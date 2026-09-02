"""Generate sample models for demo/evaluation purposes."""
import os
import sys
import json
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import accuracy_score, r2_score, mean_squared_error, mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer

from sklearn.linear_model import LogisticRegression, Ridge, Lasso
from sklearn.ensemble import (
    RandomForestClassifier, GradientBoostingClassifier,
    RandomForestRegressor, GradientBoostingRegressor,
)
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.naive_bayes import GaussianNB

try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def preprocess(df, target_col, task_type):
    y_raw = df[target_col]
    X_raw = df.drop(columns=[target_col])

    numeric_features = X_raw.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_features = X_raw.select_dtypes(include=["object", "category"]).columns.tolist()

    safe_cat = []
    for col in categorical_features:
        if X_raw[col].nunique() <= 50:
            safe_cat.append(col)

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_features),
        ] + ([("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False))]), safe_cat)] if safe_cat else []),
        remainder="drop",
    )

    X_processed = preprocessor.fit_transform(X_raw)
    if hasattr(X_processed, "toarray"):
        X_processed = X_processed.toarray()

    cat_out = []
    if safe_cat:
        try:
            enc = preprocessor.named_transformers_["cat"].named_steps["encoder"]
            cat_out = enc.get_feature_names_out(safe_cat).tolist()
        except Exception:
            cat_out = safe_cat

    feature_names = numeric_features + cat_out
    X_df = pd.DataFrame(X_processed, columns=feature_names)

    is_string = y_raw.dtype == object or "string" in str(y_raw.dtype) or y_raw.dtype.name in ("object", "str", "string", "category")
    if task_type == "classification" and is_string:
        from sklearn.preprocessing import LabelEncoder
        le = LabelEncoder()
        y = pd.Series(le.fit_transform(y_raw.astype(str)), index=y_raw.index)
        label_map = {int(i): str(c) for i, c in enumerate(le.classes_)}
    else:
        y = y_raw.values.astype(float)
        label_map = None

    return X_df, y, feature_names, preprocessor, label_map


def compute_metrics(y_true, y_pred, task_type):
    if task_type == "classification":
        return {
            "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        }
    else:
        return {
            "mse": round(float(mean_squared_error(y_true, y_pred)), 4),
            "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
            "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
            "r2": round(float(r2_score(y_true, y_pred)), 4),
        }


def get_feature_importance(model, feature_names):
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
    return [{"feature": feature_names[i], "importance": round(float(imp[i]), 4)} for i in idx[:20]]


def train_and_save(name, model, X_df, y, feature_names, preprocessor, label_map, task_type, prefix, extra_params=None):
    X_train, X_test, y_train, y_test = train_test_split(X_df, y, test_size=0.2, random_state=42,
                                                         stratify=y if task_type == "classification" else None)
    start = time.time()
    model.fit(X_train, y_train)
    train_time = round(time.time() - start, 2)

    y_pred = model.predict(X_test)
    metrics = compute_metrics(y_test, y_pred, task_type)

    cv = min(5, len(X_train))
    scoring = "accuracy" if task_type == "classification" else "r2"
    cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring=scoring)
    cv_score = round(float(cv_scores.mean()), 4)

    fi = get_feature_importance(model, feature_names)

    pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)])
    filename = f"{prefix}_{name}.pkl"
    save_path = os.path.join(MODELS_DIR, filename)
    joblib.dump(pipeline, save_path)

    n_classes = int(y.nunique()) if task_type == "classification" else None

    metadata = {
        "task_type": task_type,
        "n_classes": n_classes,
        "feature_names": feature_names,
        "label_map": label_map,
        "best_params": extra_params or {},
        "cv_score": cv_score,
        "metrics": metrics,
        "feature_importance": fi,
        "training_time": train_time,
        "test_size": len(X_test),
        "train_size": len(X_train),
        "total_results": [{"name": name, "cv_score": cv_score, "metrics": metrics, "training_time": train_time}],
    }
    meta_path = save_path.replace(".pkl", "_meta.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    print(f"  Saved {filename} (cv={cv_score}, metrics={metrics})")
    return filename


def main():
    print("Loading iris.csv...")
    iris = pd.read_csv(os.path.join(DATASET_DIR, "iris.csv"))

    # --- Classification: predict species ---
    print("\n=== Classification models (iris, target=species) ===")
    X_cls, y_cls, feat_cls, pre_cls, label_map_cls = preprocess(iris, "species", "classification")

    cls_models = {
        "LogisticRegression": (LogisticRegression(max_iter=2000, random_state=42), {"C": 1}),
        "RandomForest": (RandomForestClassifier(n_estimators=100, random_state=42), {"n_estimators": 100}),
        "GradientBoosting": (GradientBoostingClassifier(n_estimators=100, random_state=42), {"n_estimators": 100}),
        "KNN": (KNeighborsClassifier(n_neighbors=5), {"n_neighbors": 5}),
        "DecisionTree": (DecisionTreeClassifier(max_depth=5, random_state=42), {"max_depth": 5}),
        "NaiveBayes": (GaussianNB(), {}),
        "SVC": (SVC(kernel="rbf", random_state=42), {"kernel": "rbf"}),
    }
    if HAS_XGB:
        cls_models["XGBoost"] = (XGBClassifier(n_estimators=100, random_state=42, verbosity=0), {"n_estimators": 100})
    if HAS_LGBM:
        cls_models["LightGBM"] = (LGBMClassifier(n_estimators=100, random_state=42, verbose=-1), {"n_estimators": 100})

    for name, (model, params) in cls_models.items():
        try:
            train_and_save(name, model, X_cls, y_cls, feat_cls, pre_cls, label_map_cls, "classification", "iris_cls", params)
        except Exception as e:
            print(f"  FAILED {name}: {e}")

    # --- Regression: predict sepal_length ---
    print("\n=== Regression models (iris, target=sepal_length) ===")
    X_reg, y_reg, feat_reg, pre_reg, _ = preprocess(iris, "sepal_length", "regression")

    reg_models = {
        "SVR": (SVR(kernel="linear", C=1), {"kernel": "linear", "C": 1}),
        "Ridge": (Ridge(alpha=1.0, random_state=42), {"alpha": 1.0}),
        "Lasso": (Lasso(alpha=0.1, random_state=42), {"alpha": 0.1}),
        "RandomForest": (RandomForestRegressor(n_estimators=100, random_state=42), {"n_estimators": 100}),
        "GradientBoosting": (GradientBoostingRegressor(n_estimators=100, random_state=42), {"n_estimators": 100}),
        "KNN": (KNeighborsRegressor(n_neighbors=5), {"n_neighbors": 5}),
        "DecisionTree": (DecisionTreeRegressor(max_depth=5, random_state=42), {"max_depth": 5}),
    }
    if HAS_XGB:
        reg_models["XGBoost"] = (XGBRegressor(n_estimators=100, random_state=42, verbosity=0), {"n_estimators": 100})
    if HAS_LGBM:
        reg_models["LightGBM"] = (LGBMRegressor(n_estimators=100, random_state=42, verbose=-1), {"n_estimators": 100})

    for name, (model, params) in reg_models.items():
        try:
            train_and_save(name, model, X_reg, y_reg, feat_reg, pre_reg, None, "regression", "iris_reg", params)
        except Exception as e:
            print(f"  FAILED {name}: {e}")

    print("\nDone! Check models/ directory.")


if __name__ == "__main__":
    main()
