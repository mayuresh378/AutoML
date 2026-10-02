"""Tests for the hardened SQL Studio backend (sql_studio.py)."""
import io
import os
import pytest
from fastapi.testclient import TestClient

from database import Base
from main import app
from auth import get_current_user
from crud import create_dataset_record
from models import DatasetShare


DATA = """sepal_length,sepal_width,species,target
5.1,3.5,setosa,0
4.9,3.0,setosa,0
4.7,3.2,setosa,0
7.0,3.2,versicolor,1
6.4,3.2,versicolor,1
"""
SHARED_DATA = "id,name\n1,alpha\n2,beta\n"
PRIVATE_DATA = "secret,value\nx,1\ny,2\n"


@pytest.fixture
def sql_dir(tmp_path, monkeypatch, db):
    monkeypatch.setattr("main.DATASET_DIR", str(tmp_path))
    monkeypatch.setattr("sql_studio.DATASET_DIR", str(tmp_path))
    (tmp_path / "iris.csv").write_text(DATA, encoding="utf-8")
    (tmp_path / "shared_pub.csv").write_text(SHARED_DATA, encoding="utf-8")
    (tmp_path / "private_other.csv").write_text(PRIVATE_DATA, encoding="utf-8")
    create_dataset_record(db, "iris.csv", size_kb=0.3, rows=5,
                          columns=["sepal_length", "sepal_width", "species", "target"],
user_id=None, source="sample")
    create_dataset_record(db, "private_other.csv", size_kb=0.1, rows=2,
                          columns=["secret", "value"], user_id="usr_owner", source="upload")
    _share(db, create_dataset_record(db, "shared_pub.csv", size_kb=0.1, rows=2,
                                     columns=["id", "name"], user_id="usr_owner", source="upload").id,
           user_id="usr_test1")
    return tmp_path


def _share(db, dataset_id, user_id=None, email=None):
    share = DatasetShare(dataset_id=dataset_id, shared_with_user_id=user_id, shared_with_email=email)
    db.add(share)
    db.commit()


class TestAuthRequired:
    def test_query_requires_auth(self):
        with TestClient(app, raise_server_exceptions=False) as c:
            app.dependency_overrides.clear()
            resp = c.post("/api/v1/query", data={"query": "SELECT * FROM data LIMIT 1"})
            assert resp.status_code == 401

    def test_schema_requires_auth(self):
        with TestClient(app, raise_server_exceptions=False) as c:
            app.dependency_overrides.clear()
            resp = c.get("/api/v1/query/schema")
            assert resp.status_code == 401


class TestRunQuery:
    def test_run_select(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={"query": "SELECT * FROM data LIMIT 3", "dataset": "iris.csv"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["rows"] == 3
        assert data["total_rows"] == 3
        assert data["query_id"]
        assert data["columns"] == ["sepal_length", "sepal_width", "species", "target"]
        assert data["data"][0]["species"] == "setosa"

    def test_run_pagination(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={
            "query": "SELECT * FROM data", "dataset": "iris.csv", "page": "1", "page_size": "2"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["rows"] == 2
        assert data["total_rows"] == 5
        qid = data["query_id"]
        page2 = client.get(f"/api/v1/query/{qid}/page", params={"page": 2, "page_size": 2})
        assert page2.status_code == 200
        p2 = page2.json()
        assert p2["rows"] == 2
        first_ids = {r["sepal_length"] for r in data["data"]}
        second_ids = {r["sepal_length"] for r in p2["data"]}
        assert first_ids.isdisjoint(second_ids)

    def test_unknown_dataset(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={"query": "SELECT * FROM data LIMIT 1", "dataset": "nope.csv"})
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]

    def test_sql_error_captured(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={"query": "SELECT nope_col FROM data", "dataset": "iris.csv"})
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail["code"] == "sql_error"


class TestIsolation:
    def test_private_other_not_visible(self, client, sql_dir, db, impersonate):
        impersonate(user_id="usr_test1", email="unit@test.local")
        resp = client.post("/api/v1/query", data={
            "query": "SELECT * FROM data LIMIT 2", "dataset": "private_other.csv"})
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"]

    def test_shared_visible(self, client, sql_dir, db, impersonate):
        (sql_dir / "owned.csv").write_text("a,b\n1,2\n3,4\n", encoding="utf-8")
        owner = create_dataset_record(db, "owned.csv", size_kb=0.1, rows=2,
                                      columns=["a", "b"], user_id="usr_owner", source="upload")
        _share(db, owner.id, user_id="usr_test1")
        impersonate(user_id="usr_test1", email="unit@test.local")
        resp = client.post("/api/v1/query", data={
            "query": "SELECT * FROM data LIMIT 2", "dataset": "owned.csv"})
        assert resp.status_code == 200
        assert resp.json()["rows"] == 2


class TestDestructiveOps:
    def test_delete_requires_confirmation(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={
            "query": "DELETE FROM data WHERE target = 0", "dataset": "iris.csv"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "requires_confirmation"
        assert "delete" in data["operations"]
        assert data["message"]

    def test_drop_without_confirm_blocked(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={"query": "DROP TABLE IF EXISTS iris", "dataset": "iris.csv"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "requires_confirmation"

    def test_drop_confirmed_runs_in_sandbox(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={
            "query": "DROP TABLE IF EXISTS iris;", "dataset": "iris.csv", "confirm_destructive": "true"})
        assert resp.status_code in (200, 400)
        if resp.status_code == 200:
            assert resp.json()["status"] == "success"

    def test_read_csv_blocked(self, client, sql_dir):
        resp = client.post("/api/v1/query", data={"query": "SELECT * FROM read_csv('C:/Windows/win.ini')"})
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail.get("code") == "invalid_sql"


class TestSchema:
    def test_schema_lists_visible(self, client, sql_dir):
        resp = client.get("/api/v1/query/schema")
        assert resp.status_code == 200
        names = [d["name"] for d in resp.json()["datasets"]]
        assert "iris.csv" in names
        assert "shared_pub.csv" in names
        assert "private_other.csv" not in names

    def test_schema_private_hidden_from_other(self, client, sql_dir, db, impersonate):
        impersonate(user_id="usr_test1", email="unit@test.local")
        resp = client.get("/api/v1/query/schema")
        names = [d["name"] for d in resp.json()["datasets"]]
        assert "private_other.csv" not in names

    def test_table_schema(self, client, sql_dir):
        resp = client.get("/api/v1/query/schema/iris.csv")
        assert resp.status_code == 200
        col_names = [c["name"] for c in resp.json()["columns"]]
        assert "species" in col_names

    def test_preview(self, client, sql_dir):
        resp = client.get("/api/v1/query/preview", params={"name": "iris.csv", "limit": 2})
        assert resp.status_code == 200
        assert resp.json()["rows"] == 2


class TestValidate:
    def test_valid_readonly(self, client, sql_dir):
        resp = client.post("/api/v1/query/validate", data={"query": "SELECT * FROM data LIMIT 5", "dataset": "iris.csv"})
        assert resp.status_code == 200
        assert resp.json()["valid"] is True

    def test_invalid_column(self, client, sql_dir):
        resp = client.post("/api/v1/query/validate", data={"query": "SELECT bad_col FROM data", "dataset": "iris.csv"})
        data = resp.json()
        assert data["valid"] is False
        assert data["reasons"]


class TestHistory:
    def test_history_recorded(self, client, sql_dir):
        client.post("/api/v1/query", data={"query": "SELECT * FROM data LIMIT 2", "dataset": "iris.csv"})
        resp = client.get("/api/v1/query/history")
        assert resp.status_code == 200
        items = resp.json()["history"]
        assert len(items) >= 1
        assert items[0]["dataset"] == "iris.csv"
        assert items[0]["status"] == "success"

    def test_history_delete_and_clear(self, client, sql_dir):
        client.post("/api/v1/query", data={"query": "SELECT * FROM data LIMIT 2", "dataset": "iris.csv"})
        h = client.get("/api/v1/query/history").json()["history"]
        hid = h[0]["id"]
        resp = client.delete(f"/api/v1/query/history/{hid}")
        assert resp.status_code == 200
        remaining = client.get("/api/v1/query/history").json()["history"]
        assert all(i["id"] != hid for i in remaining)
        assert client.delete("/api/v1/query/history").status_code == 200
        assert client.get("/api/v1/query/history").json()["history"] == []


class TestSaved:
    def test_saved_crud(self, client):
        resp = client.post("/api/v1/query/saved", data={
            "name": "My Query", "query": "SELECT 1", "folder": "default"})
        assert resp.status_code == 200
        sid = resp.json()["id"]
        listed = client.get("/api/v1/query/saved").json()["saved"]
        assert any(s["id"] == sid and s["name"] == "My Query" for s in listed)
        assert client.put(f"/api/v1/query/saved/{sid}", data={"name": "Renamed"}).status_code == 200
        assert client.get("/api/v1/query/saved").json()["saved"][0]["name"] == "Renamed"
        assert client.delete(f"/api/v1/query/saved/{sid}").status_code == 200
        assert client.get("/api/v1/query/saved").json()["saved"] == []


class TestExport:
    def test_export_csv(self, client, sql_dir):
        resp = client.post("/api/v1/query/export", data={"query": "SELECT * FROM data", "dataset": "iris.csv", "format": "csv"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        body = resp.text
        assert body.splitlines()[0].startswith("sepal_length")

    def test_export_json(self, client, sql_dir):
        resp = client.post("/api/v1/query/export", data={"query": "SELECT * FROM data", "dataset": "iris.csv", "format": "json"})
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/json")
        assert '"sepal_length"' in resp.text

    def test_export_bad_format(self, client, sql_dir):
        resp = client.post("/api/v1/query/export", data={"query": "SELECT * FROM data", "format": "pdf"})
        assert resp.status_code == 400


class TestResultToDataset:
    def test_result_to_dataset(self, client, sql_dir):
        resp = client.post("/api/v1/query/result-to-dataset", data={
            "query": "SELECT species, COUNT(*) AS n FROM data GROUP BY species",
            "dataset": "iris.csv", "output_name": "agg_result.csv"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["dataset"] == "agg_result.csv"
        assert data["rows"] == 2
        assert (sql_dir / "agg_result.csv").exists()


class TestCancel:
    def test_cancel_unknown_client_404(self, client):
        resp = client.post("/api/v1/query/cancel/client/does-not-exist")
        assert resp.status_code == 404

    def test_client_cancel_roundtrip(self, client, sql_dir):
        cid = "test-client-123"
        resp = client.post("/api/v1/query", data={
            "query": "SELECT * FROM data", "dataset": "iris.csv", "client_id": cid})
        cancel = client.post(f"/api/v1/query/cancel/client/{cid}")
        assert cancel.status_code in (200, 404)


class TestAiSql:
    def test_ai_sql_grouped_avg(self, client, sql_dir):
        resp = client.post("/api/v1/ai/sql", data={
            "question": "average sepal length by species", "dataset": "iris.csv"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["sql"]
        assert "AVG" in data["sql"]
        assert "GROUP BY" in data["sql"]
        assert "data" in data["sql"]
        assert data.get("generated_by")

    def test_ai_sql_no_dataset(self, client):
        resp = client.post("/api/v1/ai/sql", data={"question": "count all rows"})
        assert resp.status_code == 200
        assert "SELECT" in resp.json()["sql"]
