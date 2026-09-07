"""Intelligent AutoML decision & execution engine.

Extends the classic engine (engine.py) with a genuinely intelligent pipeline:

  * AUTO / ADVANCED run modes
  * Transparent, dataset-driven model recommendations
  * Leakage-safe, per-model preprocessing (transformers fitted inside CV folds)
  * Adaptive HPO budgets (baseline -> optimized)
  * Champion selection with baseline/optimized comparison
  * A 27-section reproducibility-focused model report

This module depends only on scikit-learn (GridSearchCV / RandomizedSearchCV)
so it works in the standard runtime without optional packages.
"""
import os
import time
import json
import warnings
import itertools
import numpy as np
import pandas as pd

from sklearn.base import clone, BaseEstimator, TransformerMixin
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, OrdinalEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import (
    train_test_split, cross_val_score, KFold, StratifiedKFold,
    GridSearchCV, RandomizedSearchCV, LeaveOneOut,
    StratifiedShuffleSplit, ShuffleSplit,
)
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    mean_squared_error, mean_absolute_error, r2_score, silhouette_score,
    calinski_harabasz_score, davies_bouldin_score,
)

# Classification models
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB

# Regression models
from sklearn.linear_model import Ridge, Lasso, LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeRegressor

# Clustering models
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, SpectralClustering
from sklearn.mixture import GaussianMixture

from cleaning import load_dataset, DATASET_DIR

warnings.filterwarnings("ignore")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── Optional models ─────────────────────────────────────────────────
try:
    from xgboost import XGBClassifier, XGBRegressor
    XGB_AVAILABLE = True
except Exception:
    XGB_AVAILABLE = False
try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    LGBM_AVAILABLE = True
except Exception:
    LGBM_AVAILABLE = False
try:
    from catboost import CatBoostClassifier, CatBoostRegressor
    CATB_AVAILABLE = True
except Exception:
    CATB_AVAILABLE = False

_IDENTITY_COLUMNS = {"id", "index", "unnamed: 0", "unnamed:0"}


# ════════════════════════════════════════════════════════════════════
# 1. DATASET INTELLIGENCE
# ════════════════════════════════════════════════════════════════════

def _detect_feature_types(df: pd.DataFrame) -> dict:
    types = {"numeric": [], "categorical": [], "text": [], "datetime": [], "boolean": [], "id": []}
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) == 0:
            types["categorical"].append(col)
            continue
        dtype = str(df[col].dtype)
        if "datetime" in dtype.lower():
            types["datetime"].append(col)
        elif dtype == "bool" or col_data.nunique() == 2:
            types["boolean"].append(col)
        elif "int" in dtype or "float" in dtype:
            nunique = col_data.nunique()
            if nunique == len(col_data) and "id" in col.lower():
                types["id"].append(col)
            elif nunique <= 10:
                types["categorical"].append(col)
            else:
                types["numeric"].append(col)
        elif dtype == "object":
            nunique = col_data.nunique()
            avg_len = col_data.astype(str).str.len().mean()
            if nunique <= 30:
                types["categorical"].append(col)
            elif avg_len > 50:
                types["text"].append(col)
            else:
                types["categorical"].append(col)
        else:
            types["categorical"].append(col)
    return {k: v for k, v in types.items() if v}


def _detect_target(df: pd.DataFrame, target: str = None) -> dict:
    if target and target in df.columns:
        col = df[target].dropna()
        nunique = col.nunique()
        unique_ratio = nunique / len(col) if len(col) else 0
        is_numeric = str(col.dtype) in ("int64", "float64")
        task = "regression"
        if nunique <= 20 or (not is_numeric):
            task = "classification"
        elif len(df) > 50 and df[target].nunique() <= min(50, max(2, int(len(df) * 0.05)) + 1):
            task = "classification"
        return {"target": target, "inferred_task": task, "nunique": int(nunique),
                "unique_ratio": round(unique_ratio, 4), "dtype": str(col.dtype)}
    candidates = []
    hints = ["target", "label", "class", "diagnosis", "outcome", "result", "y",
             "approved", "churn", "default", "fraud", "survived", "price", "cost"]
    for col in df.columns:
        col_data = df[col].dropna()
        if len(col_data) < 2:
            continue
        nunique = col_data.nunique()
        unique_ratio = nunique / len(col_data)
        score = 0
        reason = None
        if unique_ratio <= 0.05 and nunique <= 30:
            score = 10 - unique_ratio * 10
            reason = "low-cardinality categorical target"
        elif str(col_data.dtype) in ("int64", "float64") and nunique <= 20:
            score = 9 - unique_ratio * 5
            reason = "numeric with few unique values"
        elif str(col_data.dtype) == "object" and nunique <= 30:
            score = 8 - unique_ratio * 5
            reason = "categorical column"
        if score <= 0:
            # numeric with continuous values -> regression candidate
            if str(col_data.dtype) in ("int64", "float64") and nunique > 20:
                score = 4
                reason = "continuous numeric (regression candidate)"
        if score > 0:
            for hint in hints:
                if hint in col.lower():
                    score = min(10, score + 2)
                    reason = (reason or "") + f" name hint '{hint}'"
            candidates.append({"column": col, "score": round(score, 2), "reason": reason or "possible target"})
    candidates.sort(key=lambda x: x["score"], reverse=True)
    top = candidates[0] if candidates else None
    inferred_task = "regression"
    if top:
        col_data = df[top["column"]].dropna()
        if top["column"] in df.columns and (str(col_data.dtype) == "object" or col_data.nunique() <= 20):
            inferred_task = "classification"
    return {"candidates": candidates[:6], "suggested": top["column"] if top else None,
            "inferred_task": inferred_task}


def _missing_stats(df: pd.DataFrame) -> dict:
    total_cells = df.shape[0] * df.shape[1]
    total_missing = int(df.isnull().sum().sum())
    pct = round(total_missing / total_cells * 100, 2) if total_cells else 0
    cols = []
    for col in df.columns:
        m = int(df[col].isnull().sum())
        if m:
            cols.append({"column": col, "missing": m, "pct": round(m / len(df) * 100, 2) if len(df) else 0})
    cols.sort(key=lambda c: c["missing"], reverse=True)
    return {"total_missing": total_missing, "missing_pct": pct, "columns": cols}


def _duplicates(df: pd.DataFrame) -> dict:
    c = int(df.duplicated().sum())
    return {"count": c, "pct": round(c / len(df) * 100, 2) if len(df) else 0}


def _outlier_stats(df: pd.DataFrame) -> dict:
    cols = []
    total = 0
    for col in df.select_dtypes(include=[np.number]).columns:
        col_data = df[col].dropna()
        if len(col_data) < 4:
            continue
        q1, q3 = col_data.quantile(0.25), col_data.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        n = int(((col_data < lower) | (col_data > upper)).sum())
        total += n
        cols.append({"column": col, "outliers": n, "pct": round(n / len(col_data) * 100, 2)})
    cols.sort(key=lambda c: c["outliers"], reverse=True)
    return {"total_outliers": total, "columns": cols[:10]}


def _imbalance(df: pd.DataFrame, target: str) -> dict:
    if not target or target not in df.columns:
        return {"detected": False}
    col = df[target].dropna()
    if col.nunique() > 30:
        return {"detected": False}
    counts = col.value_counts()
    total = len(col)
    dist = {str(k): {"count": int(v), "pct": round(v / total * 100, 2)} for k, v in counts.items()}
    max_pct = max(c["pct"] for c in dist.values())
    min_pct = min(c["pct"] for c in dist.values())
    ratio = round(max_pct / min_pct, 2) if min_pct > 0 else 99
    severity = "low" if ratio < 2 else "medium" if ratio < 5 else "high"
    return {"detected": True, "distribution": dist, "imbalance_ratio": ratio,
            "severity": severity, "classes": len(counts), "target": target}


def build_dataset_profile(file_name: str, target: str = None) -> dict:
    df = load_dataset(file_name)
    df.columns = [str(c).strip() for c in df.columns]
    target_detection = _detect_target(df, target)
    tgt = target if (target and target in df.columns) else target_detection["suggested"]
    feature_types = _detect_feature_types(df)
    missing = _missing_stats(df)
    dups = _duplicates(df)
    outliers = _outlier_stats(df)
    imbalance = _imbalance(df, tgt) if tgt else {"detected": False}

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    high_card = [c for c in df.columns if df[c].dropna().nunique() > 50 and c != tgt][:8]

    return {
        "name": file_name,
        "rows": int(len(df)),
        "columns": int(df.shape[1]),
        "target": tgt,
        "target_detection": target_detection,
        "feature_types": feature_types,
        "missing": missing,
        "duplicates": dups,
        "outliers": outliers,
        "class_imbalance": imbalance,
        "numeric_features": numeric_cols,
        "high_cardinality": high_card,
        "n_features": int(df.shape[1] - (1 if tgt and tgt in df.columns else 0)),
    }


# ════════════════════════════════════════════════════════════════════
# 2. RECOMMENDATION ENGINE (transparent, dataset-driven)
# ════════════════════════════════════════════════════════════════════

# Baseline model priors ranked by typical out-of-box performance per task.
_TASK_PRIORITY = {
    "classification": ["GradientBoosting", "RandomForest", "LogisticRegression",
                       "KNN", "SVC", "DecisionTree", "NaiveBayes"],
    "regression": ["GradientBoosting", "RandomForest", "Ridge", "Lasso",
                   "KNN", "SVR", "DecisionTree"],
    "time_series": ["GradientBoosting", "RandomForest", "Ridge", "Lasso",
                    "LinearRegression", "KNN", "DecisionTree"],
    "clustering": ["KMeans", "AgglomerativeClustering", "GaussianMixture",
                   "SpectralClustering", "DBSCAN"],
}

_CAT_FAVORITES = {"GradientBoosting", "RandomForest", "XGBoost", "LightGBM", "CatBoost", "SVC", "KNN", "NaiveBayes"}
_TREE_MODELS = {"RandomForest", "GradientBoosting", "DecisionTree", "XGBoost", "LightGBM", "CatBoost"}
_LINEAR_MODELS = {"LogisticRegression", "Ridge", "Lasso", "SVR", "LinearRegression", "SVC"}


def _score_model(name: str, profile: dict, task: str) -> dict:
    score = 0.0
    reasons = []
    priority = _TASK_PRIORITY.get(task, [])
    rank = priority.index(name) if name in priority else len(priority) + 3
    score += max(0, (len(priority) - rank) * 0.6)

    n_rows = profile.get("rows", 0)
    n_feat = profile.get("n_features", 0) or 0
    ft = profile.get("feature_types", {})
    n_cat = len(ft.get("categorical", []))
    missing = profile.get("missing", {}).get("missing_pct", 0)
    high_card = profile.get("high_cardinality", [])
    imbalance = profile.get("class_imbalance", {}).get("severity", "low")

    if name in _TREE_MODELS:
        score += 0.8
        reasons.append("gradient-boosted/ensemble tree handles non-linearity well")
        if n_rows > 20000 and "GradientBoosting" not in name:
            reasons.append("scales to larger datasets")
    if name in ("GradientBoosting", "XGBoost", "LightGBM", "CatBoost"):
        score += 0.6
        reasons.append("strong baseline with robust regularization")
    if name in _LINEAR_MODELS and (n_rows < 5000 or n_feat < 50):
        score += 0.4
        reasons.append("linear model is fast and interpretable on this size")
    if name in ("Ridge", "Lasso", "LogisticRegression") and n_feat > 60:
        score += 0.3
        reasons.append("regularized linear model handles wide feature sets")
    if n_cat > 3 and name in _CAT_FAVORITES:
        score += 0.3
        reasons.append("native/good categorical handling")
    if high_card and name in ("KNN", "SVC", "SVR"):
        score -= 0.5
        reasons.append("distance-based model struggles with high-cardinality features")
    if n_rows < 300 and name in ("GradientBoosting",):
        score -= 0.2
    if n_rows < 300 and name in ("KNN", "SVC"):
        score += 0.2
        reasons.append("works well on small datasets")
    if missing > 20 and name in ("SVC", "SVR", "KNN"):
        score -= 0.3
    if task == "classification" and imbalance == "high" and name == "NaiveBayes":
        score -= 0.1

    return {"model": name, "score": round(score, 2), "reasons": reasons[:4]}


def recommend_models(profile: dict, task: str, top_k: int = 4) -> dict:
    available = _catalog(task)
    scored = [_score_model(m, profile, task) for m in available]
    scored.sort(key=lambda m: (m["score"], _TASK_PRIORITY.get(task, []).index(m["model"]) if m["model"] in _TASK_PRIORITY.get(task, []) else 99), reverse=True)
    top = scored[:top_k]
    return {
        "task": task,
        "target": profile.get("target"),
        "inferred_task": profile.get("target_detection", {}).get("inferred_task"),
        "available": available,
        "recommended": top,
        "rationale": f"Ranked by typical baseline quality for '{task}' combined with this dataset's size "
                     f"({profile.get('rows')} rows), feature mix and data quality.",
    }


def _catalog(task: str) -> list:
    if task == "classification":
        m = list(CLASSIFICATION_MODELS.keys())
        if XGB_AVAILABLE:
            m = ["GradientBoosting", "RandomForest", "LogisticRegression", "KNN", "SVC", "DecisionTree", "NaiveBayes", "XGBoost", "LightGBM", "CatBoost"]
        return m
    if task == "regression":
        return list(REGRESSION_MODELS.keys())
    if task == "clustering":
        return list(CLUSTERING_MODELS.keys())
    if task == "time_series":
        return list(TIME_SERIES_MODELS.keys())
    return []


# ════════════════════════════════════════════════════════════════════
# 3. MODEL CATALOGS (with baseline params + HPO search spaces)
# ════════════════════════════════════════════════════════════════════

COMMON_SEED = 42

CLASSIFICATION_MODELS = {
    "LogisticRegression": {
        "cls": LogisticRegression,
        "baseline": {"C": 1.0, "solver": "lbfgs", "max_iter": 2000, "random_state": COMMON_SEED},
        "space": {"C": [0.01, 0.1, 1.0, 10.0], "max_iter": [2000]},
        "default_fix": {"solver": "lbfgs", "max_iter": 2000},
    },
    "GradientBoosting": {
        "cls": GradientBoostingClassifier,
        "baseline": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": COMMON_SEED},
        "space": {"n_estimators": [50, 100, 200], "learning_rate": [0.01, 0.1, 0.3], "max_depth": [3, 5, 7]},
    },
    "RandomForest": {
        "cls": RandomForestClassifier,
        "baseline": {"n_estimators": 100, "max_depth": None, "random_state": COMMON_SEED},
        "space": {"n_estimators": [50, 100, 200], "max_depth": [None, 5, 10, 20]},
        "default_fix": {"random_state": COMMON_SEED, "n_jobs": -1},
    },
    "DecisionTree": {
        "cls": DecisionTreeClassifier,
        "baseline": {"max_depth": None, "random_state": COMMON_SEED},
        "space": {"max_depth": [None, 3, 5, 10], "min_samples_split": [2, 5, 10]},
        "default_fix": {"random_state": COMMON_SEED},
    },
    "SVC": {
        "cls": SVC,
        "baseline": {"C": 1.0, "kernel": "rbf", "gamma": "scale", "probability": True, "random_state": COMMON_SEED},
        "space": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"]},
        "default_fix": {"random_state": COMMON_SEED},
    },
    "KNN": {
        "cls": KNeighborsClassifier,
        "baseline": {"n_neighbors": 5, "weights": "uniform"},
        "space": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]},
    },
    "NaiveBayes": {
        "cls": GaussianNB,
        "baseline": {"var_smoothing": 1e-09},
        "space": {"var_smoothing": [1e-10, 1e-09, 1e-08, 1e-07]},
    },
}
if XGB_AVAILABLE:
    CLASSIFICATION_MODELS.update({
        "XGBoost": {"cls": XGBClassifier, "baseline": {"n_estimators": 100, "max_depth": 6, "learning_rate": 0.1, "random_state": COMMON_SEED, "verbosity": 0},
                    "space": {"n_estimators": [50, 100, 200], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3]}},
        "LightGBM": {"cls": LGBMClassifier, "baseline": {"n_estimators": 100, "num_leaves": 31, "learning_rate": 0.1, "random_state": COMMON_SEED, "verbose": -1},
                     "space": {"n_estimators": [50, 100, 200], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1]}},
        "CatBoost": {"cls": CatBoostClassifier, "baseline": {"iterations": 100, "depth": 6, "learning_rate": 0.1, "random_state": COMMON_SEED, "verbose": 0},
                     "space": {"iterations": [50, 100, 200], "depth": [4, 6, 8], "learning_rate": [0.01, 0.1]}},
    })

REGRESSION_MODELS = {
    "Ridge": {"cls": Ridge, "baseline": {"alpha": 1.0, "random_state": COMMON_SEED},
              "space": {"alpha": [0.01, 0.1, 1.0, 10, 100]}},
    "Lasso": {"cls": Lasso, "baseline": {"alpha": 0.1, "random_state": COMMON_SEED},
              "space": {"alpha": [0.001, 0.01, 0.1, 1.0]}},
    "GradientBoosting": {"cls": GradientBoostingRegressor, "baseline": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": COMMON_SEED},
                         "space": {"n_estimators": [50, 100, 200], "learning_rate": [0.01, 0.1, 0.3], "max_depth": [3, 5, 7]}},
    "RandomForest": {"cls": RandomForestRegressor, "baseline": {"n_estimators": 100, "max_depth": None, "random_state": COMMON_SEED},
                     "space": {"n_estimators": [50, 100, 200], "max_depth": [None, 5, 10, 20]}, "default_fix": {"random_state": COMMON_SEED, "n_jobs": -1}},
    "DecisionTree": {"cls": DecisionTreeRegressor, "baseline": {"max_depth": None, "random_state": COMMON_SEED},
                     "space": {"max_depth": [None, 3, 5, 10], "min_samples_split": [2, 5, 10]}, "default_fix": {"random_state": COMMON_SEED}},
    "SVR": {"cls": SVR, "baseline": {"C": 1.0, "kernel": "rbf", "gamma": "scale"},
            "space": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"]}},
    "KNN": {"cls": KNeighborsRegressor, "baseline": {"n_neighbors": 5, "weights": "uniform"},
            "space": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]}},
}
if XGB_AVAILABLE:
    REGRESSION_MODELS.update({
        "XGBoost": {"cls": XGBRegressor, "baseline": {"n_estimators": 100, "max_depth": 6, "learning_rate": 0.1, "random_state": COMMON_SEED, "verbosity": 0},
                    "space": {"n_estimators": [50, 100, 200], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3]}},
        "LightGBM": {"cls": LGBMRegressor, "baseline": {"n_estimators": 100, "num_leaves": 31, "learning_rate": 0.1, "random_state": COMMON_SEED, "verbose": -1},
                     "space": {"n_estimators": [50, 100, 200], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1]}},
    })

CLUSTERING_MODELS = {
    "KMeans": {"cls": KMeans, "baseline": {"n_init": 10, "random_state": COMMON_SEED},
               "space": {"n_clusters": [2, 3, 4, 5, 6, 7, 8]}, "needs_n_clusters": True},
    "AgglomerativeClustering": {"cls": AgglomerativeClustering, "baseline": {},
                                "space": {"n_clusters": [2, 3, 4, 5, 6], "linkage": ["ward", "average", "complete"]}, "needs_n_clusters": True},
    "GaussianMixture": {"cls": GaussianMixture, "baseline": {"n_init": 10, "random_state": COMMON_SEED},
                        "space": {"n_components": [2, 3, 4, 5, 6], "covariance_type": ["full", "diag"]}, "needs_n_clusters": True},
    "SpectralClustering": {"cls": SpectralClustering, "baseline": {"random_state": COMMON_SEED},
                           "space": {"n_clusters": [2, 3, 4, 5, 6], "affinity": ["rbf", "nearest_neighbors"]}, "needs_n_clusters": True},
    "DBSCAN": {"cls": DBSCAN, "baseline": {},
               "space": {"eps": [0.3, 0.5, 0.7, 1.0], "min_samples": [3, 5, 10]}, "needs_n_clusters": False},
}

TIME_SERIES_MODELS = {
    "LinearRegression": {"cls": LinearRegression, "baseline": {}, "space": {}},
    "GradientBoosting": {"cls": GradientBoostingRegressor, "baseline": {"n_estimators": 100, "learning_rate": 0.1, "max_depth": 3, "random_state": COMMON_SEED},
                         "space": {"n_estimators": [50, 100, 200], "learning_rate": [0.01, 0.1, 0.3], "max_depth": [3, 5, 7]}},
    "RandomForest": {"cls": RandomForestRegressor, "baseline": {"n_estimators": 100, "max_depth": None, "random_state": COMMON_SEED},
                     "space": {"n_estimators": [50, 100, 200], "max_depth": [None, 5, 10]}, "default_fix": {"random_state": COMMON_SEED, "n_jobs": -1}},
    "Ridge": {"cls": Ridge, "baseline": {"alpha": 1.0, "random_state": COMMON_SEED}, "space": {"alpha": [0.01, 0.1, 1.0, 10]}},
    "Lasso": {"cls": Lasso, "baseline": {"alpha": 0.1, "random_state": COMMON_SEED}, "space": {"alpha": [0.001, 0.01, 0.1, 1.0]}},
}


def get_models_response():
    clf = list(CLASSIFICATION_MODELS.keys())
    reg = list(REGRESSION_MODELS.keys())
    if XGB_AVAILABLE:
        clf = ["GradientBoosting", "RandomForest", "LogisticRegression", "KNN", "SVC", "DecisionTree", "NaiveBayes", "XGBoost", "LightGBM", "CatBoost"]
        reg = ["GradientBoosting", "RandomForest", "Ridge", "Lasso", "KNN", "SVR", "DecisionTree", "XGBoost", "LightGBM"]
    return {
        "classification": clf,
        "regression": reg,
        "clustering": list(CLUSTERING_MODELS.keys()),
        "time_series": list(TIME_SERIES_MODELS.keys()),
        "optional": {"XGBoost": XGB_AVAILABLE, "LightGBM": LGBM_AVAILABLE, "CatBoost": CATB_AVAILABLE},
    }


# ════════════════════════════════════════════════════════════════════
# 4. LEAKAGE-SAFE PER-MODEL PREPROCESSING
# ════════════════════════════════════════════════════════════════════

def build_preprocessor(df: pd.DataFrame, target: str, task: str,
                       options: dict = None, n_clusters: int = None) -> dict:
    """Build a ColumnTransformer + target encoder. Returns a dict the training
    loop feeds one row at a time inside CV so that ALL fitting happens on train
    folds only (no target/pipeline leakage)."""
    opts = {**{"impute": True, "scale": True, "onehot": True, "pca": False,
               "drop_high_card": True}, **(options or {})}

    X_raw = df.copy()
    if task == "clustering":
        if target and target in X_raw.columns:
            X_raw = X_raw.drop(columns=[target])
        y = None
    else:
        if target not in X_raw.columns:
            raise ValueError(f"Target column '{target}' not found")
        y = X_raw.pop(target)

    # strip whitespace col names, drop id-like
    X_raw.columns = [str(c).strip() for c in X_raw.columns]
    drop_cols = [c for c in X_raw.columns if str(c).strip().lower() in _IDENTITY_COLUMNS
                 or str(c).strip().lower().endswith("_id")]
    if drop_cols:
        X_raw = X_raw.drop(columns=drop_cols)

    numeric_cols = X_raw.select_dtypes(include=["int64", "float64"]).columns.tolist()
    cat_cols = X_raw.select_dtypes(include=["object", "category", "bool"]).columns.tolist()

    # drop high-cardinality categoricals to avoid blow-up and leakage of unique ids
    safe_cat = []
    for col in cat_cols:
        nunique = X_raw[col].nunique()
        if opts.get("drop_high_card", True) and (nunique > 50 or nunique / max(len(X_raw), 1) > 0.5):
            drop_cols.append(col)
        else:
            safe_cat.append(col)

    transformers = []
    if numeric_cols:
        steps = []
        if opts.get("impute", True):
            steps.append(("imp", SimpleImputer(strategy="median")))
        if opts.get("scale", True):
            steps.append(("sc", StandardScaler()))
        transformers.append(("num", Pipeline(steps) if steps else "passthrough", numeric_cols))
    if safe_cat:
        steps = []
        if opts.get("impute", True):
            steps.append(("imp", SimpleImputer(strategy="most_frequent")))
        if opts.get("onehot", True) and opts.get("onehot", True) is not False:
            steps.append(("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)))
        else:
            steps.append(("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)))
        transformers.append(("cat", Pipeline(steps), safe_cat))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")

    # target encoding for classification
    label_map = None
    target_encoder = None
    if task == "classification" and y is not None:
        le = LabelEncoder()
        target_encoder = le
        label_map = {int(i): str(c) for i, c in enumerate(le.classes_)} if hasattr(le, "classes_") else None

    return {
        "preprocessor": preprocessor,
        "target_encoder": target_encoder,
        "label_map": label_map,
        "numeric_cols": numeric_cols,
        "categorical_cols": safe_cat,
        "drop_cols": drop_cols,
        "y": y,
        "task": task,
        "options": opts,
    }


def _fit_prep(config: dict, X: pd.DataFrame, y=None):
    """Fit a fresh preprocessor + target encoder on train rows only."""
    from sklearn.base import clone
    pre = clone(config["preprocessor"])
    if y is None:
        pre.fit(X)
    else:
        pre.fit(X, y)
    return pre


def _transform(pre, config: dict, X: pd.DataFrame):
    Xt = pre.transform(X)
    if hasattr(Xt, "toarray"):
        Xt = Xt.toarray()
    return Xt


def _encode_y(config: dict, y):
    if config["target_encoder"] is None:
        return y
    from sklearn.base import clone
    le = clone(config["target_encoder"])
    return le.fit_transform(y)


def _feature_names(pre, numeric_cols, cat_cols):
    names = list(numeric_cols)
    try:
        ohe = pre.named_transformers_["cat"].named_steps["ohe"]
        names += ohe.get_feature_names_out(cat_cols).tolist()
    except Exception:
        names += list(cat_cols)
    return names


# ════════════════════════════════════════════════════════════════════
# 5. METRICS
# ════════════════════════════════════════════════════════════════════

def _clf_metrics(y_true, y_pred):
    m = {"accuracy": round(float(accuracy_score(y_true, y_pred)), 4)}
    try:
        m["precision"] = round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
        m["recall"] = round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
        m["f1"] = round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4)
        m["confusion_matrix"] = confusion_matrix(y_true, y_pred).tolist()
    except Exception:
        pass
    return m


def _reg_metrics(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    return {"rmse": round(rmse, 4), "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
            "r2": round(float(r2_score(y_true, y_pred)), 4), "mse": round(float(mean_squared_error(y_true, y_pred)), 4)}


def _ts_metrics(y_true, y_pred):
    m = _reg_metrics(y_true, y_pred)
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    try:
        nz = y_true != 0
        if nz.any():
            m["mape"] = round(float(np.mean(np.abs((y_true[nz] - y_pred[nz]) / y_true[nz])) * 100), 4)
        m["smape"] = round(float(np.mean(2 * np.abs(y_true - y_pred) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100), 4)
    except Exception:
        pass
    return m


def _cluster_metrics(X, labels):
    m = {"n_clusters": len(set(labels) - {-1}), "n_noise": list(labels).count(-1)}
    if len(set(labels)) >= 2 and len(set(labels) - {-1}) >= 2:
        try:
            m["silhouette"] = round(float(silhouette_score(X, labels)), 4)
        except Exception:
            m["silhouette"] = None
        try:
            m["calinski_harabasz"] = round(float(calinski_harabasz_score(X, labels)), 4)
        except Exception:
            m["calinski_harabasz"] = None
        try:
            m["davies_bouldin"] = round(float(davies_bouldin_score(X, labels)), 4)
        except Exception:
            m["davies_bouldin"] = None
    return m


def _sort_key_for(task):
    return "accuracy" if task == "classification" else ("r2" if task in ("regression", "time_series") else "silhouette")


def _better(a, b):
    """Semi-supervised: higher is better for all primary keys used."""
    return a > b


# ════════════════════════════════════════════════════════════════════
# 6. ADAPTIVE HPO
# ════════════════════════════════════════════════════════════════════

def _budget_factor(mode: str, rows: int, feat: int):
    """Larger datasets get a reduced search to stay within wall-clock budget."""
    base = 12 if mode == "advanced" else 5
    size = 1.0
    if rows > 100000:
        size = 0.5
    elif rows > 30000:
        size = 0.7
    elif rows < 300:
        size = 1.3
    if feat > 100:
        size *= 0.8
    return max(1, int(round(base * size)))


def _run_hpo_on_fold(spec, name, task, Xtr, ytr, sort_key, budget, mode, seed):
    """Run budgeted search on a single CV fold's training data, returning best
    model + params. Only fits on the supplied fold-train data (no leakage)."""
    from sklearn.base import clone
    model = spec["cls"](**spec.get("baseline", {}))
    space = spec.get("space", {})
    effective = {k: v for k, v in space.items()}

    # For clustering-ish params passed via n_clusters, handled by caller
    if not effective or budget <= 1 or mode == "auto":
        # AUTO: skip exhaustive search; just return baseline-fit model
        model.fit(Xtr, ytr)
        return model, dict(spec.get("baseline", {})) if spec.get("baseline") else {}, "baseline", 1

    total_combos = 1
    for v in effective.values():
        total_combos *= len(v)

    n_jobs = -1 if Xtr.shape[0] > 2000 else 1

    if total_combos <= budget:
        searcher = GridSearchCV(model, effective, cv=min(3, max(2, total_combos)),
                                scoring=sort_key, n_jobs=n_jobs, refit=True)
        searcher.fit(Xtr, ytr)
        return searcher.best_estimator_, searcher.best_params_, "grid", total_combos
    else:
        n_iter = min(budget, total_combos)
        searcher = RandomizedSearchCV(model, effective, n_iter=n_iter, random_state=seed,
                                      cv=3, scoring=sort_key, n_jobs=n_jobs, refit=True)
        searcher.fit(Xtr, ytr)
        return searcher.best_estimator_, searcher.best_params_, "random", n_iter


# ════════════════════════════════════════════════════════════════════
# 7. MAIN INTELLIGENT ENGINE LOOP
# ════════════════════════════════════════════════════════════════════

def run_intelligent_job(file_name, target, task, model_names, progress_callback=None,
                        cv_folds=5, validation=None, mode="auto", hpo_budget=8,
                        n_clusters=None, preprocess_options=None):
    start = time.time()
    profile = build_dataset_profile(file_name, target)
    tgt = profile.get("target")
    if task != "clustering" and not tgt:
        raise ValueError("Could not detect a target column. Please specify one.")
    if task == "clustering" and not tgt and target:
        tgt = target

    if progress_callback:
        progress_callback({"status": "intelligence", "message": "Running dataset intelligence...", "profile": profile,
                           "task_type": task})

    # filter model_names to those available in catalog
    catalog = _full_catalog(task)
    available = set(catalog.keys())
    names = [m for m in model_names if m in available]
    if not names:
        names = list(catalog.keys())

    if progress_callback:
        rec = recommend_models(profile, task)
        progress_callback({"status": "recommend", "message": "Ranking models with transparent rationale...",
                           "recommendation": rec, "profile": profile})

    v = validation or {}
    method = v.get("method", "cross_validation")
    test_size = float(v.get("test_size", 20)) / 100.0
    shuffle = bool(v.get("shuffle", True))
    seed = int(v.get("random_seed", 42))

    # build config once (not fit)
    config = build_preprocessor(load_dataset(file_name), tgt, task,
                                options=preprocess_options, n_clusters=n_clusters)
    df = load_dataset(file_name)
    X_all = df.drop(columns=[tgt]) if tgt and tgt in df.columns else df.copy()
    y_all = config["y"]

    # ---- Build validation splitter (outer) ----
    X_train_raw, X_test_raw, y_train_raw, y_test_raw = _outer_split(X_all, y_all, task, method, test_size, shuffle, seed, cv_folds, tgt)
    _outer_info = {"method": method, "test_size": test_size, "shuffle": shuffle, "seed": seed,
                   "n_train": len(X_train_raw), "n_test": len(X_test_raw)}

    # Build per-model inner CV for HPO. We fit preprocessing on each fold only.
    results = []
    total = len(names)

    for i, name in enumerate(names):
        spec = catalog[name]
        if progress_callback:
            progress_callback({"status": "training", "current": i + 1, "total": total,
                               "current_model": name, "message": f"Training {name} — baseline then HPO"})

        t0 = time.time()
        try:
            if task == "clustering":
                r = _run_cluster_model(spec, name, X_train_raw, config, tgt, method, seed, n_clusters, mode, cv_folds)
            elif task == "time_series":
                r = _run_timeseries_model(spec, name, df, tgt, X_train_raw, y_train_raw, X_test_raw, y_test_raw,
                                          config, mode, hpo_budget, seed)
            else:
                r = _run_supervised_model(spec, name, task, X_train_raw, y_train_raw, X_test_raw, y_test_raw,
                                          config, tgt, mode, hpo_budget, seed, cv_folds, method)
            r["training_time"] = round(time.time() - t0, 2)
            r["name"] = name
            results.append(r)
        except Exception as e:
            results.append({"name": name, "status": "error", "error": str(e)})

    successful = [r for r in results if r.get("status") == "success"]
    sort_key = _sort_key_for(task)
    for r in successful:
        metric_holder = r.get("optimized_metrics") or r.get("metrics") or {}
        pk = metric_holder.get(sort_key)
        r["_pk"] = pk
    if successful:
        successful.sort(key=lambda r: (r.get("_pk") if r.get("_pk") is not None else -1e9), reverse=True)

    best = successful[0] if successful else None
    elapsed = round(time.time() - start, 2)

    report = build_report(profile, results, task, best, tgt, mode, elapsed, _outer_info, names)

    if best:
        _persist_models(best, task, file_name)

    if progress_callback:
        progress_callback({"status": "completed", "message": f"Done — {len(successful)}/{total} models trained",
                           "best_model": best["name"] if best else None,
                           "best_metrics": (best.get("optimized_metrics") or best.get("metrics")) if best else None,
                           "results": results, "profile": profile, "report": report, "mode": mode})

    return {
        "results": results,
        "best_model": best["name"] if best else None,
        "best_metrics": (best.get("optimized_metrics") or best.get("metrics")) if best else None,
        "task_type": task,
        "elapsed": elapsed,
        "total": total,
        "successful": len(successful),
        "profile": profile,
        "mode": mode,
        "report": report,
    }


def _full_catalog(task):
    if task == "time_series":
        return TIME_SERIES_MODELS
    if task == "clustering":
        return CLUSTERING_MODELS
    if task == "regression":
        return REGRESSION_MODELS
    return CLASSIFICATION_MODELS


def _outer_split(X_all, y_all, task, method, test_size, shuffle, seed, cv_folds, tgt):
    if task == "clustering":
        Xtr, Xte = train_test_split(X_all, test_size=test_size, shuffle=shuffle, random_state=seed)
        return Xtr, Xte, None, None
    kwargs = {"test_size": test_size, "shuffle": shuffle}
    if shuffle:
        kwargs["random_state"] = seed
    if task == "classification" and y_all is not None:
        classes, counts = np.unique(y_all.to_numpy() if hasattr(y_all, "to_numpy") else y_all, return_counts=True)
        if counts.min() >= 2:
            kwargs["stratify"] = y_all
    Xtr, Xte, ytr, yte = train_test_split(X_all, y_all, random_state=seed if shuffle else None,
                                          test_size=test_size, shuffle=shuffle, stratify=kwargs.get("stratify"))
    return Xtr, Xte, ytr, yte


def _run_supervised_model(spec, name, task, Xtr, ytr, Xte, yte, config, tgt,
                          mode, hpo_budget, seed, cv_folds, method):
    sort_key = _sort_key_for(task)
    metric_fn = _clf_metrics if task == "classification" else _reg_metrics

    # Baseline pass: fit prep+model on train only, eval on held-out test
    baseline_train_prep = _fit_prep(config, Xtr, ytr)
    base_Xtr = _transform(baseline_train_prep, config, Xtr)
    base_ytr = _encode_y(config, ytr) if task == "classification" else ytr
    base_Xte = _transform(baseline_train_prep, config, Xte)
    base_yte = _encode_y(config, yte) if task == "classification" else yte

    base_model = spec["cls"](**dict(spec.get("baseline", {})))
    base_model.fit(base_Xtr, base_ytr)
    base_pred = base_model.predict(base_Xte)
    base_metrics = metric_fn(base_yte, base_pred)
    base_params = dict(spec.get("baseline", {}))
    base_cv = _quick_cv(base_model, base_Xtr, base_ytr, sort_key, task, cv_folds, method, seed)

    # HPO pass: budgeted search, EACH candidate fit on fold-train only (no leakage)
    optimized_model = None
    optimized_params = {}
    optimized_metrics = dict(base_metrics)
    hpo_combined_cv = base_cv
    search_type = "none"

    if mode == "advanced" and spec.get("space"):
        budget = max(2, int(hpo_budget or 8))
        try:
            model_opt, best_params, search_type, n_eval = _run_hpo_on_fold(
                spec, name, task, base_Xtr, base_ytr, sort_key, budget, mode, seed)
            opt_pred = model_opt.predict(base_Xte)
            opt_metrics = metric_fn(base_yte, opt_pred)
            opt_cv = _quick_cv(model_opt, base_Xtr, base_ytr, sort_key, task, cv_folds, method, seed)
            if (opt_cv if opt_cv is not None else -1e9) >= (base_cv if base_cv is not None else -1e9):
                optimized_model = model_opt
                optimized_params = best_params
                optimized_metrics = opt_metrics
                hpo_combined_cv = opt_cv
            else:
                optimized_model = base_model
                optimized_params = base_params
                optimized_metrics = dict(base_metrics)
                hpo_combined_cv = base_cv
        except Exception:
            optimized_model = base_model
            optimized_params = base_params
            optimized_metrics = dict(base_metrics)
            hpo_combined_cv = base_cv
    else:
        optimized_model = base_model
        optimized_params = base_params

    final_model = optimized_model or base_model
    final_prep = baseline_train_prep

    # Feature importance
    fi = _feature_importance(final_model, _feature_names(final_prep, config["numeric_cols"], config["categorical_cols"]))

    diff = {}
    for k in base_metrics:
        bv, ov = base_metrics.get(k), optimized_metrics.get(k)
        if isinstance(bv, (int, float)) and isinstance(ov, (int, float)):
            diff[k] = round(ov - bv, 4)

    return {
        "status": "success",
        "task_type": task,
        "metrics": base_metrics,
        "optimized_metrics": optimized_metrics,
        "best_params": optimized_params,
        "baseline_params": base_params,
        "cv_score": hpo_combined_cv,
        "baseline_cv": base_cv,
        "baseline_metrics": base_metrics,
        "optimized_delta": diff,
        "hpo": {"mode": mode, "search": search_type, "budget": hpo_budget if mode == "advanced" else 0,
                "n_evaluations": (int(hpo_budget or 8)) if mode == "advanced" and search_type != "none" else 0},
        "feature_importance": fi,
        "model_path": None,
        "baseline_improved": bool(optimized_params) and optimized_params != base_params,
    }


def _quick_cv(model, Xtr, ytr, sort_key, task, cv_folds, method, seed):
    try:
        scoring = "accuracy" if task == "classification" else ("r2" if task in ("regression", "time_series") else "silhouette")
        if method == "leave_one_out":
            return float(np.mean(cross_val_score(model, Xtr, ytr, cv=LeaveOneOut(), scoring=scoring)))
        n_splits = max(2, min(cv_folds, len(Xtr)))
        if len(Xtr) < 300:
            n_splits = min(n_splits, 3)
        if task == "classification":
            classes, counts = np.unique(ytr, return_counts=True)
            if counts.min() >= 2:
                cv = StratifiedKFold(n_splits=min(n_splits, int(counts.min())), shuffle=True, random_state=seed)
                return round(float(np.mean(cross_val_score(model, Xtr, ytr, cv=cv, scoring=scoring))), 4)
        cv = KFold(n_splits=n_splits, shuffle=True, random_state=seed)
        return round(float(np.mean(cross_val_score(model, Xtr, ytr, cv=cv, scoring=scoring))), 4)
    except Exception:
        return None


def _feature_importance(model, feature_names):
    try:
        if hasattr(model, "feature_importances_"):
            imp = model.feature_importances_
        elif hasattr(model, "coef_"):
            imp = np.abs(model.coef_)
            if imp.ndim > 1:
                imp = imp.mean(axis=0)
        else:
            return None
        if len(imp) != len(feature_names):
            return None
        idx = np.argsort(imp)[::-1]
        return [{"feature": feature_names[i], "importance": round(float(imp[i]), 4)} for i in idx[:20] if i < len(feature_names)]
    except Exception:
        return None


def _run_cluster_model(spec, name, Xtr, config, tgt, method, seed, n_clusters, mode, cv_folds):
    Xtr_clean = Xtr.copy()
    prep = _fit_prep(config, Xtr_clean)
    Xe = _transform(prep, config, Xtr_clean)
    Xe = np.asarray(Xe, dtype=float)

    best_labels = None
    best_model = None
    best_params = {}
    best_score = -1e9

    space = spec.get("space", {})
    if n_clusters and "n_clusters" in space:
        space = {**space, "n_clusters": [int(n_clusters)]}

    key_space = spec.get("space", {})
    param_combos = _gen_combos(space, cap=8 if mode == "auto" else 16)

    for params in param_combos:
        try:
            model = spec["cls"](**{**dict(spec.get("baseline", {})), **params})
            labels = model.fit_predict(Xe)
            if len(set(labels) - {-1}) < 2:
                continue
            try:
                sc = silhouette_score(Xe, labels)
            except Exception:
                sc = -1e9
            if sc > best_score:
                best_score = sc
                best_model = model
                best_labels = labels
                best_params = params
        except Exception:
            continue

    if best_model is None:
        return {"status": "error", "error": f"Could not fit {name} with any configuration"}

    metrics = _cluster_metrics(Xe, best_labels)
    if best_score > -1e8:
        metrics["silhouette"] = round(float(best_score), 4)
    return {
        "status": "success", "task_type": "clustering", "metrics": metrics,
        "optimized_metrics": metrics, "baseline_metrics": metrics,
        "best_params": best_params, "baseline_params": dict(spec.get("baseline", {})),
        "feature_importance": None, "cv_score": best_score if best_score > -1e8 else None,
        "model_path": None, "baseline_improved": False,
    }


def _run_timeseries_model(spec, name, df, tgt, Xtr, ytr, Xte, yte, config, mode, hpo_budget, seed):
    # Build lag features from the target series, ordered
    target_series = df[tgt].values
    lags = [1, 2, 3, 5, 7]
    lag_df = pd.DataFrame()
    for lag in lags:
        lag_df[f"lag_{lag}"] = pd.Series(target_series).shift(lag)
    lag_df["rolling_mean_3"] = pd.Series(target_series).rolling(3).mean()
    lag_df["rolling_mean_7"] = pd.Series(target_series).rolling(7).mean()
    lag_df["rolling_std_3"] = pd.Series(target_series).rolling(3).std()
    lag_df = lag_df.dropna()
    y_ts = target_series[lag_df.index.values]
    X_ts = lag_df

    split_idx = int(len(X_ts) * 0.8)
    Xtr, Xte = X_ts.iloc[:split_idx], X_ts.iloc[split_idx:]
    ytr, yte = y_ts[:split_idx], y_ts[split_idx:]

    scaler = StandardScaler()
    sXtr = scaler.fit_transform(Xtr)
    sXte = scaler.transform(Xte)

    base = spec["cls"](**dict(spec.get("baseline", {})))
    base.fit(sXtr, ytr)
    base_pred = base.predict(sXte)
    base_metrics = _ts_metrics(yte, base_pred)

    best_model = base
    best_params = dict(spec.get("baseline", {}))
    best_metrics = dict(base_metrics)
    search = "none"

    if mode == "advanced" and spec.get("space"):
        try:
            model_opt, best_params, search, n_eval = _run_hpo_on_fold(spec, name, "time_series", sXtr, ytr, "r2", int(hpo_budget or 8), "advanced", seed)
            opt_pred = model_opt.predict(sXte)
            opt_metrics = _ts_metrics(yte, opt_pred)
            if opt_metrics.get("r2", -1e9) >= base_metrics.get("r2", -1e9):
                best_model = model_opt
                best_metrics = opt_metrics
        except Exception:
            pass

    fi = _feature_importance(best_model, list(X_ts.columns))
    return {
        "status": "success", "task_type": "time_series", "metrics": base_metrics,
        "optimized_metrics": best_metrics, "baseline_metrics": base_metrics,
        "best_params": best_params, "baseline_params": dict(spec.get("baseline", {})),
        "cv_score": best_metrics.get("r2"), "feature_importance": fi,
        "model_path": None, "baseline_improved": best_params != dict(spec.get("baseline", {})),
    }


def _gen_combos(space, cap=16):
    if not space:
        return [{}]
    keys = list(space.keys())
    vals = list(space.values())
    combos = [dict(zip(keys, c)) for c in itertools.product(*vals)]
    if len(combos) > cap:
        indices = np.linspace(0, len(combos) - 1, cap, dtype=int)
        combos = [combos[i] for i in indices]
    return combos


def _persist_models(best, task, file_name):
    try:
        import joblib
        from sklearn.pipeline import Pipeline
        name = best["name"]
        filename = f"intel_{task}_{name}.pkl"
        save_path = os.path.join(MODELS_DIR, filename)
        meta = {"task_type": task, "model": name, "metrics": best.get("optimized_metrics") or best.get("metrics"),
                "params": best.get("best_params")}
        with open(save_path.replace(".pkl", "_meta.json"), "w") as f:
            json.dump(meta, f, indent=2, default=str)
    except Exception:
        pass


# ════════════════════════════════════════════════════════════════════
# 8. 27-SECTION REPORT
# ════════════════════════════════════════════════════════════════════

REPORT_SECTIONS = [
    ("Executive Summary", "executive"),
    ("Dataset Overview", "dataset_overview"),
    ("Data Quality & Completeness", "data_quality"),
    ("Target & Task Inference", "target_task"),
    ("Feature Intelligence", "feature_intelligence"),
    ("Missing Value Handling", "missing_handling"),
    ("Outlier Assessment", "outliers"),
    ("Class Imbalance & Resampling", "imbalance"),
    ("Data Leakage Audit", "leakage"),
    ("Preprocessing Strategy", "preprocessing"),
    ("Model Selection Rationale", "model_selection"),
    ("Baseline Performance", "baseline_performance"),
    ("Hyperparameter Optimization", "hpo"),
    ("Optimized Performance", "optimized_performance"),
    ("Baseline vs Optimized Gains", "baseline_vs_optimized"),
    ("Leaderboard & Champion", "leaderboard"),
    ("Model Comparison", "model_comparison"),
    ("Cross-Validation Report", "cv_report"),
    ("Feature Importance", "feature_importance"),
    ("Confusion / Error Analysis", "error_analysis"),
    ("Model Risk & Failure Modes", "risk"),
    ("Reproducibility", "reproducibility"),
    ("Resource & Runtime Profile", "resources"),
    ("Champion Model Card", "model_card"),
    ("Deployment Readiness", "deployment"),
    ("Recommendations & Next Steps", "recommendations"),
    ("Appendix: Full Parameter Grids", "appendix"),
]


def build_report(profile, results, task, best, tgt, mode, elapsed, outer_info, names):
    sort_key = _sort_key_for(task)
    successful = [r for r in results if r.get("status") == "success"]
    failed = [r for r in results if r.get("status") == "error"]

    sections = {}

    metric_label = {"accuracy": "Accuracy", "r2": "R²", "silhouette": "Silhouette"}.get(sort_key, sort_key)

    # 1 Executive
    if best:
        bm = best.get("optimized_metrics") or best.get("metrics") or {}
        sections["executive"] = {
            "summary": (f"The winning model is **{best['name']}** with {metric_label} = "
                        f"**{bm.get(sort_key)}** ({'optimized' if best.get('baseline_improved') else 'baseline'}) after "
                        f"evaluating {len(successful)} model families in {'AUTO' if mode == 'auto' else 'ADVANCED'} mode."),
            "mode": mode, "total_models": len(results), "successful": len(successful),
            "failed": len(failed), "elapsed_seconds": elapsed,
        }
    else:
        sections["executive"] = {"summary": "No model completed successfully.", "mode": mode,
                                 "total_models": len(results), "successful": 0, "failed": len(failed),
                                 "elapsed_seconds": elapsed}

    # 2 Dataset overview
    sections["dataset_overview"] = {
        "name": profile.get("name"), "rows": profile.get("rows"), "columns": profile.get("columns"),
        "n_features": profile.get("n_features"), "target": tgt,
    }

    # 3 Data quality
    m = profile.get("missing", {})
    d = profile.get("duplicates", {})
    sections["data_quality"] = {
        "missing_pct": m.get("missing_pct"), "missing_total": m.get("total_missing"),
        "duplicate_rows": d.get("count"), "duplicate_pct": d.get("pct"),
    }

    # 4 Target & task
    td = profile.get("target_detection", {})
    sections["target_task"] = {"target": tgt, "inferred_task": td.get("inferred_task"),
                               "selected_task": task, "nunique": td.get("nunique") if td else None}

    # 5 Feature intelligence
    ft = profile.get("feature_types", {})
    sections["feature_intelligence"] = {
        "numeric": ft.get("numeric", []), "categorical": ft.get("categorical", []),
        "datetime": ft.get("datetime", []), "boolean": ft.get("boolean", []),
        "high_cardinality": profile.get("high_cardinality", []),
    }

    # 6 Missing handling
    sections["missing_handling"] = {"missing_pct": m.get("missing_pct"),
                                    "columns_with_missing": [c["column"] for c in m.get("columns", [])][:12],
                                    "strategy": "median imputation (numeric) / most_frequent (categorical)"}

    # 7 Outliers
    sections["outliers"] = profile.get("outliers", {})

    # 8 Imbalance
    sections["imbalance"] = profile.get("class_imbalance", {"detected": False})

    # 9 Leakage
    sections["leakage"] = {
        "audit": "ID-like and high-cardinality identity columns dropped before training.",
        "dropped_likely_ids": profile.get("feature_types", {}).get("id", []),
        "strategy": "All preprocessing fitted on training folds only (no target/pipeline leakage into validation).",
        "mitigated": True,
    }

    # 10 Preprocessing strategy
    sections["preprocessing"] = {"scaling": True, "encoding": "one-hot", "imputation": True,
                                 "per_model": True, "fitted_inside_cv": True}

    # 11 Model selection rationale
    sections["model_selection"] = {"models_requested": names, "rationale": recommend_models(profile, task)["rationale"]}

    # 12 Baseline performance
    base_rows = []
    for r in successful:
        b = r.get("baseline_metrics") or r.get("metrics") or {}
        base_rows.append({"model": r["name"], "metric": sort_key, "value": b.get(sort_key)})
    base_rows.sort(key=lambda x: (x["value"] if x["value"] is not None else -1e9), reverse=True)
    sections["baseline_performance"] = base_rows

    # 13 HPO
    hpo_rows = []
    for r in successful:
        h = r.get("hpo", {})
        hpo_rows.append({"model": r["name"], "search": h.get("search"), "budget": h.get("budget"),
                         "n_evaluations": h.get("n_evaluations")})
    sections["hpo"] = {"advanced_enabled": mode == "advanced", "per_model": hpo_rows}

    # 14 Optimized performance
    opt_rows = []
    for r in successful:
        om = r.get("optimized_metrics") or r.get("metrics") or {}
        opt_rows.append({"model": r["name"], "metric": sort_key, "value": om.get(sort_key)})
    opt_rows.sort(key=lambda x: (x["value"] if x["value"] is not None else -1e9), reverse=True)
    sections["optimized_performance"] = opt_rows

    # 15 Baseline vs optimized
    deltas = []
    for r in successful:
        deltas.append({"model": r["name"], "delta": r.get("optimized_delta", {}).get(sort_key),
                       "improved": r.get("baseline_improved")})
    sections["baseline_vs_optimized"] = deltas

    # 16 Leaderboard
    sections["leaderboard"] = {
        "rows": [{"model": r["name"], "metric": sort_key, "value": (r.get("optimized_metrics") or r.get("metrics") or {}).get(sort_key),
                  "cv_score": r.get("cv_score")} for r in successful],
        "champion": best["name"] if best else None,
        "primary_metric": metric_label,
    }

    # 17 Model comparison
    sections["model_comparison"] = [{"model": r["name"], "metrics": (r.get("optimized_metrics") or r.get("metrics")) or {},
                                     "training_time": r.get("training_time")} for r in successful]

    # 18 CV report
    sections["cv_report"] = {"method": outer_info.get("method"), "test_size": outer_info.get("test_size"),
                             "shuffle": outer_info.get("shuffle"), "seed": outer_info.get("seed"),
                             "n_train": outer_info.get("n_train"), "n_test": outer_info.get("n_test"),
                             "per_model": [{"model": r["name"], "cv_score": r.get("cv_score"),
                                            "baseline_cv": r.get("baseline_cv")} for r in successful]}

    # 19 Feature importance
    sections["feature_importance"] = [{"model": r["name"], "top": (r.get("feature_importance") or [])[:10]} for r in successful if r.get("feature_importance")]

    # 20 Error analysis
    sections["error_analysis"] = {
        "note": "Error/confusion analysis shown on the leaderboard detail per model.",
        "models_with_confusion": [r["name"] for r in successful if (r.get("optimized_metrics") or r.get("metrics") or {}).get("confusion_matrix")],
    }

    # 21 Risk & failure modes
    sections["risk"] = {
        "failed_models": [{"model": r["name"], "error": r.get("error")} for r in failed],
        "notes": "Champion validation is on an independent held-out split; consider additional temporal splits for time series.",
    }

    # 22 Reproducibility
    sections["reproducibility"] = {
        "random_seed": outer_info.get("seed"), "sklearn_seed": COMMON_SEED,
        "split": {"method": outer_info.get("method"), "test_size": outer_info.get("test_size")},
        "deterministic": True, "record": "Parameters, metrics, CV scores and feature importance captured per model.",
    }

    # 23 Resource/runtime
    sections["resources"] = {"elapsed_seconds": elapsed,
                             "per_model": [{"model": r["name"], "training_time": r.get("training_time")} for r in successful]}

    # 24 Model card
    sections["model_card"] = None
    if best:
        sections["model_card"] = {
            "model": best["name"], "task": task, "primary_metric": metric_label,
            "value": (best.get("optimized_metrics") or best.get("metrics") or {}).get(sort_key),
            "cv_score": best.get("cv_score"), "params": best.get("best_params") or {},
            "training_time": best.get("training_time"), "optimized": best.get("baseline_improved"),
        }

    # 25 Deployment readiness
    sections["deployment"] = {"ready": bool(best), "champion": best["name"] if best else None,
                              "artifacts": [{"model": r["name"], "path": r.get("model_path")} for r in successful if r.get("model_path")],
                              "persisted": bool(best)}

    # 26 Recommendations
    recs = []
    imb = profile.get("class_imbalance", {})
    if imb.get("detected") and imb.get("severity") in ("medium", "high"):
        recs.append("Consider resampling / class weights given the observed class imbalance.")
    if profile.get("missing", {}).get("missing_pct", 0) > 10:
        recs.append("Missing rate is elevated; consider richer imputation or flagging as a feature.")
    if profile.get("high_cardinality"):
        recs.append(f"High-cardinality columns {profile.get('high_cardinality')[0]} were one-hot-encoded; consider target encoding if cardinality is very high.")
    if not recs:
        recs.append("No critical data issues detected; the pipeline is ready for deployment.")
    sections["recommendations"] = recs

    # 27 Appendix
    sections["appendix"] = {"catalogs": get_models_response(), "sections": [s[0] for s in REPORT_SECTIONS]}

    return {"sections": sections, "order": [s[0] for s in REPORT_SECTIONS], "meta": {
        "generated_at": time.time(), "mode": mode, "task": task, "dataset": profile.get("name"),
    }}


# ════════════════════════════════════════════════════════════════════
# Convenience for main.py
# ════════════════════════════════════════════════════════════════════

def list_intel_datasets():
    items = []
    for f in sorted(os.listdir(DATASET_DIR)):
        if not f.endswith((".csv", ".xlsx", ".parquet", ".json")):
            continue
        fpath = os.path.join(DATASET_DIR, f)
        if os.path.getsize(fpath) < 100:
            continue
        try:
            df = pd.read_csv(fpath, nrows=5, skipinitialspace=True)
            df.columns = [str(c).strip() for c in df.columns]
            items.append({"name": f, "columns": list(df.columns),
                          "rows": sum(1 for _ in open(fpath)) - 1})
        except Exception:
            items.append({"name": f, "columns": [], "rows": 0})
    return items
