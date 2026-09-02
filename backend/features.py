import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import PolynomialFeatures

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def load_dataset(file_name: str) -> pd.DataFrame:
    file_path = os.path.join(DATASET_DIR, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found.")
    return pd.read_csv(file_path)


def generate_features(file_name: str, operations: list) -> dict:
    df = load_dataset(file_name)
    generated = []
    original_cols = set(df.columns)

    for op in operations:
        op_type = op.get("type")
        columns = op.get("columns", [])
        valid_cols = [c for c in columns if c in df.columns and df[c].dtype in ["int64", "float64"]]

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
                    name = f"{col}^ {d}"
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
                if (df[col] > 0).all():
                    name = f"log_{col}"
                    df[name] = np.log1p(df[col])
                    generated.append(name)

        elif op_type == "sqrt":
            for col in valid_cols:
                if (df[col] >= 0).all():
                    name = f"sqrt_{col}"
                    df[name] = np.sqrt(df[col])
                    generated.append(name)

    # Save the feature-enhanced dataset
    enhanced_name = f"featurized_{file_name}"
    save_path = os.path.join(DATASET_DIR, enhanced_name)
    df.to_csv(save_path, index=False)

    new_cols = [c for c in df.columns if c not in original_cols]

    return {
        "enhanced_file": enhanced_name,
        "total_columns": len(df.columns),
        "new_columns": len(new_cols),
        "generated_features": new_cols,
    }


def suggest_features(file_name: str) -> dict:
    df = load_dataset(file_name)
    suggestions = []

    numeric_cols = [c for c in df.columns if df[c].dtype in ["int64", "float64"]]

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
        if (df[col] > 0).all():
            suggestions.append({
                "type": "log",
                "description": f"Log transform for {col} (skewed distribution)",
                "columns": [col],
            })
        suggestions.append({
            "type": "bin",
            "description": f"Binned encoding for {col}",
            "columns": [col],
            "n_bins": 5,
        })

    return {"suggestions": suggestions}
