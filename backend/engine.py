import os
import time
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score, KFold, StratifiedKFold, LeaveOneOut
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
    mean_squared_error, mean_absolute_error, r2_score, silhouette_score,
    calinski_harabasz_score, davies_bouldin_score
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder, OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.decomposition import PCA

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

# Clustering models
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, SpectralClustering
from sklearn.mixture import GaussianMixture

# Time series models
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor as RandomForestRegressorTS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

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

# ── Model Catalogs ─────────────────────────────────────────────────

CLASSIFICATION_MODELS = {
    "LogisticRegression": {"cls": LogisticRegression, "params": {"C": [0.01, 0.1, 1, 10], "solver": ["lbfgs"], "max_iter": [2000]}},
    "RandomForest": {"cls": RandomForestClassifier, "params": {"n_estimators": [50, 100, 200], "max_depth": [None, 10, 20], "random_state": [42]}},
    "GradientBoosting": {"cls": GradientBoostingClassifier, "params": {"n_estimators": [50, 100], "learning_rate": [0.01, 0.1], "max_depth": [3, 5], "random_state": [42]}},
    "DecisionTree": {"cls": DecisionTreeClassifier, "params": {"max_depth": [None, 5, 10, 20], "min_samples_split": [2, 5, 10], "random_state": [42]}},
    "SVC": {"cls": SVC, "params": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"], "random_state": [42]}},
    "KNN": {"cls": KNeighborsClassifier, "params": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]}},
    "NaiveBayes": {"cls": GaussianNB, "params": {"var_smoothing": [1e-09, 1e-08, 1e-07]}},
}
if XGB_AVAILABLE:
    CLASSIFICATION_MODELS["XGBoost"] = {"cls": XGBClassifier, "params": {"n_estimators": [50, 100], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3], "random_state": [42], "verbosity": [0]}}
if LGBM_AVAILABLE:
    CLASSIFICATION_MODELS["LightGBM"] = {"cls": LGBMClassifier, "params": {"n_estimators": [50, 100], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [-1]}}
if CATB_AVAILABLE:
    CLASSIFICATION_MODELS["CatBoost"] = {"cls": CatBoostClassifier, "params": {"iterations": [50, 100], "depth": [4, 6, 8], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [0]}}

REGRESSION_MODELS = {
    "Ridge": {"cls": Ridge, "params": {"alpha": [0.01, 0.1, 1, 10, 100], "random_state": [42]}},
    "Lasso": {"cls": Lasso, "params": {"alpha": [0.001, 0.01, 0.1, 1], "random_state": [42]}},
    "RandomForest": {"cls": RandomForestRegressor, "params": {"n_estimators": [50, 100, 200], "max_depth": [None, 10, 20], "random_state": [42]}},
    "GradientBoosting": {"cls": GradientBoostingRegressor, "params": {"n_estimators": [50, 100], "learning_rate": [0.01, 0.1], "max_depth": [3, 5], "random_state": [42]}},
    "DecisionTree": {"cls": DecisionTreeRegressor, "params": {"max_depth": [None, 5, 10, 20], "min_samples_split": [2, 5, 10], "random_state": [42]}},
    "SVR": {"cls": SVR, "params": {"C": [0.1, 1, 10], "kernel": ["rbf", "linear"], "gamma": ["scale", "auto"]}},
    "KNN": {"cls": KNeighborsRegressor, "params": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]}},
}
if XGB_AVAILABLE:
    REGRESSION_MODELS["XGBoost"] = {"cls": XGBRegressor, "params": {"n_estimators": [50, 100], "max_depth": [3, 6, 9], "learning_rate": [0.01, 0.1, 0.3], "random_state": [42], "verbosity": [0]}}
if LGBM_AVAILABLE:
    REGRESSION_MODELS["LightGBM"] = {"cls": LGBMRegressor, "params": {"n_estimators": [50, 100], "num_leaves": [15, 31, 63], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [-1]}}
if CATB_AVAILABLE:
    REGRESSION_MODELS["CatBoost"] = {"cls": CatBoostRegressor, "params": {"iterations": [50, 100], "depth": [4, 6, 8], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [0]}}

CLUSTERING_MODELS = {
    "KMeans": {"cls": KMeans, "params": {"n_clusters": [2, 3, 4, 5, 6, 7, 8], "n_init": [10], "random_state": [42]}, "needs_n_clusters": True},
    "AgglomerativeClustering": {"cls": AgglomerativeClustering, "params": {"n_clusters": [2, 3, 4, 5, 6, 7, 8], "linkage": ["ward", "complete", "average"]}, "needs_n_clusters": True},
    "DBSCAN": {"cls": DBSCAN, "params": {"eps": [0.3, 0.5, 0.7, 1.0], "min_samples": [3, 5, 10]}, "needs_n_clusters": False},
    "GaussianMixture": {"cls": GaussianMixture, "params": {"n_components": [2, 3, 4, 5, 6, 7, 8], "covariance_type": ["full", "tied", "diag"], "n_init": [10], "random_state": [42]}, "needs_n_clusters": True},
    "SpectralClustering": {"cls": SpectralClustering, "params": {"n_clusters": [2, 3, 4, 5, 6, 7, 8], "affinity": ["rbf", "nearest_neighbors"], "random_state": [42]}, "needs_n_clusters": True},
}

TIME_SERIES_MODELS = {
    "LinearRegression": {"cls": LinearRegression, "params": {"fit_intercept": [True], "n_jobs": [1]}},
    "RandomForest": {"cls": RandomForestRegressorTS, "params": {"n_estimators": [50, 100, 200], "max_depth": [None, 10, 20], "random_state": [42]}},
    "Ridge": {"cls": Ridge, "params": {"alpha": [0.01, 0.1, 1, 10], "random_state": [42]}},
    "Lasso": {"cls": Lasso, "params": {"alpha": [0.001, 0.01, 0.1, 1], "random_state": [42]}},
    "GradientBoosting": {"cls": GradientBoostingRegressor, "params": {"n_estimators": [50, 100], "learning_rate": [0.01, 0.1], "max_depth": [3, 5], "random_state": [42]}},
    "KNN": {"cls": KNeighborsRegressor, "params": {"n_neighbors": [3, 5, 7, 11], "weights": ["uniform", "distance"]}},
    "DecisionTree": {"cls": DecisionTreeRegressor, "params": {"max_depth": [None, 5, 10], "min_samples_split": [2, 5], "random_state": [42]}},
}
if XGB_AVAILABLE:
    TIME_SERIES_MODELS["XGBoost"] = {"cls": XGBRegressor, "params": {"n_estimators": [50, 100], "max_depth": [3, 6], "learning_rate": [0.01, 0.1], "random_state": [42], "verbosity": [0]}}
if LGBM_AVAILABLE:
    TIME_SERIES_MODELS["LightGBM"] = {"cls": LGBMRegressor, "params": {"n_estimators": [50, 100], "num_leaves": [15, 31], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [-1]}}
if CATB_AVAILABLE:
    TIME_SERIES_MODELS["CatBoost"] = {"cls": CatBoostRegressor, "params": {"iterations": [50, 100], "depth": [4, 6], "learning_rate": [0.01, 0.1], "random_state": [42], "verbose": [0]}}


def get_all_models():
    return {
        "classification": list(CLASSIFICATION_MODELS.keys()),
        "regression": list(REGRESSION_MODELS.keys()),
        "clustering": list(CLUSTERING_MODELS.keys()),
        "time_series": list(TIME_SERIES_MODELS.keys()),
        "optional": {"XGBoost": XGB_AVAILABLE, "LightGBM": LGBM_AVAILABLE, "CatBoost": CATB_AVAILABLE},
    }


# ── Preprocessing ─────────────────────────────────────────────────

DEFAULT_PREPROCESS_OPTIONS = {
    "imputation": True,
    "dedupe": True,
    "outlier": False,
    "scaling": True,
    "labelEncoding": False,
    "oneHot": True,
    "featureSelection": True,
    "pca": False,
    "balancing": False,
    "leakage": True,
}

_IDENTITY_COLUMNS = {"id", "index", "unnamed: 0", "unnamed:0"}


def preprocess_data(file_name, target_column, task_type, datadir=None, options=None):
    if datadir is None:
        datadir = os.path.join(BASE_DIR, "..", "dataset")
    opts = {**DEFAULT_PREPROCESS_OPTIONS, **(options or {})}
    file_path = os.path.join(datadir, file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found.")

    df = pd.read_csv(file_path, skipinitialspace=True)
    df.columns = df.columns.str.strip()
    target_column = target_column.strip()

    if opts["dedupe"]:
        df = df.drop_duplicates()

    if not opts["imputation"]:
        df = df.dropna()

    if task_type == "clustering":
        X = df.copy()
        if target_column and target_column in X.columns:
            X = X.drop(columns=[target_column])
        y = None
    else:
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset.")
        y = df[target_column]
        X = df.drop(columns=[target_column])

    if opts["leakage"]:
        id_like = [c for c in X.columns if str(c).strip().lower() in _IDENTITY_COLUMNS or str(c).strip().lower().endswith("_id")]
        if id_like:
            X = X.drop(columns=id_like)

    numeric_features = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_features = X.select_dtypes(include=["object", "category", "bool"]).columns.tolist()

    if opts["outlier"]:
        for col in numeric_features:
            try:
                q1, q3 = X[col].quantile(0.25), X[col].quantile(0.75)
                iqr = q3 - q1
                if iqr > 0:
                    X[col] = X[col].clip(lower=q1 - 1.5 * iqr, upper=q3 + 1.5 * iqr)
            except Exception:
                pass

    if opts["featureSelection"]:
        for col in list(numeric_features):
            try:
                if X[col].nunique() <= 1:
                    X = X.drop(columns=[col])
                    numeric_features.remove(col)
            except Exception:
                pass

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

    if numeric_features:
        num_steps = []
        if opts["imputation"]:
            num_steps.append(("imputer", SimpleImputer(strategy="median")))
        if opts["scaling"]:
            num_steps.append(("scaler", StandardScaler()))
        if opts["pca"] and len(numeric_features) >= 2:
            num_steps.append(("pca", PCA(n_components=0.95, random_state=42)))
        numeric_transformer = Pipeline(num_steps) if num_steps else "passthrough"
    else:
        numeric_transformer = "passthrough"

    if safe_cat_features:
        cat_steps = []
        if opts["imputation"]:
            cat_steps.append(("imputer", SimpleImputer(strategy="most_frequent")))
        if opts["oneHot"]:
            cat_steps.append(("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)))
        else:
            cat_steps.append(("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)))
        categorical_transformer = Pipeline(cat_steps) if cat_steps else "passthrough"
    else:
        categorical_transformer = "passthrough"

    transformers = [("num", numeric_transformer, numeric_features)]
    if safe_cat_features:
        transformers.append(("cat", categorical_transformer, safe_cat_features))

    preprocessor = ColumnTransformer(transformers=transformers, remainder="drop")
    X_transformed = preprocessor.fit_transform(X)

    cat_features_out = []
    if safe_cat_features and opts["oneHot"]:
        try:
            cat_pipeline = preprocessor.named_transformers_["cat"]
            encoder = cat_pipeline.named_steps["encoder"] if hasattr(cat_pipeline, "named_steps") else cat_pipeline
            cat_features_out = encoder.get_feature_names_out(safe_cat_features).tolist()
        except Exception:
            cat_features_out = safe_cat_features
    elif safe_cat_features:
        cat_features_out = safe_cat_features

    all_feature_names = numeric_features + cat_features_out
    if hasattr(X_transformed, "toarray"):
        X_transformed = X_transformed.toarray()

    X_processed = pd.DataFrame(X_transformed, columns=all_feature_names, index=X.index)

    label_map = None
    if task_type == "classification" and y is not None and y.dtype.name in ("object", "str", "category"):
        le = LabelEncoder()
        y = pd.Series(le.fit_transform(y), index=y.index, name=y.name)
        y.attrs["label_encoder"] = le
        label_map = {int(i): str(c) for i, c in enumerate(le.classes_)}

    if opts["balancing"] and task_type == "classification":
        try:
            from imblearn.over_sampling import SMOTE
            X_balanced, y = SMOTE(random_state=42).fit_resample(X_processed, y)
            X_processed = pd.DataFrame(X_balanced, columns=all_feature_names, index=range(len(X_balanced)))
        except Exception:
            pass

    return {
        "X": X_processed,
        "y": y,
        "X_raw": X,
        "preprocessor": preprocessor,
        "feature_names": all_feature_names,
        "label_map": label_map,
        "original_df": df,
    }


# ── Time Series Feature Engineering ───────────────────────────────

def create_lag_features(df, target_col, lags=None):
    if lags is None:
        lags = [1, 2, 3, 5, 7]
    result = df.copy()
    for lag in lags:
        result[f"lag_{lag}"] = result[target_col].shift(lag)
    result[f"rolling_mean_3"] = result[target_col].rolling(window=3).mean()
    result[f"rolling_mean_7"] = result[target_col].rolling(window=7).mean()
    result[f"rolling_std_3"] = result[target_col].rolling(window=3).std()
    result["month"] = pd.to_datetime(result.index, errors="coerce").month if not isinstance(result.index, pd.RangeIndex) else 0
    result = result.dropna()
    return result


# ── Metrics ────────────────────────────────────────────────────────

def compute_classification_metrics(y_true, y_pred):
    metrics = {"accuracy": round(float(accuracy_score(y_true, y_pred)), 4)}
    try:
        metrics["precision"] = round(float(precision_score(y_true, y_pred, average="weighted")), 4)
        metrics["recall"] = round(float(recall_score(y_true, y_pred, average="weighted")), 4)
        metrics["f1"] = round(float(f1_score(y_true, y_pred, average="weighted")), 4)
        cm = confusion_matrix(y_true, y_pred).tolist()
        metrics["confusion_matrix"] = cm
    except Exception:
        pass
    return metrics


def compute_regression_metrics(y_true, y_pred):
    return {
        "mse": round(float(mean_squared_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
    }


def compute_clustering_metrics(X, labels):
    if len(set(labels)) < 2:
        return {"error": "Only one cluster found"}
    metrics = {}
    try:
        metrics["silhouette"] = round(float(silhouette_score(X, labels)), 4)
    except Exception:
        metrics["silhouette"] = None
    try:
        metrics["calinski_harabasz"] = round(float(calinski_harabasz_score(X, labels)), 4)
    except Exception:
        metrics["calinski_harabasz"] = None
    try:
        metrics["davies_bouldin"] = round(float(davies_bouldin_score(X, labels)), 4)
    except Exception:
        metrics["davies_bouldin"] = None
    metrics["n_clusters"] = len(set(labels) - {-1})
    metrics["n_noise"] = list(labels).count(-1)
    return metrics


def compute_timeseries_metrics(y_true, y_pred):
    y_true = np.array(y_true, dtype=float)
    y_pred = np.array(y_pred, dtype=float)
    mape = None
    smape = None
    try:
        nonzero = y_true != 0
        if nonzero.any():
            mape = round(float(np.mean(np.abs((y_true[nonzero] - y_pred[nonzero]) / y_true[nonzero])) * 100), 4)
        smape = round(float(np.mean(2 * np.abs(y_true - y_pred) / (np.abs(y_true) + np.abs(y_pred) + 1e-8)) * 100), 4)
    except Exception:
        pass
    return {
        "mse": round(float(mean_squared_error(y_true, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 4),
        "mae": round(float(mean_absolute_error(y_true, y_pred)), 4),
        "r2": round(float(r2_score(y_true, y_pred)), 4),
        "mape": mape,
        "smape": smape,
    }


def get_feature_importance(model, feature_names):
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
    return [{"feature": feature_names[i], "importance": round(float(importances[i]), 4)} for i in indices[:20]]


# ── Main Engine Training ──────────────────────────────────────────

def run_engine_job(file_name, target_column, task_type, model_names, progress_callback=None, cv_folds=5, datadir=None, n_clusters=None, preprocess_options=None, validation=None):
    start_time = time.time()

    if progress_callback:
        progress_callback({"status": "preprocessing", "message": f"Loading and preprocessing {file_name}..."})

    prep = preprocess_data(file_name, target_column, task_type, datadir=datadir, options=preprocess_options)
    X, y = prep["X"], prep["y"]
    preprocessor = prep["preprocessor"]
    feature_names = prep["feature_names"]
    label_map = prep.get("label_map")

    if task_type == "clustering":
        return _run_clustering(X, model_names, progress_callback, start_time)
    elif task_type == "time_series":
        return _run_timeseries(prep, target_column, model_names, progress_callback, start_time)
    elif task_type == "regression":
        return _run_supervised(X, y, task_type, model_names, REGRESSION_MODELS, preprocessor, feature_names,
                               compute_regression_metrics, "r2", cv_folds, progress_callback, start_time, label_map, validation)
    else:
        return _run_supervised(X, y, task_type, model_names, CLASSIFICATION_MODELS, preprocessor, feature_names,
                               compute_classification_metrics, "accuracy", cv_folds, progress_callback, start_time, label_map, validation)


def _run_supervised(X, y, task_type, model_names, catalog, preprocessor, feature_names,
                    metrics_fn, sort_key, cv_folds, progress_callback, start_time, label_map=None, validation=None):
    v = validation or {}
    method = v.get("method", "cross_validation")
    test_size = float(v.get("test_size", 20)) / 100.0
    shuffle = bool(v.get("shuffle", True))
    seed = int(v.get("random_seed", 42))

    split_kwargs = {"test_size": test_size, "shuffle": shuffle}
    if shuffle:
        split_kwargs["random_state"] = seed
    if task_type == "classification":
        classes, counts = np.unique(y, return_counts=True)
        if counts.min() >= 2:
            split_kwargs["stratify"] = y
    X_train, X_test, y_train, y_test = train_test_split(X, y, **split_kwargs)

    def _make_cv():
        if method == "leave_one_out":
            return LeaveOneOut()
        if method == "train_test_split":
            return None
        n_splits = max(2, min(cv_folds, len(X_train)))
        cls = KFold
        if method == "stratified" and task_type == "classification":
            classes, counts = np.unique(y_train, return_counts=True)
            min_class = int(counts.min()) if len(counts) else 0
            if min_class >= 2:
                cls = StratifiedKFold
                n_splits = max(2, min(n_splits, min_class))
        kwargs = {"n_splits": n_splits}
        if shuffle:
            kwargs["shuffle"] = True
            kwargs["random_state"] = seed
        return cls(**kwargs)

    results = []
    total = len(model_names)

    for i, name in enumerate(model_names):
        if name not in catalog:
            results.append({"name": name, "error": f"Unknown model '{name}'", "status": "error"})
            if progress_callback:
                progress_callback({"status": "training", "current": i + 1, "total": total,
                                   "current_model": name, "message": f"Skipping unknown model {name}"})
            continue

        if progress_callback:
            progress_callback({"status": "training", "current": i + 1, "total": total,
                               "current_model": name, "message": f"Training {name} ({i+1}/{total})"})

        try:
            spec = catalog[name]
            t0 = time.time()
            model = spec["cls"](**{k: v[0] for k, v in spec["params"].items()})
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            train_time = round(time.time() - t0, 2)

            metrics = metrics_fn(y_test, y_pred)

            cv_score = None
            try:
                scoring = "accuracy" if task_type == "classification" else "r2"
                cv = _make_cv()
                if cv is not None:
                    cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring=scoring)
                    mean_cv = float(cv_scores.mean())
                    cv_score = round(mean_cv, 4) if np.isfinite(mean_cv) else None
            except Exception:
                pass

            fi = get_feature_importance(model, feature_names)

            model_filename = f"engine_{task_type}_{name}.pkl"
            save_path = os.path.join(MODELS_DIR, model_filename)
            full_pipeline = Pipeline([("preprocessor", preprocessor), ("model", model)]) if preprocessor else model
            joblib.dump(full_pipeline, save_path)
            meta_path = save_path.replace(".pkl", "_meta.json")
            meta = {"task_type": task_type, "model": name, "feature_names": feature_names, "label_map": label_map, "metrics": metrics}
            with open(meta_path, "w") as f:
                json.dump(meta, f, indent=2, default=str)

            results.append({
                "name": name, "status": "success", "cv_score": cv_score, "metrics": metrics,
                "training_time": train_time, "feature_importance": fi, "model_path": model_filename,
            })
        except Exception as e:
            results.append({"name": name, "status": "error", "error": str(e)})

    successful = [r for r in results if r.get("status") == "success"]
    if successful:
        successful.sort(key=lambda r: r["metrics"].get(sort_key, 0), reverse=True)

    best = successful[0] if successful else None
    elapsed = round(time.time() - start_time, 2)

    if progress_callback:
        progress_callback({"status": "completed", "message": f"Done — {len(successful)}/{total} models trained",
                           "best_model": best["name"] if best else None})

    return {
        "results": results,
        "best_model": best["name"] if best else None,
        "best_metrics": best["metrics"] if best else None,
        "task_type": task_type,
        "elapsed": elapsed,
        "total": total,
        "successful": len(successful),
    }


def _run_clustering(X, model_names, progress_callback, start_time):
    results = []
    total = len(model_names)
    X_array = X.values

    for i, name in enumerate(model_names):
        if name not in CLUSTERING_MODELS:
            results.append({"name": name, "error": f"Unknown model '{name}'", "status": "error"})
            continue

        if progress_callback:
            progress_callback({"status": "training", "current": i + 1, "total": total,
                               "current_model": name, "message": f"Fitting {name} ({i+1}/{total})"})

        try:
            spec = CLUSTERING_MODELS[name]
            t0 = time.time()

            best_model = None
            best_labels = None
            best_score = -1
            best_params = {}

            param_combos = _generate_param_combos(spec["params"])
            if not param_combos:
                param_combos = [{}]

            for params in param_combos:
                try:
                    model = spec["cls"](**params)
                    labels = model.fit_predict(X_array)
                    if len(set(labels)) < 2:
                        continue
                    score = silhouette_score(X_array, labels)
                    if score > best_score:
                        best_score = score
                        best_model = model
                        best_labels = labels
                        best_params = params
                except Exception:
                    continue

            if best_model is None:
                results.append({"name": name, "status": "error", "error": "Could not fit model with any parameter combination"})
                continue

            train_time = round(time.time() - t0, 2)
            metrics = compute_clustering_metrics(X_array, best_labels)
            metrics["silhouette"] = round(float(best_score), 4)

            model_filename = f"engine_clustering_{name}.pkl"
            save_path = os.path.join(MODELS_DIR, model_filename)
            joblib.dump(best_model, save_path)

            results.append({
                "name": name, "status": "success", "metrics": metrics,
                "training_time": train_time, "best_params": best_params,
                "model_path": model_filename,
            })
        except Exception as e:
            results.append({"name": name, "status": "error", "error": str(e)})

    successful = [r for r in results if r.get("status") == "success"]
    if successful:
        successful.sort(key=lambda r: r["metrics"].get("silhouette", 0), reverse=True)

    best = successful[0] if successful else None
    elapsed = round(time.time() - start_time, 2)

    if progress_callback:
        progress_callback({"status": "completed", "message": f"Done — {len(successful)}/{total} models fitted",
                           "best_model": best["name"] if best else None})

    return {
        "results": results,
        "best_model": best["name"] if best else None,
        "best_metrics": best["metrics"] if best else None,
        "task_type": "clustering",
        "elapsed": elapsed,
        "total": total,
        "successful": len(successful),
    }


def _run_timeseries(prep, target_column, model_names, progress_callback, start_time):
    X, y, df = prep["X"], prep["y"], prep["original_df"]
    preprocessor = prep["preprocessor"]
    feature_names = prep["feature_names"]

    ts_df = df.copy()
    target_series = ts_df[target_column].values

    lags = [1, 2, 3, 5, 7]
    lag_df = pd.DataFrame()
    for lag in lags:
        lag_df[f"lag_{lag}"] = pd.Series(target_series).shift(lag)
    lag_df["rolling_mean_3"] = pd.Series(target_series).rolling(3).mean()
    lag_df["rolling_mean_7"] = pd.Series(target_series).rolling(7).mean()
    lag_df["rolling_std_3"] = pd.Series(target_series).rolling(3).std()
    lag_df["idx"] = range(len(target_series))
    lag_df = lag_df.dropna()

    y_ts = target_series[lag_df.index.values]
    X_ts = lag_df.drop(columns=["idx"])

    if len(X_ts) < 20:
        raise ValueError("Not enough data points for time series forecasting (need at least 20)")

    split_idx = int(len(X_ts) * 0.8)
    X_train, X_test = X_ts.iloc[:split_idx], X_ts.iloc[split_idx:]
    y_train, y_test = y_ts[:split_idx], y_ts[split_idx:]

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    results = []
    total = len(model_names)

    for i, name in enumerate(model_names):
        if name not in TIME_SERIES_MODELS:
            results.append({"name": name, "error": f"Unknown model '{name}'", "status": "error"})
            continue

        if progress_callback:
            progress_callback({"status": "training", "current": i + 1, "total": total,
                               "current_model": name, "message": f"Training {name} ({i+1}/{total})"})

        try:
            spec = TIME_SERIES_MODELS[name]
            t0 = time.time()
            model = spec["cls"](**{k: v[0] for k, v in spec["params"].items()})
            model.fit(X_train_s, y_train)
            y_pred = model.predict(X_test_s)
            train_time = round(time.time() - t0, 2)

            metrics = compute_timeseries_metrics(y_test, y_pred)

            model_filename = f"engine_timeseries_{name}.pkl"
            save_path = os.path.join(MODELS_DIR, model_filename)
            joblib.dump({"model": model, "scaler": scaler, "lags": lags, "last_values": list(target_series[-max(lags):])}, save_path)

            fi = get_feature_importance(model, list(X_ts.columns))

            results.append({
                "name": name, "status": "success", "cv_score": metrics["r2"], "metrics": metrics,
                "training_time": train_time, "feature_importance": fi, "model_path": model_filename,
            })
        except Exception as e:
            results.append({"name": name, "status": "error", "error": str(e)})

    successful = [r for r in results if r.get("status") == "success"]
    if successful:
        successful.sort(key=lambda r: r["metrics"].get("r2", 0), reverse=True)

    best = successful[0] if successful else None
    elapsed = round(time.time() - start_time, 2)

    if progress_callback:
        progress_callback({"status": "completed", "message": f"Done — {len(successful)}/{total} models trained",
                           "best_model": best["name"] if best else None})

    return {
        "results": results,
        "best_model": best["name"] if best else None,
        "best_metrics": best["metrics"] if best else None,
        "task_type": "time_series",
        "elapsed": elapsed,
        "total": total,
        "successful": len(successful),
    }


def _generate_param_combos(params_dict):
    import itertools
    keys = list(params_dict.keys())
    values = list(params_dict.values())
    combos = []
    for combo in itertools.product(*values):
        combos.append(dict(zip(keys, combo)))
    if len(combos) > 12:
        indices = np.linspace(0, len(combos) - 1, 12, dtype=int)
        combos = [combos[i] for i in indices]
    return combos
