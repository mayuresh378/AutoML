import os
import json
import math
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, learning_curve, validation_curve
from sklearn.metrics import (
    confusion_matrix, roc_curve, auc, precision_recall_curve, average_precision_score,
    accuracy_score, precision_score, recall_score, f1_score, log_loss,
    matthews_corrcoef, cohen_kappa_score,
    mean_absolute_error, mean_squared_error, r2_score,
)
from sklearn.pipeline import Pipeline
from preprocess import auto_preprocess, preprocess_target

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def _load_model(name):
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model '{name}' not found")
    return joblib.load(path)


def _load_meta(name):
    meta_path = os.path.join(MODELS_DIR, name.replace(".pkl", "_meta.json"))
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            return json.load(f)
    return {}


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


def _fmt(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 6)
    if isinstance(v, np.ndarray):
        return v.tolist()
    return v


def _sanitize_nan(obj):
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _sanitize_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_sanitize_nan(v) for v in obj]
    if isinstance(obj, (np.floating, np.float64)):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else round(v, 6)
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.ndarray):
        return _sanitize_nan(obj.tolist())
    return obj


def _prepare_data(file_name, target_column, pipeline, meta, task_type):
    warnings = []
    file_path = os.path.join(DATASET_DIR, file_name)
    df = pd.read_csv(file_path)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset. Available: {list(df.columns)}")

    y_raw = df[target_column]
    X_raw = df.drop(columns=[target_column])

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
        X_raw = X_raw.drop(columns=datetime_cols)

    if task_type == "classification":
        y_processed = preprocess_target(y_raw, task_type)
    else:
        try:
            y_processed = y_raw.values.astype(float)
        except (ValueError, TypeError):
            try:
                y_processed = pd.to_datetime(y_raw).astype(int).values.astype(float)
            except Exception:
                raise ValueError(f"Target column '{target_column}' cannot be converted to numeric values for regression")

    if isinstance(pipeline, Pipeline):
        expected = meta.get("feature_names", [])
        if expected:
            expected_set = set(expected)
            raw_cols = set(X_raw.columns)
            missing = expected_set - raw_cols
            extra = raw_cols - expected_set

            if missing:
                warnings.append(f"Dataset missing {len(missing)} feature(s) required by model: {sorted(missing)}. Filling with 0.")
                for col in missing:
                    X_raw[col] = 0.0

            if extra:
                warnings.append(f"Dataset has {len(extra)} extra feature(s) not used by model: {sorted(extra)}. Ignoring them.")

            X_raw = X_raw[[c for c in expected if c in X_raw.columns]]

        model_obj = pipeline
        X_for_split = X_raw
    else:
        preprocess_result = auto_preprocess(file_name, target_column, task_type)
        X_for_split = preprocess_result["X"]
        y_processed = preprocess_result["y"]
        model_obj = Pipeline([("preprocessor", preprocess_result["preprocessor"]), ("model", pipeline)])

    return X_for_split, y_processed, model_obj, warnings


def _split_data(X, y, task_type):
    return train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if task_type == "classification" else None,
    )


def _compute_classification_metrics(y_test, y_pred, y_proba, n_classes):
    metrics = {}
    metrics["accuracy"] = round(float(accuracy_score(y_test, y_pred)), 4)
    try:
        metrics["precision"] = round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
    except Exception:
        metrics["precision"] = None
    try:
        metrics["recall"] = round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
    except Exception:
        metrics["recall"] = None
    try:
        metrics["f1"] = round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4)
    except Exception:
        metrics["f1"] = None
    try:
        metrics["mcc"] = round(float(matthews_corrcoef(y_test, y_pred)), 4)
    except Exception:
        metrics["mcc"] = None
    try:
        metrics["cohen_kappa"] = round(float(cohen_kappa_score(y_test, y_pred)), 4)
    except Exception:
        metrics["cohen_kappa"] = None
    if y_proba is not None:
        try:
            if n_classes == 2:
                metrics["log_loss"] = round(float(log_loss(y_test, y_proba)), 4)
            else:
                metrics["log_loss"] = round(float(log_loss(y_test, y_proba)), 4)
        except Exception:
            metrics["log_loss"] = None
    return metrics


def _compute_regression_metrics(y_test, y_pred):
    metrics = {}
    metrics["mae"] = round(float(mean_absolute_error(y_test, y_pred)), 4)
    metrics["mse"] = round(float(mean_squared_error(y_test, y_pred)), 4)
    metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
    metrics["r2"] = round(float(r2_score(y_test, y_pred)), 4)
    try:
        y_test_arr = np.array(y_test, dtype=float)
        mask = y_test_arr != 0
        if mask.sum() > 0:
            mape = float(np.mean(np.abs((y_test_arr[mask] - np.array(y_pred, dtype=float)[mask]) / y_test_arr[mask])) * 100)
            metrics["mape"] = round(mape, 4)
        else:
            metrics["mape"] = None
    except Exception:
        metrics["mape"] = None
    return metrics


def compute_confusion_matrix(model_obj, X_test, y_test, task_type, meta):
    if task_type != "classification":
        return None
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    y_pred = model_obj.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)))
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]
    cm = confusion_matrix(y_test_list, y_pred_list, labels=labels)
    return {"matrix": cm.tolist(), "labels": str_labels}


def compute_roc_curve(model_obj, X_test, y_test, task_type, meta):
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    y_pred = model_obj.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)))
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]

    if task_type != "classification" or not hasattr(model_obj, "predict_proba"):
        return None

    y_proba = model_obj.predict_proba(X_test)

    if len(labels) == 2:
        fpr, tpr, _ = roc_curve(y_test_list, y_proba[:, 1], pos_label=labels[1])
        return {
            "fpr": [round(float(x), 4) for x in fpr],
            "tpr": [round(float(x), 4) for x in tpr],
            "auc": round(float(auc(fpr, tpr)), 4),
        }
    else:
        from sklearn.preprocessing import label_binarize
        y_test_bin = label_binarize(y_test_list, classes=labels)
        per_class_roc = []
        all_auc_vals = []
        for ci in range(len(labels)):
            fpr_i, tpr_i, _ = roc_curve(y_test_bin[:, ci], y_proba[:, ci])
            auc_i = round(float(auc(fpr_i, tpr_i)), 4)
            all_auc_vals.append(auc_i)
            per_class_roc.append({
                "label": str_labels[ci],
                "fpr": [round(float(x), 4) for x in fpr_i],
                "tpr": [round(float(x), 4) for x in tpr_i],
                "auc": auc_i,
            })
        return {"per_class": per_class_roc, "macro_auc": round(float(np.mean(all_auc_vals)), 4)}


def compute_pr_curve(model_obj, X_test, y_test, task_type, meta):
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    y_pred = model_obj.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)))
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]

    if task_type != "classification" or not hasattr(model_obj, "predict_proba"):
        return None

    y_proba = model_obj.predict_proba(X_test)

    if len(labels) == 2:
        prec_arr, rec_arr, _ = precision_recall_curve(y_test_list, y_proba[:, 1], pos_label=labels[1])
        return {
            "precision": [round(float(x), 4) for x in prec_arr],
            "recall": [round(float(x), 4) for x in rec_arr],
            "average_precision": round(float(average_precision_score(y_test_list, y_proba[:, 1])), 4),
        }
    else:
        from sklearn.preprocessing import label_binarize
        y_test_bin = label_binarize(y_test_list, classes=labels)
        per_class_pr = []
        all_ap_vals = []
        for ci in range(len(labels)):
            p_i, r_i, _ = precision_recall_curve(y_test_bin[:, ci], y_proba[:, ci])
            ap_i = round(float(average_precision_score(y_test_bin[:, ci], y_proba[:, ci])), 4)
            all_ap_vals.append(ap_i)
            per_class_pr.append({
                "label": str_labels[ci],
                "precision": [round(float(x), 4) for x in p_i],
                "recall": [round(float(x), 4) for x in r_i],
                "ap": ap_i,
            })
        return {"per_class": per_class_pr, "macro_ap": round(float(np.mean(all_ap_vals)), 4)}


def compute_learning_curve(pipeline, X, y, task_type):
    try:
        train_sizes_abs, train_scores, val_scores = learning_curve(
            pipeline, X, y,
            train_sizes=np.linspace(0.1, 1.0, 10),
            cv=min(5, len(y) // 2) if len(y) >= 10 else 2,
            scoring="accuracy" if task_type == "classification" else "r2",
            n_jobs=-1,
            random_state=42,
        )
        return {
            "train_sizes": [int(x) for x in train_sizes_abs],
            "train_mean": [round(float(x), 4) for x in np.mean(train_scores, axis=1)],
            "train_std": [round(float(x), 4) for x in np.std(train_scores, axis=1)],
            "val_mean": [round(float(x), 4) for x in np.mean(val_scores, axis=1)],
            "val_std": [round(float(x), 4) for x in np.std(val_scores, axis=1)],
            "scoring": "accuracy" if task_type == "classification" else "r2",
        }
    except Exception as e:
        return {"error": str(e)}


def compute_validation_curve(pipeline, X, y, task_type, estimator):
    param_name = None
    param_range = None
    inner_model = estimator

    if hasattr(estimator, "n_estimators"):
        param_name = "model__n_estimators"
        param_range = [10, 25, 50, 75, 100, 150, 200]
    elif hasattr(estimator, "C"):
        param_name = "model__C"
        param_range = [0.01, 0.1, 1, 10, 100]
    elif hasattr(estimator, "max_depth"):
        param_name = "model__max_depth"
        param_range = [2, 3, 5, 7, 10, 15]
    elif hasattr(estimator, "n_neighbors"):
        param_name = "model__n_neighbors"
        param_range = [3, 5, 7, 9, 11, 15, 21]

    if param_name is None:
        return {"error": "No tunable hyperparameter found for validation curve"}

    if not isinstance(pipeline, Pipeline):
        param_name = param_name.replace("model__", "")

    try:
        valid_range = [p for p in param_range if p is not None]
        if len(valid_range) < 2:
            return {"error": "Insufficient parameter range for validation curve"}
        if param_name.endswith("max_depth"):
            valid_range = [2, 3, 5, 7, 10, 15]

        train_scores, val_scores = validation_curve(
            pipeline, X, y,
            param_name=param_name,
            param_range=valid_range,
            cv=min(5, len(y) // 2) if len(y) >= 10 else 2,
            scoring="accuracy" if task_type == "classification" else "r2",
            n_jobs=-1,
        )
        return {
            "param_name": param_name.split("__")[-1] if "__" in param_name else param_name,
            "param_range": [str(p) for p in valid_range],
            "train_mean": [round(float(x), 4) for x in np.mean(train_scores, axis=1)],
            "train_std": [round(float(x), 4) for x in np.std(train_scores, axis=1)],
            "val_mean": [round(float(x), 4) for x in np.mean(val_scores, axis=1)],
            "val_std": [round(float(x), 4) for x in np.std(val_scores, axis=1)],
            "scoring": "accuracy" if task_type == "classification" else "r2",
        }
    except Exception as e:
        return {"error": str(e)}


def compute_residual_plot(model_obj, X_test, y_test, task_type):
    if task_type == "classification":
        return None
    y_pred = model_obj.predict(X_test)
    residuals = y_test - y_pred
    indices = np.random.choice(len(residuals), min(500, len(residuals)), replace=False) if len(residuals) > 500 else np.arange(len(residuals))
    return {
        "predicted": [round(float(y_pred[i]), 4) for i in indices],
        "residuals": [round(float(residuals[i]), 4) for i in indices],
        "actual": [round(float(y_test[i]), 4) for i in indices],
        "mean_residual": round(float(np.mean(residuals)), 4),
        "std_residual": round(float(np.std(residuals)), 4),
    }


def compute_prediction_distribution(y_test, y_pred, task_type):
    if task_type == "classification":
        unique, counts = np.unique(y_pred, return_counts=True)
        total = len(y_pred)
        return {
            "type": "classification",
            "predictions": [{"label": str(u), "count": int(c), "pct": round(float(c / total) * 100, 1)} for u, c in zip(unique, counts)],
            "total": total,
        }
    else:
        return {
            "type": "regression",
            "predictions": [round(float(x), 4) for x in y_pred[:500]],
            "actual": [round(float(x), 4) for x in y_test[:500]],
            "mean": round(float(np.mean(y_pred)), 4),
            "std": round(float(np.std(y_pred)), 4),
            "min": round(float(np.min(y_pred)), 4),
            "max": round(float(np.max(y_pred)), 4),
        }


def compute_feature_importance(model, feature_names):
    importances = []
    importances_arr = None
    if hasattr(model, "feature_importances_"):
        importances_arr = model.feature_importances_
    elif hasattr(model, "coef_"):
        coefs = model.coef_
        importances_arr = coefs[0] if coefs.ndim > 1 else coefs

    if importances_arr is not None and feature_names:
        abs_imp = np.abs(importances_arr)
        vmax = abs_imp.max()
        for i, fname in enumerate(feature_names):
            if i < len(importances_arr):
                importances.append({
                    "feature": fname,
                    "importance": round(float(importances_arr[i]), 6),
                    "normalized": round(float(abs_imp[i] / vmax), 4) if vmax > 0 else 0,
                })
        importances.sort(key=lambda x: abs(x["importance"]), reverse=True)
    return importances


def compute_prediction_samples(model_obj, X_test, y_test, y_proba, task_type, meta, n_samples=20):
    label_map = meta.get("label_map") or {}
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    y_pred_list = model_obj.predict(X_test).tolist()

    n = min(n_samples, len(y_test_list))
    indices = np.random.choice(len(y_test_list), n, replace=False) if len(y_test_list) > n else np.arange(len(y_test_list))

    samples = []
    for i in indices:
        actual = y_test_list[i]
        predicted = y_pred_list[i]
        if task_type == "classification":
            actual_label = label_map.get(str(actual), str(actual))
            predicted_label = label_map.get(str(predicted), str(predicted))
            prob = None
            if y_proba is not None:
                prob = {label_map.get(str(c), str(c)): round(float(y_proba[i][j]), 4)
                        for j, c in enumerate(sorted(set(y_test_list)))}
            samples.append({
                "actual": actual_label,
                "predicted": predicted_label,
                "correct": actual == predicted,
                "probability": prob,
            })
        else:
            samples.append({
                "actual": round(float(actual), 4),
                "predicted": round(float(predicted), 4),
                "residual": round(float(actual - predicted), 4),
            })
    return samples


def compute_class_distribution(y_test, task_type):
    if task_type != "classification":
        return None
    unique, counts = np.unique(y_test, return_counts=True)
    total = len(y_test)
    return [{"label": str(u), "count": int(c), "pct": round(float(c / total) * 100, 1)} for u, c in zip(unique, counts)]


def evaluate_model_comprehensive(model_name, file_name, target_column):
    pipeline = _load_model(model_name)
    meta = _load_meta(model_name)
    model, preprocessor = _extract_model(pipeline)
    task_type = meta.get("task_type", "classification")
    feature_names = meta.get("feature_names", [])

    X_for_split, y_processed, model_obj, data_warnings = _prepare_data(file_name, target_column, pipeline, meta, task_type)
    X_train, X_test, y_train, y_test = _split_data(X_for_split, y_processed, task_type)

    y_pred = model_obj.predict(X_test)
    y_proba = None
    if task_type == "classification" and hasattr(model_obj, "predict_proba"):
        try:
            y_proba = model_obj.predict_proba(X_test)
        except Exception:
            pass

    n_classes = len(np.unique(y_test)) if task_type == "classification" else 0
    if task_type == "classification":
        metrics = _compute_classification_metrics(y_test, y_pred, y_proba, n_classes)
    else:
        metrics = _compute_regression_metrics(y_test, y_pred)

    roc = compute_roc_curve(model_obj, X_test, y_test, task_type, meta)
    if roc and task_type == "classification":
        if "auc" in roc:
            metrics["roc_auc"] = roc["auc"]
        elif "macro_auc" in roc:
            metrics["roc_auc"] = roc["macro_auc"]

    result = {
        "model_name": model_name,
        "task_type": task_type,
        "feature_names": feature_names,
        "metrics": metrics,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "confusion_matrix": compute_confusion_matrix(model_obj, X_test, y_test, task_type, meta),
        "roc_curve": roc,
        "pr_curve": compute_pr_curve(model_obj, X_test, y_test, task_type, meta),
        "feature_importance": compute_feature_importance(model, feature_names),
        "learning_curve": compute_learning_curve(model_obj, X_for_split, y_processed, task_type),
        "validation_curve": compute_validation_curve(model_obj, X_for_split, y_processed, task_type, model),
        "residual_plot": compute_residual_plot(model_obj, X_test, y_test, task_type),
        "prediction_distribution": compute_prediction_distribution(y_test, y_pred, task_type),
        "prediction_samples": compute_prediction_samples(model_obj, X_test, y_test, y_proba, task_type, meta),
        "class_distribution": compute_class_distribution(y_test, task_type),
        "warnings": data_warnings,
    }

    return _sanitize_nan(result)


def compare_models(model_names, file_name, target_column):
    results = []
    for name in model_names:
        try:
            pipeline = _load_model(name)
            meta = _load_meta(name)
            model, _ = _extract_model(pipeline)
            task_type = meta.get("task_type", "classification")
            feature_names = meta.get("feature_names", [])

            X_for_split, y_processed, model_obj, data_warnings = _prepare_data(file_name, target_column, pipeline, meta, task_type)
            X_train, X_test, y_train, y_test = _split_data(X_for_split, y_processed, task_type)

            y_pred = model_obj.predict(X_test)
            y_proba = None
            if task_type == "classification" and hasattr(model_obj, "predict_proba"):
                try:
                    y_proba = model_obj.predict_proba(X_test)
                except Exception:
                    pass

            n_classes = len(np.unique(y_test)) if task_type == "classification" else 0
            if task_type == "classification":
                metrics = _compute_classification_metrics(y_test, y_pred, y_proba, n_classes)
                roc = compute_roc_curve(model_obj, X_test, y_test, task_type, meta)
                if roc:
                    if "auc" in roc:
                        metrics["roc_auc"] = roc["auc"]
                    elif "macro_auc" in roc:
                        metrics["roc_auc"] = roc["macro_auc"]
            else:
                metrics = _compute_regression_metrics(y_test, y_pred)

            training_time = meta.get("training_time")
            results.append({
                "model_name": name,
                "task_type": task_type,
                "metrics": metrics,
                "training_time": training_time,
                "feature_importance": compute_feature_importance(model, feature_names)[:10],
            })
        except Exception as e:
            results.append({
                "model_name": name,
                "error": str(e),
            })

    return _sanitize_nan(results)


def generate_ai_insights(eval_result):
    task_type = eval_result.get("task_type", "classification")
    metrics = eval_result.get("metrics", {})
    feature_importance = eval_result.get("feature_importance", [])
    model_name = eval_result.get("model_name", "Unknown")

    lines = []
    lines.append(f"**Model Summary**")
    lines.append(f"")

    if task_type == "classification":
        acc = metrics.get("accuracy")
        prec = metrics.get("precision")
        rec = metrics.get("recall")
        f1 = metrics.get("f1")
        roc_auc = metrics.get("roc_auc")

        if acc is not None:
            quality = "excellent" if acc >= 0.95 else "good" if acc >= 0.85 else "moderate" if acc >= 0.70 else "poor"
            lines.append(f"Best model: **{model_name}**")
            lines.append(f"Accuracy: **{acc*100:.1f}%** — {quality} performance.")
        if prec is not None and rec is not None:
            balance = "balanced" if abs(prec - rec) < 0.05 else "imbalanced"
            lines.append(f"Precision ({prec*100:.1f}%) and Recall ({rec*100:.1f}%) are {balance}.")
        if f1 is not None:
            lines.append(f"F1 Score: **{f1*100:.1f}%**")
        if roc_auc is not None:
            auc_quality = "outstanding" if roc_auc >= 0.95 else "good" if roc_auc >= 0.80 else "fair" if roc_auc >= 0.70 else "poor"
            lines.append(f"ROC AUC: **{roc_auc:.4f}** — {auc_quality} discrimination.")
        if acc is not None and acc >= 0.85 and f1 is not None and f1 >= 0.80:
            lines.append(f"Recommendation: This model is suitable for deployment.")
        elif acc is not None and acc >= 0.70:
            lines.append(f"Recommendation: Consider hyperparameter tuning or more training data before deploying.")
        else:
            lines.append(f"Recommendation: Model performance is below acceptable thresholds. Review features and data quality.")
    else:
        r2 = metrics.get("r2")
        rmse = metrics.get("rmse")
        mae = metrics.get("mae")
        mape = metrics.get("mape")

        if r2 is not None:
            quality = "excellent" if r2 >= 0.90 else "good" if r2 >= 0.75 else "moderate" if r2 >= 0.50 else "poor"
            lines.append(f"Best model: **{model_name}**")
            lines.append(f"R² Score: **{r2:.4f}** — {quality} fit.")
        if rmse is not None:
            lines.append(f"RMSE: **{rmse:.4f}**")
        if mae is not None:
            lines.append(f"MAE: **{mae:.4f}**")
        if mape is not None:
            lines.append(f"MAPE: **{mape:.2f}%**")
        if r2 is not None and r2 >= 0.75:
            lines.append(f"Recommendation: This model is suitable for deployment.")
        elif r2 is not None and r2 >= 0.50:
            lines.append(f"Recommendation: Consider feature engineering or model selection improvements.")
        else:
            lines.append(f"Recommendation: Model performance is weak. Review data quality and feature relevance.")

    if feature_importance:
        top3 = feature_importance[:3]
        feat_names = [f["feature"] for f in top3]
        lines.append(f"")
        lines.append(f"Top features: **{', '.join(feat_names)}**.")

    overfitting = False
    lc = eval_result.get("learning_curve", {})
    if lc and "train_mean" in lc and "val_mean" in lc:
        train_final = lc["train_mean"][-1] if lc["train_mean"] else None
        val_final = lc["val_mean"][-1] if lc["val_mean"] else None
        if train_final is not None and val_final is not None:
            gap = train_final - val_final
            if gap > 0.10:
                overfitting = True
                lines.append(f"")
                lines.append(f"Warning: Potential overfitting detected (train-val gap: {gap:.2f}).")

    if not overfitting:
        lines.append(f"No significant overfitting detected.")

    return "\n".join(lines)
