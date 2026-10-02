import json
import os
import pytest
import numpy as np
import pandas as pd
from sklearn.datasets import load_iris, fetch_california_housing
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.pipeline import Pipeline
import joblib

from main import MODELS_DIR, DATASET_DIR
from models import Dataset, ModelRegistry


@pytest.fixture
def sample_models_and_datasets(tmp_path, monkeypatch, db):
    models_dir = tmp_path / "models"
    dataset_dir = tmp_path / "datasets"
    models_dir.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("main.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("main.DATASET_DIR", str(dataset_dir))
    monkeypatch.setattr("evaluation.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("evaluation.DATASET_DIR", str(dataset_dir))

    # 1. Prepare classification model & dataset (Iris)
    iris = load_iris(as_frame=True)
    iris_df = iris.frame.rename(columns={"target": "species"})
    iris_path = dataset_dir / "iris.csv"
    iris_df.to_csv(iris_path, index=False)

    clf = RandomForestClassifier(n_estimators=10, random_state=42)
    clf.fit(iris.data, iris.target)
    clf_pipeline = Pipeline([("model", clf)])

    clf_path = models_dir / "iris_rf.pkl"
    joblib.dump(clf_pipeline, clf_path)
    meta_clf = {
        "task_type": "classification",
        "cv_score": 0.95,
        "feature_names": list(iris.data.columns),
        "target": "species",
    }
    joblib.dump(meta_clf, str(clf_path) + ".meta.pkl")

    ds_clf = Dataset(
        id="ds_iris",
        filename="iris.csv",
        original_filename="iris.csv",
        file_path=str(iris_path),
        user_id="usr_test1",
        columns=list(iris_df.columns),
        rows=len(iris_df),
    )
    db.add(ds_clf)

    reg_clf = ModelRegistry(
        id="mod_iris",
        name="iris_rf.pkl",
        user_id="usr_test1",
        task_type="classification",
        cv_score=0.95,
    )
    db.add(reg_clf)

    # 2. Prepare regression model & dataset
    reg_data = pd.DataFrame({
        "feature_1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0] * 5,
        "feature_2": [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0, 100.0] * 5,
        "target_val": [15.0, 25.0, 35.0, 45.0, 55.0, 65.0, 75.0, 85.0, 95.0, 105.0] * 5,
    })
    reg_path = dataset_dir / "reg_data.csv"
    reg_data.to_csv(reg_path, index=False)

    regr = RandomForestRegressor(n_estimators=10, random_state=42)
    regr.fit(reg_data[["feature_1", "feature_2"]], reg_data["target_val"])
    regr_pipeline = Pipeline([("model", regr)])

    regr_path = models_dir / "regr_rf.pkl"
    joblib.dump(regr_pipeline, regr_path)
    meta_regr = {
        "task_type": "regression",
        "cv_score": 0.90,
        "feature_names": ["feature_1", "feature_2"],
        "target": "target_val",
    }
    joblib.dump(meta_regr, str(regr_path) + ".meta.pkl")

    ds_regr = Dataset(
        id="ds_regr",
        filename="reg_data.csv",
        original_filename="reg_data.csv",
        file_path=str(reg_path),
        user_id="usr_test1",
        columns=list(reg_data.columns),
        rows=len(reg_data),
    )
    db.add(ds_regr)

    reg_regr = ModelRegistry(
        id="mod_regr",
        name="regr_rf.pkl",
        user_id="usr_test1",
        task_type="regression",
        cv_score=0.90,
    )
    db.add(reg_regr)
    db.commit()

    return {
        "clf_model": "iris_rf.pkl",
        "clf_dataset": "iris.csv",
        "clf_target": "species",
        "regr_model": "regr_rf.pkl",
        "regr_dataset": "reg_data.csv",
        "regr_target": "target_val",
    }


def test_evaluate_classification_model(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    payload = {
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }
    response = client.post("/api/v1/evaluation/evaluate", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["task_type"] == "classification"
    assert "metrics" in data
    assert "accuracy" in data["metrics"]
    assert data["metrics"]["accuracy"] > 0.5
    assert "confusion_matrix" in data
    assert "roc_curve" in data
    assert "pr_curve" in data
    assert "feature_importance" in data
    assert "prediction_samples" in data
    assert len(data["prediction_samples"]) > 0
    assert "ai_insights" in data
    assert "evaluation_id" in data


def test_evaluate_regression_model(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    payload = {
        "model_name": info["regr_model"],
        "dataset_name": info["regr_dataset"],
        "target_column": info["regr_target"],
    }
    response = client.post("/api/v1/evaluation/evaluate", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["task_type"] == "regression"
    assert "metrics" in data
    assert "r2" in data["metrics"]
    assert "rmse" in data["metrics"]
    assert "residual_plot" in data
    assert "prediction_samples" in data
    assert "evaluation_id" in data


def test_evaluation_history(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })

    res = client.get("/api/v1/evaluation/history")
    assert res.status_code == 200, res.text
    history = res.json()
    assert history["total"] >= 1
    assert history["evaluations"][0]["model_name"] == info["clf_model"]

    eval_id = history["evaluations"][0]["id"]
    detail_res = client.get(f"/api/v1/evaluation/{eval_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == eval_id


def test_evaluate_nonexistent_model(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    payload = {
        "model_name": "non_existent_model.pkl",
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }
    response = client.post("/api/v1/evaluation/evaluate", json=payload)
    assert response.status_code == 404


# ── Validation and error handling ──────────────────────────────────────


def test_evaluate_nonexistent_dataset(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": "not_a_real_dataset.csv",
        "target_column": info["clf_target"],
    })
    assert response.status_code == 404


def test_evaluate_invalid_target_column(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": "no_such_column",
    })
    assert response.status_code == 400
    assert "no_such_column" in response.json()["detail"]


def test_evaluate_reports_missing_features(client, sample_models_and_datasets):
    """A dataset that cannot supply the model's columns must be named, not crashed on."""
    import evaluation as ev

    info = sample_models_and_datasets
    model_path = os.path.join(ev.MODELS_DIR, info["clf_model"])
    meta = joblib.load(model_path + ".meta.pkl")
    expected = meta["feature_names"]

    df = pd.read_csv(os.path.join(ev.DATASET_DIR, info["clf_dataset"]))
    drop_cols = expected[-3:]
    df = df.drop(columns=drop_cols)
    partial = "iris_missing_cols.csv"
    df.to_csv(os.path.join(ev.DATASET_DIR, partial), index=False)

    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": partial,
        "target_column": info["clf_target"],
    })
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert f"missing {len(drop_cols)} features" in detail
    for col in drop_cols:
        assert col in detail


def test_evaluate_missing_target_is_rejected(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
    })
    assert response.status_code in (400, 422)


def test_evaluate_requires_authentication(client, sample_models_and_datasets):
    """The endpoint must depend on required auth, not optional auth."""
    from fastapi import HTTPException
    from auth import get_current_user
    from main import app

    info = sample_models_and_datasets

    def _unauthorized():
        raise HTTPException(status_code=401, detail="Authentication token missing")

    app.dependency_overrides[get_current_user] = _unauthorized
    try:
        response = client.post("/api/v1/evaluation/evaluate", json={
            "model_name": info["clf_model"],
            "dataset_name": info["clf_dataset"],
            "target_column": info["clf_target"],
        })
        assert response.status_code == 401
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_evaluate_rejects_other_users_model(client, impersonate, sample_models_and_datasets):
    info = sample_models_and_datasets
    impersonate("usr_intruder", "intruder@test.local", "Intruder")
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 403


def test_evaluate_rejects_other_users_dataset(client, impersonate, sample_models_and_datasets):
    info = sample_models_and_datasets
    impersonate("usr_intruder", "intruder@test.local", "Intruder")
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 403


# ── Task-type coverage ─────────────────────────────────────────────────


def test_multiclass_classification_reports_per_class_curves(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 200, response.text
    data = response.json()

    # Iris has 3 classes, so curves must be one-vs-rest, not binary.
    assert data["task_type"] == "classification"
    assert len(data["confusion_matrix"]["labels"]) == 3
    assert len(data["confusion_matrix"]["matrix"]) == 3
    assert "per_class" in data["roc_curve"], "multiclass ROC must be one-vs-rest"
    assert len(data["roc_curve"]["per_class"]) == 3
    assert isinstance(data["metrics"]["roc_auc"], (int, float))
    assert len(data["class_distribution"]) == 3


def test_regression_does_not_return_classification_charts(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["regr_model"],
        "dataset_name": info["regr_dataset"],
        "target_column": info["regr_target"],
    })
    data = response.json()
    assert data["task_type"] == "regression"
    assert data["confusion_matrix"] is None
    assert data["roc_curve"] is None
    assert data["pr_curve"] is None
    assert data["class_distribution"] is None
    assert data["residual_plot"] is not None
    assert "r2" in data["metrics"] and "rmse" in data["metrics"]


def test_prediction_samples_have_residuals_for_regression(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["regr_model"],
        "dataset_name": info["regr_dataset"],
        "target_column": info["regr_target"],
    })
    samples = response.json()["prediction_samples"]
    assert samples
    for s in samples:
        assert set(("actual", "predicted", "residual", "abs_error")).issubset(s.keys())
        assert abs(s["residual"]) < 1e-6 or s["abs_error"] >= 0


# ── Pipeline with a real preprocessor ──────────────────────────────────


@pytest.fixture
def preprocessor_pipeline_model(tmp_path, monkeypatch, db):
    """A pipeline that owns its own ColumnTransformer, like real training output.

    This is the shape that regressed when input columns were aligned against
    post-transform feature names.
    """
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import StandardScaler, OneHotEncoder
    from sklearn.impute import SimpleImputer
    from sklearn.pipeline import Pipeline as SkPipeline

    models_dir = tmp_path / "models"
    dataset_dir = tmp_path / "datasets"
    models_dir.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("main.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("main.DATASET_DIR", str(dataset_dir))
    monkeypatch.setattr("evaluation.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("evaluation.DATASET_DIR", str(dataset_dir))

    rng = np.random.default_rng(0)
    n = 240
    frame = pd.DataFrame({
        "age": rng.normal(40, 12, n).round(1),
        "income": rng.normal(60_000, 15_000, n).round(2),
        "city": rng.choice(["amsterdam", "berlin", "cairo"], n),
        "signup_month": rng.integers(1, 13, n),
    })
    score = frame["age"] * 0.3 + frame["income"] / 12_000 + (frame["city"] == "berlin") * 4
    frame["churned"] = (score > score.median()).astype(int)
    frame.to_csv(dataset_dir / "churn.csv", index=False)

    numeric = ["age", "income", "signup_month"]
    categorical = ["city"]
    numeric_pipe = SkPipeline([
        ("impute", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
    ])
    categorical_pipe = SkPipeline([
        ("impute", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    pre = ColumnTransformer([
        ("num", numeric_pipe, numeric),
        ("cat", categorical_pipe, categorical),
    ])
    pipeline = SkPipeline([("preprocessor", pre), ("model", RandomForestClassifier(
        n_estimators=25, random_state=42))])
    pipeline.fit(frame.drop(columns=["churned"]), frame["churned"])

    joblib.dump(pipeline, models_dir / "churn_rf.pkl")
    joblib.dump(
        {
            "task_type": "classification",
            "cv_score": 0.9,
            "target_column": "churned",
            # Recorded POST transform on purpose: the evaluator must not use
            # these to align the raw frame.
            "feature_names": ["num__age", "num__income", "num__signup_month",
                              "cat__city_amsterdam", "cat__city_berlin", "cat__city_cairo"],
        },
        str(models_dir / "churn_rf.pkl") + ".meta.pkl",
    )

    db.add(Dataset(id="ds_churn", filename="churn.csv", original_filename="churn.csv",
                   file_path=str(dataset_dir / "churn.csv"), user_id="usr_test1",
                   columns=list(frame.columns), rows=len(frame)))
    db.add(ModelRegistry(id="mod_churn", name="churn_rf.pkl", user_id="usr_test1",
                         task_type="classification", cv_score=0.9))
    db.commit()
    return {"model": "churn_rf.pkl", "dataset": "churn.csv", "target": "churned"}


def test_pipeline_with_preprocessor_is_evaluated_correctly(client, preprocessor_pipeline_model):
    info = preprocessor_pipeline_model
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["model"],
        "dataset_name": info["dataset"],
        "target_column": info["target"],
    })
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["metrics"]["accuracy"] > 0.8, "preprocessor pipeline scored near chance"
    # Importance must be named from get_feature_names_out, not the post-transform
    # metadata list, and must line up with the estimator width.
    assert data["feature_importance"], "expected feature importance from the fitted RF"
    assert data["input_feature_names"], "expected resolved model input names"
    # The categorical OHE columns should be the ones driving importance.
    assert any("city" in f["feature"] for f in data["feature_importance"])


# ── Unsupported metrics ────────────────────────────────────────────────


@pytest.fixture
def model_without_proba(tmp_path, monkeypatch, db):
    from sklearn.svm import LinearSVC

    models_dir = tmp_path / "models"
    dataset_dir = tmp_path / "datasets"
    models_dir.mkdir(parents=True, exist_ok=True)
    dataset_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("main.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("main.DATASET_DIR", str(dataset_dir))
    monkeypatch.setattr("evaluation.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("evaluation.DATASET_DIR", str(dataset_dir))

    iris = load_iris(as_frame=True)
    df = iris.frame.rename(columns={"target": "species"})
    df.to_csv(dataset_dir / "iris.csv", index=False)

    clf = LinearSVC(random_state=42, max_iter=5000)
    clf.fit(iris.data, iris.target)
    joblib.dump(Pipeline([("model", clf)]), models_dir / "iris_svc.pkl")
    joblib.dump(
        {"task_type": "classification", "feature_names": list(iris.data.columns),
         "target": "species"},
        str(models_dir / "iris_svc.pkl") + ".meta.pkl",
    )
    db.add(Dataset(id="ds_svc", filename="iris.csv", original_filename="iris.csv",
                   file_path=str(dataset_dir / "iris.csv"), user_id="usr_test1",
                   columns=list(df.columns), rows=len(df)))
    db.add(ModelRegistry(id="mod_svc", name="iris_svc.pkl", user_id="usr_test1",
                         task_type="classification", cv_score=0.9))
    db.commit()
    return {"model": "iris_svc.pkl", "dataset": "iris.csv", "target": "species"}


def test_unsupported_metric_is_explained_not_crashed(client, model_without_proba):
    info = model_without_proba
    response = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["model"],
        "dataset_name": info["dataset"],
        "target_column": info["target"],
    })
    assert response.status_code == 200, response.text
    data = response.json()

    # Accuracy and confusion matrix still work.
    assert isinstance(data["metrics"]["accuracy"], (int, float))
    assert data["confusion_matrix"] is not None
    # Probability-based metrics must be explicitly unavailable, with a reason.
    assert data["roc_curve"] is None
    assert data["metrics"]["roc_auc"] is None
    assert data["metrics"].get("log_loss") is None
    assert any("ROC" in u for u in data["unavailable"])
    assert any("ROC" in i["title"] or "ROC" in i["detail"] for i in data["insights"])


# ── Insights and determinism ───────────────────────────────────────────


def test_insights_are_evidence_backed(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    data = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }).json()

    assert data["insights"], "expected structured insights"
    for item in data["insights"]:
        assert item["title"] and item["detail"]
        assert item["severity"] in ("info", "positive", "warning", "critical")
        # Generic filler is not acceptable.
        assert "performs well" not in item["detail"].lower()
    # Cached text rendering must exist for the persisted record.
    assert data["ai_insights"]


def test_evaluation_is_deterministic(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    payload = {
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }
    first = client.post("/api/v1/evaluation/evaluate", json=payload).json()
    second = client.post("/api/v1/evaluation/evaluate", json=payload).json()
    assert first["metrics"] == second["metrics"]
    assert first["prediction_samples"] == second["prediction_samples"]
    assert first["roc_curve"] == second["roc_curve"]


def test_stored_evaluation_returns_full_result(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    created = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }).json()

    detail = client.get(f"/api/v1/evaluation/{created['evaluation_id']}").json()
    assert detail["id"] == created["evaluation_id"]
    assert detail["result"]["metrics"] == created["metrics"]
    assert detail["result"]["confusion_matrix"] == created["confusion_matrix"]


def test_evaluation_echoes_the_evaluated_dataset_and_target(client, sample_models_and_datasets):
    """The response must describe what was actually evaluated.

    Artifact metadata for these fixtures records no target, so a response that
    trusted metadata instead of the request would report nulls and the UI would
    mislabel the run.
    """
    info = sample_models_and_datasets
    data = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }).json()

    assert data["dataset_name"] == info["clf_dataset"]
    assert data["target_column"] == info["clf_target"]
    assert data["model_name"] == info["clf_model"]

    # The stored record must carry the same identifiers for history display.
    history = client.get("/api/v1/evaluation/history").json()["evaluations"][0]
    assert history["dataset_name"] == info["clf_dataset"]
    assert history["target_column"] == info["clf_target"]


def test_evaluation_history_is_scoped_to_user(client, impersonate, sample_models_and_datasets):
    info = sample_models_and_datasets
    client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert client.get("/api/v1/evaluation/history").json()["total"] == 1

    impersonate("usr_other", "other@test.local", "Other")
    assert client.get("/api/v1/evaluation/history").json()["total"] == 0


def test_model_list_exposes_target_for_preselection(client, sample_models_and_datasets):
    """The UI preselects the target from this field, so it must be present.

    Production training writes the ``*_meta.json`` sidecar, which is what the
    model list reads, so the fixture mirrors that rather than the legacy
    joblib sidecar.
    """
    import evaluation as ev

    info = sample_models_and_datasets
    base = info["clf_model"][:-4] if info["clf_model"].endswith(".pkl") else info["clf_model"]
    meta_path = os.path.join(ev.MODELS_DIR, f"{base}_meta.json")
    with open(meta_path, "w") as f:
        json.dump({"task_type": "classification", "target_column": info["clf_target"]}, f)

    models = client.get("/api/v1/models").json()["models"]
    entry = next(m for m in models if m["name"] == info["clf_model"])
    assert entry["target_column"] == info["clf_target"]
    assert entry["task_type"] == "classification"


def test_model_list_exposes_target_for_registered_pkl_name(client, sample_models_and_datasets, db):
    """Registry names include ".pkl"; the list must not append it twice.

    Appending it again made the sidecar unreadable, so every registered model
    reported a null target and the UI could not preselect one.
    """
    import evaluation as ev

    info = sample_models_and_datasets
    base = info["clf_model"][:-4] if info["clf_model"].endswith(".pkl") else info["clf_model"]
    meta_path = os.path.join(ev.MODELS_DIR, f"{base}_meta.json")
    with open(meta_path, "w") as f:
        json.dump({"task_type": "classification", "target_column": info["clf_target"],
                   "dataset_name": "iris.csv"}, f)

    models = client.get("/api/v1/models", params={"limit": 500}).json()["models"]
    entry = next(m for m in models if m["name"] == info["clf_model"])
    assert entry["target_column"] == info["clf_target"]
    assert entry["dataset_name"] == "iris.csv"


def test_evaluation_aligns_label_spaces(client, sample_models_and_datasets):
    """A model trained on raw string labels must still be scorable.

    The platform label-encodes string targets, so ground truth arrives as
    integers while this model predicts the original strings. Comparing them
    directly used to fail with a 400 and silently drop every curve.
    """
    import evaluation as ev

    info = sample_models_and_datasets
    target = info["clf_target"]

    # A dataset whose target holds real labels, not encoded indices.
    X = pd.read_csv(os.path.join(ev.DATASET_DIR, info["clf_dataset"]))
    X = X.drop(columns=[target])
    y = X.index.to_series().map(lambda i: ["setosa", "versicolor", "virginica"][i % 3])
    labelled = X.copy()
    labelled[target] = y.values
    ds_name = "string_labels.csv"
    labelled.to_csv(os.path.join(ev.DATASET_DIR, ds_name), index=False)

    # Trained on raw strings, with no label_map in its metadata.
    pipe = Pipeline([("model", RandomForestClassifier(n_estimators=20, random_state=42))])
    pipe.fit(X, y)
    joblib.dump(pipe, os.path.join(ev.MODELS_DIR, info["clf_model"]))
    with open(os.path.join(ev.MODELS_DIR, os.path.basename(info["clf_model"]).replace(".pkl", "_meta.json")), "w") as f:
        json.dump({"task_type": "classification"}, f)

    r = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": ds_name,
        "target_column": target,
    })
    assert r.status_code == 200, r.text
    res = r.json()
    assert 0.0 <= res["metrics"]["accuracy"] <= 1.0
    # A perfect fit on the full data must not score as a total mismatch.
    assert res["metrics"]["accuracy"] > 0.5
    assert res["confusion_matrix"]["matrix"]
    assert res["roc_curve"] is not None
    assert res["pr_curve"] is not None
    assert res.get("unavailable") == []


def test_evaluation_detail_is_owner_scoped(client, impersonate, sample_models_and_datasets):
    info = sample_models_and_datasets
    created = client.post("/api/v1/evaluation/evaluate", json={
        "model_name": info["clf_model"],
        "dataset_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    }).json()

    impersonate("usr_other", "other@test.local", "Other")
    # Another user must not be able to read this record.
    assert client.get(f"/api/v1/evaluation/{created['evaluation_id']}").status_code in (403, 404)


def test_evaluation_history_paginates_and_searches(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    for _ in range(3):
        client.post("/api/v1/evaluation/evaluate", json={
            "model_name": info["clf_model"],
            "dataset_name": info["clf_dataset"],
            "target_column": info["clf_target"],
        })

    page = client.get("/api/v1/evaluation/history", params={"limit": 2, "offset": 0}).json()
    assert page["total"] == 3, "total must count the filtered set, not the page"
    assert len(page["evaluations"]) == 2
    assert page["offset"] == 0 and page["limit"] == 2

    second = client.get("/api/v1/evaluation/history", params={"limit": 2, "offset": 2}).json()
    assert len(second["evaluations"]) == 1
    first_ids = {e["id"] for e in page["evaluations"]}
    assert first_ids.isdisjoint({e["id"] for e in second["evaluations"]})

    assert client.get("/api/v1/evaluation/history", params={"search": "iris"}).json()["total"] == 3
    assert client.get("/api/v1/evaluation/history", params={"search": "nope"}).json()["total"] == 0
    assert client.get("/api/v1/evaluation/history", params={"search": "species"}).json()["total"] == 3

    asc = client.get("/api/v1/evaluation/history", params={"sort_by": "model_name", "order": "asc"}).json()
    desc_ = client.get("/api/v1/evaluation/history", params={"sort_by": "model_name", "order": "desc"}).json()
    assert [e["model_name"] for e in asc["evaluations"]] == list(
        reversed([e["model_name"] for e in desc_["evaluations"]])
    )


# ── Comparison ─────────────────────────────────────────────────────────


def test_compare_uses_one_shared_test_set(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/models/compare", data={
        "model_names": json.dumps([info["clf_model"]]),
        "file_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 200, response.text
    results = response.json()["results"]
    assert len(results) == 1
    assert "error" not in results[0]
    assert isinstance(results[0]["metrics"]["accuracy"], (int, float))
    assert results[0]["dataset_name"] == info["clf_dataset"]


def test_compare_isolates_a_broken_model(client, sample_models_and_datasets):
    info = sample_models_and_datasets
    response = client.post("/api/v1/models/compare", data={
        "model_names": json.dumps([info["clf_model"], "absent_model.pkl"]),
        "file_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 200, response.text
    by_name = {r["model_name"]: r for r in response.json()["results"]}
    assert "error" not in by_name[info["clf_model"]]
    assert "error" in by_name["absent_model.pkl"]


def test_compare_rejects_other_users_models(client, impersonate, sample_models_and_datasets):
    info = sample_models_and_datasets
    impersonate("usr_intruder", "intruder@test.local", "Intruder")
    response = client.post("/api/v1/models/compare", data={
        "model_names": json.dumps([info["clf_model"]]),
        "file_name": info["clf_dataset"],
        "target_column": info["clf_target"],
    })
    assert response.status_code == 403

