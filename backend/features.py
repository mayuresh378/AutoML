import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import PolynomialFeatures

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")

SUPPORTED_OPS = {"polynomial", "interaction", "bin", "log", "sqrt"}


class FeatureError(ValueError):
    """Raised for invalid feature-engineering requests (surfaces as HTTP 400)."""


def load_dataset(file_name: str) -> pd.DataFrame:
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found.")
    return pd.read_csv(file_path)


def _validate_operations(operations) -> list:
    """Reject unknown/empty operation lists instead of silently doing nothing.

    Previously an unrecognised ``type`` fell through every branch and the
    endpoint answered ``200 {"new_columns": 0}``, which reads as success while
    producing nothing. Callers now get an explicit error listing the real
    supported types.
    """
    if not isinstance(operations, list):
        raise FeatureError("'operations' must be a JSON array of operations.")
    if not operations:
        raise FeatureError("'operations' must contain at least one operation.")

    for index, op in enumerate(operations):
        if not isinstance(op, dict):
            raise FeatureError(f"Operation {index} must be a JSON object.")
        op_type = op.get("type")
        if op_type not in SUPPORTED_OPS:
            raise FeatureError(
                f"Unsupported feature operation '{op_type}'. "
                f"Supported types: {', '.join(sorted(SUPPORTED_OPS))}."
            )
    return operations


def generate_features(file_name: str, operations: list) -> dict:
    df = load_dataset(file_name)
    _validate_operations(operations)

    generated = []
    original_cols = set(df.columns)
    warnings = []

    for op in operations:
        op_type = op.get("type")
        columns = op.get("columns", [])
        if isinstance(columns, str):
            columns = [columns]
        requested = list(columns)

        valid_cols = [
            c for c in columns
            if c in df.columns and pd.api.types.is_numeric_dtype(df[c])
        ]
        unknown = [c for c in columns if c not in df.columns]
        if unknown:
            warnings.append(
                f"{op_type}: skipped unknown column(s) {', '.join(unknown)}."
            )

        if not valid_cols:
            warnings.append(
                f"{op_type}: no usable numeric column(s) in "
                f"{', '.join(requested) if requested else '(none given)'}."
            )
            continue

        # Numeric transforms cannot consume NaN. Only impute the columns this
        # operation actually touches, so unrelated missing values stay intact
        # and the saved file remains faithful to the input.
        missing = [c for c in valid_cols if df[c].isna().any()]
        if missing:
            for c in missing:
                median = df[c].median()
                # An all-NaN column has no median; fall back to 0.
                df[c] = df[c].fillna(0.0 if pd.isna(median) else median)
            warnings.append(
                f"{op_type}: imputed {len(missing)} missing-value column(s) "
                f"({', '.join(missing)}) with the median before transforming."
            )

        if op_type == "polynomial":
            degree = op.get("degree", 2)
            if len(valid_cols) >= 2:
                poly = PolynomialFeatures(degree=degree, include_bias=False, interaction_only=False)
                poly_data = poly.fit_transform(df[valid_cols])
                poly_names = poly.get_feature_names_out(valid_cols)
                for i, name in enumerate(poly_names):
                    if name not in df.columns:
                        df[name] = poly_data[:, i]
                        generated.append(name)
            elif len(valid_cols) == 1:
                col = valid_cols[0]
                for d in range(2, degree + 1):
                    name = f"{col}^{d}"
                    df[name] = df[col] ** d
                    generated.append(name)

        elif op_type == "interaction":
            for i in range(len(valid_cols)):
                for j in range(i + 1, len(valid_cols)):
                    name = f"{valid_cols[i]}_x_{valid_cols[j]}"
                    df[name] = df[valid_cols[i]] * df[valid_cols[j]]
                    generated.append(name)

        elif op_type == "bin":
            for col in valid_cols:
                n_bins = op.get("n_bins", 5)
                name = f"{col}_binned"
                df[name] = pd.cut(df[col], bins=n_bins, labels=False)
                generated.append(name)

        elif op_type == "log":
            for col in valid_cols:
                non_positive = int((df[col] <= 0).sum())
                if non_positive:
                    # np.log1p is undefined at <= 0; offset so it stays finite.
                    shifted = df[col] - df[col].min() + 1.0
                    df[f"log_{col}"] = np.log1p(shifted)
                    warnings.append(
                        f"log: {col} has {non_positive} non-positive value(s); "
                        f"shifted the column before log1p."
                    )
                else:
                    df[f"log_{col}"] = np.log1p(df[col])
                generated.append(f"log_{col}")

        elif op_type == "sqrt":
            for col in valid_cols:
                negatives = int((df[col] < 0).sum())
                if negatives:
                    warnings.append(
                        f"sqrt: skipped '{col}' because it has "
                        f"{negatives} negative value(s)."
                    )
                    continue
                df[f"sqrt_{col}"] = np.sqrt(df[col])
                generated.append(f"sqrt_{col}")

    if not generated:
        raise FeatureError(
            "No features were generated. "
            + (" ".join(warnings) if warnings else "No supported operations were applied.")
        )

    enhanced_name = f"featurized_{file_name}"
    save_path = os.path.join(DATASET_DIR, enhanced_name)
    df.to_csv(save_path, index=False)

    new_cols = [c for c in df.columns if c not in original_cols]

    return {
        "enhanced_file": enhanced_name,
        "total_columns": len(df.columns),
        "new_columns": len(new_cols),
        "generated_features": new_cols,
        "warnings": warnings,
    }


def suggest_features(file_name: str) -> dict:
    df = load_dataset(file_name)
    suggestions = []

    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]

    if len(numeric_cols) >= 2:
        suggestions.append({
            "type": "polynomial",
            "description": f"Polynomial interaction terms ({', '.join(numeric_cols[:3])})",
            "columns": numeric_cols[:3],
            "degree": 2,
        })
        suggestions.append({
            "type": "interaction",
            "description": f"Pairwise interactions for top numeric features",
            "columns": numeric_cols[:3],
        })

    for col in numeric_cols[:2]:
        # Missing values are imputed with the median before the transform, so
        # these are offered regardless of gaps. Only offer log/sqrt when the
        # data is genuinely skewed / non-negative so the transform means
        # something, rather than rejecting every op at runtime.
        has_missing = bool(df[col].isna().any())
        if has_missing:
            detail = " (missing values will be median-imputed)"
        else:
            detail = ""

        if (df[col] > 0).all():
            suggestions.append({
                "type": "log",
                "description": f"Log transform for {col} (skewed distribution){detail}",
                "columns": [col],
            })
        if (df[col] >= 0).all():
            suggestions.append({
                "type": "sqrt",
                "description": f"Square-root transform for {col}{detail}",
                "columns": [col],
            })
        suggestions.append({
            "type": "bin",
            "description": f"Binned encoding for {col}{detail}",
            "columns": [col],
            "n_bins": 5,
        })

    return {"suggestions": suggestions}
