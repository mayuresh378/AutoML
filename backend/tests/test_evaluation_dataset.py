import os
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from main import app, MODELS_DIR, DATASET_DIR
from evaluation import detect_target_column, detect_task_type, analyze_dataset_for_evaluation, evaluate_dataset_end_to_end


@pytest.fixture
def temp_dataset(tmp_path, monkeypatch):
    dataset_dir = tmp_path / "datasets"
    models_dir = tmp_path / "models"
    dataset_dir.mkdir(parents=True, exist_ok=True)
    models_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setattr("main.DATASET_DIR", str(dataset_dir))
    monkeypatch.setattr("main.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("evaluation.DATASET_DIR", str(dataset_dir))
    monkeypatch.setattr("evaluation.MODELS_DIR", str(models_dir))
    monkeypatch.setattr("preprocess.DATASET_DIR", str(dataset_dir))

    # Classification CSV
    clf_df = pd.DataFrame({
        "user_id": [f"user_{i}" for i in range(30)],
        "age": np.random.randint(18, 65, size=30),
        "income": np.random.uniform(20000, 100000, size=30),
        "target": np.random.choice(["Yes", "No"], size=30),
    })
    clf_path = dataset_dir / "sample_clf.csv"
    clf_df.to_csv(clf_path, index=False)

    # Regression CSV
    reg_df = pd.DataFrame({
        "house_id": [f"h_{i}" for i in range(30)],
        "bedrooms": np.random.randint(1, 5, size=30),
        "sqft": np.random.uniform(500, 3500, size=30),
        "price": np.random.uniform(100000, 800000, size=30),
    })
    reg_path = dataset_dir / "sample_reg.csv"
    reg_df.to_csv(reg_path, index=False)

    return str(dataset_dir)


def test_detect_target_column(temp_dataset):
    file_path = os.path.join(temp_dataset, "sample_clf.csv")
    df = pd.read_csv(file_path)
    detection = detect_target_column(df)
    assert detection["suggested_target"] == "target"
    assert detection["confidence"] == "High"
    assert detection["task_type"] == "classification"
    assert "user_id" in detection["potential_ids"]

    reg_file = os.path.join(temp_dataset, "sample_reg.csv")
    df_reg = pd.read_csv(reg_file)
    detection_reg = detect_target_column(df_reg)
    assert detection_reg["suggested_target"] == "price"
    assert detection_reg["task_type"] == "regression"


def test_analyze_dataset_for_evaluation(temp_dataset):
    analysis = analyze_dataset_for_evaluation("sample_clf.csv")
    assert analysis["file_name"] == "sample_clf.csv"
    assert analysis["rows"] == 30
    assert analysis["suggested_target"] == "target"
    assert analysis["detected_task_type"] == "classification"
    assert "user_id" in analysis["potential_id_columns"]


def test_evaluate_dataset_end_to_end_classification(temp_dataset):
    res = evaluate_dataset_end_to_end("sample_clf.csv", target_column="target", task_type="classification")
    assert res["target_column"] == "target"
    assert res["task_type"] == "classification"
    assert "metrics" in res
    assert "accuracy" in res["metrics"]
    assert len(res["preprocessing_summary"]) > 0
    assert len(res["model_comparison"]) > 0
    assert "best_model_name" in res


def test_evaluate_dataset_end_to_end_regression(temp_dataset):
    res = evaluate_dataset_end_to_end("sample_reg.csv", target_column="price", task_type="regression")
    assert res["target_column"] == "price"
    assert res["task_type"] == "regression"
    assert "metrics" in res
    assert "r2" in res["metrics"]
    assert len(res["preprocessing_summary"]) > 0
    assert len(res["model_comparison"]) > 0


def test_api_analyze_and_run_dataset(temp_dataset, client, monkeypatch):
    import main as main_module

    # Bypass dataset ownership DB check (temp dataset has no DB record in test)
    monkeypatch.setattr(main_module, "require_dataset_access", lambda db, name, user, **kwargs: None)

    # 1. Analyze API
    resp = client.post("/api/v1/evaluation/analyze", json={"file_name": "sample_clf.csv"})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["suggested_target"] == "target"
    assert data["detected_task_type"] == "classification"

    # 2. Run Dataset Evaluation API
    resp_eval = client.post("/api/v1/evaluation/run-dataset", json={"file_name": "sample_clf.csv", "target_column": "target"})
    assert resp_eval.status_code == 200, resp_eval.text
    eval_data = resp_eval.json()
    assert eval_data["target_column"] == "target"
    assert "accuracy" in eval_data["metrics"]

