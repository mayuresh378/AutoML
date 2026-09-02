import os
import time
import copy
import math
import threading
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, RandomizedSearchCV
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_squared_error, mean_absolute_error, r2_score, roc_auc_score,
)

try:
    import optuna
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    OPTUNA_AVAILABLE = True
except ImportError:
    OPTUNA_AVAILABLE = False

try:
    from skopt import BayesSearchCV
    from skopt.space import Real, Integer, Categorical
    SKOPT_AVAILABLE = True
except ImportError:
    SKOPT_AVAILABLE = False

from train import (
    CLASSIFICATION_MODELS, REGRESSION_MODELS,
    _default_scoring, _compute_metrics, _get_feature_importance,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

PARAM_RANGES = {
    "LogisticRegression": {
        "C": {"low": 0.001, "high": 100, "log": True},
    },
    "RandomForest": {
        "n_estimators": {"low": 10, "high": 300, "step": 1},
        "max_depth": {"low": 2, "high": 50, "step": 1},
        "min_samples_split": {"low": 2, "high": 20, "step": 1},
        "min_samples_leaf": {"low": 1, "high": 10, "step": 1},
    },
    "GradientBoosting": {
        "n_estimators": {"low": 10, "high": 300, "step": 1},
        "learning_rate": {"low": 0.001, "high": 0.5, "log": True},
        "max_depth": {"low": 2, "high": 10, "step": 1},
        "subsample": {"low": 0.5, "high": 1.0},
    },
    "DecisionTree": {
        "max_depth": {"low": 2, "high": 30, "step": 1},
        "min_samples_split": {"low": 2, "high": 20, "step": 1},
        "min_samples_leaf": {"low": 1, "high": 10, "step": 1},
    },
    "SVC": {
        "C": {"low": 0.001, "high": 100, "log": True},
        "kernel": {"values": ["rbf", "linear", "poly", "sigmoid"]},
        "gamma": {"values": ["scale", "auto"]},
    },
    "KNN": {
        "n_neighbors": {"low": 1, "high": 30, "step": 1},
        "weights": {"values": ["uniform", "distance"]},
        "p": {"values": [1, 2]},
    },
    "NaiveBayes": {
        "var_smoothing": {"low": 1e-12, "high": 1e-6, "log": True},
    },
    "Ridge": {
        "alpha": {"low": 0.001, "high": 100, "log": True},
    },
    "Lasso": {
        "alpha": {"low": 0.0001, "high": 10, "log": True},
    },
    "SVR": {
        "C": {"low": 0.001, "high": 100, "log": True},
        "kernel": {"values": ["rbf", "linear", "poly", "sigmoid"]},
        "gamma": {"values": ["scale", "auto"]},
        "epsilon": {"low": 0.001, "high": 1.0, "log": True},
    },
}


def get_param_ranges(model_name):
    return PARAM_RANGES.get(model_name, {})


def _sklearn_search(method, base_model, param_space, X_train, y_train, scoring, cv, n_iter, n_jobs_inner):
    if method == "grid":
        return GridSearchCV(
            base_model, param_space, cv=cv, scoring=scoring,
            n_jobs=1, verbose=0, refit=True,
        )
    else:
        total = 1
        for v in param_space.values():
            total *= len(v) if isinstance(v, list) else 1
        actual_iter = max(5, min(n_iter, total))
        return RandomizedSearchCV(
            base_model, param_space, n_iter=actual_iter,
            cv=cv, scoring=scoring, random_state=42,
            n_jobs=1, verbose=0, refit=True,
        )


def _bayesian_search(base_model, param_ranges, X_train, y_train, scoring, cv, n_iter, n_jobs_inner):
    if not SKOPT_AVAILABLE:
        raise RuntimeError("scikit-optimize not installed. pip install scikit-optimize")
    search_space = {}
    for pname, prange in param_ranges.items():
        if "values" in prange:
            search_space[pname] = Categorical(prange["values"])
        elif "low" in prange:
            if prange.get("step"):
                search_space[pname] = Integer(prange["low"], prange["high"])
            elif prange.get("log"):
                search_space[pname] = Real(prange["low"], prange["high"], prior="log-uniform")
            else:
                search_space[pname] = Real(prange["low"], prange["high"])
    return BayesSearchCV(
        base_model, search_space, n_iter=n_iter,
        cv=cv, scoring=scoring, random_state=42,
        n_jobs=1, verbose=0, refit=True,
    )


def _optuna_optimize(base_model, param_ranges, X_train, y_train, scoring, cv, n_trials, task_type):
    if not OPTUNA_AVAILABLE:
        raise RuntimeError("Optuna not installed. pip install optuna")

    def objective(trial):
        params = {}
        for pname, prange in param_ranges.items():
            if "values" in prange:
                params[pname] = trial.suggest_categorical(pname, prange["values"])
            elif "low" in prange:
                low, high = prange["low"], prange["high"]
                if prange.get("step"):
                    params[pname] = trial.suggest_int(pname, low, high, step=prange["step"])
                elif prange.get("log"):
                    params[pname] = trial.suggest_float(pname, low, high, log=True)
                else:
                    params[pname] = trial.suggest_float(pname, low, high)
        model = copy.deepcopy(base_model)
        model.set_params(**params)
        cv_actual = max(2, min(cv, 10))
        scores = cross_val_score(model, X_train, y_train, cv=cv_actual, scoring=scoring, n_jobs=1)
        return scores.mean()

    study = optuna.create_study(direction="maximize")
    study.optimize(objective, n_trials=n_trials, show_progress_bar=False)
    return study


class HPORunner:
    def __init__(self, X, y, task_type, models, method, cv_folds=5, n_iter=50, callback=None):
        self.X = X
        self.y = y
        self.task_type = task_type
        self.models = models if isinstance(models, list) else [models]
        self.method = method
        self.cv_folds = max(2, min(cv_folds, 10))
        self.n_iter = n_iter
        self.callback = callback
        self.scoring = _default_scoring(task_type)
        self._cancelled = False

    def cancel(self):
        self._cancelled = True

    def run(self):
        model_candidates = CLASSIFICATION_MODELS if self.task_type == "classification" else REGRESSION_MODELS
        X_train, X_test, y_train, y_test = train_test_split(
            self.X, self.y, test_size=0.2, random_state=42,
            stratify=self.y if self.task_type == "classification" else None,
        )

        all_results = []
        total = len(self.models)

        for i, model_name in enumerate(self.models):
            if self._cancelled:
                break
            if model_name not in model_candidates:
                all_results.append({"name": model_name, "error": f"Unknown model '{model_name}'"})
                if self.callback:
                    self.callback(model_name, "failed", i + 1, total, None, None, None)
                continue

            try:
                result = self._optimize_model(
                    model_name, model_candidates[model_name],
                    X_train, y_train, X_test, y_test, i, total,
                )
                all_results.append(result)
            except Exception as e:
                all_results.append({"name": model_name, "error": str(e)})
                if self.callback:
                    self.callback(model_name, "failed", i + 1, total, None, None, str(e))

        successful = [r for r in all_results if "error" not in r]
        if self.task_type == "classification":
            successful.sort(key=lambda r: r.get("metrics", {}).get("accuracy", 0), reverse=True)
        else:
            successful.sort(key=lambda r: r.get("metrics", {}).get("r2", 0), reverse=True)

        best = successful[0] if successful else None

        return {
            "results": all_results,
            "best_model": best["name"] if best else None,
            "best_params": best.get("best_params") if best else None,
            "best_score": best.get("cv_score") if best else None,
            "task_type": self.task_type,
        }

    def _optimize_model(self, model_name, spec, X_train, y_train, X_test, y_test, idx, total):
        start = time.time()
        base_model = copy.deepcopy(spec["model"])
        default_params = spec["params"]
        param_ranges = PARAM_RANGES.get(model_name, {})

        search_cv = None
        n_jobs_inner = 1

        if self.method == "bayesian":
            if not param_ranges:
                param_ranges = {k: {"values": v} for k, v in default_params.items()}
            search_cv = _bayesian_search(
                base_model, param_ranges, X_train, y_train,
                self.scoring, self.cv_folds, self.n_iter, n_jobs_inner,
            )
            self._run_cv_search(search_cv, X_train, y_train, model_name, idx, total)

        elif self.method == "optuna":
            if not param_ranges:
                param_ranges = {k: {"values": v} for k, v in default_params.items()}
            study = _optuna_optimize(
                base_model, param_ranges, X_train, y_train,
                self.scoring, self.cv_folds, self.n_iter, self.task_type,
            )
            best_params = study.best_params
            base_model.set_params(**best_params)
            cv_score = study.best_value

            if self.callback:
                self.callback(model_name, "completed", idx + 1, total, best_params, cv_score, None)

            base_model.fit(X_train, y_train)
            y_pred = base_model.predict(X_test)

            train_time = time.time() - start
            metrics = _compute_metrics(y_test, y_pred, self.task_type)
            self._try_roc_auc(base_model, X_test, y_test, metrics)

            return {
                "name": model_name,
                "best_params": self._sanitize_params(best_params),
                "cv_score": round(float(cv_score), 4),
                "metrics": metrics,
                "training_time": round(train_time, 2),
                "trials": len(study.trials),
            }

        elif self.method in ("grid", "random"):
            param_space = default_params
            search_cv = _sklearn_search(
                self.method, base_model, param_space, X_train, y_train,
                self.scoring, self.cv_folds, self.n_iter, n_jobs_inner,
            )
            self._run_cv_search(search_cv, X_train, y_train, model_name, idx, total)

        else:
            raise ValueError(f"Unknown method: {self.method}")

        best_params = search_cv.best_params_
        cv_score = search_cv.best_score_

        if self.callback:
            self.callback(model_name, "completed", idx + 1, total, self._sanitize_params(best_params), cv_score, None)

        y_pred = search_cv.predict(X_test)
        train_time = time.time() - start
        metrics = _compute_metrics(y_test, y_pred, self.task_type)
        self._try_roc_auc(search_cv.best_estimator_, X_test, y_test, metrics)

        fold_scores = None
        if hasattr(search_cv, "cv_results_"):
            fold_keys = [k for k in search_cv.cv_results_ if k.startswith("split") and k.endswith("_test_score")]
            if fold_keys:
                fold_scores = [round(float(search_cv.cv_results_[k][search_cv.best_index_]), 4)
                               for k in sorted(fold_keys, key=lambda x: int(x.split("split")[1].split("_")[0]))]

        n_candidates = search_cv.cv_results_["mean_test_score"].shape[0] if hasattr(search_cv, "cv_results_") else None

        return {
            "name": model_name,
            "best_params": self._sanitize_params(best_params),
            "cv_score": round(float(cv_score), 4),
            "fold_scores": fold_scores,
            "metrics": metrics,
            "training_time": round(train_time, 2),
            "n_candidates": n_candidates,
        }

    def _run_cv_search(self, search_cv, X_train, y_train, model_name, idx, total):
        orig_fit = search_cv.fit

        def patched_fit(X, y=None, *args, **kwargs):
            result = orig_fit(X, y, *args, **kwargs)
            return result

        search_cv.fit(X_train, y_train)

    def _try_roc_auc(self, estimator, X_test, y_test, metrics):
        try:
            if hasattr(estimator, "predict_proba"):
                y_proba = estimator.predict_proba(X_test)
                n_cls = len(np.unique(y_test))
                if n_cls == 2:
                    metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_proba[:, 1])), 4)
                else:
                    metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_proba, multi_class="ovr", average="weighted")), 4)
        except Exception:
            pass

    def _sanitize_params(self, params):
        sanitized = {}
        for k, v in params.items():
            if isinstance(v, (np.floating,)):
                sanitized[k] = round(float(v), 6)
            elif isinstance(v, (np.integer,)):
                sanitized[k] = int(v)
            else:
                sanitized[k] = v
        return sanitized
