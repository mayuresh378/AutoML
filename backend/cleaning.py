import pandas as pd
import numpy as np
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def load_dataset(file_name: str) -> pd.DataFrame:
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found.")
    return pd.read_csv(file_path)


def get_dataset_path(file_name: str) -> str:
    return os.path.join(DATASET_DIR, file_name)


def profile_dataset(file_name: str) -> dict:
    df = load_dataset(file_name)
    profile = {
        "name": file_name,
        "rows": len(df),
        "columns": len(df.columns),
        "column_details": [],
        "missing_values": 0,
        "missing_pct": 0.0,
        "duplicates": int(df.duplicated().sum()),
        "dtypes": {},
    }

    for col in df.columns:
        col_info = {"name": col, "dtype": str(df[col].dtype)}
        missing = int(df[col].isnull().sum())
        col_info["missing"] = missing
        profile["missing_values"] += missing

        if df[col].dtype in ["int64", "float64"]:
            col_info["mean"] = round(float(df[col].mean()), 2) if df[col].notna().any() else None
            col_info["median"] = round(float(df[col].median()), 2) if df[col].notna().any() else None
            col_info["min"] = round(float(df[col].min()), 2) if df[col].notna().any() else None
            col_info["max"] = round(float(df[col].max()), 2) if df[col].notna().any() else None
            col_info["std"] = round(float(df[col].std()), 2) if df[col].notna().any() else None
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            col_info["outliers"] = int(((df[col] < lower) | (df[col] > upper)).sum())
        else:
            col_info["unique_values"] = int(df[col].nunique())
            if df[col].nunique() < 20:
                col_info["top_values"] = df[col].value_counts().head(5).to_dict()

        profile["column_details"].append(col_info)
        profile["dtypes"][col] = str(df[col].dtype)

    profile["missing_pct"] = round(profile["missing_values"] / (profile["rows"] * profile["columns"]) * 100, 2) if profile["columns"] > 0 else 0
    return profile


def clean_dataset(file_name: str, operations: list) -> dict:
    df = load_dataset(file_name)
    applied = []

    for op in operations:
        op_type = op.get("type")
        columns = op.get("columns", [])

        if op_type == "impute_missing":
            strategy = op.get("strategy", "median")
            cols = columns if columns else df.columns
            for col in cols:
                if col in df.columns and df[col].isnull().any():
                    if df[col].dtype in ["int64", "float64"]:
                        if strategy == "median":
                            df[col] = df[col].fillna(df[col].median())
                        elif strategy == "mean":
                            df[col] = df[col].fillna(df[col].mean())
                        elif strategy == "zero":
                            df[col] = df[col].fillna(0)
                    else:
                        df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "unknown")
                    applied.append(f"Imputed missing values in {col} ({strategy})")

        elif op_type == "encode_categorical":
            for col in columns:
                if col in df.columns and df[col].dtype == "object":
                    df = pd.get_dummies(df, columns=[col], drop_first=True)
                    applied.append(f"One-hot encoded {col}")

        elif op_type == "scale_numeric":
            strategy = op.get("strategy", "standard")
            for col in columns:
                if col in df.columns and df[col].dtype in ["int64", "float64"]:
                    if strategy == "standard":
                        df[col] = (df[col] - df[col].mean()) / df[col].std()
                    elif strategy == "minmax":
                        df[col] = (df[col] - df[col].min()) / (df[col].max() - df[col].min())
                    applied.append(f"Scaled {col} ({strategy})")

        elif op_type == "normalize":
            for col in columns:
                if col in df.columns and df[col].dtype in ["int64", "float64"]:
                    mn, mx = df[col].min(), df[col].max()
                    if mx - mn > 0:
                        df[col] = (df[col] - mn) / (mx - mn)
                    applied.append(f"Normalized {col}")

        elif op_type == "standardize":
            for col in columns:
                if col in df.columns and df[col].dtype in ["int64", "float64"]:
                    mean, std = df[col].mean(), df[col].std()
                    if std > 0:
                        df[col] = (df[col] - mean) / std
                    applied.append(f"Standardized {col}")

        elif op_type == "remove_duplicates":
            before = len(df)
            df = df.drop_duplicates()
            removed = before - len(df)
            applied.append(f"Removed {removed} duplicate rows")

        elif op_type == "remove_outliers":
            for col in columns:
                if col in df.columns and df[col].dtype in ["int64", "float64"]:
                    q1 = df[col].quantile(0.25)
                    q3 = df[col].quantile(0.75)
                    iqr = q3 - q1
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    before = len(df)
                    df = df[(df[col] >= lower) & (df[col] <= upper)]
                    removed = before - len(df)
                    applied.append(f"Removed {removed} outliers from {col}")

        elif op_type == "feature_selection":
            threshold = op.get("threshold", 0.01)
            numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns
            for col in numeric_cols:
                variance = df[col].var()
                if variance < threshold:
                    df = df.drop(columns=[col])
                    applied.append(f"Dropped low-variance feature {col} (var={variance:.6f})")

    cleaned_name = f"cleaned_{file_name}"
    save_path = os.path.join(DATASET_DIR, cleaned_name)
    df.to_csv(save_path, index=False)

    return {
        "cleaned_file": cleaned_name,
        "rows_after": len(df),
        "columns_after": len(df.columns),
        "applied_operations": applied,
    }


def auto_clean(file_name: str) -> dict:
    df = load_dataset(file_name)
    applied = []
    step_stats = {}
    before_rows = len(df)
    before_cols = len(df.columns)

    original_df = df.copy()
    per_step = {}

    # 1. Missing value handling
    missing_cols = []
    for col in df.columns:
        if df[col].isnull().any():
            missing_cols.append(col)
            before_miss = int(df[col].isnull().sum())
            if df[col].dtype in ["int64", "float64"]:
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "unknown")
            applied.append(f"Imputed {before_miss} missing values in {col}")
    step_stats["missing_values"] = len(missing_cols)
    per_step["missing"] = {"columns": missing_cols, "count": len(missing_cols)}

    # 2. Remove duplicates
    dup_before = len(df)
    df = df.drop_duplicates()
    dup_removed = dup_before - len(df)
    if dup_removed > 0:
        applied.append(f"Removed {dup_removed} duplicate rows")
    step_stats["duplicates_removed"] = dup_removed
    per_step["duplicates"] = {"removed": dup_removed}

    # 3. Encode categorical columns
    cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
    encoded_cols = []
    for col in cat_cols:
        df = pd.get_dummies(df, columns=[col], drop_first=True)
        encoded_cols.append(col)
        applied.append(f"One-hot encoded {col}")
    step_stats["categorical_encoded"] = len(encoded_cols)
    per_step["encoding"] = {"columns": encoded_cols, "count": len(encoded_cols)}

    # 4. Outlier detection & removal
    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns
    outlier_cols = []
    total_outliers_removed = 0
    for col in numeric_cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        outlier_count = int(outlier_mask.sum())
        if outlier_count > 0:
            outlier_cols.append(col)
            total_outliers_removed += outlier_count
            before = len(df)
            df = df[~outlier_mask]
            removed = before - len(df)
            if removed > 0:
                applied.append(f"Removed {removed} outliers from {col}")
    step_stats["outliers_removed"] = total_outliers_removed
    per_step["outliers"] = {"columns": outlier_cols, "total": total_outliers_removed}

    # 5. Scaling (MinMax to [0,1])
    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns
    scaled_cols = []
    for col in numeric_cols:
        mn, mx = df[col].min(), df[col].max()
        if mx - mn > 0:
            df[col] = (df[col] - mn) / (mx - mn)
            scaled_cols.append(col)
            applied.append(f"MinMax scaled {col} to [0,1]")
    step_stats["features_scaled"] = len(scaled_cols)
    per_step["scaling"] = {"columns": scaled_cols, "count": len(scaled_cols)}

    # 6. Normalization (L2 norm)
    numeric_cols = df.select_dtypes(include=["float64"]).columns
    norm_cols = []
    for col in numeric_cols:
        norm = (df[col] ** 2).sum() ** 0.5
        if norm > 0:
            df[col] = df[col] / norm
            norm_cols.append(col)
    if norm_cols:
        applied.append(f"L2-normalized {len(norm_cols)} numeric features")
    step_stats["features_normalized"] = len(norm_cols)
    per_step["normalization"] = {"columns": norm_cols, "count": len(norm_cols)}

    # 7. Standardization (Z-score)
    numeric_cols = df.select_dtypes(include=["float64"]).columns
    std_cols = []
    for col in numeric_cols:
        mean, std = df[col].mean(), df[col].std()
        if std > 0:
            df[col] = (df[col] - mean) / std
            std_cols.append(col)
    if std_cols:
        applied.append(f"Z-score standardized {len(std_cols)} numeric features")
    step_stats["features_standardized"] = len(std_cols)
    per_step["standardization"] = {"columns": std_cols, "count": len(std_cols)}

    # 8. Feature selection (drop low-variance)
    dropped_cols = []
    for col in df.select_dtypes(include=["float64"]).columns:
        if df[col].var() < 0.01:
            df = df.drop(columns=[col])
            dropped_cols.append(col)
            applied.append(f"Dropped low-variance feature {col} (var={df[col].var() if col in df.columns else '<0.01'})")
    step_stats["low_variance_dropped"] = len(dropped_cols)
    per_step["feature_selection"] = {"columns": dropped_cols, "count": len(dropped_cols)}

    # Column-level comparison
    column_changes = []
    for col in original_df.columns:
        if col in df.columns:
            orig_dtype = str(original_df[col].dtype)
            new_dtype = str(df[col].dtype)
            missing_before = int(original_df[col].isnull().sum())
            missing_after = int(df[col].isnull().sum())
            if orig_dtype in ["int64", "float64"] and new_dtype in ["int64", "float64"]:
                column_changes.append({
                    "name": col, "dtype": new_dtype,
                    "missing_before": missing_before, "missing_after": missing_after,
                    "mean_before": round(float(original_df[col].mean()), 4),
                    "mean_after": round(float(df[col].mean()), 4),
                    "std_before": round(float(original_df[col].std()), 4),
                    "std_after": round(float(df[col].std()), 4),
                })
            else:
                column_changes.append({
                    "name": col, "dtype": new_dtype,
                    "missing_before": missing_before, "missing_after": missing_after,
                })
        else:
            column_changes.append({
                "name": col, "dtype": str(original_df[col].dtype),
                "removed": True,
                "missing_before": 0, "missing_after": 0,
            })

    # Save
    cleaned_name = f"auto_cleaned_{file_name}"
    save_path = os.path.join(DATASET_DIR, cleaned_name)
    df.to_csv(save_path, index=False)

    return {
        "cleaned_file": cleaned_name,
        "rows_before": before_rows,
        "rows_after": len(df),
        "columns_before": before_cols,
        "columns_after": len(df.columns),
        "applied_operations": applied,
        "column_changes": column_changes,
        "step_stats": {k: v for k, v in step_stats.items() if v > 0},
        "per_step": per_step,
        "summary": {
            "duplicates_removed": step_stats.get("duplicates_removed", 0),
            "missing_imputed": step_stats.get("missing_values", 0),
            "categorical_encoded": step_stats.get("categorical_encoded", 0),
            "outliers_removed": step_stats.get("outliers_removed", 0),
            "features_scaled": step_stats.get("features_scaled", 0),
            "features_normalized": step_stats.get("features_normalized", 0),
            "features_standardized": step_stats.get("features_standardized", 0),
            "low_variance_dropped": step_stats.get("low_variance_dropped", 0),
        },
    }
