"""Tests for the HPO experiment history endpoints (list / detail / re-run / delete).

Each test redirects the history store file to a temp location so the real
`backend/hpo_history.json` is never touched.
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture
def history_file(tmp_path, monkeypatch):
    main.HPO_HISTORY_FILE = str(tmp_path / "hpo_history.json")
    main.HPO_HISTORY_LIMIT = 200
    return str(tmp_path / "hpo_history.json")


@pytest.fixture
def seed_record(history_file):
    """Write a realistic completed experiment record directly to the store."""
    record = {
        "id": "job_history_1",
        "user_id": "usr_test1",
        "project_id": None,
        "name": "churn · grid",
        "config": {
            "file_name": "churn.csv",
            "target_column": "churn",
            "method": "grid",
            "cv_folds": 5,
            "n_iter": 40,
            "models": ["GradientBoosting", "RandomForest"],
            "task_type": "classification",
            "metric": "accuracy",
            "project_id": None,
        },
        "status": "completed",
        "error": None,
        "save_warning": None,
        "best_model": "GradientBoosting",
        "best_params": {"n_estimators": 200, "learning_rate": 0.05},
        "best_score": 0.87,
        "best_metrics": {"accuracy": 0.87},
        "saved_model_name": "churn_GradientBoosting.pkl",
        "experiments": [{"id": "exp_1", "name": "churn-GradientBoosting-hpo", "model": "GradientBoosting", "cv_score": 0.87}],
        "trials": [
            {"name": "GradientBoosting", "params": {"n_estimators": 200}, "score": 0.87},
            {"name": "RandomForest", "params": {"n_estimators": 150}, "score": 0.85},
        ],
        "total": 2,
        "started_at": "2026-10-01T10:00:00",
        "completed_at": "2026-10-01T10:00:12",
    }
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump([record], f, indent=2)
    return record


def test_list_empty(client, history_file):
    r = client.get("/api/v1/hpo/experiments")
    assert r.status_code == 200
    body = r.json()
    assert body["experiments"] == []
    assert body["total"] == 0


def test_list_and_detail(client, seed_record):
    r = client.get("/api/v1/hpo/experiments")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["experiments"][0]["id"] == "job_history_1"
    assert body["experiments"][0]["best_model"] == "GradientBoosting"
    assert body["experiments"][0]["config"]["method"] == "grid"

    d = client.get("/api/v1/hpo/experiments/job_history_1")
    assert d.status_code == 200
    det = d.json()
    assert det["best_params"] == {"n_estimators": 200, "learning_rate": 0.05}
    assert len(det["trials"]) == 2
    assert det["total"] == 2


def test_detail_and_list_404_unknown(client, history_file):
    assert client.get("/api/v1/hpo/experiments/nope").status_code == 404
    assert client.get("/api/v1/hpo/experiments").json()["total"] == 0


def test_delete(client, seed_record):
    r = client.delete("/api/v1/hpo/experiments/job_history_1")
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"
    assert client.get("/api/v1/hpo/experiments").json()["total"] == 0
    assert client.delete("/api/v1/hpo/experiments/job_history_1").status_code == 404


def test_user_isolation(client, seed_record, impersonate):
    # A different user must not see, open, or delete another user's record.
    impersonate(user_id="usr_other")
    assert client.get("/api/v1/hpo/experiments").json()["total"] == 0
    assert client.get("/api/v1/hpo/experiments/job_history_1").status_code == 404
    assert client.delete("/api/v1/hpo/experiments/job_history_1").status_code == 404
    assert client.post("/api/v1/hpo/experiments/job_history_1/rerun").status_code == 404


def test_rerun_launches_real_job(client, seed_record, dataset_dir, monkeypatch):
    """Re-running a stored experiment must start a genuine optimization job."""
    import pandas as pd

    monkeypatch.setattr("preprocess.DATASET_DIR", str(dataset_dir))

    # Small but valid dataset: 120 rows, 3 balanced classes, one numeric feature.
    rng = __import__("numpy").random.RandomState(7)
    df = pd.DataFrame({
        "f1": rng.randn(15 * 8),
        "label": ["A"] * 40 + ["B"] * 40 + ["C"] * 40,
    })
    df.to_csv(os.path.join(dataset_dir, "churn.csv"), index=False)

    # Rewrite the seed record to point at the temp dataset and train 1 fast model.
    rec = dict(seed_record)
    rec["config"] = {
        **rec["config"],
        "file_name": "churn.csv",
        "target_column": "label",
        "cv_folds": 3,
        "n_iter": 1,
        "models": ["KNN"],
        "method": "random",
    }
    with open(main.HPO_HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump([rec], f, indent=2)

    r = client.post("/api/v1/hpo/experiments/job_history_1/rerun")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "queued"
    assert body["rerun_of"] == "job_history_1"
    assert body["job_id"]

    # The new job must be live and eventually reach a terminal state.
    import time
    job_id = body["job_id"]
    terminal = None
    for _ in range(60):
        p = client.get(f"/api/v1/hpo/{job_id}")
        assert p.status_code == 200
        st = p.json().get("status")
        if st in ("completed", "failed") or p.json().get("status") == "cancelled":
            terminal = st
            break
        time.sleep(0.5)
    assert terminal in ("completed", "failed"), (terminal, p.json())

    # The re-run also snapshots into history (a second record).
    listed = client.get("/api/v1/hpo/experiments").json()
    assert listed["total"] == 2
    assert listed["experiments"][0]["id"] == job_id
    assert listed["experiments"][0]["config"]["method"] == "random"


def test_rerun_incomplete_config_400(client, history_file):
    record = {
        "id": "job_bad",
        "user_id": "usr_test1",
        "name": "broken",
        "config": {"file_name": "missing.csv", "target_column": "", "models": []},
        "status": "failed",
        "trials": [],
    }
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump([record], f, indent=2)
    r = client.post("/api/v1/hpo/experiments/job_bad/rerun")
    assert r.status_code == 400


def test_record_helper_persists(tmp_path, monkeypatch, history_file):
    """_record_hpo_experiment snapshots an in-memory job into the history file."""
    with main.hpo_lock:
        main.hpo_progress_store["job_live"] = {
            "status": "completed",
            "user_id": "usr_test1",
            "current_model": "KNN",
            "current": 1,
            "total": 1,
            "model_results": [{"name": "KNN", "params": {"n_neighbors": 5}, "score": 0.8}],
            "best_model": "KNN",
            "best_params": {"n_neighbors": 5},
            "best_score": 0.8,
            "best_metrics": {"accuracy": 0.8},
            "saved_model_name": "ds_KNN.pkl",
            "experiments": [],
            "config": {
                "file_name": "ds.csv",
                "target_column": "y",
                "method": "grid",
                "cv_folds": 5,
                "n_iter": 30,
                "models": ["KNN"],
                "task_type": "classification",
                "metric": "accuracy",
            },
            "started_at": "2026-10-02T00:00:00",
        }
    try:
        main._record_hpo_experiment("job_live")
        with open(history_file, "r", encoding="utf-8") as f:
            records = json.load(f)
        assert records[0]["id"] == "job_live"
        assert records[0]["best_model"] == "KNN"
        assert records[0]["total"] == 1
        assert records[0]["status"] == "completed"
    finally:
        with main.hpo_lock:
            main.hpo_progress_store.pop("job_live", None)