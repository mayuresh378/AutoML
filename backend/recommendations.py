import os
import numpy as np
import pandas as pd
from typing import Optional

from preprocess import load_dataset_file, DATASET_DIR
from train import CLASSIFICATION_MODELS, REGRESSION_MODELS


def suggest_target_column(df: pd.DataFrame) -> tuple[str, str]:
    """Suggest the most likely target column and explain why."""
    col_names = list(df.columns)
    if not col_names:
        return "", "No columns available"

    keywords = ["target", "label", "class", "churn", "outcome", "survived", "status", "price", "salary", "score"]
    for col in col_names:
        col_l = str(col).lower()
        for kw in keywords:
            if kw in col_l:
                return col, f"Column name contains common target keyword '{kw}'"

    # Default to the last column
    last_col = col_names[-1]
    return last_col, "Standard convention: last column in tabular dataset is used as target"


def generate_dataset_recommendations(file_name: str, target_column: Optional[str] = None) -> dict:
    """Analyze dataset characteristics and generate intelligent recommendations for training."""
    df = load_dataset_file(file_name)
    total_rows = int(len(df))
    total_cols = int(len(df.columns))

    if total_rows == 0 or total_cols < 2:
        return {
            "file_name": file_name,
            "total_rows": total_rows,
            "total_columns": total_cols,
            "error": "Dataset is empty or has fewer than 2 columns.",
        }

    # 1. Target column suggestion / confirmation
    target_reason = ""
    if not target_column or target_column.strip() not in df.columns:
        target_column, target_reason = suggest_target_column(df)
    else:
        target_column = target_column.strip()
        target_reason = "User-selected target column"

    y = df[target_column]
    features_df = df.drop(columns=[target_column])

    # 2. Problem type detection & explanation
    nunique_target = int(y.nunique(dropna=True))
    is_numeric_target = pd.api.types.is_numeric_dtype(y)
    null_target_count = int(y.isna().sum())

    problem_type = "classification"
    problem_reason = ""
    is_ambiguous = False

    if not is_numeric_target:
        problem_type = "classification"
        problem_reason = (
            f"Target '{target_column}' is non-numeric with {nunique_target} distinct categories "
            f"({', '.join([str(v) for v in y.dropna().unique()[:4]])}), which indicates a classification problem."
        )
    elif nunique_target <= 15:
        problem_type = "classification"
        problem_reason = (
            f"Target '{target_column}' is numeric but has only {nunique_target} discrete values "
            f"({', '.join([str(v) for v in y.dropna().unique()[:4]])}), consistent with classification classes."
        )
    elif nunique_target > 15 and nunique_target <= 30:
        is_ambiguous = True
        problem_type = "classification" if nunique_target <= 20 else "regression"
        problem_reason = (
            f"Target '{target_column}' has {nunique_target} distinct numeric values. "
            f"Could be treated as multiclass classification or continuous regression. Selected {problem_type} as default."
        )
    else:
        problem_type = "regression"
        std_val = float(y.std()) if not np.isnan(float(y.std())) else 0.0
        problem_reason = (
            f"Target '{target_column}' is continuous numeric with {nunique_target} unique values "
            f"(mean: {float(y.mean()):.2f}, std: {std_val:.2f}), which fits regression."
        )

    # 3. Quality issues & Cleaning suggestions
    quality_issues = []
    cleaning_suggestions = []

    # Missing values
    missing_by_col = df.isna().sum()
    missing_cols = missing_by_col[missing_by_col > 0].to_dict()
    if missing_cols:
        worst_col, worst_count = max(missing_cols.items(), key=lambda x: x[1])
        worst_pct = (worst_count / total_rows) * 100
        quality_issues.append({
            "type": "missing_values",
            "severity": "high" if worst_pct > 30 else "medium",
            "title": f"Missing values in {len(missing_cols)} column(s)",
            "description": f"Highest in '{worst_col}' with {worst_count} missing rows ({worst_pct:.1f}%).",
        })
        cleaning_suggestions.append({
            "stage": "imputation",
            "action": "Automated imputation enabled",
            "details": "Median imputation applied to numeric features; most-frequent category imputation for text/categoricals.",
        })

    # Null target rows
    if null_target_count > 0:
        quality_issues.append({
            "type": "null_target",
            "severity": "high",
            "title": f"Target column has {null_target_count} missing value(s)",
            "description": f"{null_target_count} rows with missing target will be dropped before training.",
        })

    # Duplicate rows
    dup_count = int(df.duplicated().sum())
    if dup_count > 0:
        quality_issues.append({
            "type": "duplicate_rows",
            "severity": "low",
            "title": f"{dup_count} duplicate row(s) detected",
            "description": f"{(dup_count / total_rows) * 100:.1f}% of dataset rows are exact duplicates.",
        })
        cleaning_suggestions.append({
            "stage": "deduplication",
            "action": "Consider deduplication",
            "details": "Duplicate rows may cause slight train/test data leakage if not stratified.",
        })

    # Class imbalance (for classification)
    class_distribution = None
    imbalance_ratio = 1.0
    if problem_type == "classification" and nunique_target >= 2:
        val_counts = y.value_counts(dropna=True)
        class_distribution = {str(k): int(v) for k, v in val_counts.items()}
        if len(val_counts) >= 2:
            imbalance_ratio = float(val_counts.iloc[0] / max(val_counts.iloc[-1], 1))
            if imbalance_ratio > 3.0:
                quality_issues.append({
                    "type": "class_imbalance",
                    "severity": "medium",
                    "title": f"Class imbalance detected (ratio {imbalance_ratio:.1f}:1)",
                    "description": f"Majority class '{val_counts.index[0]}' has {val_counts.iloc[0]} samples while minority class has only {val_counts.iloc[-1]}.",
                })
                cleaning_suggestions.append({
                    "stage": "sampling_weights",
                    "action": "Use stratified splits and weighted metrics",
                    "details": "AutoML will use stratified train/test split and prioritize F1-score & ROC-AUC over plain accuracy.",
                })

    # Constant features
    constant_cols = [c for c in features_df.columns if features_df[c].nunique(dropna=True) <= 1]
    if constant_cols:
        quality_issues.append({
            "type": "constant_features",
            "severity": "medium",
            "title": f"{len(constant_cols)} constant feature(s)",
            "description": f"Columns [{', '.join(constant_cols[:5])}] have 0 variance and offer no predictive value.",
        })
        cleaning_suggestions.append({
            "stage": "feature_selection",
            "action": "Drop constant columns",
            "details": "Constant columns will be automatically bypassed to reduce dimensionality.",
        })

    # 4. Feature breakdown
    numeric_cols = [c for c in features_df.columns if pd.api.types.is_numeric_dtype(features_df[c])]
    categorical_cols = [c for c in features_df.columns if not pd.api.types.is_numeric_dtype(features_df[c])]

    # 5. Algorithm recommendations with justifications
    recommended_algos = []
    available_pool = CLASSIFICATION_MODELS if problem_type == "classification" else REGRESSION_MODELS

    if problem_type == "classification":
        if "RandomForest" in available_pool:
            recommended_algos.append({
                "name": "RandomForest",
                "label": "Random Forest",
                "reason": "Robust ensemble baseline that resists overfitting and handles non-linear tabular features well.",
                "priority": "high",
            })
        if "GradientBoosting" in available_pool:
            recommended_algos.append({
                "name": "GradientBoosting",
                "label": "Gradient Boosting",
                "reason": "Sequential boosting provides high precision on tabular data with structured interactions.",
                "priority": "high",
            })
        if "CatBoost" in available_pool:
            recommended_algos.append({
                "name": "CatBoost",
                "label": "CatBoost",
                "reason": "Top-tier gradient boosting specifically designed for tabular datasets with categorical variables.",
                "priority": "high",
            })
        if "LightGBM" in available_pool:
            recommended_algos.append({
                "name": "LightGBM",
                "label": "LightGBM",
                "reason": "Fast histogram-based gradient boosting ideal for rapid training and feature interactions.",
                "priority": "medium",
            })
        if "LogisticRegression" in available_pool:
            recommended_algos.append({
                "name": "LogisticRegression",
                "label": "Logistic Regression",
                "reason": "Fast linear model useful as an interpretable benchmark.",
                "priority": "medium",
            })
    else:
        if "RandomForest" in available_pool:
            recommended_algos.append({
                "name": "RandomForest",
                "label": "Random Forest",
                "reason": "Ensemble of regression trees capturing non-linear relationships without scaling requirements.",
                "priority": "high",
            })
        if "GradientBoosting" in available_pool:
            recommended_algos.append({
                "name": "GradientBoosting",
                "label": "Gradient Boosting",
                "reason": "Standard boosting workhorse for regression tasks with strong R² performance.",
                "priority": "high",
            })
        if "CatBoost" in available_pool:
            recommended_algos.append({
                "name": "CatBoost",
                "label": "CatBoost",
                "reason": "Symmetric decision tree boosting preventing target leakage in regression.",
                "priority": "high",
            })
        if "Ridge" in available_pool:
            recommended_algos.append({
                "name": "Ridge",
                "label": "Ridge Regression",
                "reason": "L2-regularized linear baseline preventing extreme coefficients on correlated features.",
                "priority": "medium",
            })

    # 6. Evaluation metrics recommendations
    if problem_type == "classification":
        if imbalance_ratio > 3.0:
            recommended_metrics = [
                {"name": "f1", "label": "Weighted F1-Score", "reason": "Accurately measures balance between precision and recall on imbalanced classes."},
                {"name": "roc_auc", "label": "ROC-AUC", "reason": "Evaluates discrimination threshold independently of class proportions."},
                {"name": "precision", "label": "Precision", "reason": "Quantifies false positive rate."},
                {"name": "accuracy", "label": "Accuracy", "reason": "General reference metric."},
            ]
        else:
            recommended_metrics = [
                {"name": "accuracy", "label": "Accuracy", "reason": "Balanced class distribution makes overall accuracy a reliable metric."},
                {"name": "f1", "label": "F1-Score", "reason": "Harmonic mean of precision and recall for balanced evaluation."},
                {"name": "precision", "label": "Precision", "reason": "Fraction of true positive predictions."},
                {"name": "recall", "label": "Recall", "reason": "Fraction of actual positive cases retrieved."},
            ]
    else:
        recommended_metrics = [
            {"name": "r2", "label": "R² (Coefficient of Determination)", "reason": "Measures variance explained by the model (higher is better, 1.0 is perfect)."},
            {"name": "rmse", "label": "Root Mean Squared Error (RMSE)", "reason": "Penalizes large outlier errors in the same units as the target."},
            {"name": "mae", "label": "Mean Absolute Error (MAE)", "reason": "Average absolute prediction error magnitude, robust to outliers."},
        ]

    # 7. Estimated complexity & warnings
    cell_count = total_rows * total_cols
    if cell_count < 20000:
        complexity = "Fast"
        est_time_seconds = "3 - 8 seconds"
        warning = None
    elif cell_count < 200000:
        complexity = "Moderate"
        est_time_seconds = "10 - 25 seconds"
        warning = None
    else:
        complexity = "Heavy"
        est_time_seconds = "30 - 60+ seconds"
        warning = "Large dataset size. Enabling full hyperparameter optimization across all algorithms will take extra computation time."

    return {
        "file_name": file_name,
        "total_rows": total_rows,
        "total_columns": total_cols,
        "target_column": target_column,
        "target_reason": target_reason,
        "available_columns": list(df.columns),
        "problem_type": problem_type,
        "problem_reason": problem_reason,
        "is_ambiguous": is_ambiguous,
        "quality_issues": quality_issues,
        "cleaning_suggestions": cleaning_suggestions,
        "numeric_feature_count": len(numeric_cols),
        "categorical_feature_count": len(categorical_cols),
        "class_distribution": class_distribution,
        "recommended_algorithms": recommended_algos,
        "recommended_metrics": recommended_metrics,
        "complexity": complexity,
        "estimated_duration": est_time_seconds,
        "complexity_warning": warning,
    }
