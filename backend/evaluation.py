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
    mean_absolute_error, mean_squared_error, r2_score, roc_auc_score,
)
from sklearn.pipeline import Pipeline
from preprocess import auto_preprocess, preprocess_target

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")

# Evaluation must be deterministic so repeated runs of the same
# (model, dataset, target) triple produce identical numbers.
RANDOM_SEED = 42
TEST_SIZE = 0.2

# Hard ceilings so a large dataset cannot stall a request.
MAX_EVAL_ROWS = 50_000
MAX_CURVE_POINTS = 300
MAX_SAMPLES = 500
MAX_TRAIN_SIZES = 5
MAX_CV_FOLDS = 3


class MissingFeaturesError(ValueError):
    """Raised when the dataset cannot supply the columns a model needs."""

    def __init__(self, missing, expected=None):
        self.missing = list(missing)
        self.expected = list(expected or [])
        count = len(self.missing)
        noun = "feature" if count == 1 else "features"
        super().__init__(
            f"This dataset is missing {count} {noun} required by the selected model: "
            f"{', '.join(self.missing)}."
        )


def _load_model(name):
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Model '{name}' not found")
    return joblib.load(path)


def _load_meta(name):
    base_name = name[:-4] if name.endswith(".pkl") else name
    candidates = [
        f"{base_name}_meta.json",
        f"{name}_meta.json",
        f"{base_name}.meta.json",
        f"{base_name}.meta.pkl",
        f"{name}.meta.pkl",
    ]
    for candidate in candidates:
        p = os.path.join(MODELS_DIR, candidate)
        if os.path.exists(p):
            try:
                if candidate.endswith(".json"):
                    with open(p) as f:
                        return json.load(f)
                else:
                    return joblib.load(p)
            except Exception:
                pass
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


def _infer_task_type(model_obj, meta):
    if meta and meta.get("task_type"):
        return meta.get("task_type")
    model, _ = _extract_model(model_obj)
    estimator_type = getattr(model, "_estimator_type", None)
    if estimator_type == "regressor":
        return "regression"
    if estimator_type == "classifier":
        return "classification"
    return "classification"


def _resolve_input_schema(pipeline, preprocessor, meta):
    """Work out which raw dataset columns the model actually consumes.

    Two artifact shapes exist in this project and they need different handling:

    * ``Pipeline([("preprocessor", ct), ("model", est)])`` - the pipeline owns
      the transform, so it must be handed *raw* columns and must never be
      re-aligned against post-transform names (that is a double transform).
    * bare estimator / ``Pipeline([("model", est)])`` - the model consumes the
      pre-encoded matrix directly, so ``meta["feature_names"]`` (written
      post-transform by some trainers) is the authoritative input schema.

    Returns ``(raw_schema, model_input_names)`` where ``raw_schema`` is the
    pre-transform column order to feed the pipeline, or ``None`` when the
    pipeline does no preprocessing.
    """
    if preprocessor is not None:
        # `feature_names_in_` is populated by sklearn whenever the preprocessor
        # was fitted on a DataFrame, and it is the exact pre-transform schema.
        fitted_names = getattr(preprocessor, "feature_names_in_", None)
        if fitted_names is not None:
            raw_schema = [str(c) for c in fitted_names]
        else:
            raw_schema = list(meta.get("feature_names") or [])
        return raw_schema, None

    model_input_names = list(meta.get("feature_names") or [])
    return None, model_input_names or None


def _model_input_feature_names(preprocessor, model, meta, n_model_features):
    """Feature names in the exact order/wIDTH the estimator consumes.

    Feature importance is indexed against the estimator, so these must be the
    post-transform names. Falls back through several sources because different
    trainers write different metadata.
    """
    if preprocessor is not None:
        try:
            names = [str(c) for c in preprocessor.get_feature_names_out()]
            if len(names) == n_model_features:
                return names
        except Exception:
            pass

    meta_names = list(meta.get("feature_importance_names") or [])
    if len(meta_names) == n_model_features:
        return meta_names

    meta_names = list(meta.get("feature_names") or [])
    if len(meta_names) == n_model_features:
        return meta_names

    if n_model_features:
        return [f"f{i}" for i in range(n_model_features)]
    return []



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


def _read_dataset(file_name):
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset file '{file_name}' not found")
    ext = os.path.splitext(file_name)[1].lower()
    if ext == ".csv":
        return pd.read_csv(file_path)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    elif ext == ".parquet":
        return pd.read_parquet(file_path)
    elif ext == ".json":
        try:
            return pd.read_json(file_path, lines=True)
        except Exception:
            return pd.read_json(file_path)
    else:
        return pd.read_csv(file_path)


def _align_columns(X_raw, expected, warnings, what="feature"):
    """Restrict a raw frame to ``expected``, reporting anything missing/extra."""
    if not expected:
        return X_raw

    raw_cols = set(X_raw.columns)
    missing = [c for c in expected if c not in raw_cols]
    extra = [c for c in X_raw.columns if c not in set(expected)]

    if missing:
        raise MissingFeaturesError(missing, expected)
    if extra:
        warnings.append(
            f"Dataset has {len(extra)} column(s) not used by the model and they were ignored: {sorted(extra)}."
        )
    return X_raw[list(expected)]


def _prepare_data(file_name, target_column, pipeline, meta, task_type, max_rows=None):
    warnings = []
    df = _read_dataset(file_name)

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset. Available: {list(df.columns)}")

    # Guard against path traversal on the dataset name.
    if os.path.sep in file_name or (os.path.altsep and os.path.altsep in file_name):
        raise ValueError("Invalid dataset name")

    y_raw = df[target_column]

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

    X_raw = df.drop(columns=[target_column])

    # Drop pure datetime columns: they cannot be fed to the estimator and the
    # training pipeline did not receive them either.
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
        warnings.append(
            f"Ignored {len(datetime_cols)} datetime-like column(s) that cannot be used as model input: {sorted(datetime_cols)}."
        )

    model_obj, preprocessor = _extract_model(pipeline)
    raw_schema, model_input_names = _resolve_input_schema(pipeline, preprocessor, meta)

    if preprocessor is not None:
        # The pipeline performs the transform, so hand it raw columns only.
        if raw_schema:
            missing = [c for c in raw_schema if c not in set(X_raw.columns)]
            if missing:
                raise MissingFeaturesError(missing, raw_schema)
            extra = [c for c in X_raw.columns if c not in set(raw_schema)]
            if extra:
                warnings.append(
                    f"Dataset has {len(extra)} column(s) not used by the model and they were ignored: {sorted(extra)}."
                )
            X_raw = X_raw[list(raw_schema)]
        X_for_split = X_raw
        full_pipeline = pipeline
    else:
        # No preprocessor: the estimator consumes the encoded matrix directly,
        # so align raw columns against the recorded model-input schema.
        if model_input_names:
            X_raw = _align_columns(X_raw, model_input_names, warnings)
        X_for_split = X_raw
        full_pipeline = pipeline

    if max_rows is not None and len(X_for_split) > max_rows:
        # Deterministic down-sample so metrics stay reproducible.
        keep = np.linspace(0, len(X_for_split) - 1, num=max_rows).astype(int)
        keep = np.unique(keep)
        X_for_split = X_for_split.iloc[keep]
        y_processed = np.asarray(y_processed)[keep]
        warnings.append(
            f"Dataset had {len(df)} rows; evaluation used a deterministic sample of {len(keep)} rows."
        )

    return X_for_split, y_processed, model_obj, preprocessor, full_pipeline, warnings


def _split_data(X, y, task_type, test_size=TEST_SIZE, random_state=RANDOM_SEED):
    """Deterministic train/test split that tolerates small and skewed datasets.

    Stratification is only requested when every class has at least two
    members, otherwise sklearn raises instead of evaluating anything.
    """
    stratify = None
    if task_type == "classification":
        y_arr = np.asarray(y)
        _, counts = np.unique(y_arr, return_counts=True)
        n_test = max(1, int(round(len(y_arr) * test_size)))
        if len(counts) > 1 and counts.min() >= 2 and n_test >= len(counts):
            stratify = y_arr

    test_size = min(test_size, max(1, (len(y) - 1) / len(y))) if len(y) > 1 else None
    if test_size is None:
        return X, y, X, y

    return train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=stratify,
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


def compute_confusion_matrix(predictor, X_test, y_test, task_type, meta, y_pred=None):
    if task_type != "classification":
        return None
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    if y_pred is None:
        y_pred = predictor.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)), key=str)
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]
    cm = confusion_matrix(y_test_list, y_pred_list, labels=labels)
    return {"matrix": cm.tolist(), "labels": str_labels}


def compute_roc_curve(predictor, X_test, y_test, task_type, meta, y_pred=None):
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    if y_pred is None:
        y_pred = predictor.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)), key=str)
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]

    if task_type != "classification" or not hasattr(predictor, "predict_proba"):
        return None

    y_proba = predictor.predict_proba(X_test)

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


def compute_pr_curve(predictor, X_test, y_test, task_type, meta, y_pred=None):
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    if y_pred is None:
        y_pred = predictor.predict(X_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)
    labels = sorted(list(set(y_test_list + y_pred_list)), key=str)
    label_map = meta.get("label_map") or {}
    str_labels = [label_map.get(str(l), str(l)) for l in labels]

    if task_type != "classification" or not hasattr(predictor, "predict_proba"):
        return None

    y_proba = predictor.predict_proba(X_test)

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


def _curve_cv(n_samples):
    if n_samples < 10:
        return 2
    return int(max(2, min(MAX_CV_FOLDS, n_samples // 2)))


def compute_learning_curve(pipeline, X, y, task_type):
    """Learning curve computed by actually re-fitting the pipeline.

    Nothing here is simulated: if the pipeline cannot be cross-validated the
    error is returned so the UI can say the curve is unavailable.
    """
    scoring = "accuracy" if task_type == "classification" else "r2"
    n = len(y)
    if n < 4:
        return {"error": "Learning curve needs at least 4 rows", "scoring": scoring}
    try:
        train_sizes_abs, train_scores, val_scores = learning_curve(
            pipeline, X, y,
            train_sizes=np.linspace(0.1, 1.0, MAX_TRAIN_SIZES),
            cv=_curve_cv(n),
            scoring=scoring,
            n_jobs=1,
            random_state=RANDOM_SEED,
        )
        return {
            "train_sizes": [int(x) for x in train_sizes_abs],
            "train_mean": [round(float(x), 4) for x in np.mean(train_scores, axis=1)],
            "train_std": [round(float(x), 4) for x in np.std(train_scores, axis=1)],
            "val_mean": [round(float(x), 4) for x in np.mean(val_scores, axis=1)],
            "val_std": [round(float(x), 4) for x in np.std(val_scores, axis=1)],
            "scoring": scoring,
        }
    except Exception as e:
        return {"error": str(e), "scoring": scoring}


def compute_validation_curve(pipeline, X, y, task_type, estimator):
    param_name = None
    param_range = None
    inner_model = estimator

    step_prefix = ""
    if isinstance(pipeline, Pipeline) and hasattr(pipeline, "named_steps"):
        for key in ("model", "classifier", "estimator", "regressor"):
            if key in pipeline.named_steps:
                step_prefix = f"{key}__"
                break

    if hasattr(estimator, "n_estimators"):
        param_name = f"{step_prefix}n_estimators"
        param_range = [10, 25, 50, 75, 100, 150, 200]
    elif hasattr(estimator, "C"):
        param_name = f"{step_prefix}C"
        param_range = [0.01, 0.1, 1, 10, 100]
    elif hasattr(estimator, "max_depth"):
        param_name = f"{step_prefix}max_depth"
        param_range = [2, 3, 5, 7, 10, 15]
    elif hasattr(estimator, "n_neighbors"):
        param_name = f"{step_prefix}n_neighbors"
        param_range = [3, 5, 7, 9, 11, 15, 21]

    if param_name is None:
        return {"error": "No tunable hyperparameter found for validation curve"}

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
            cv=_curve_cv(len(y)),
            scoring="accuracy" if task_type == "classification" else "r2",
            n_jobs=1,
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


def _sample_indices(n, limit, seed=RANDOM_SEED):
    """Deterministic subsample of ``limit`` indices out of ``n``."""
    if n <= limit:
        return np.arange(n)
    return np.unique(np.linspace(0, n - 1, num=limit).astype(int))


def compute_residual_plot(predictor, X_test, y_test, task_type):
    if task_type == "classification":
        return None
    y_pred = np.asarray(predictor.predict(X_test), dtype=float)
    y_true = np.asarray(y_test, dtype=float)
    residuals = y_true - y_pred
    indices = _sample_indices(len(residuals), MAX_CURVE_POINTS)
    # Bias sign: a strong negative mean means systematic over-prediction.
    return {
        "predicted": [round(float(y_pred[i]), 4) for i in indices],
        "residuals": [round(float(residuals[i]), 4) for i in indices],
        "actual": [round(float(y_true[i]), 4) for i in indices],
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
    """Importance read off the real estimator.

    ``feature_names`` must be in the estimator's own input order (post
    transform). When a width mismatch occurs the importance is skipped rather
    than mislabelled, because a wrongly named chart is worse than none.
    """
    importances = []
    importances_arr = None
    source = None
    if hasattr(model, "feature_importances_"):
        importances_arr = np.asarray(model.feature_importances_, dtype=float)
        source = "feature_importances_"
    elif hasattr(model, "coef_"):
        coefs = np.asarray(model.coef_, dtype=float)
        importances_arr = coefs[0] if coefs.ndim > 1 else coefs
        source = "coef_"

    if importances_arr is None:
        return []

    if not feature_names or len(feature_names) != len(importances_arr):
        return []

    abs_imp = np.abs(importances_arr)
    vmax = abs_imp.max()
    for i, fname in enumerate(feature_names):
        importances.append({
            "feature": fname,
            "importance": round(float(importances_arr[i]), 6),
            "normalized": round(float(abs_imp[i] / vmax), 4) if vmax > 0 else 0,
            "source": source,
        })
    importances.sort(key=lambda x: abs(x["importance"]), reverse=True)
    return importances


def compute_prediction_samples(y_pred, X_test, y_test, y_proba, task_type, meta, n_samples=50):
    """Real per-row evaluation results, deterministically sampled."""
    label_map = meta.get("label_map") or {}
    y_test_list = y_test.tolist() if hasattr(y_test, "tolist") else list(y_test)
    y_pred_list = y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred)

    n = min(n_samples, len(y_test_list))
    indices = _sample_indices(len(y_test_list), n)

    classes = sorted(set(y_test_list))
    samples = []
    for i in indices:
        actual = y_test_list[i]
        predicted = y_pred_list[i]
        if task_type == "classification":
            prob = None
            if y_proba is not None:
                prob = {
                    label_map.get(str(c), str(c)): round(float(y_proba[i][j]), 4)
                    for j, c in enumerate(classes)
                    if j < y_proba.shape[1]
                }
            samples.append({
                "actual": label_map.get(str(actual), str(actual)),
                "predicted": label_map.get(str(predicted), str(predicted)),
                "correct": actual == predicted,
                "probability": prob,
            })
        else:
            residual = float(actual) - float(predicted)
            samples.append({
                "actual": round(float(actual), 4),
                "predicted": round(float(predicted), 4),
                "residual": round(residual, 4),
                "abs_error": round(abs(residual), 4),
            })
    return samples


def compute_class_distribution(y_test, task_type):
    if task_type != "classification":
        return None
    unique, counts = np.unique(y_test, return_counts=True)
    total = len(y_test)
    return [{"label": str(u), "count": int(c), "pct": round(float(c / total) * 100, 1)} for u, c in zip(unique, counts)]


def _reconcile_label_spaces(y_test, y_pred, meta):
    """Put ground truth and predictions in the same label space.

    Models trained through this platform label-encode string targets, so they
    predict integers, while a model trained elsewhere predicts the raw labels.
    Comparing the two directly either crashes or silently scores everything
    wrong, so align them before any metric is computed.
    """
    y_true = np.asarray(y_test)
    y_pred_arr = np.asarray(y_pred)
    true_numeric = np.issubdtype(y_true.dtype, np.number)
    pred_numeric = np.issubdtype(y_pred_arr.dtype, np.number)
    if true_numeric == pred_numeric:
        return y_true, y_pred_arr

    if not pred_numeric and true_numeric:
        # Truth is encoded, predictions are raw labels.
        label_map = meta.get("label_map") or {}
        if label_map:
            mapped = [label_map.get(str(int(v)), str(v)) for v in y_true]
            return np.array(mapped, dtype=object), y_pred_arr.astype(object)
        # LabelEncoder orders classes by sorted unique value, so encoding the
        # predictions the same way is only valid if the split kept every class.
        classes = np.unique(y_pred_arr)
        n_true = len(np.unique(y_true))
        if len(classes) != n_true:
            raise ValueError(
                f"The model predicts {len(classes)} label(s) but the data has {n_true} "
                "encoded class(es), and no label mapping is stored with the model. "
                "Re-train the model on this dataset before evaluating it."
            )
        return y_true, np.searchsorted(classes, y_pred_arr)

    raise ValueError(
        "The model predicts encoded class indices but the dataset's target column "
        "contains raw labels, and no label mapping is stored with the model. "
        "Re-train the model on this dataset before evaluating it."
    )


def evaluate_model_comprehensive(model_name, file_name, target_column, max_rows=MAX_EVAL_ROWS):
    pipeline = _load_model(model_name)
    meta = _load_meta(model_name)
    estimator, preprocessor = _extract_model(pipeline)
    task_type = _infer_task_type(pipeline, meta)

    X_for_split, y_processed, _, _, predictor, warnings = _prepare_data(
        file_name, target_column, pipeline, meta, task_type, max_rows=max_rows
    )
    X_train, X_test, y_train, y_test = _split_data(X_for_split, y_processed, task_type)

    if len(np.unique(np.asarray(y_test))) < 2 and task_type == "classification":
        warnings.append(
            "The evaluation split contains a single class, so precision/recall/F1 and "
            "threshold curves are not defined. Evaluate on a larger dataset for full metrics."
        )

    y_pred = predictor.predict(X_test)
    if task_type == "classification":
        y_test, y_pred = _reconcile_label_spaces(y_test, y_pred, meta)
    y_proba = None
    if task_type == "classification" and hasattr(predictor, "predict_proba"):
        try:
            y_proba = predictor.predict_proba(X_test)
        except Exception as e:
            warnings.append(f"Class probabilities are not available for this model: {e}")

    n_classes = len(np.unique(y_test)) if task_type == "classification" else 0
    if task_type == "classification":
        metrics = _compute_classification_metrics(y_test, y_pred, y_proba, n_classes)
    else:
        metrics = _compute_regression_metrics(y_test, y_pred)

    # Optional artifacts: a failure here is reported, never silently hidden.
    errors = []

    def _attempt(label, fn, default=None):
        try:
            return fn()
        except Exception as e:
            errors.append(f"{label} could not be computed: {type(e).__name__}: {e}")
            return default

    cm = _attempt("Confusion matrix", lambda: compute_confusion_matrix(predictor, X_test, y_test, task_type, meta, y_pred))
    roc = _attempt("ROC curve", lambda: compute_roc_curve(predictor, X_test, y_test, task_type, meta, y_pred))
    pr = _attempt("Precision-Recall curve", lambda: compute_pr_curve(predictor, X_test, y_test, task_type, meta, y_pred))

    if task_type == "classification":
        if roc and "auc" in roc:
            metrics["roc_auc"] = roc["auc"]
        elif roc and "macro_auc" in roc:
            metrics["roc_auc"] = roc["macro_auc"]
        else:
            metrics["roc_auc"] = None
            if not roc:
                errors.append(
                    "ROC-AUC is unavailable: this model does not expose predict_proba, "
                    "or the evaluation split has fewer than two classes."
                )

    n_model_features = getattr(estimator, "n_features_in_", None)
    if n_model_features is None and hasattr(estimator, "coef_"):
        coef = np.asarray(estimator.coef_)
        n_model_features = coef.shape[1] if coef.ndim > 1 else coef.shape[0]
    if n_model_features:
        importance_names = _model_input_feature_names(
            preprocessor, estimator, meta, int(n_model_features)
        )
    else:
        importance_names = []

    feat_imp = _attempt(
        "Feature importance",
        lambda: compute_feature_importance(estimator, importance_names),
        default=[],
    )
    if not feat_imp:
        errors.append(
            "Feature importance is not available: this estimator exposes neither "
            "feature_importances_ nor coef_."
        )

    lc = _attempt(
        "Learning curve",
        lambda: compute_learning_curve(predictor, X_for_split, y_processed, task_type),
        default={"error": "Learning curve unavailable for this model"},
    )
    vc = _attempt(
        "Validation curve",
        lambda: compute_validation_curve(predictor, X_for_split, y_processed, task_type, estimator),
        default={"error": "Validation curve unavailable for this model"},
    )
    res_plot = _attempt(
        "Residual analysis", lambda: compute_residual_plot(predictor, X_test, y_test, task_type)
    )
    pred_dist = _attempt(
        "Prediction distribution", lambda: compute_prediction_distribution(y_test, y_pred, task_type)
    )
    pred_samples = _attempt(
        "Prediction samples",
        lambda: compute_prediction_samples(y_pred, X_test, y_test, y_proba, task_type, meta),
        default=[],
    )
    class_dist = _attempt(
        "Class distribution", lambda: compute_class_distribution(y_test, task_type)
    )

    result = {
        "model_name": model_name,
        "task_type": task_type,
        # Echo what was actually evaluated, so a stored record never depends on
        # whatever the artifact metadata happened to contain.
        "dataset_name": file_name,
        "target_column": target_column,
        "feature_names": list(importance_names) or list(meta.get("feature_names") or []),
        "input_feature_names": list(importance_names),
        "metrics": metrics,
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "confusion_matrix": cm,
        "roc_curve": roc,
        "pr_curve": pr,
        "feature_importance": feat_imp,
        "learning_curve": lc,
        "validation_curve": vc,
        "residual_plot": res_plot,
        "prediction_distribution": pred_dist,
        "prediction_samples": pred_samples,
        "class_distribution": class_dist,
        "warnings": warnings,
        "unavailable": errors,
    }

    return _sanitize_nan(result)



def compare_models(model_names, file_name, target_column, max_rows=MAX_EVAL_ROWS):
    """Evaluate several models on ONE shared test set.

    The dataset and the train/test split are computed once so every model is
    measured on identical rows; otherwise the numbers are not comparable.
    Each model is isolated in its own try/except so one broken model cannot
    take down the whole comparison.
    """
    results = []
    prepared = {}

    for name in model_names:
        try:
            pipeline = _load_model(name)
            meta = _load_meta(name)
            estimator, preprocessor = _extract_model(pipeline)
            task_type = _infer_task_type(pipeline, meta)
            X, y, _, _, predictor, _ = _prepare_data(
                file_name, target_column, pipeline, meta, task_type, max_rows=max_rows
            )
            prepared[name] = (X, y, task_type, meta, estimator, preprocessor, predictor)
        except Exception as e:
            results.append({"model_name": name, "error": _human_error(e)})

    if not prepared:
        return _sanitize_nan(results)

    # A single reference task type/split for everyone, so metrics line up.
    ref_name = next(iter(prepared))
    ref_task = prepared[ref_name][2]

    # Only models sharing the reference task type can share the split.
    candidates = {n: p for n, p in prepared.items() if p[2] == ref_task}
    for name in prepared:
        if name not in candidates:
            results.append({
                "model_name": name,
                "task_type": prepared[name][2],
                "error": (
                    f"Not comparable: this is a {prepared[name][2]} model but the "
                    f"comparison dataset was split for {ref_task}."
                ),
            })

    if candidates:
        # Derive the shared test positions ONCE from the reference target so
        # every model is scored on byte-identical rows.
        ref_y = candidates[ref_name][1]
        n_rows = len(ref_y)
        n_test = max(1, int(round(n_rows * TEST_SIZE)))
        n_test = min(n_test, n_rows - 1) if n_rows > 1 else n_rows
        test_positions = None
        if n_rows > 1:
            _, test_positions = train_test_split(
                np.arange(n_rows), test_size=n_test, random_state=RANDOM_SEED
            )
            test_positions = np.sort(test_positions)

        for name, (X, y, task_type, meta, estimator, preprocessor, predictor) in candidates.items():
            try:
                if test_positions is None:
                    y_test = np.asarray(y)
                    X_eval = X
                else:
                    if len(y) != n_rows or len(X) != n_rows:
                        results.append({
                            "model_name": name,
                            "task_type": task_type,
                            "error": "Not comparable: dataset row count differs across models.",
                        })
                        continue
                    y_test = np.asarray(y)[test_positions]
                    X_eval = X.iloc[test_positions] if hasattr(X, "iloc") else X[test_positions]

                y_pred = predictor.predict(X_eval)
                if task_type == "classification":
                    y_test, y_pred = _reconcile_label_spaces(y_test, y_pred, meta)
                results.append(
                    _comparison_entry(
                        name, y_test, y_pred, predictor, X_eval, task_type, meta,
                        estimator, preprocessor, meta.get("dataset_name") or file_name,
                    )
                )
            except Exception as e:
                results.append({"model_name": name, "task_type": task_type, "error": _human_error(e)})


    order = {n: i for i, n in enumerate(model_names)}
    results.sort(key=lambda r: order.get(r.get("model_name"), 999))
    return _sanitize_nan(results)


def _comparison_entry(name, y_test, y_pred, predictor, X, task_type, meta, estimator, preprocessor, dataset_name=None):
    y_proba = None
    if task_type == "classification" and hasattr(predictor, "predict_proba"):
        try:
            y_proba = predictor.predict_proba(X)
        except Exception:
            y_proba = None

    n_classes = len(np.unique(y_test)) if task_type == "classification" else 0
    if task_type == "classification":
        metrics = _compute_classification_metrics(y_test, y_pred, y_proba, n_classes)
        try:
            roc = compute_roc_curve(predictor, X, y_test, task_type, meta, y_pred)
            if roc and "auc" in roc:
                metrics["roc_auc"] = roc["auc"]
            elif roc and "macro_auc" in roc:
                metrics["roc_auc"] = roc["macro_auc"]
            else:
                metrics["roc_auc"] = None
        except Exception:
            metrics["roc_auc"] = None
    else:
        metrics = _compute_regression_metrics(y_test, y_pred)

    n_model_features = getattr(estimator, "n_features_in_", None)
    if n_model_features:
        names = _model_input_feature_names(preprocessor, estimator, meta, int(n_model_features))
    else:
        names = []
    importance = compute_feature_importance(estimator, names)[:10]

    return {
        "model_name": name,
        "task_type": task_type,
        "metrics": metrics,
        "training_time": meta.get("training_time"),
        "dataset_name": dataset_name,
        "target_column": meta.get("target_column") or meta.get("target"),
        "feature_importance": importance,
    }



def _human_error(e):
    """Turn an exception into a message that is safe to show a user."""
    if isinstance(e, MissingFeaturesError):
        return str(e)
    if isinstance(e, FileNotFoundError):
        return str(e)
    if isinstance(e, ValueError):
        return str(e)
    return f"{type(e).__name__}: {e}"


CLASSIFICATION_THRESHOLDS = (0.95, 0.85, 0.70)
R2_THRESHOLDS = (0.90, 0.75, 0.50)
PERFORMANCE_BANDS = ("excellent", "strong", "moderate", "weak")


def _band(value, thresholds, labels=PERFORMANCE_BANDS):
    """Map a metric onto a named band using explicit thresholds."""
    for threshold, label in zip(thresholds, labels):
        if value >= threshold:
            return label
    return labels[-1]



def build_insights(eval_result):
    """Deterministic, evidence-linked observations about a real evaluation.

    Every item cites the metric and value it was derived from. Nothing here is
    generated speculatively, and no item is emitted without a number behind it.
    """
    insights = []
    task_type = eval_result.get("task_type", "classification")
    metrics = eval_result.get("metrics") or {}
    model_name = eval_result.get("model_name", "the model")
    test_size = eval_result.get("test_size") or 0

    def add(category, severity, title, detail, evidence=None):
        insights.append({
            "id": f"{category}-{len(insights) + 1}",
            "category": category,
            "severity": severity,
            "title": title,
            "detail": detail,
            "evidence": evidence or {},
        })

    if test_size:
        add(
            "evaluation", "info", "Evaluation basis",
            f"Every number below is measured on a held-out test split of {test_size} rows "
            f"from {eval_result.get('dataset_name') or 'the selected dataset'}; the model was not "
            f"scored on rows it was fitted on.",
            {"test_size": test_size, "train_size": eval_result.get("train_size")},
        )

    if task_type == "classification":
        acc = metrics.get("accuracy")
        prec = metrics.get("precision")
        rec = metrics.get("recall")
        f1 = metrics.get("f1")
        auc = metrics.get("roc_auc")
        logloss = metrics.get("log_loss")

        scored = {k: v for k, v in (
            ("accuracy", acc), ("precision", prec), ("recall", rec),
            ("f1", f1), ("roc_auc", auc),
        ) if isinstance(v, (int, float))}

        if scored:
            strongest = max(scored, key=lambda k: scored[k])
            weakest = min(scored, key=lambda k: scored[k])
            add(
                "performance", "info", "Strongest and weakest metric",
                f"Strongest metric is {strongest.replace('_', ' ')} at {scored[strongest]:.4f}; "
                f"weakest is {weakest.replace('_', ' ')} at {scored[weakest]:.4f}.",
                {"strongest": strongest, "weakest": weakest, "values": scored},
            )

        if isinstance(acc, (int, float)):
            band = _band(acc, CLASSIFICATION_THRESHOLDS)
            add(
                "performance",
                "positive" if acc >= 0.85 else "warning" if acc < 0.70 else "info",
                f"Overall correctness: {band}",
                f"Accuracy is {acc * 100:.2f}%, which is {band} for a "
                f"{'weighted' if isinstance(prec, float) else ''} classification task.",
                {"accuracy": acc, "band": band},
            )

        if isinstance(prec, (int, float)) and isinstance(rec, (int, float)):
            delta = prec - rec
            if abs(delta) < 0.05:
                detail = (
                    f"Precision ({prec * 100:.2f}%) and recall ({rec * 100:.2f}%) are within "
                    f"{abs(delta) * 100:.2f} points, so false positives and false negatives are "
                    f"occurring at a similar rate."
                )
                severity = "info"
            elif delta > 0:
                detail = (
                    f"Precision ({prec * 100:.2f}%) exceeds recall ({rec * 100:.2f}%) by "
                    f"{delta * 100:.2f} points: the model is conservative and misses positive "
                    f"cases more often than it raises false alarms. Lowering the decision "
                    f"threshold would trade precision for recall."
                )
                severity = "warning"
            else:
                detail = (
                    f"Recall ({rec * 100:.2f}%) exceeds precision ({prec * 100:.2f}%) by "
                    f"{abs(delta) * 100:.2f} points: the model is catching most positives but "
                    f"also raising false alarms. Raising the decision threshold would trade "
                    f"recall for precision."
                )
                severity = "warning"
            add("error_pattern", severity, "Precision/recall balance", detail,
                {"precision": prec, "recall": rec, "delta": round(delta, 4)})

        if isinstance(logloss, (int, float)):
            add(
                "performance", "info", "Probability calibration",
                f"Log loss is {logloss:.4f}. Lower is better; it measures how confidently and "
                f"correctly the model assigns probabilities rather than just its final choices.",
                {"log_loss": logloss},
            )

        if auc is None:
            add(
                "performance", "warning", "ROC-AUC unavailable",
                "ROC-AUC could not be computed. It requires either a model that exposes "
                "predict_proba or an evaluation split containing at least two classes.",
                {},
            )

        cm = eval_result.get("confusion_matrix")
        if cm and cm.get("labels"):
            matrix = cm["matrix"]
            labels = cm["labels"]
            total = sum(sum(row) for row in matrix) or 1
            errors = []
            for i, actual in enumerate(labels):
                for j, predicted in enumerate(labels):
                    if i != j and matrix[i][j] > 0:
                        errors.append((matrix[i][j], actual, predicted))
            errors.sort(reverse=True)
            if errors:
                top = errors[0]
                pct = top[0] / total * 100
                add(
                    "error_pattern", "info", "Most frequent misclassification",
                    f"The single largest error cell is actual '{top[1]}' predicted as "
                    f"'{top[2]}' with {top[0]} of {total} rows ({pct:.2f}% of the test set).",
                    {"cell": [top[1], top[2]], "count": top[0], "total": total},
                )
            else:
                add(
                    "error_pattern", "positive", "No misclassifications",
                    f"All {total} test rows were classified correctly, so the confusion matrix "
                    f"is entirely diagonal.",
                    {"total": total},
                )

        class_dist = eval_result.get("class_distribution")
        if class_dist:
            counts = [c.get("count", 0) for c in class_dist if isinstance(c.get("count"), (int, float))]
            if len(counts) > 1 and sum(counts) > 0:
                minority = min(counts)
                majority = max(counts)
                ratio = majority / minority if minority else float("inf")
                if ratio >= 10:
                    add(
                        "data", "warning", "Severe class imbalance",
                        f"The test split is imbalanced by a factor of {ratio:.1f} "
                        f"({majority} vs {minority} rows). Accuracy is dominated by the majority "
                        f"class; judge minority performance on precision, recall and F1 for that "
                        f"class specifically, and consider resampling.",
                        {"majority": majority, "minority": minority, "ratio": round(ratio, 2)},
                    )
                elif ratio >= 3:
                    add(
                        "data", "info", "Moderate class imbalance",
                        f"The largest class has {ratio:.1f}x the rows of the smallest "
                        f"({majority} vs {minority}). Per-class metrics are worth reviewing.",
                        {"ratio": round(ratio, 2)},
                    )

    else:
        r2 = metrics.get("r2")
        mae = metrics.get("mae")
        rmse = metrics.get("rmse")
        mape = metrics.get("mape")

        if isinstance(r2, (int, float)):
            band = _band(r2, R2_THRESHOLDS)
            add(
                "performance",
                "positive" if r2 >= 0.75 else "warning" if r2 < 0.5 else "info",
                f"Variance explained: {band}",
                f"R2 is {r2:.4f}, so the model accounts for {max(r2, 0) * 100:.2f}% of the "
                f"variance in the target on unseen data."
                + (" A negative R2 means it predicts worse than predicting the mean." if r2 < 0 else ""),
                {"r2": r2, "band": band},
            )

        if isinstance(rmse, (int, float)) and isinstance(mae, (int, float)):
            ratio = rmse / mae if mae else None
            if ratio and ratio >= 1.5:
                add(
                    "error_pattern", "warning", "Heavy error tail",
                    f"RMSE ({rmse:.4f}) is {ratio:.2f}x MAE ({mae:.4f}), which means a small "
                    f"number of rows carry large errors while most rows are predicted well. "
                    f"Inspect the residual plot for outliers.",
                    {"rmse": rmse, "mae": mae, "ratio": round(ratio, 2)},
                )
            else:
                add(
                    "error_pattern", "info", "Error magnitude",
                    f"Average error is {mae:.4f} (MAE) and root-mean-square error is "
                    f"{rmse:.4f} (RMSE). Their closeness indicates errors are spread evenly "
                    f"rather than dominated by outliers.",
                    {"mae": mae, "rmse": rmse},
                )

        if isinstance(mape, (int, float)):
            add(
                "performance", "info", "Percentage error",
                f"MAPE is {mape:.2f}%, the average error relative to actual values. It is "
                f"undefined for rows whose actual value is zero, so those rows were excluded.",
                {"mape": mape},
            )
        elif metrics.get("mape", "missing") is None:
            add(
                "performance", "info", "MAPE unavailable",
                "MAPE is undefined here because the target contains zero values.",
                {},
            )

        residuals = eval_result.get("residual_plot")
        if residuals and residuals.get("mean_residual") is not None:
            mean_r = residuals["mean_residual"]
            std_r = residuals.get("std_residual") or 0
            if abs(mean_r) > 0.1 * std_r if std_r else False:
                add(
                    "error_pattern", "warning", "Systematic bias",
                    f"Mean residual is {mean_r:.4f} against a residual std of {std_r:.4f}: the "
                    f"model is biased "
                    f"{'high' if mean_r < 0 else 'low'} on average, which usually points to a "
                    f"missing non-linear term or a truncated target range.",
                    {"mean_residual": mean_r, "std_residual": std_r},
                )

    importance = eval_result.get("feature_importance") or []
    if importance:
        top = importance[:3]
        total_abs = sum(abs(f.get("importance", 0)) for f in importance) or 1
        share = sum(abs(f.get("importance", 0)) for f in top) / total_abs * 100
        names = ", ".join(f["feature"] for f in top)
        add(
            "features", "info", "Dominant features",
            f"{names} account for {share:.1f}% of total absolute importance "
            f"({importance[0].get('source') or 'model coefficients'})."
            + (" Feature importance is concentrated, so a few columns drive most predictions."
               if share >= 70 else ""),
            {"features": [f["feature"] for f in top], "share_pct": round(share, 1)},
        )
        bottom = importance[-1]
        if isinstance(bottom.get("importance"), (int, float)) and abs(bottom["importance"]) < 1e-6:
            add(
                "features", "info", "Feature with no contribution",
                f"'{bottom['feature']}' has importance 0 and can be dropped without changing "
                f"this model's predictions.",
                {"feature": bottom["feature"]},
            )

    lc = eval_result.get("learning_curve") or {}
    if isinstance(lc, dict) and lc.get("train_mean") and lc.get("val_mean"):
        train_final = lc["train_mean"][-1]
        val_final = lc["val_mean"][-1]
        gap = train_final - val_final
        if gap > 0.10:
            add(
                "overfitting", "warning", "Possible overfitting",
                f"Training score ({train_final:.4f}) exceeds validation score ({val_final:.4f}) "
                f"by {gap:.4f} at full data size. The model fits the training data better than "
                f"it generalises; regularisation or more data would help.",
                {"train": train_final, "validation": val_final, "gap": round(gap, 4)},
            )
        else:
            add(
                "overfitting", "positive", "No clear overfitting",
                f"Training ({train_final:.4f}) and validation ({val_final:.4f}) scores are "
                f"within {abs(gap):.4f} at full data size, so the model generalises about as "
                f"well as it fits.",
                {"gap": round(gap, 4)},
            )
    elif isinstance(lc, dict) and lc.get("error"):
        add(
            "overfitting", "info", "Learning curve unavailable",
            "This model could not be cross-validated on the selected data, so no "
            "overfitting signal was measured.",
            {},
        )

    for warning in eval_result.get("warnings") or []:
        add("data", "warning", "Data note", warning, {})

    for issue in eval_result.get("unavailable") or []:
        add("data", "info", "Metric not available", issue, {})

    return insights


def generate_ai_insights(eval_result):
    """Text rendering of :func:`build_insights` for the persisted record.

    Kept deterministic on purpose: this project has no LLM dependency on the
    evaluation path, and every statement must be traceable to a metric.
    """
    insights = build_insights(eval_result)
    if not insights:
        return "No evaluation metrics were produced, so no analysis is available."
    lines = [f"Evaluation of {eval_result.get('model_name', 'model')}", ""]
    for item in insights:
        lines.append(f"[{item['severity'].upper()}] {item['title']}")
        lines.append(item["detail"])
        lines.append("")
    return "\n".join(lines).strip()


def detect_target_column(df: pd.DataFrame) -> dict:
    """Analyze dataframe columns and return suggested target, confidence, task type, and column scores."""
    priority_names = {
        "target", "label", "class", "y", "outcome", "result", "prediction",
        "price", "sales", "revenue", "churn", "status", "response", "purchased",
        "deposit", "default", "attrition", "survived", "salary", "score"
    }
    id_terms = {"id", "uuid", "index", "rowid", "productid", "customerid", "userid", "accountid", "patientid", "transactionid"}

    n_rows = len(df)
    scores = {}
    details = {}
    potential_ids = []

    for i, col in enumerate(df.columns):
        col_lower = str(col).strip().lower()
        score = 0
        reasons = []

        nunique = df[col].nunique(dropna=True)
        unique_ratio = nunique / n_rows if n_rows > 0 else 0
        is_id = col_lower in id_terms or col_lower.endswith("_id") or (col_lower.endswith("id") and col_lower != "hybrid")

        if is_id or (unique_ratio >= 0.9 and n_rows >= 10 and df[col].dtype == "object"):
            potential_ids.append(str(col))
            score -= 100
            reasons.append("Looks like identifier column")

        if col_lower in priority_names or any(p == col_lower for p in priority_names):
            score += 60
            reasons.append("Exact match with common target keyword")
        elif any(p in col_lower for p in priority_names):
            score += 35
            reasons.append("Partial match with target keyword")

        if i == len(df.columns) - 1 and not is_id:
            score += 20
            reasons.append("Last column in dataset")

        if 2 <= nunique <= 20:
            score += 25
            reasons.append("Ideal discrete class label (2-20 unique classes)")
        elif nunique > 20 and df[col].dtype in ["float64", "int64"] and not is_id:
            score += 15
            reasons.append("Continuous numeric column")

        scores[col] = score
        details[col] = {
            "score": score,
            "reasons": reasons,
            "nunique": int(nunique),
            "dtype": str(df[col].dtype),
        }

    sorted_cols = sorted(scores.keys(), key=lambda c: scores[c], reverse=True)
    best_target = sorted_cols[0] if sorted_cols else df.columns[-1]
    best_score = scores.get(best_target, 0)

    if best_score >= 40:
        confidence = "High"
    elif best_score >= 15:
        confidence = "Medium"
    else:
        confidence = "Low"

    detected_task = detect_task_type(df[best_target])

    return {
        "suggested_target": best_target,
        "confidence": confidence,
        "task_type": detected_task,
        "scores": scores,
        "details": details,
        "potential_ids": potential_ids,
    }


def detect_task_type(y: pd.Series) -> str:
    """Detect whether ML problem is classification or regression."""
    if y.dtype.name in ["bool", "object", "category", "string"]:
        return "classification"
    
    unique_count = int(y.nunique(dropna=True))
    if unique_count <= 20 or (unique_count <= 50 and unique_count / max(len(y), 1) <= 0.05):
        return "classification"
    return "regression"


def analyze_dataset_for_evaluation(file_name: str, target_column: str = None) -> dict:
    """Read dataset, compute statistics, detect target column, task type, and potential ID columns."""
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found")

    df = pd.read_csv(file_path, skipinitialspace=True)
    df.columns = df.columns.str.strip()

    detection = detect_target_column(df)
    suggested_target = target_column.strip() if target_column and target_column.strip() in df.columns else detection["suggested_target"]
    
    target_series = df[suggested_target]
    task_type = detect_task_type(target_series)

    dtypes_dict = {col: str(df[col].dtype) for col in df.columns}
    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()

    preview_df = df.head(10).copy()
    preview_data = json.loads(preview_df.to_json(orient="records", default_handler=str))

    return {
        "file_name": file_name,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "missing_count": int(df.isna().sum().sum()),
        "duplicate_count": int(df.duplicated().sum()),
        "dtypes": dtypes_dict,
        "suggested_target": suggested_target,
        "target_confidence": detection["confidence"],
        "detected_task_type": task_type,
        "potential_id_columns": detection["potential_ids"],
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "preview_data": preview_data,
    }


def evaluate_dataset_end_to_end(
    file_name: str,
    target_column: str = None,
    task_type: str = None,
    user_id: str = None,
    db = None,
) -> dict:
    """Run an end-to-end dataset-driven baseline training and evaluation workflow."""
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found in dataset directory.")

    df = pd.read_csv(file_path, skipinitialspace=True)
    df.columns = df.columns.str.strip()

    if len(df) < 5:
        raise ValueError("Dataset must contain at least 5 rows for model evaluation.")

    detection = detect_target_column(df)
    if not target_column or target_column.strip() not in df.columns:
        target_column = detection["suggested_target"]
    else:
        target_column = target_column.strip()

    y_raw = df[target_column]
    if y_raw.isna().all():
        raise ValueError(f"Target column '{target_column}' has no non-null values.")
    if y_raw.nunique(dropna=True) < 2:
        raise ValueError(f"Target column '{target_column}' must have at least 2 distinct values.")

    if not task_type or task_type not in ["classification", "regression"]:
        task_type = detect_task_type(y_raw)

    preprocessing_summary = []
    
    # Drop rows where target is NaN
    valid_idx = y_raw.dropna().index
    if len(valid_idx) < len(df):
        dropped_count = len(df) - len(valid_idx)
        df = df.loc[valid_idx].copy()
        y_raw = df[target_column]
        preprocessing_summary.append(f"Dropped {dropped_count} rows with missing target values")

    # Auto preprocessing features
    processed = auto_preprocess(file_name=file_name, target_column=target_column, task_type=task_type)
    X = processed["X"]
    y = processed["y"]
    
    preprocessing_summary.append("Imputed numerical missing values with median strategy")
    preprocessing_summary.append("Imputed categorical missing values with most-frequent strategy")
    preprocessing_summary.append("Scaled numerical features using StandardScaler")
    preprocessing_summary.append("Encoded categorical features using One-Hot encoding")

    # Identify dropped ID columns
    original_cols = set(df.drop(columns=[target_column]).columns)
    processed_cols = set(processed["feature_names"])
    for col in detection["potential_ids"]:
        if col in original_cols and col not in processed_cols:
            preprocessing_summary.append(f"Excluded high-cardinality/identifier column '{col}' from features")

    # Split train/test
    if task_type == "classification":
        try:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED, stratify=y
            )
        except Exception:
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
            )
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
        )

    preprocessing_summary.append(
        f"Split dataset into {len(X_train)} training rows (80%) and {len(X_test)} testing rows (20%)"
    )

    # Train baseline candidate models
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, RandomForestRegressor, GradientBoostingRegressor
    from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

    candidate_models = {}
    if task_type == "classification":
        candidate_models = {
            "RandomForest": RandomForestClassifier(n_estimators=100, random_state=RANDOM_SEED),
            "GradientBoosting": GradientBoostingClassifier(n_estimators=100, random_state=RANDOM_SEED),
            "LogisticRegression": LogisticRegression(max_iter=1000, random_state=RANDOM_SEED),
            "DecisionTree": DecisionTreeClassifier(max_depth=10, random_state=RANDOM_SEED),
        }
    else:
        candidate_models = {
            "RandomForest": RandomForestRegressor(n_estimators=100, random_state=RANDOM_SEED),
            "GradientBoosting": GradientBoostingRegressor(n_estimators=100, random_state=RANDOM_SEED),
            "RidgeRegression": Ridge(random_state=RANDOM_SEED),
            "DecisionTree": DecisionTreeRegressor(max_depth=10, random_state=RANDOM_SEED),
        }

    model_comparison = []
    trained_models = {}

    for name, model_inst in candidate_models.items():
        try:
            model_inst.fit(X_train, y_train)
            y_pred_m = model_inst.predict(X_test)
            trained_models[name] = (model_inst, y_pred_m)

            if task_type == "classification":
                acc = round(float(accuracy_score(y_test, y_pred_m)), 4)
                prec = round(float(precision_score(y_test, y_pred_m, average="weighted", zero_division=0)), 4)
                rec = round(float(recall_score(y_test, y_pred_m, average="weighted", zero_division=0)), 4)
                f1 = round(float(f1_score(y_test, y_pred_m, average="weighted", zero_division=0)), 4)
                
                roc = None
                if hasattr(model_inst, "predict_proba"):
                    try:
                        y_prob_m = model_inst.predict_proba(X_test)
                        if len(np.unique(y_test)) == 2:
                            roc = round(float(roc_auc_score(y_test, y_prob_m[:, 1])), 4)
                        else:
                            roc = round(float(roc_auc_score(y_test, y_prob_m, multi_class="ovr", average="weighted")), 4)
                    except Exception:
                        pass

                model_comparison.append({
                    "model_name": name,
                    "accuracy": acc,
                    "precision": prec,
                    "recall": rec,
                    "f1": f1,
                    "roc_auc": roc,
                })
            else:
                mae = round(float(mean_absolute_error(y_test, y_pred_m)), 4)
                mse = round(float(mean_squared_error(y_test, y_pred_m)), 4)
                rmse = round(float(np.sqrt(mse)), 4)
                r2 = round(float(r2_score(y_test, y_pred_m)), 4)

                model_comparison.append({
                    "model_name": name,
                    "mae": mae,
                    "mse": mse,
                    "rmse": rmse,
                    "r2": r2,
                })
        except Exception:
            pass

    if not model_comparison or not trained_models:
        raise RuntimeError("Failed to train baseline models on the provided dataset.")

    # Select best model
    if task_type == "classification":
        model_comparison.sort(key=lambda m: (m.get("f1") or 0, m.get("accuracy") or 0), reverse=True)
    else:
        model_comparison.sort(key=lambda m: (m.get("r2") or -999), reverse=True)

    best_model_name = model_comparison[0]["model_name"]
    best_model, y_pred = trained_models[best_model_name]

    # Compute full evaluation artifacts for the best model
    label_encoder = getattr(y, "attrs", {}).get("label_encoder")
    label_map = {}
    if label_encoder is not None:
        label_map = {str(i): str(c) for i, c in enumerate(label_encoder.classes_)}

    meta = {
        "label_map": label_map,
        "dataset_name": file_name,
        "target_column": target_column,
        "task_type": task_type,
    }

    y_proba = None
    if task_type == "classification" and hasattr(best_model, "predict_proba"):
        try:
            y_proba = best_model.predict_proba(X_test)
        except Exception:
            y_proba = None

    unavailable = []
    warnings = []

    if task_type == "classification":
        metrics = _compute_classification_metrics(y_test, y_pred, y_proba, len(np.unique(y_test)))
        cm = compute_confusion_matrix(best_model, X_test, y_test, task_type, meta, y_pred=y_pred)
        roc = compute_roc_curve(best_model, X_test, y_test, task_type, meta, y_pred=y_pred)
        pr = compute_pr_curve(best_model, X_test, y_test, task_type, meta, y_pred=y_pred)
        res_plot = None
        class_dist = compute_class_distribution(y_test, task_type)
        pred_dist = compute_prediction_distribution(y_test, y_pred, task_type)
    else:
        metrics = _compute_regression_metrics(y_test, y_pred)
        cm = None
        roc = None
        pr = None
        res_plot = compute_residual_plot(best_model, X_test, y_test, task_type)
        class_dist = None
        pred_dist = compute_prediction_distribution(y_test, y_pred, task_type)

    feat_imp = compute_feature_importance(best_model, list(X.columns))
    lc = compute_learning_curve(best_model, X, y, task_type)
    vc = compute_validation_curve(best_model, X, y, task_type, best_model)
    samples = compute_prediction_samples(y_pred, X_test, y_test, y_proba, task_type, meta)

    eval_result = {
        "model_name": f"Baseline_{best_model_name}",
        "dataset_name": file_name,
        "target_column": target_column,
        "task_type": task_type,
        "input_feature_names": list(X.columns),
        "feature_names": list(X.columns),
        "metrics": metrics,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "confusion_matrix": cm,
        "roc_curve": roc,
        "pr_curve": pr,
        "feature_importance": feat_imp,
        "learning_curve": lc,
        "validation_curve": vc,
        "residual_plot": res_plot,
        "prediction_distribution": pred_dist,
        "prediction_samples": samples,
        "class_distribution": class_dist,
        "insights": [],
        "warnings": warnings,
        "unavailable": unavailable,
        "preprocessing_summary": preprocessing_summary,
        "model_comparison": model_comparison,
        "best_model_name": best_model_name,
    }

    insights = build_insights(eval_result)
    eval_result["insights"] = insights
    eval_result["ai_insights"] = generate_ai_insights(eval_result)

    # Store record if DB session provided
    if db:
        from models import EvaluationRecord
        db_record = EvaluationRecord(
            user_id=user_id,
            model_name=f"Baseline_{best_model_name}",
            dataset_name=file_name,
            target_column=target_column,
            task_type=task_type,
            metrics=metrics,
            results_summary=eval_result,
            ai_insights=eval_result["ai_insights"],
        )
        db.add(db_record)
        db.commit()
        db.refresh(db_record)
        eval_result["evaluation_id"] = db_record.id
        eval_result["created_at"] = db_record.created_at.isoformat() if db_record.created_at else None

    return _sanitize_nan(eval_result)



