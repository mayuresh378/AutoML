"""Data cleaning pipeline tests: detection, per-stage apply, versioning, history, export, ownership."""
import io
import os
import json
import pandas as pd
import pytest
from fastapi.testclient import TestClient


def _upload(client, name, df):
    buf = io.StringIO()
    if isinstance(df, str):
        buf.write(df)
    else:
        df.to_csv(buf, index=False)
    resp = client.post("/api/v1/datasets", files={"file": (name, buf.getvalue().encode(), "text/csv")})
    assert resp.status_code == 200, resp.text
    return resp


def _make_people():
    return pd.DataFrame({
        "id": [1, 2, 2, 3, 4, 5],
        "score": [90, 70, 70, 55, None, 2],
        "gender": ["M", "F", "F", "Male", "m", "F"],
        "joined": pd.to_datetime(["2021-01-01", "2021-02-01", "2021-02-01", "2020-06-15", "2019-12-31", "2022-01-01"]),
        "salary": [60000, 40000, 40000, 30000, 22000, 999999],
    })


class TestDetection:
    def test_pipeline_state_detects_issues(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        resp = client.get("/api/v1/datasets/people.csv/cleaning")
        assert resp.status_code == 200
        d = resp.json()
        det = d["detections"]
        assert det["missing"]["total"] == 1
        assert det["duplicates"]["count"] == 2
        outlier_cols = [c["name"] for c in det["outliers"]["columns"] if c["outliers_iqr"] > 0]
        assert "salary" in outlier_cols
        enc = [c["name"] for c in det["encoding"]["columns"]]
        assert "gender" in enc
        assert d["has_issues"]["missing"] is True
        assert d["has_issues"]["duplicates"] is True
        assert d["active_version"] == "people.csv"

    def test_clean_dataset_has_no_issues(self, client: TestClient, dataset_dir):
        clean = pd.DataFrame({"a": [1.0, 2.0, 3.0], "b": ["x", "y", "z"]})
        _upload(client, "clean.csv", clean)
        d = client.get("/api/v1/datasets/clean.csv/cleaning").json()
        assert d["has_issues"] == {"missing": False, "duplicates": False, "outliers": False}
        assert d["available"] == {"encoding": True, "scaling": True}
        assert d["detections"]["missing"]["total"] == 0

    def test_invalid_stage_rejected(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        resp = client.post("/api/v1/datasets/people.csv/cleaning/apply", data={"stage": "bogus"})
        assert resp.status_code == 422


class TestApplyStages:
    def test_missing_creates_version_and_history(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        resp = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                           data={"stage": "missing", "method": "median", 'columns': '["score"]'})
        assert resp.status_code == 200, resp.text
        d = resp.json()
        assert d["step"]["status"] == "completed"
        assert d["summary"]["filled"] == 1
        nv = d["new_version"]
        assert nv is not None
        assert nv["name"] == "people_cleaned_v2.csv"

        # new file on disk, original untouched
        assert os.path.exists(os.path.join(str(dataset_dir), "people_cleaned_v2.csv"))
        orig = pd.read_csv(os.path.join(str(dataset_dir), "people.csv"))
        assert orig["score"].isna().sum() == 1
        new = pd.read_csv(os.path.join(str(dataset_dir), "people_cleaned_v2.csv"))
        assert new["score"].isna().sum() == 0

        # state on new version inherits step chain
        st = client.get("/api/v1/datasets/people_cleaned_v2.csv/cleaning").json()
        assert st["steps"]["missing"]["status"] == "completed"
        versions = [v["filename"] for v in st["versions"]]
        assert "people.csv" in versions and "people_cleaned_v2.csv" in versions
        active = [v for v in st["versions"] if v["active"]]
        assert active and active[0]["filename"] == "people_cleaned_v2.csv"

        # history recorded
        h = client.get("/api/v1/datasets/people.csv/cleaning/history").json()["history"]
        assert any(e["stage"] == "missing" and e["rows_affected"] == 1 for e in h)

    def test_duplicates_keeps_first(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "duplicates", "method": "first"}).json()
        assert d["summary"]["removed"] == 1
        nv = d["new_version"]["name"]
        assert pd.read_csv(os.path.join(str(dataset_dir), nv)).duplicated().sum() == 0

    def test_outliers_cap(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "outliers", "method": "iqr",
                              'columns': '["salary"]', 'params': '{"action":"cap"}'}).json()
        assert d["summary"]["cells_replaced"] == 1
        nv = d["new_version"]["name"]
        capped = pd.read_csv(os.path.join(str(dataset_dir), nv))
        assert capped["salary"].max() < 999999

    def test_encoding_one_hot_and_target_preserved(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        # target 'score' should be preserved (not encoded) by default
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "encoding", "method": "one_hot",
                              'columns': '["gender"]', 'params': '{"target":"score"}'}).json()
        assert d["summary"]["added"] == ["gender_F", "gender_M", "gender_Male", "gender_m"]
        nv = d["new_version"]["name"]
        cols = list(pd.read_csv(os.path.join(str(dataset_dir), nv)).columns)
        assert "score" in cols
        assert "gender_F" in cols

    def test_encoding_requires_columns(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        resp = client.post("/api/v1/datasets/people.csv/cleaning/apply", data={"stage": "encoding"})
        assert resp.status_code == 422

    def test_encoding_target_opt_in(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "encoding", "method": "one_hot",
                              'columns': '["gender"]', 'params': '{"target":"score","encode_target":"true"}'}).json()
        assert d["new_version"] is not None

    def test_scaling_standard(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "scaling", "method": "standard",
                              'columns': '["salary"]'}).json()
        assert d["summary"]["scaled"] == 1
        nv = d["new_version"]["name"]
        scaled = pd.read_csv(os.path.join(str(dataset_dir), nv))
        assert abs(float(scaled["salary"].mean())) < 1e-6
        assert abs(float(scaled["salary"].std()) - 1.0) < 0.15

    def test_skip_and_no_issues(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "scaling", "action": "skip"}).json()
        assert d["step"]["status"] == "skipped"
        assert d["new_version"] is None

        # duplicates stage applied to an already-deduped dataset -> no_issues, no new version
        dn = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                         data={"stage": "duplicates", "method": "first"}).json()
        dedup = dn["new_version"]["name"]
        no = client.post(f"/api/v1/datasets/{dedup}/cleaning/apply",
                         data={"stage": "duplicates", "method": "first"}).json()
        assert no["step"]["status"] == "no_issues"
        assert no["new_version"] is None

    def test_error_records_failed_step(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        # one-hot encoding a column with too many unique values raises a ValueError -> failed step
        resp = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                           data={"stage": "encoding", "method": "one_hot",
                                 'columns': '["id"]', 'params': '{"max_categories":2}'})
        assert resp.status_code == 400
        st = client.get("/api/v1/datasets/people.csv/cleaning").json()
        assert st["steps"]["encoding"]["status"] == "failed"


class TestExport:
    def test_export_formats(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", _make_people())
        for fmt in ("csv", "xlsx", "parquet"):
            resp = client.post("/api/v1/datasets/people.csv/export", data={"format": fmt})
            assert resp.status_code == 200, resp.text
            d = resp.json()
            assert d["filename"] == f"people_cleaned_v1.{fmt}"
            assert os.path.exists(os.path.join(str(dataset_dir), d["filename"]))
            # exported file registers as a dataset record
            lst = client.get("/api/v1/datasets").json()["datasets"]
            assert d["filename"] in [x["name"] for x in lst]
        # invalid format rejected
        assert client.post("/api/v1/datasets/people.csv/export", data={"format": "json"}).status_code == 422


class TestOwnership:
    def test_other_user_denied(self, client: TestClient, impersonate, dataset_dir):
        impersonate("usr_a", "a@test.local", "User A")
        _upload(client, "people.csv", _make_people())

        impersonate("usr_b", "b@test.local", "User B")
        assert client.get("/api/v1/datasets/people.csv/cleaning").status_code == 403
        assert client.get("/api/v1/datasets/people.csv/cleaning/history").status_code == 403
        assert client.post("/api/v1/datasets/people.csv/cleaning/apply",
                           data={"stage": "missing", "method": "median"}).status_code == 403
        assert client.post("/api/v1/datasets/people.csv/export", data={"format": "csv"}).status_code == 403

        impersonate("usr_a", "a@test.local", "User A")
        assert client.post("/api/v1/datasets/people.csv/cleaning/apply",
                           data={"stage": "missing", "method": "median"}).status_code == 200


class TestScale:
    def test_large_dataset_detection(self, client: TestClient, dataset_dir):
        n = 5000
        df = pd.DataFrame({
            "x": [float(i) for i in range(n)],
            "y": [float(i % 7) for i in range(n)],
            "cat": ["c%d" % (i % 5) for i in range(n)],
        })
        df.loc[100, "x"] = None
        _upload(client, "big.csv", df)
        resp = client.get("/api/v1/datasets/big.csv/cleaning")
        assert resp.status_code == 200
        d = resp.json()["detections"]
        assert d["missing"]["total"] == 1
        assert len(d["encoding"]["columns"]) == 1
        # apply one stage on the large dataset
        r = client.post("/api/v1/datasets/big.csv/cleaning/apply",
                        data={"stage": "missing", "method": "zero", 'columns': '["x"]'})
        assert r.status_code == 200
        assert r.json()["new_version"] is not None


class TestBoolDummies:
    """One-hot encoding with missing categories yields pandas-3 `bool` dummy columns.
    These must not crash detection/outliers/scaling nor sklearn's SimpleImputer."""

    def _people_with_nan_gender(self):
        df = _make_people()
        # pandas 3 get_dummies turns NaN category rows into `False`/`True` bool dtypes
        df.loc[5, "gender"] = None
        return df

    def test_detect_after_one_hot_with_nan(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", self._people_with_nan_gender())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "encoding", "method": "one_hot",
                              'columns': '["gender"]', 'params': '{"target":"score"}'}).json()
        nv = d["new_version"]["name"]
        new = pd.read_csv(os.path.join(str(dataset_dir), nv))
        bool_cols = [c for c in new.columns if pd.api.types.is_bool_dtype(new[c])]
        assert bool_cols, "expected bool dummy column from NaN category"
        resp = client.get(f"/api/v1/datasets/{nv}/cleaning")
        assert resp.status_code == 200, resp.text  # regression: crashed on bool subtract

    def test_scale_after_one_hot_skips_bool(self, client: TestClient, dataset_dir):
        _upload(client, "people.csv", self._people_with_nan_gender())
        d = client.post("/api/v1/datasets/people.csv/cleaning/apply",
                        data={"stage": "encoding", "method": "one_hot",
                              'columns': '["gender"]', 'params': '{"target":"score"}'}).json()
        nv = d["new_version"]["name"]
        r = client.post(f"/api/v1/datasets/{nv}/cleaning/apply",
                        data={"stage": "scaling", "method": "standard",
                              'columns': '["salary"]'})
        assert r.status_code == 200, r.text  # bool dummies must not be scaled
        assert r.json()["summary"]["scaled"] == 1

    def test_auto_preprocess_accepts_bool_dummies(self, dataset_dir, monkeypatch):
        import preprocess
        df = self._people_with_nan_gender().drop(columns=["salary"])
        encoded = pd.get_dummies(df[["id", "score", "gender"]], columns=["gender"], dummy_na=True)
        encoded["id"] = encoded["id"].astype("float64")
        encoded.to_csv(os.path.join(str(dataset_dir), "raw_ohe.csv"), index=False)
        monkeypatch.setattr("preprocess.DATASET_DIR", str(dataset_dir))
        res = preprocess.auto_preprocess("raw_ohe.csv", target_column="score", task_type="regression")
        assert len(res["X"]) == len(df)
        bool_remnants = [c for c in res["X"].columns if pd.api.types.is_bool_dtype(res["X"][c])]
        assert bool_remnants == []  # regression: SimpleImputer rejected bool arrays