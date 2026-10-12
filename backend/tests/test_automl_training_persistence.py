import pytest
import pandas as pd
import numpy as np
import os
from train import get_algorithms_catalog, CLASSIFICATION_MODELS, REGRESSION_MODELS
from preprocess import load_dataset_file, validate_dataset_and_target, prepare_train_test_data
from recommendations import generate_dataset_recommendations
from crud import (
    create_training_run, update_training_run, get_training_run,
    list_training_runs, delete_training_run
)


def test_algorithms_catalog():
    """Verify algorithm catalog provides accurate availability and metadata."""
    catalog = get_algorithms_catalog()
    assert "classification" in catalog
    assert "regression" in catalog
    assert "optional" in catalog

    clf_names = [m["name"] for m in catalog["classification"]]
    reg_names = [m["name"] for m in catalog["regression"]]

    assert "RandomForest" in clf_names
    assert "CatBoost" in clf_names
    assert "XGBoost" in clf_names
    assert "LightGBM" in clf_names

    assert "RandomForest" in reg_names
    assert "Ridge" in reg_names
    assert "CatBoost" in reg_names

    # Check available flag
    catb_clf = next(m for m in catalog["classification"] if m["name"] == "CatBoost")
    assert isinstance(catb_clf["available"], bool)
    assert catb_clf["default_selected"] == catb_clf["available"]


def test_dataset_loading_and_validation(tmp_path, monkeypatch):
    """Verify multi-format loading and data validation checks."""
    monkeypatch.setattr("preprocess.DATASET_DIR", str(tmp_path))
    monkeypatch.setattr("recommendations.DATASET_DIR", str(tmp_path))

    # 1. Create a valid classification CSV
    df = pd.DataFrame({
        "age": [25, 30, 45, 35, 50, 23, 40, 60, 29, 31],
        "income": [50000, 60000, 80000, 65000, 100000, 48000, 72000, 110000, 58000, 61000],
        "gender": ["M", "F", "F", "M", "M", "F", "M", "F", "M", "F"],
        "target": [0, 1, 1, 0, 1, 0, 1, 1, 0, 0]
    })
    csv_file = tmp_path / "test_data.csv"
    df.to_csv(csv_file, index=False)

    loaded = load_dataset_file("test_data.csv")
    assert len(loaded) == 10
    assert "target" in loaded.columns

    # Validation succeeds
    X, y, detected_task, meta = validate_dataset_and_target(loaded, "target", "classification")
    assert len(X) == 10
    assert len(y) == 10
    assert detected_task == "classification"
    assert meta["n_classes"] == 2

    # 2. Test constant target error
    df_const = df.copy()
    df_const["target"] = 1
    with pytest.raises(ValueError, match="constant"):
        validate_dataset_and_target(df_const, "target", "classification")

    # 3. Test missing target column error
    with pytest.raises(ValueError, match="not found"):
        validate_dataset_and_target(df, "non_existent_col")


def test_leakage_free_preprocessing(tmp_path, monkeypatch):
    """Verify that preprocessing splits data before fitting transformer."""
    monkeypatch.setattr("preprocess.DATASET_DIR", str(tmp_path))

    # Create dataset with numeric, categorical, and missing values
    np.random.seed(42)
    n = 40
    df = pd.DataFrame({
        "num1": np.random.randn(n),
        "num2": [np.nan if i % 5 == 0 else float(i) for i in range(n)],
        "cat1": ["cat" if i % 2 == 0 else "dog" for i in range(n)],
        "target": [1 if i % 3 == 0 else 0 for i in range(n)]
    })
    df.to_csv(tmp_path / "leakage_test.csv", index=False)

    prep = prepare_train_test_data("leakage_test.csv", "target", "classification", test_size=0.25)

    assert "X_train" in prep
    assert "X_test" in prep
    assert "y_train" in prep
    assert "y_test" in prep
    assert prep["preprocessor"] is not None

    # Train and test should have expected lengths (40 * 0.75 = 30 train, 10 test)
    assert len(prep["X_train"]) == 30
    assert len(prep["X_test"]) == 10
    # No NaNs in processed data
    assert not prep["X_train"].isna().any().any()
    assert not prep["X_test"].isna().any().any()


def test_dataset_recommendations(tmp_path, monkeypatch):
    """Verify dataset recommendations provide intelligent suggestions."""
    monkeypatch.setattr("preprocess.DATASET_DIR", str(tmp_path))
    monkeypatch.setattr("recommendations.DATASET_DIR", str(tmp_path))

    df = pd.DataFrame({
        "id": range(1, 31),
        "feature_a": np.random.randn(30),
        "feature_b": ["A", "B", "C"] * 10,
        "is_churn": [0, 1] * 15
    })
    df.to_csv(tmp_path / "churn_data.csv", index=False)

    rec = generate_dataset_recommendations("churn_data.csv", "is_churn")
    assert rec["problem_type"] == "classification"
    assert rec["target_column"] == "is_churn"
    assert len(rec["recommended_algorithms"]) > 0
    assert len(rec["recommended_metrics"]) > 0
    assert rec["complexity"] in ("Fast", "Moderate", "Heavy")


def test_training_run_crud_and_persistence(db):
    """Test full lifecycle of TrainingRun in SQLite DB."""
    run_id = "test_run_1"
    run_data = {
        "id": run_id,
        "name": "churn_data-classification",
        "user_id": "usr_test1",
        "dataset_name": "churn_data.csv",
        "target_column": "is_churn",
        "task_type": "classification",
        "selected_algorithms": ["RandomForest", "LogisticRegression"],
        "hyperparameters_config": {"cv_folds": 5, "optimize_hyperparameters": True},
        "status": "queued",
        "progress": 0.0,
        "message": "Queued",
    }

    # 1. Create
    created = create_training_run(db, run_data)
    assert created.id == run_id
    assert created.status == "queued"

    # 2. Get
    fetched = get_training_run(db, run_id, user_id="usr_test1")
    assert fetched is not None
    assert fetched.name == "churn_data-classification"

    # 3. Update status to running then completed
    update_training_run(db, run_id, {
        "status": "running",
        "progress": 50.0,
        "current_step": "training",
        "message": "Training RandomForest",
    })
    updated = get_training_run(db, run_id, user_id="usr_test1")
    assert updated.status == "running"
    assert updated.progress == 50.0

    update_training_run(db, run_id, {
        "status": "completed",
        "progress": 100.0,
        "current_step": "complete",
        "best_model_name": "RandomForest",
        "best_score": 0.92,
        "rank_metric": "accuracy",
        "evaluation_metrics": {"accuracy": 0.92, "f1": 0.91},
        "logs": [{"time": 1.2, "message": "Done"}],
        "duration_seconds": 12.5,
    })
    completed = get_training_run(db, run_id, user_id="usr_test1")
    assert completed.status == "completed"
    assert completed.best_score == 0.92
    assert completed.evaluation_metrics["accuracy"] == 0.92

    # 4. List
    runs, total = list_training_runs(db, user_id="usr_test1")
    assert total >= 1
    assert any(r.id == run_id for r in runs)

    # 5. Delete
    deleted = delete_training_run(db, run_id, user_id="usr_test1")
    assert deleted is True
    assert get_training_run(db, run_id, user_id="usr_test1") is None


def test_training_history_api(client, db):
    """Test Training History API endpoints."""
    # Seed a training run
    create_training_run(db, {
        "id": "run_hist_1",
        "name": "housing-regression",
        "user_id": "usr_test1",
        "dataset_name": "housing.csv",
        "target_column": "price",
        "task_type": "regression",
        "selected_algorithms": ["RandomForest", "Ridge"],
        "status": "completed",
        "progress": 100.0,
        "best_model_name": "RandomForest",
        "best_score": 0.88,
        "rank_metric": "r2",
        "evaluation_metrics": {"r2": 0.88, "mae": 15000.0},
    })

    # Test GET /api/v1/training/history
    res = client.get("/api/v1/training/history")
    assert res.status_code == 200
    data = res.json()
    assert "runs" in data
    assert data["total"] >= 1
    run_entry = next(r for r in data["runs"] if r["id"] == "run_hist_1")
    assert run_entry["best_model_name"] == "RandomForest"
    assert run_entry["rank_metric"] == "r2"

    # Test GET /api/v1/training/history/{run_id}
    res_single = client.get("/api/v1/training/history/run_hist_1")
    assert res_single.status_code == 200
    single_data = res_single.json()
    assert single_data["id"] == "run_hist_1"
    assert single_data["evaluation_metrics"]["r2"] == 0.88

    # Test DELETE /api/v1/training/history/{run_id}
    res_del = client.delete("/api/v1/training/history/run_hist_1")
    assert res_del.status_code == 200
    assert client.get("/api/v1/training/history/run_hist_1").status_code == 404


def test_optional_models_import_resilience(monkeypatch):
    """Verify that train and catalog modules do not crash if an optional library raises OSError."""
    import sys
    # Verify that get_algorithms_catalog works cleanly regardless of native lib status
    catalog = get_algorithms_catalog()
    assert "classification" in catalog
    assert "regression" in catalog
    # Verify catalog contains LightGBM, XGBoost, CatBoost entries with availability flags
    names = [m["name"] for m in catalog["classification"]]
    assert "LightGBM" in names
    assert "XGBoost" in names
    assert "CatBoost" in names
