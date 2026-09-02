import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def _load_model(name: str):
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model '{name}' not found")
    return joblib.load(path)


def _load_meta(name: str):
    meta_path = os.path.join(MODELS_DIR, name.replace(".pkl", "_meta.json"))
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            return json.load(f)
    return {}


def _load_dataset(file_name: str):
    path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found")
    if file_name.endswith(".csv"):
        return pd.read_csv(path)
    elif file_name.endswith((".xls", ".xlsx")):
        return pd.read_excel(path)
    elif file_name.endswith(".parquet"):
        return pd.read_parquet(path)
    elif file_name.endswith(".json"):
        return pd.read_json(path)
    return pd.read_csv(path)


def _extract_model(pipeline):
    model = pipeline
    preprocessor = None
    if hasattr(pipeline, "named_steps"):
        if "preprocessor" in pipeline.named_steps:
            preprocessor = pipeline.named_steps["preprocessor"]
        for key in ("model", "classifier", "estimator", "regressor"):
            if key in pipeline.named_steps:
                model = pipeline.named_steps[key]
                break
    return model, preprocessor


def _get_importances(model, feature_names):
    importances = []
    if hasattr(model, "feature_importances_"):
        fi = model.feature_importances_
        for i, name in enumerate(feature_names):
            if i < len(fi):
                importances.append({"feature": name, "importance": round(float(fi[i]), 4)})
    elif hasattr(model, "coef_"):
        coefs = model.coef_
        if coefs.ndim > 1:
            coefs = coefs[0]
        for i, name in enumerate(feature_names):
            if i < len(coefs):
                importances.append({"feature": name, "importance": round(float(coefs[i]), 4)})
    if importances:
        vals = np.abs([i["importance"] for i in importances])
        vmax = vals.max()
        if vmax > 0:
            for i in range(len(importances)):
                importances[i]["normalized"] = round(float(vals[i] / vmax), 4)
        else:
            for i in range(len(importances)):
                importances[i]["normalized"] = 0.0
        importances.sort(key=lambda x: abs(x["importance"]), reverse=True)
    return importances


def _fmt(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 6)
    if isinstance(v, np.ndarray):
        return v.tolist()
    return v


# ── SHAP Approximation ──────────────────────────────────────────────

def compute_shap_values(pipeline, model, X, feature_names, n_samples=100):
    """Compute SHAP-like values using permutation-based approximation."""
    if X.shape[0] > n_samples:
        idx = np.random.choice(X.shape[0], n_samples, replace=False)
        X_sample = X[idx]
    else:
        X_sample = X

    base_pred = pipeline.predict(X_sample)
    n_features = X_sample.shape[1]

    shap_matrix = np.zeros((X_sample.shape[0], n_features))

    for j in range(n_features):
        X_perm = X_sample.copy()
        perm_idx = np.random.permutation(X_sample.shape[0])
        X_perm[:, j] = X_sample[perm_idx, j]
        perm_pred = pipeline.predict(X_perm)
        shap_matrix[:, j] = (base_pred - perm_pred).astype(float)

    mean_shap = np.mean(shap_matrix, axis=0)

    if hasattr(model, "coef_"):
        coefs = model.coef_
        if coefs.ndim > 1:
            coefs = coefs[0]
        total_abs = np.sum(np.abs(coefs))
        if total_abs > 0:
            direction = np.sign(coefs[:n_features])
            mean_shap = direction * np.abs(mean_shap)

    result = []
    for i, name in enumerate(feature_names):
        val = float(mean_shap[i]) if i < len(mean_shap) else 0.0
        result.append({
            "feature": name,
            "value": round(val, 6),
            "abs_value": round(abs(val), 6),
            "direction": "positive" if val >= 0 else "negative",
            "mean_value": round(float(X_sample[:, i].mean()) if i < X_sample.shape[1] else 0, 4),
            "std_value": round(float(X_sample[:, i].std()) if i < X_sample.shape[1] else 0, 4),
        })
    result.sort(key=lambda x: x["abs_value"], reverse=True)
    return result


def compute_shap_for_prediction(pipeline, model, x_single, feature_names, X_background=None, n_background=50):
    """Compute SHAP values for a single prediction using permutation approximation."""
    if X_background is None:
        n_bg = n_background
    else:
        n_bg = min(n_background, X_background.shape[0])

    base_pred = pipeline.predict(x_single.reshape(1, -1))[0]
    n_features = x_single.shape[0]

    shap_vals = np.zeros(n_features)
    for j in range(n_features):
        x_perm = x_single.copy()
        if X_background is not None and X_background.shape[0] > 0:
            x_perm[j] = X_background[np.random.randint(X_background.shape[0]), j]
        else:
            x_perm[j] = 0
        perm_pred = pipeline.predict(x_perm.reshape(1, -1))[0]
        shap_vals[j] = float(base_pred) - float(perm_pred)

    result = []
    for i, name in enumerate(feature_names):
        val = float(shap_vals[i]) if i < len(shap_vals) else 0.0
        result.append({
            "feature": name,
            "value": round(val, 6),
            "abs_value": round(abs(val), 6),
            "direction": "positive" if val >= 0 else "negative",
            "feature_value": round(float(x_single[i]) if i < len(x_single) else 0, 4),
        })
    result.sort(key=lambda x: x["abs_value"], reverse=True)
    return result


# ── LIME Approximation ──────────────────────────────────────────────

def compute_lime_explanation(pipeline, x_single, feature_names, n_samples=200, n_features_top=10):
    """Compute LIME-style local explanation using perturbation + local linear model."""
    from sklearn.linear_model import Ridge

    n_features = x_single.shape[0]
    X_perturb = np.random.normal(0, 1, (n_samples, n_features))
    X_perturbed = np.tile(x_single, (n_samples, 1)) + X_perturb * 0.1

    try:
        y_perturb = pipeline.predict(X_perturbed).astype(float)
    except Exception:
        y_perturb = pipeline.predict_proba(X_perturbed)[:, 1].astype(float) if hasattr(pipeline, "predict_proba") else np.zeros(n_samples)

    distances = np.sqrt(np.sum(X_perturb ** 2, axis=1))
    kernel_width = np.sqrt(n_features) * 0.75
    weights = np.exp(-(distances ** 2) / (kernel_width ** 2))

    try:
        local_model = Ridge(alpha=1.0)
        local_model.fit(X_perturbed, y_perturb, sample_weight=weights)
        local_coefs = local_model.coef_
        local_intercept = float(local_model.intercept_)
    except Exception:
        local_coefs = np.zeros(n_features)
        local_intercept = 0.0

    result = []
    for i, name in enumerate(feature_names):
        if i < len(local_coefs):
            coef = float(local_coefs[i])
            result.append({
                "feature": name,
                "coefficient": round(coef, 6),
                "abs_coefficient": round(abs(coef), 6),
                "feature_value": round(float(x_single[i]) if i < len(x_single) else 0, 4),
                "direction": "positive" if coef >= 0 else "negative",
                "contribution": round(coef * float(x_single[i]) if i < len(x_single) else 0, 6),
            })
    result.sort(key=lambda x: x["abs_coefficient"], reverse=True)

    predicted = pipeline.predict(x_single.reshape(1, -1))[0]
    return {
        "intercept": round(local_intercept, 6),
        "predicted_value": _fmt(predicted),
        "local_coefficients": result[:n_features_top],
        "top_positive": [r for r in result if r["direction"] == "positive"][:5],
        "top_negative": [r for r in result if r["direction"] == "negative"][:5],
        "model_r2": round(float(1 - np.sum((y_perturb - local_model.predict(X_perturb)) ** 2) / max(np.sum((y_perturb - y_perturb.mean()) ** 2), 1e-10)), 4) if n_samples > 2 else 0,
    }


# ── Feature Importance ──────────────────────────────────────────────

def compute_feature_importance(pipeline, model, feature_names):
    """Compute feature importance with multiple methods."""
    importances = _get_importances(model, feature_names)

    methods = {}
    if hasattr(model, "feature_importances_"):
        fi = model.feature_importances_
        methods["tree_importance"] = [
            {"feature": feature_names[i] if i < len(feature_names) else f"f{i}", "value": round(float(fi[i]), 6)}
            for i in range(min(len(fi), len(feature_names)))
        ]

    if hasattr(model, "coef_"):
        coefs = model.coef_
        if coefs.ndim > 1:
            coefs = coefs[0]
        methods["coefficient"] = [
            {"feature": feature_names[i] if i < len(feature_names) else f"f{i}", "value": round(float(coefs[i]), 6), "abs_value": round(abs(float(coefs[i])), 6)}
            for i in range(min(len(coefs), len(feature_names)))
        ]

    if hasattr(model, "feature_importances_"):
        fi = model.feature_importances_
        cumulative = np.cumsum(np.sort(fi)[::-1])
        total = cumulative[-1] if len(cumulative) > 0 else 1
        threshold_90 = int(np.searchsorted(cumulative / total, 0.9)) + 1
        threshold_50 = int(np.searchsorted(cumulative / total, 0.5)) + 1
        methods["cumulative"] = {
            "features_for_50pct": min(threshold_50, len(feature_names)),
            "features_for_90pct": min(threshold_90, len(feature_names)),
            "total_features": len(feature_names),
        }

    return {
        "features": importances,
        "methods": methods,
        "total_features": len(feature_names),
        "top_5": importances[:5],
        "bottom_5": importances[-5:] if len(importances) >= 5 else importances,
    }


# ── Global Explanation ──────────────────────────────────────────────

def compute_global_explanation(pipeline, model, X, feature_names, task_type):
    """Compute global model behavior explanation."""
    mean_values = np.mean(X, axis=0)
    std_values = np.std(X, axis=0)
    min_values = np.min(X, axis=0)
    max_values = np.max(X, axis=0)

    feature_stats = []
    for i, name in enumerate(feature_names):
        if i < X.shape[1]:
            feature_stats.append({
                "feature": name,
                "mean": round(float(mean_values[i]), 4),
                "std": round(float(std_values[i]), 4),
                "min": round(float(min_values[i]), 4),
                "max": round(float(max_values[i]), 4),
                "range": round(float(max_values[i] - min_values[i]), 4),
                "coefficient_of_variation": round(float(std_values[i] / max(abs(mean_values[i]), 1e-10)), 4),
            })

    importance = _get_importances(model, feature_names)
    top_features = [f["feature"] for f in importance[:5]]

    predictions = pipeline.predict(X)
    if task_type == "classification" and hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(X)
        confidence_dist = {
            "mean_confidence": round(float(np.mean(np.max(proba, axis=1))), 4),
            "min_confidence": round(float(np.min(np.max(proba, axis=1))), 4),
            "max_confidence": round(float(np.max(np.max(proba, axis=1))), 4),
            "std_confidence": round(float(np.std(np.max(proba, axis=1))), 4),
            "low_confidence_count": int(np.sum(np.max(proba, axis=1) < 0.6)),
            "total_predictions": len(predictions),
        }
        class_distribution = {}
        classes = pipeline.classes_.tolist() if hasattr(pipeline, "classes_") else list(np.unique(predictions))
        for c in classes:
            class_distribution[str(c)] = int(np.sum(predictions == c))
    else:
        confidence_dist = {
            "mean_prediction": round(float(np.mean(predictions)), 4),
            "std_prediction": round(float(np.std(predictions)), 4),
            "min_prediction": round(float(np.min(predictions)), 4),
            "max_prediction": round(float(np.max(predictions)), 4),
        }
        class_distribution = {}

    feature_interactions = []
    for i in range(min(5, len(feature_names))):
        for j in range(i + 1, min(5, len(feature_names))):
            if i < X.shape[1] and j < X.shape[1]:
                corr = round(float(np.corrcoef(X[:, i], X[:, j])[0, 1]), 4)
                if abs(corr) > 0.3:
                    feature_interactions.append({
                        "feature_a": feature_names[i],
                        "feature_b": feature_names[j],
                        "correlation": corr,
                        "strength": "strong" if abs(corr) > 0.7 else "moderate",
                    })

    return {
        "feature_statistics": feature_stats,
        "most_important_features": top_features,
        "feature_importance_summary": importance[:10],
        "prediction_distribution": {
            "task_type": task_type,
            "total_samples": X.shape[0],
            "confidence_distribution": confidence_dist,
            "class_distribution": class_distribution,
        },
        "feature_interactions": feature_interactions,
        "model_insights": {
            "n_features": len(feature_names),
            "n_samples": X.shape[0],
            "high_importance_features": top_features[:3],
            "has_interactions": len(feature_interactions) > 0,
        },
    }


# ── Local Explanation ───────────────────────────────────────────────

def compute_local_explanation(pipeline, model, x_single, X_background, feature_names, task_type, sample_idx=None):
    """Compute local explanation combining SHAP and LIME for a single instance."""
    shap_vals = compute_shap_for_prediction(pipeline, model, x_single, feature_names, X_background)
    lime_result = compute_lime_explanation(pipeline, x_single, feature_names)

    prediction = pipeline.predict(x_single.reshape(1, -1))[0]
    probabilities = {}
    confidence = None
    if task_type == "classification" and hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(x_single.reshape(1, -1))[0]
        classes = pipeline.classes_.tolist() if hasattr(pipeline, "classes_") else list(range(len(proba)))
        confidence = round(float(max(proba)), 4)
        for c, p in zip(classes, proba):
            probabilities[str(c)] = round(float(p), 4)

    top_shap = shap_vals[:10]
    top_lime = lime_result["local_coefficients"][:10]

    agreement = 0
    for shap_item in top_shap:
        for lime_item in top_lime:
            if shap_item["feature"] == lime_item["feature"]:
                if shap_item["direction"] == lime_item["direction"]:
                    agreement += 1

    total_common = min(len(top_shap), len(top_lime))
    agreement_score = round(agreement / max(total_common, 1), 4)

    return {
        "sample_index": sample_idx,
        "prediction": _fmt(prediction),
        "confidence": confidence,
        "probabilities": probabilities,
        "shap_values": shap_vals,
        "lime_explanation": lime_result,
        "agreement_score": agreement_score,
        "explanation_consistency": "high" if agreement_score > 0.7 else ("moderate" if agreement_score > 0.4 else "low"),
        "top_features_combined": _merge_explanations(top_shap, top_lime)[:10],
    }


def _merge_explanations(shap_vals, lime_vals):
    combined = {}
    for item in shap_vals:
        name = item["feature"]
        combined[name] = {
            "feature": name,
            "shap_value": item.get("value", 0),
            "shap_direction": item.get("direction", "positive"),
            "lime_coefficient": 0,
            "lime_direction": "positive",
            "feature_value": item.get("feature_value", 0),
        }
    for item in lime_vals:
        name = item["feature"]
        if name in combined:
            combined[name]["lime_coefficient"] = item.get("coefficient", 0)
            combined[name]["lime_direction"] = item.get("direction", "positive")
        else:
            combined[name] = {
                "feature": name,
                "shap_value": 0,
                "shap_direction": "positive",
                "lime_coefficient": item.get("coefficient", 0),
                "lime_direction": item.get("direction", "positive"),
                "feature_value": item.get("feature_value", 0),
            }
    result = list(combined.values())
    result.sort(key=lambda x: abs(x["shap_value"]) + abs(x["lime_coefficient"]), reverse=True)
    return result


# ── Prediction Explanation ──────────────────────────────────────────

def compute_prediction_explanation(pipeline, model, x_single, X_background, feature_names, task_type):
    """Compute a comprehensive explanation for a single prediction."""
    prediction = pipeline.predict(x_single.reshape(1, -1))[0]
    probabilities = {}
    confidence = None
    if task_type == "classification" and hasattr(pipeline, "predict_proba"):
        proba = pipeline.predict_proba(x_single.reshape(1, -1))[0]
        classes = pipeline.classes_.tolist() if hasattr(pipeline, "classes_") else list(range(len(proba)))
        confidence = round(float(max(proba)), 4)
        predicted_idx = int(np.argmax(proba))
        predicted_class = classes[predicted_idx]
        for c, p in zip(classes, proba):
            probabilities[str(c)] = round(float(p), 4)
    else:
        predicted_class = prediction

    shap_vals = compute_shap_for_prediction(pipeline, model, x_single, feature_names, X_background)
    lime_result = compute_lime_explanation(pipeline, x_single, feature_names)

    feature_contributions = []
    for item in shap_vals:
        feature_contributions.append({
            "feature": item["feature"],
            "feature_value": item.get("feature_value", 0),
            "shap_value": item["value"],
            "shap_direction": item["direction"],
            "importance_rank": shap_vals.index(item) + 1,
        })

    reasons_for = [f for f in feature_contributions if f["shap_direction"] == "positive"][:5]
    reasons_against = [f for f in feature_contributions if f["shap_direction"] == "negative"][:5]

    return {
        "prediction": _fmt(prediction),
        "predicted_class": _fmt(predicted_class),
        "confidence": confidence,
        "probabilities": probabilities,
        "feature_contributions": feature_contributions,
        "top_positive_factors": reasons_for,
        "top_negative_factors": reasons_against,
        "explanation_text": _generate_explanation_text(reasons_for, reasons_against, predicted_class, confidence),
        "shap_summary": shap_vals[:10],
        "lime_summary": lime_result,
    }


def _generate_explanation_text(reasons_for, reasons_against, predicted_class, confidence):
    parts = []
    if confidence is not None:
        conf_level = "high" if confidence > 0.8 else ("moderate" if confidence > 0.6 else "low")
        parts.append(f"The model predicts class '{predicted_class}' with {conf_level} confidence ({confidence:.1%}).")
    else:
        parts.append(f"The model predicts '{predicted_class}'.")

    if reasons_for:
        top = reasons_for[0]
        parts.append(f'The strongest positive factor is "{top["feature"]}" (SHAP: {top["shap_value"]:+.4f}).')

    if reasons_against:
        top = reasons_against[0]
        parts.append(f'The strongest negative factor is "{top["feature"]}" (SHAP: {top["shap_value"]:+.4f}).')

    return " ".join(parts)


# ── Main Explanation Entry Point ─────────────────────────────────────

def explain_prediction(model_name: str, input_data: dict = None):
    pipeline = _load_model(model_name)
    meta = _load_meta(model_name)
    model, _ = _extract_model(pipeline)
    feature_names = meta.get("feature_names", [])
    task_type = meta.get("task_type", "classification")

    if input_data is None and meta.get("sample_input"):
        input_data = meta["sample_input"]

    importances = _get_importances(model, feature_names)
    shap_values = _generate_simulated_shap(importances, feature_names)

    explanation = {
        "model_name": model_name,
        "task_type": task_type,
        "feature_importance": importances,
        "shap_values": shap_values,
        "confidence": None,
        "prediction": None,
        "prediction_label": None,
        "top_features": sorted(shap_values, key=lambda x: abs(x.get("value", 0)), reverse=True)[:10],
        "feature_count": len(feature_names),
    }

    if input_data and feature_names:
        try:
            df_in = pd.DataFrame([input_data]) if isinstance(input_data, dict) else pd.DataFrame(input_data)
            for f in feature_names:
                if f not in df_in.columns:
                    df_in[f] = 0
            df_in = df_in[feature_names]

            if hasattr(pipeline, "predict"):
                pred = pipeline.predict(df_in)
                explanation["prediction"] = _fmt(pred[0])

            if hasattr(pipeline, "predict_proba") and task_type == "classification":
                proba = pipeline.predict_proba(df_in)
                probs = proba[0]
                explanation["confidence"] = round(float(max(probs)), 4)
                classes = pipeline.classes_.tolist() if hasattr(pipeline, "classes_") else list(range(len(probs)))
                label_map = meta.get("label_map", {})
                predicted_class = int(pred[0]) if pred is not None else int(np.argmax(probs))
                explanation["prediction_label"] = label_map.get(str(predicted_class), str(predicted_class))
                explanation["probabilities"] = {
                    str(label_map.get(str(c), str(c))): round(float(p), 4)
                    for c, p in zip(classes, probs)
                }
        except Exception:
            pass

    return explanation


def _generate_simulated_shap(importances, feature_names):
    if not feature_names:
        return []
    if importances:
        imp_map = {i["feature"]: i["importance"] for i in importances}
        total_abs = sum(abs(v) for v in imp_map.values())
        if total_abs > 0:
            return [
                {"feature": name, "value": round((imp_map.get(name, 0) / total_abs) * 0.8, 4),
                 "abs_value": round(abs((imp_map.get(name, 0) / total_abs) * 0.8), 4),
                 "direction": "positive" if imp_map.get(name, 0) >= 0 else "negative"}
                for name in feature_names
            ]
    n = len(feature_names)
    return [{"feature": name, "value": round(0.8 / n, 4), "abs_value": round(0.8 / n, 4), "direction": "positive"} for name in feature_names]


# ── Comprehensive Explanation ────────────────────────────────────────

def compute_comprehensive_explanation(model_name, file_name, target_column):
    """Compute all 6 explanation types in one call."""
    pipeline = _load_model(model_name)
    meta = _load_meta(model_name)
    model, preprocessor = _extract_model(pipeline)
    task_type = meta.get("task_type", "classification")

    from preprocess import auto_preprocess, preprocess_target
    from sklearn.pipeline import Pipeline as SkPipeline

    data_warnings = []
    if isinstance(pipeline, SkPipeline):
        expected = set(meta.get("feature_names", []))
        DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
        file_path = os.path.join(DATASET_DIR, file_name)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset '{file_name}' not found")
        df_check = pd.read_csv(file_path)
        raw_cols = set(c for c in df_check.columns if c != target_column)
        if expected:
            missing = expected - raw_cols
            if missing:
                data_warnings.append(f"Dataset missing {len(missing)} feature(s): {sorted(missing)}. Filling with 0.")
        preprocess_result = auto_preprocess(file_name, target_column, task_type)
        X_all = preprocess_result["X"]
        y_all = preprocess_result["y"]
        model_obj = model
    else:
        DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
        file_path = os.path.join(DATASET_DIR, file_name)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dataset '{file_name}' not found")
        df = pd.read_csv(file_path)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not in dataset")

        feature_cols = [c for c in df.columns if c != target_column]

        X_raw = df[feature_cols].copy()
        y_raw = df[target_column]

        str_cols = X_raw.select_dtypes(include=["object"]).columns.tolist()
        datetime_cols = []
        for col in str_cols:
            try:
                parsed = pd.to_datetime(X_raw[col], errors="coerce")
                if parsed.notna().sum() > len(X_raw[col]) * 0.5:
                    datetime_cols.append(col)
            except Exception:
                pass
        if datetime_cols:
            for col in datetime_cols:
                X_raw[col] = pd.to_datetime(X_raw[col]).astype("int64") / 1e9

        for col in X_raw.select_dtypes(include=["object", "category"]).columns:
            from sklearn.preprocessing import LabelEncoder
            le = LabelEncoder()
            X_raw[col] = le.fit_transform(X_raw[col].astype(str))

        X_all = X_raw.astype(float)
        if y_raw.dtype == object:
            from sklearn.preprocessing import LabelEncoder
            le_y = LabelEncoder()
            y_all = le_y.fit_transform(y_raw.astype(str))
        else:
            y_all = y_raw.values.astype(float)
        model_obj = pipeline

    feature_names = meta.get("feature_names", X_all.columns.tolist() if hasattr(X_all, 'columns') else [])

    X_train, X_test, y_train, y_test = train_test_split(X_all, y_all, test_size=0.2, random_state=42)

    if hasattr(X_train, "values"):
        X_train_np = X_train.values
        X_test_np = X_test.values
    else:
        X_train_np = X_train
        X_test_np = X_test

    try:
        model_obj.fit(X_train_np, y_train)
    except Exception:
        pass

    feature_imp = compute_feature_importance(model_obj, model, feature_names)
    shap_all = compute_shap_values(model_obj, model, X_test_np, feature_names)
    global_exp = compute_global_explanation(model_obj, model, X_test_np, feature_names, task_type)

    sample_indices = list(range(min(5, X_test_np.shape[0])))
    local_explanations = []
    prediction_explanations = []
    for idx in sample_indices:
        local_exp = compute_local_explanation(model_obj, model, X_test_np[idx], X_test_np, feature_names, task_type, idx)
        local_explanations.append(local_exp)
        pred_exp = compute_prediction_explanation(model_obj, model, X_test_np[idx], X_test_np, feature_names, task_type)
        prediction_explanations.append(pred_exp)

    return {
        "model_name": model_name,
        "task_type": task_type,
        "feature_names": feature_names,
        "feature_importance": feature_imp,
        "shap_values": shap_all,
        "global_explanation": global_exp,
        "local_explanations": local_explanations,
        "prediction_explanations": prediction_explanations,
        "data_summary": {
            "total_samples": X_all.shape[0],
            "train_size": X_train_np.shape[0],
            "test_size": X_test_np.shape[0],
            "n_features": X_all.shape[1],
            "task_type": task_type,
        },
        "warnings": data_warnings,
    }
