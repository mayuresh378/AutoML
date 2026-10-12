import pandas as pd
import numpy as np
import os
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, MinMaxScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def load_dataset_file(file_name: str) -> pd.DataFrame:
    """Load dataset supporting CSV, Excel, Parquet, JSON, and TSV formats."""
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found in dataset directory ({DATASET_DIR}).")

    name_lower = file_name.lower()
    try:
        if name_lower.endswith(".csv"):
            return pd.read_csv(file_path, skipinitialspace=True)
        elif name_lower.endswith((".xlsx", ".xls")):
            return pd.read_excel(file_path)
        elif name_lower.endswith(".parquet"):
            return pd.read_parquet(file_path)
        elif name_lower.endswith((".tsv", ".tab")):
            return pd.read_csv(file_path, sep="\t", skipinitialspace=True)
        elif name_lower.endswith(".json"):
            return pd.read_json(file_path)
        else:
            # Default to csv
            return pd.read_csv(file_path, skipinitialspace=True)
    except Exception as exc:
        raise ValueError(f"Failed to read dataset '{file_name}': {str(exc)}") from exc


def validate_dataset_and_target(df: pd.DataFrame, target_column: str, task_type: str = None) -> tuple[pd.DataFrame, pd.Series, str, dict]:
    """Validate dataset structure, target column, non-emptiness, and task compatibility."""
    if df.empty or len(df) == 0:
        raise ValueError("Dataset is completely empty (0 rows). Training requires at least 5 rows.")

    if len(df) < 5:
        raise ValueError(f"Dataset contains only {len(df)} row(s). Machine learning requires at least 5 rows for training and evaluation.")

    if len(df.columns) < 2:
        raise ValueError(f"Dataset contains only {len(df.columns)} column(s). At least 2 columns (1 feature + 1 target) are required.")

    target_column = target_column.strip()
    col_map = {c.strip(): c for c in df.columns}
    if target_column not in col_map:
        avail = ", ".join(list(df.columns)[:15])
        raise ValueError(f"Target column '{target_column}' not found. Available columns: [{avail}]")

    actual_col = col_map[target_column]
    raw_y = df[actual_col]

    # Drop rows where target is missing
    valid_mask = raw_y.notna()
    dropped_target_nulls = int((~valid_mask).sum())
    if valid_mask.sum() < 4:
        raise ValueError(
            f"Target column '{actual_col}' has {dropped_target_nulls} missing values, leaving only "
            f"{valid_mask.sum()} non-null row(s). At least 5 non-null rows are required."
        )

    clean_df = df[valid_mask].copy()
    clean_df.columns = clean_df.columns.str.strip()
    y = clean_df[actual_col]
    X = clean_df.drop(columns=[actual_col])

    if task_type is None or task_type == "auto":
        task_type = detect_task_type(y)

    meta = {
        "dropped_target_nulls": dropped_target_nulls,
        "initial_rows": len(df),
        "valid_rows": len(clean_df),
        "feature_count": len(X.columns),
    }

    nunique = int(y.nunique())
    if nunique <= 1:
        single_val = y.dropna().iloc[0] if len(y) > 0 else "None"
        raise ValueError(
            f"Target column '{actual_col}' is constant (all rows have the same value: '{single_val}'). "
            "Machine learning requires variance in the target to learn patterns. Please select a different target."
        )

    if task_type == "classification":
        # If numeric continuous with many distinct values, warn or suggest regression
        if pd.api.types.is_numeric_dtype(y) and nunique > 50 and (nunique / len(y)) > 0.5:
            raise ValueError(
                f"Target column '{actual_col}' is a continuous numeric column with {nunique} unique values. "
                "It looks like a regression problem rather than classification. Please select Regression as the task type."
            )
        # Check class distribution
        counts = y.value_counts()
        min_count = int(counts.min())
        if min_count < 1:
            raise ValueError(f"Smallest class has {min_count} samples. Each class requires at least 1 sample.")
        meta["class_counts"] = {str(k): int(v) for k, v in counts.items()}
        meta["n_classes"] = len(counts)
    else:
        # Regression checks
        y_num = pd.to_numeric(y, errors="coerce")
        bad_count = int(y_num.isna().sum())
        if bad_count > 0.2 * len(y):
            raise ValueError(
                f"Regression selected, but target column '{actual_col}' has {bad_count} non-numeric values "
                f"({bad_count / len(y):.1%}). Please select Classification, or clean non-numeric values."
            )
        clean_df = clean_df[y_num.notna()]
        y = y_num[y_num.notna()]
        X = clean_df.drop(columns=[actual_col])
        if float(y.std()) == 0.0 or np.isnan(float(y.std())):
            raise ValueError(f"Regression target '{actual_col}' has zero variance. Please choose a target with variable values.")

    return X, y, task_type, meta


def build_preprocessor_pipeline(X: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str], list[str]]:
    """Construct a scikit-learn ColumnTransformer for numeric and categorical features."""
    numeric_features = []
    categorical_features = []
    dropped_id_features = []

    for col in X.columns:
        # Coerce booleans
        if pd.api.types.is_bool_dtype(X[col]):
            X[col] = X[col].astype("float64")

        # Datetime detection
        if X[col].dtype == "object":
            try:
                parsed = pd.to_datetime(X[col], errors="coerce")
                if parsed.notna().sum() > len(X[col]) * 0.5:
                    X[col] = parsed.astype("int64") / 1e9
                    numeric_features.append(col)
                    continue
            except Exception:
                pass

        if pd.api.types.is_numeric_dtype(X[col]):
            numeric_features.append(col)
        else:
            nunique = int(X[col].nunique())
            ratio = nunique / max(len(X), 1)
            # High cardinality identifier columns (UUIDs, names, serials)
            col_lower = str(col).lower()
            if ratio > 0.9 and nunique > 30 and any(w in col_lower for w in ["id", "uuid", "guid", "token", "hash", "key", "url"]):
                dropped_id_features.append(col)
            else:
                categorical_features.append(col)

    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    transformers = []
    if numeric_features:
        transformers.append(("num", numeric_transformer, numeric_features))
    if categorical_features:
        transformers.append(("cat", categorical_transformer, categorical_features))

    preprocessor = ColumnTransformer(
        transformers=transformers,
        remainder="drop",
    )

    return preprocessor, numeric_features, categorical_features, dropped_id_features


def auto_preprocess(file_name: str, target_column: str, task_type: str = None):
    """Backwards-compatible preprocessing function that uses robust dataset loading and validation."""
    df = load_dataset_file(file_name)
    X, y, task_type, meta = validate_dataset_and_target(df, target_column, task_type)

    preprocessor, numeric_features, safe_cat_features, drop_cols = build_preprocessor_pipeline(X)
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
        "validation_metadata": meta,
        "dropped_columns": drop_cols,
    }


def prepare_train_test_data(
    file_name: str,
    target_column: str,
    task_type: str = None,
    test_size: float = 0.2,
    random_state: int = 42,
):
    """
    Split raw dataset into train and test FIRST, then fit preprocessor STRICTLY
    on training split to prevent any data leakage.
    """
    from sklearn.model_selection import train_test_split

    df = load_dataset_file(file_name)
    X, y, detected_task, meta = validate_dataset_and_target(df, target_column, task_type)

    y_processed = preprocess_target(y, detected_task)

    # Check if stratified split is possible for classification
    stratify = None
    if detected_task == "classification":
        counts = y_processed.value_counts()
        if (counts >= 2).all() and len(counts) > 1 and (len(y_processed) * (1 - test_size) >= len(counts)):
            stratify = y_processed

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y_processed,
        test_size=test_size,
        random_state=random_state,
        stratify=stratify,
    )

    preprocessor, num_cols, cat_cols, dropped_cols = build_preprocessor_pipeline(X_train)

    # FIT ONLY ON TRAINING SET (NO DATA LEAKAGE)
    X_train_trans = preprocessor.fit_transform(X_train)
    # TRANSFORM TEST SET WITH FITTED PREPROCESSOR
    X_test_trans = preprocessor.transform(X_test)

    cat_names = []
    if cat_cols:
        try:
            cat_pipeline = preprocessor.named_transformers_["cat"]
            encoder = cat_pipeline.named_steps["encoder"] if hasattr(cat_pipeline, "named_steps") else cat_pipeline
            cat_names = encoder.get_feature_names_out(cat_cols).tolist()
        except Exception:
            cat_names = cat_cols

    feature_names = num_cols + cat_names

    if hasattr(X_train_trans, "toarray"):
        X_train_trans = X_train_trans.toarray()
    if hasattr(X_test_trans, "toarray"):
        X_test_trans = X_test_trans.toarray()

    X_train_df = pd.DataFrame(X_train_trans, columns=feature_names, index=X_train.index)
    X_test_df = pd.DataFrame(X_test_trans, columns=feature_names, index=X_test.index)

    return {
        "X_train": X_train_df,
        "X_test": X_test_df,
        "y_train": y_train,
        "y_test": y_test,
        "preprocessor": preprocessor,
        "feature_names": feature_names,
        "task_type": detected_task,
        "numeric_features": num_cols,
        "categorical_features": cat_cols,
        "dropped_features": dropped_cols,
        "class_counts": y_processed.value_counts().to_dict() if detected_task == "classification" else None,
        "validation_metadata": meta,
        "raw_train_shape": list(X_train.shape),
        "raw_test_shape": list(X_test.shape),
        "processed_train_shape": list(X_train_df.shape),
        "processed_test_shape": list(X_test_df.shape),
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
