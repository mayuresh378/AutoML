"""Comprehensive API tests."""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient


class TestHealth:
    def test_health_endpoint(self, client: TestClient):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] in ("healthy", "ok")


class TestAuth:
    def test_register_and_login(self, client: TestClient):
        resp = client.post("/api/v1/auth/register", data={
            "email": "test@example.com", "password": "testpass123", "name": "Test User"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"

        resp = client.post("/api/v1/auth/login", data={
            "email": "test@example.com", "password": "testpass123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data

    def test_register_duplicate(self, client: TestClient):
        client.post("/api/v1/auth/register", data={
            "email": "dup@example.com", "password": "testpass123", "name": "Dup"
        })
        resp = client.post("/api/v1/auth/register", data={
            "email": "dup@example.com", "password": "testpass123", "name": "Dup"
        })
        assert resp.status_code in (400, 409)

    def test_login_invalid(self, client: TestClient):
        resp = client.post("/api/v1/auth/login", data={
            "email": "nonexist@example.com", "password": "wrong"
        })
        assert resp.status_code == 401


class TestDatasets:
    def test_list_datasets(self, client: TestClient):
        resp = client.get("/api/v1/datasets")
        assert resp.status_code == 200
        assert "datasets" in resp.json()

    def test_upload_and_list(self, client: TestClient, dataset_dir):
        # `dataset_dir` redirects DATASET_DIR to tmp_path. Without it this test
        # uploaded into the real dataset/ folder and asserted against the
        # default 50-row page, so the fresh upload fell outside the page once
        # the directory accumulated enough files.
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("a,b,c\n1,2,3\n4,5,6\n")
            fpath = f.name

        with open(fpath, "rb") as f:
            resp = client.post("/api/v1/datasets", files={"file": (os.path.basename(fpath), f, "text/csv")})
        assert resp.status_code == 200

        resp = client.get("/api/v1/datasets?limit=500")
        assert resp.status_code == 200
        names = [d["name"] for d in resp.json()["datasets"]]
        assert os.path.basename(fpath) in names

        os.unlink(fpath)

    def test_preview(self, client: TestClient, dataset_dir):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("x,y\n10,20\n30,40\n50,60\n")
            fpath = f.name

        with open(fpath, "rb") as f:
            client.post("/api/v1/datasets", files={"file": (os.path.basename(fpath), f, "text/csv")})

        resp = client.get(f"/api/v1/datasets/{os.path.basename(fpath)}/preview?rows=2")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_rows"] == 3
        assert len(data["data"]) == 2

        os.unlink(fpath)


class TestModels:
    def test_list_models(self, client: TestClient):
        resp = client.get("/api/v1/models")
        assert resp.status_code == 200
        assert "models" in resp.json()


class TestMonitoring:
    def test_metrics(self, client: TestClient):
        resp = client.get("/api/v1/monitoring/metrics")
        assert resp.status_code == 200
        data = resp.json()
        d = data.get("data", data)
        for key in ["cpu", "memory", "disk"]:
            assert key in d

    def test_stats(self, client: TestClient):
        resp = client.get("/api/v1/monitoring/stats")
        assert resp.status_code == 200


class TestWebhooks:
    def test_crud(self, client: TestClient):
        resp = client.post("/api/v1/webhooks", json={
            "name": "Test Webhook",
            "url": "https://example.com/hook",
            "events": ["experiment.completed", "model.registered"],
        })
        assert resp.status_code == 200
        wh_id = resp.json()["id"]

        resp = client.get("/api/v1/webhooks")
        assert resp.status_code == 200
        ids = [w["id"] for w in resp.json()["webhooks"]]
        assert wh_id in ids

        resp = client.delete(f"/api/v1/webhooks/{wh_id}")
        assert resp.status_code == 200


class TestActivity:
    def test_activity(self, client: TestClient):
        resp = client.get("/api/v1/activity")
        assert resp.status_code == 200
        assert "activities" in resp.json()


class TestUserIsolation:
    def test_other_user_cannot_see_or_access(self, client: TestClient, impersonate, dataset_dir):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write("a,b,c\n1,2,3\n4,5,6\n")
            fname = os.path.basename(f.name)

        impersonate("usr_a", "a@test.local", "User A")
        with open(f.name, "rb") as fh:
            up = client.post("/api/v1/datasets", files={"file": (fname, fh, "text/csv")})
        assert up.status_code == 200

        # User B must NOT see User A's dataset in the list
        impersonate("usr_b", "b@test.local", "User B")
        lst = client.get("/api/v1/datasets")
        assert lst.status_code == 200
        names = [d["name"] for d in lst.json()["datasets"]]
        assert fname not in names

        # User B must not read, download, or delete it
        assert client.get(f"/api/v1/datasets/{fname}").status_code == 403
        assert client.get(f"/api/v1/datasets/{fname}/download").status_code == 403
        assert client.delete(f"/api/v1/datasets/{fname}").status_code == 403

        # Owner can still read it
        impersonate("usr_a", "a@test.local", "User A")
        assert client.get(f"/api/v1/datasets/{fname}").status_code == 200
        assert client.delete(f"/api/v1/datasets/{fname}").status_code == 200

        os.unlink(f.name)

    def test_anonymous_gets_empty_list(self, client: TestClient, dataset_dir):
        from auth import get_optional_user
        from main import app

        app.dependency_overrides[get_optional_user] = lambda: {
            "id": "anonymous", "email": "guest@automl.local", "name": "Guest", "role": "guest",
        }
        resp = client.get("/api/v1/datasets")
        assert resp.status_code == 200
        assert resp.json()["datasets"] == []


class TestSampleDatasets:
    def test_load_and_cross_user_visibility(self, client: TestClient, impersonate, dataset_dir):
        impersonate("usr_s1", "s1@test.local", "Sample One")
        r = client.post("/api/v1/datasets/sample/iris")
        assert r.status_code == 200
        data = r.json()
        assert data["rows"] == 150
        assert data["default_target"] == "target"
        assert data["status"] == "ready"

        assert client.get("/api/v1/datasets/iris.csv").status_code == 200
        prev = client.get("/api/v1/datasets/iris.csv/preview?rows=5")
        assert prev.status_code == 200
        assert len(prev.json()["data"]) == 5

        # A different user can read the shared sample but not mutate it
        impersonate("usr_s2", "s2@test.local", "Sample Two")
        assert client.get("/api/v1/datasets/iris.csv").status_code == 200
        lst = client.get("/api/v1/datasets")
        names = [d["name"] for d in lst.json()["datasets"]]
        assert "iris.csv" in names
        assert client.delete("/api/v1/datasets/iris.csv").status_code == 403

    def test_unknown_sample_rejected(self, client: TestClient):
        resp = client.post("/api/v1/datasets/sample/doesnotexist")
        assert resp.status_code == 400


class TestModelIsolation:
    def test_other_user_cannot_list_or_access_models(self, client: TestClient, db, impersonate, tmp_path, monkeypatch):
        monkeypatch.setattr("main.MODELS_DIR", str(tmp_path))
        import pickle
        from models import ModelRegistry

        fname = "user_a_model.pkl"
        (tmp_path / fname).write_bytes(pickle.dumps({"m": 1}))
        (tmp_path / fname.replace(".pkl", "_meta.json")).write_text('{"cv_score": 0.8, "status": "staging"}')
        db.add(ModelRegistry(id="reg_a", name="user_a_model", user_id="usr_a"))
        db.commit()

        impersonate("usr_a", "a@test.local", "User A")
        lst = client.get("/api/v1/models")
        assert lst.status_code == 200
        names = [m.get("name") for m in lst.json()["models"]]
        assert fname in names
        assert names.count(fname) == 1
        assert client.get(f"/api/v1/models/{fname}").status_code == 200
        assert client.get(f"/api/v1/models/{fname}/download").status_code == 200

        impersonate("usr_b", "b@test.local", "User B")
        lst = client.get("/api/v1/models")
        names = [m.get("name") for m in lst.json()["models"]]
        assert fname not in names
        assert client.get(f"/api/v1/models/{fname}").status_code == 403
        assert client.get(f"/api/v1/models/{fname}/download").status_code == 403
        assert client.delete(f"/api/v1/models/{fname}").status_code == 403
        assert client.put(f"/api/v1/models/{fname}/promote").status_code == 403
        assert client.put(f"/api/v1/models/{fname}/archive").status_code == 403


class TestPredictionLogIsolation:
    def test_cross_user_prediction_log_gated(self, client: TestClient, db, impersonate):
        from models import PredictionLog

        db.add(PredictionLog(id="plog_a", model_name="m.pkl", input_preview="x",
                             prediction="y", batch_size=1, user_id="usr_a"))
        db.commit()

        impersonate("usr_b", "b@test.local", "User B")
        assert client.get("/api/v1/predictions/plog_a").status_code == 403
        assert client.delete("/api/v1/predictions/plog_a").status_code == 403

        impersonate("usr_a", "a@test.local", "User A")
        assert client.get("/api/v1/predictions/plog_a").status_code == 200
        assert client.delete("/api/v1/predictions/plog_a").status_code == 200
