import os
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, RandomizedSearchCV, GridSearchCV
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    mean_squared_error, mean_absolute_error, r2_score, roc_auc_score
)
from sklearn.pipeline import Pipeline

# Classification models
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB

# Regression models
from sklearn.linear_model import Ridge, Lasso
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeRegressor

# Optional models
try:
    from xgboost import XGBClassifier, XGBRegressor
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False

try:
    from lightgbm import LGBMClassifier, LGBMRegressor
    LGBM_AVAILABLE = True
except ImportError:
    LGBM_AVAILABLE = False

try:
    from catboost import CatBoostClassifier, CatBoostRegressor
    CATB_AVAILABLE = True
except ImportError:
    CATB_AVAILABLE = False

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

CLASSIFICATION_MODELS = {
    "LogisticRegression": {
        "model": LogisticRegression(max_iter=2000, random_state=42),
        "params": {"C": [0.01, 0.1, 1, 10], "solver": ["lbfgs"]},
    },
    "RandomForest": {
        "model": RandomForestClassifier(random_state=42),
        "params": {"n_estimators": [50, 100, 200], "max_depth": [None, 10, 20]},
    },
    "GradientBoosting": {
        "model": GradientBoostingClassifier(random_state=42),
        "params": {"n_estimators": [50, 100], "learning_rate": [0.01, 0.1], "max_depth": [3, 5]},
    },
    "DecisionTree": {
        "model": DecisionTreeClassifier(random_state=42),
        "params": {"max_depth": [None, 5, 10, 20], "min_samples_split": [2, 5, 10]},
    },
    "SVC": {
        "model": SVC(random_state=42),
        "params": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"]},
    },
    "KNN": {
        "model": KNeighborsClassifier(),
        "params": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]},
    },
    "NaiveBayes": {
        "model": GaussianNB(),
        "params": {"var_smoothing": [1e-09, 1e-08, 1e-07]},
    },
}

if XGB_AVAILABLE:
    CLASSIFICATION_MODELS["XGBoost"] = {
        "model": XGBClassifier(random_state=42, verbosity=0),
        "params": {"n_estimators": [50, 100], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3]},
    }

if LGBM_AVAILABLE:
    CLASSIFICATION_MODELS["LightGBM"] = {
        "model": LGBMClassifier(random_state=42, verbose=-1),
        "params": {"n_estimators": [50, 100], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1]},
    }

if CATB_AVAILABLE:
    CLASSIFICATION_MODELS["CatBoost"] = {
        "model": CatBoostClassifier(random_state=42, verbose=0),
        "params": {"iterations": [50, 100], "depth": [4, 6, 8], "learning_rate": [0.01, 0.1]},
    }

REGRESSION_MODELS = {
    "Ridge": {
        "model": Ridge(random_state=42),
        "params": {"alpha": [0.01, 0.1, 1, 10, 100]},
    },
    "Lasso": {
        "model": Lasso(random_state=42),
        "params": {"alpha": [0.001, 0.01, 0.1, 1]},
    },
    "RandomForest": {
        "model": RandomForestRegressor(random_state=42),
        "params": {"n_estimators": [50, 100, 200], "max_depth": [None, 10, 20]},
    },
    "GradientBoosting": {
        "model": GradientBoostingRegressor(random_state=42),
        "params": {"n_estimators": [50, 100], "learning_rate": [0.01, 0.1], "max_depth": [3, 5]},
    },
    "DecisionTree": {
        "model": DecisionTreeRegressor(random_state=42),
        "params": {"max_depth": [None, 5, 10, 20], "min_samples_split": [2, 5, 10]},
    },
    "SVR": {
        "model": SVR(),
        "params": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"]},
    },
    "KNN": {
        "model": KNeighborsRegressor(),
        "params": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]},
    },
}

if XGB_AVAILABLE:
    REGRESSION_MODELS["XGBoost"] = {
        "model": XGBRegressor(random_state=42, verbosity=0),
        "params": {"n_estimators": [50, 100], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3]},
    }

if LGBM_AVAILABLE:
    REGRESSION_MODELS["LightGBM"] = {
        "model": LGBMRegressor(random_state=42, verbose=-1),
        "params": {"n_estimators": [50, 100], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1]},
    }

if CATB_AVAILABLE:
    REGRESSION_MODELS["CatBoost"] = {
        "model": CatBoostRegressor(random_state=42, verbose=0),
        "params": {"iterations": [50, 100], "depth": [4, 6, 8], "learning_rate": [0.01, 0.1]},
    }


def run_automl_training(X, y, task_type, model_name_prefix="automl_model", preprocessor=None, cv_folds=5):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if task_type == "classification" else None
    )

    model_candidates = CLASSIFICATION_MODELS if task_type == "classification" else REGRESSION_MODELS
    n_classes = y.nunique() if task_type == "classification" else None

    results = []
    for name, spec in model_candidates.items():
        try:
            start = time.time()
            base_model = spec["model"]
            param_dist = spec["params"]

            if n_classes == 2 and name == "LogisticRegression":
                pass

            n_iter = min(5, _count_params(param_dist))
            cv = max(2, min(cv_folds, 10))
            search = RandomizedSearchCV(
                base_model, param_dist, n_iter=n_iter,
                cv=cv, scoring=_default_scoring(task_type),
                random_state=42, n_jobs=1, verbose=0,
            )
            search.fit(X_train, y_train)

            train_time = time.time() - start
            y_pred = search.predict(X_test)
            cv_score = search.best_score_

            metrics = _compute_metrics(y_test, y_pred, task_type)
            try:
                best_est = search.best_estimator_
                if hasattr(best_est, "predict_proba"):
                    y_proba = best_est.predict_proba(X_test)
                    n_cls = len(np.unique(y_test))
                    if n_cls == 2:
                        metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_proba[:, 1])), 4)
                    else:
                        metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_proba, multi_class="ovr", average="weighted")), 4)
            except Exception:
                pass

            feature_importance = _get_feature_importance(search.best_estimator_, X.columns, task_type)

            results.append({
                "name": name,
                "model": search.best_estimator_,
                "best_params": search.best_params_,
                "cv_score": round(float(cv_score), 4),
                "metrics": metrics,
                "feature_importance": feature_importance,
                "training_time": round(train_time, 2),
            })
        except Exception as e:
            results.append({"name": name, "model": None, "error": str(e)})

    successful = [r for r in results if r["model"] is not None]
    if not successful:
        errors = [f"{r['name']}: {r['error']}" for r in results if "error" in r]
        raise RuntimeError(f"No models trained successfully. Errors: {'; '.join(errors)}")

    if task_type == "classification":
        successful.sort(key=lambda r: r["metrics"]["accuracy"], reverse=True)
    else:
        successful.sort(key=lambda r: r["metrics"]["r2"], reverse=True)

    best = successful[0]

    full_pipeline = Pipeline([("preprocessor", preprocessor), ("model", best["model"])]) if preprocessor else best["model"]

    model_filename = f"{model_name_prefix}_{best['name']}.pkl"
    save_path = os.path.join(MODELS_DIR, model_filename)
    joblib.dump(full_pipeline, save_path)

    label_encoder = getattr(y, "attrs", {}).get("label_encoder")
    label_map = None
    if label_encoder is not None:
        label_map = {int(i): str(c) for i, c in enumerate(label_encoder.classes_)}

    metadata = {
        "task_type": task_type,
        "n_classes": n_classes,
        "feature_names": list(X.columns),
        "label_map": label_map,
        "best_params": best["best_params"],
        "cv_score": best["cv_score"],
        "metrics": best["metrics"],
        "feature_importance": best.get("feature_importance"),
        "training_time": best["training_time"],
        "test_size": len(X_test),
        "train_size": len(X_train),
        "total_results": [
            {
                "name": r["name"],
                "cv_score": r.get("cv_score"),
                "metrics": r.get("metrics"),
                "training_time": r.get("training_time"),
            }
            for r in successful
        ],
    }
    metadata_path = save_path.replace(".pkl", "_meta.json")
    import json
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    return {
        "best_model": best["name"],
        "best_params": best["best_params"],
        "cv_score": best["cv_score"],
        "metrics": best["metrics"],
        "feature_importance": best.get("feature_importance"),
        "training_time": best["training_time"],
        "saved_at": model_filename,
        "task_type": task_type,
        "results": metadata["total_results"],
    }


def run_tuning(X, y, task_type, model_names, param_overrides, search_method="random", cv_folds=5):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if task_type == "classification" else None
    )
    model_candidates = CLASSIFICATION_MODELS if task_type == "classification" else REGRESSION_MODELS
    effective_cv = max(2, min(cv_folds, 10))
    results = []
    for name in model_names:
        if name not in model_candidates:
            results.append({"name": name, "error": f"Unknown model '{name}'"})
            continue
        try:
            start = time.time()
            spec = model_candidates[name]
            base_model = spec["model"]
            param_dist = param_overrides.get(name, spec["params"])
            scoring = _default_scoring(task_type)
            if search_method == "grid":
                search = GridSearchCV(
                    base_model, param_dist, cv=effective_cv,
                    scoring=scoring, n_jobs=1, verbose=0,
                )
            else:
                from math import prod
                total_combos = prod([len(v) for v in param_dist.values()])
                n_iter = max(5, min(50, total_combos))
                search = RandomizedSearchCV(
                    base_model, param_dist, n_iter=n_iter,
                    cv=effective_cv, scoring=scoring,
                    random_state=42, n_jobs=1, verbose=0,
                )
            search.fit(X_train, y_train)
            train_time = time.time() - start
            y_pred = search.predict(X_test)
            cv_score = search.best_score_
            metrics = _compute_metrics(y_test, y_pred, task_type)

            # Collect per-fold scores
            fold_scores = None
            if hasattr(search, "cv_results_"):
                fold_keys = [k for k in search.cv_results_ if k.startswith("split") and k.endswith("_test_score")]
                if fold_keys:
                    fold_scores = [round(float(search.cv_results_[k][search.best_index_]), 4) for k in sorted(fold_keys, key=lambda x: int(x.split("split")[1].split("_")[0]))]

            results.append({
                "name": name,
                "best_params": {k: (float(v) if isinstance(v, (np.floating,)) else int(v) if isinstance(v, (np.integer,)) else v) for k, v in search.best_params_.items()},
                "cv_score": round(float(cv_score), 4),
                "fold_scores": fold_scores,
                "n_iter": search.n_iter if hasattr(search, "n_iter") else None,
                "metrics": metrics,
                "training_time": round(train_time, 2),
            })
        except Exception as e:
            results.append({"name": name, "error": str(e)})
    return {"results": results, "task_type": task_type}

def run_engine_training(X, y, task_type, model_names, model_name_prefix="automl_engine", preprocessor=None):
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if task_type == "classification" else None
    )
    model_candidates = CLASSIFICATION_MODELS if task_type == "classification" else REGRESSION_MODELS
    results = []
    for name in model_names:
        if name not in model_candidates:
            continue
        try:
            start = time.time()
            spec = model_candidates[name]
            base_model = spec["model"]
            base_model.fit(X_train, y_train)
            train_time = time.time() - start
            y_pred = base_model.predict(X_test)
            metrics = _compute_metrics(y_test, y_pred, task_type)
            cv_scores = cross_val_score(base_model, X_train, y_train, cv=max(2, min(5, len(X_train))), scoring=_default_scoring(task_type))
            cv_score = round(float(cv_scores.mean()), 4)
            fi = _get_feature_importance(base_model, X.columns, task_type)
            results.append({
                "name": name,
                "cv_score": cv_score,
                "metrics": metrics,
                "training_time": round(train_time, 2),
                "feature_importance": fi,
                "best_params": {},
            })
            model_filename = f"{model_name_prefix}_{name}.pkl"
            save_path = os.path.join(MODELS_DIR, model_filename)
            full_pipeline = Pipeline([("preprocessor", preprocessor), ("model", base_model)]) if preprocessor else base_model
            joblib.dump(full_pipeline, save_path)
        except Exception as e:
            results.append({"name": name, "error": str(e)})
    successful = [r for r in results if "error" not in r]
    if successful:
        sort_key = "accuracy" if task_type == "classification" else "r2"
        successful.sort(key=lambda r: r["metrics"].get(sort_key, 0), reverse=True)
    return {"results": results, "best_model": successful[0]["name"] if successful else None, "task_type": task_type}

def _count_params(param_dist):
    count = 1
    for v in param_dist.values():
        count *= len(v)
    return count


def _default_scoring(task_type):
    return "accuracy" if task_type == "classification" else "r2"


def _compute_metrics(y_true, y_pred, task_type):
    metrics = {}
    if task_type == "classification":
        metrics["accuracy"] = round(float(accuracy_score(y_true, y_pred)), 4)
        try:
            metrics["precision"] = round(float(precision_score(y_true, y_pred, average="weighted")), 4)
            metrics["recall"] = round(float(recall_score(y_true, y_pred, average="weighted")), 4)
            metrics["f1"] = round(float(f1_score(y_true, y_pred, average="weighted")), 4)
            cm = confusion_matrix(y_true, y_pred).tolist()
            metrics["confusion_matrix"] = cm
        except Exception as e:
            import traceback
            traceback.print_exc()
            metrics["metrics_error"] = str(e)
    else:
        metrics["mse"] = round(float(mean_squared_error(y_true, y_pred)), 4)
        metrics["rmse"] = round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4)
        metrics["mae"] = round(float(mean_absolute_error(y_true, y_pred)), 4)
        metrics["r2"] = round(float(r2_score(y_true, y_pred)), 4)
    return metrics


def _get_feature_importance(model, feature_names, task_type):
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    elif hasattr(model, "coef_"):
        importances = np.abs(model.coef_)
        if importances.ndim > 1:
            importances = importances.mean(axis=0)
    else:
        return None

    if len(importances) != len(feature_names):
        return None

    indices = np.argsort(importances)[::-1]
    return [
        {"feature": feature_names[i], "importance": round(float(importances[i]), 4)}
        for i in indices[:20]
    ]
