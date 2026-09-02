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
