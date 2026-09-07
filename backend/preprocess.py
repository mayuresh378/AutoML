import pandas as pd
import numpy as np
import os
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def auto_preprocess(file_name: str, target_column: str, task_type: str = None):
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found in dataset directory.")

    df = pd.read_csv(file_path, skipinitialspace=True)
    df.columns = df.columns.str.strip()
    target_column = target_column.strip()
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    y = df[target_column]
    X = df.drop(columns=[target_column])

    # pandas 3-style one-hot dummies are `bool`; sklearn SimpleImputer cannot
    # consume bool arrays, so coerce them to float (lossless for 0/1).
    for col in X.columns:
        if pd.api.types.is_bool_dtype(X[col]):
            X[col] = X[col].astype("float64")

    if task_type is None:
        task_type = detect_task_type(y)

    numeric_features = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_features = X.select_dtypes(include=["object", "category", "bool"]).columns.tolist()

    # Drop high-cardinality categorical columns (likely ID columns) that would explode memory
    drop_cols = []
    safe_cat_features = []
    for col in categorical_features:
        try:
            parsed = pd.to_datetime(X[col], errors="coerce")
            if parsed.notna().sum() > len(X[col]) * 0.5:
                X[col] = parsed.astype("int64") / 1e9
                numeric_features.append(col)
                continue
        except Exception:
            pass
        nunique = X[col].nunique()
        if nunique > 50 or nunique / max(len(X), 1) > 0.5:
            drop_cols.append(col)
        else:
            safe_cat_features.append(col)

    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    transformers = [("num", numeric_transformer, numeric_features)]
    if safe_cat_features:
        transformers.append(("cat", categorical_transformer, safe_cat_features))

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
    )

    X_transformed = preprocessor.fit_transform(X)

    cat_features_out = []
    if safe_cat_features:
        try:
            cat_pipeline = preprocessor.named_transformers_["cat"]
            encoder = cat_pipeline.named_steps["encoder"] if hasattr(cat_pipeline, "named_steps") else cat_pipeline
            cat_features_out = encoder.get_feature_names_out(safe_cat_features).tolist()
        except Exception:
            cat_features_out = safe_cat_features

    all_feature_names = numeric_features + cat_features_out

    if hasattr(X_transformed, "toarray"):
        X_transformed = X_transformed.toarray()

    X_processed = pd.DataFrame(X_transformed, columns=all_feature_names, index=X.index)

    y_processed = preprocess_target(y, task_type)

    class_counts = None
    if task_type == "classification":
        class_counts = y_processed.value_counts().to_dict()

    return {
        "X": X_processed,
        "y": y_processed,
        "preprocessor": preprocessor,
        "feature_names": all_feature_names,
        "task_type": task_type,
        "class_counts": class_counts,
        "n_classes": len(class_counts) if class_counts else None,
        "original_columns": list(df.columns),
    }


def detect_task_type(y: pd.Series) -> str:
    if y.dtype in ["int64", "float64"]:
        unique_count = y.nunique()
        if unique_count <= 20:
            return "classification"
        return "regression"
    return "classification"


def preprocess_target(y: pd.Series, task_type: str) -> pd.Series:
    if task_type == "classification" and y.dtype.name in ("object", "str", "category"):
        from sklearn.preprocessing import LabelEncoder
        le = LabelEncoder()
        y_encoded = pd.Series(le.fit_transform(y), index=y.index, name=y.name)
        y_encoded.attrs["label_encoder"] = le
        return y_encoded
    return y


def _short_repr(value, max_len: int = 24) -> str:
    s = str(value)
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def analyze_target(file_name: str, target_column: str, task_type: str = None, cv_folds: int = 5) -> dict:
    """Inspect a target column before optimization.

    Detects the task type, class distribution, high-cardinality / identifier-like
    targets, and the largest safe CV fold count. A classification target is blocked
    when any class has fewer than 2 samples (stratified splits are impossible).
    """
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found in dataset directory.")

    df = pd.read_csv(file_path, skipinitialspace=True)
    df.columns = df.columns.str.strip()
    target_column = target_column.strip()
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in dataset.")

    y = df[target_column]
    n = int(len(y))

    if task_type is None:
        task_type = detect_task_type(y)

    analysis = {
        "target_column": target_column,
        "task_type": task_type,
        "total_samples": n,
        "missing_count": int(y.isna().sum()),
        "n_classes": None,
        "min_class_count": None,
        "max_class_count": None,
        "class_counts": None,
        "high_cardinality": False,
        "identifier_like": False,
        "cardinality_reason": None,
        "example_values": [],
        "blocked": False,
        "block_reason": None,
        "warning": None,
        "cv_folds_selected": int(cv_folds),
        "safe_cv_folds": int(cv_folds),
        "cv_adjusted": False,
        "cv_valid": True,
        "cv_note": None,
    }

    nunique = int(y.nunique())
    unique_ratio = nunique / n if n else 0.0
    is_string = y.dtype.name in ("object", "str", "category")
    analysis["example_values"] = [_short_repr(v) for v in y.dropna().unique()[:3]]

    high_cardinality = nunique > 50 and unique_ratio > 0.5
    identifier_like = nunique >= 2 and unique_ratio >= 0.9
    analysis["high_cardinality"] = bool(high_cardinality)
    analysis["identifier_like"] = bool(identifier_like)

    if high_cardinality or identifier_like:
        reason = (
            f"Target '{target_column}' has {nunique} unique values out of {n} rows "
            f"({unique_ratio:.1%} unique)."
        )
        if identifier_like and is_string:
            reason += " It looks like an identifier (e.g., a name or ID) rather than a class label."
            if analysis["example_values"]:
                reason += f" Example values: {', '.join(analysis['example_values'])}."
        elif identifier_like:
            reason += " It is nearly unique per row, which is a typical signature of an ID/identifier column."
        else:
            reason += " With this many distinct values it is not a meaningful discrete classification label."
        analysis["cardinality_reason"] = reason
        title = "Identifier-like target detected" if identifier_like else "High-cardinality target detected"
        analysis["warning"] = f"{title}: {reason}"

    user_cv = max(1, int(cv_folds))
    if task_type == "classification":
        counts = y.value_counts(dropna=True)
        n_classes = int(len(counts))
        analysis["n_classes"] = n_classes
        analysis["class_counts"] = {str(k): int(v) for k, v in counts.items()}
        analysis["min_class_count"] = int(counts.min()) if n_classes else 0
        analysis["max_class_count"] = int(counts.max()) if n_classes else 0

        if analysis["min_class_count"] < 2:
            analysis["blocked"] = True
            analysis["cv_valid"] = False
            block_reason = (
                f"Target '{target_column}' cannot be used for classification: it has {n_classes} class(es) "
                f"and the smallest class has only {analysis['min_class_count']} sample(s). Training a classifier "
                f"needs at least 2 samples per class so the data can be split into train/test and cross-validated. "
                f"Choose a different target, use regression for continuous values, or drop the classes with a "
                f"single sample."
            )
            if analysis["cardinality_reason"]:
                block_reason += f" {analysis['cardinality_reason']}"
            analysis["block_reason"] = block_reason
            analysis["cv_note"] = "Cross-validation is not possible with this target."
        else:
            safe = max(2, min(user_cv, analysis["min_class_count"]))
            analysis["safe_cv_folds"] = safe
            analysis["cv_adjusted"] = safe < min(user_cv, 10)
            analysis["cv_valid"] = True
            analysis["cv_note"] = (
                f"Using {safe} CV folds — limited by the smallest class ({analysis['min_class_count']} sample(s))."
                if analysis["cv_adjusted"]
                else f"Using {safe} CV folds."
            )
    else:
        safe = max(2, min(user_cv, 10))
        analysis["safe_cv_folds"] = safe
        analysis["cv_adjusted"] = safe < user_cv
        analysis["cv_valid"] = True
        analysis["cv_note"] = f"Using {safe} CV folds."

    return analysis
