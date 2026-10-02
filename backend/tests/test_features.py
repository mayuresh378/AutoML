"""Feature engineering: NaN-safe transforms, validation, and honest reporting.

Regression tests for two production bugs:

1. ``polynomial`` was suggestion #1 from ``/features/suggest`` but crashed with
   ``400 "Input X contains NaN"`` on any realistic dataset that had a missing
   value, because the raw column was handed straight to sklearn's
   ``PolynomialFeatures``. Numeric transforms now median-impute the columns
   they touch before transforming.
2. An unrecognised operation type fell through every branch and answered
   ``200 {"new_columns": 0, "generated_features": []}``, i.e. success with no
   work done. Unknown types, empty lists and malformed JSON are now rejected.
"""
import io
import os
import pandas as pd
import pytest
from fastapi.testclient import TestClient


def _upload(client, name, df):
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    resp = client.post("/api/v1/datasets", files={"file": (name, buf.getvalue().encode(), "text/csv")})
    assert resp.status_code == 200, resp.text
    return resp


def _messy():
    """Numeric frame with a genuine gap in ``age`` plus a text column."""
    return pd.DataFrame({
        "age": [20.0, 35.0, None, 50.0, 28.0, 41.0, 33.0, 60.0],
        "tenure": [1, 5, 3, 12, 2, 8, 4, 20],
        "balance": [100.0, 250.0, 400.0, 150.0, 900.0, 320.0, 480.0, 60.0],
        "region": ["N", "S", "E", "W", "N", "S", "E", "W"],
    })


def _gen(client, name, ops):
    return client.post(
        f"/api/v1/datasets/{name}/features/generate",
        data={"operations": ops},
    )


class TestNaNSafeTransforms:
    def test_polynomial_survives_missing_values(self, client: TestClient):
        """The bug: suggestion #1 failed on any dataset with a NaN."""
        _upload(client, "messy.csv", _messy())
        r = _gen(client, "messy.csv", '[{"type":"polynomial","columns":["age","tenure"],"degree":2}]')
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["new_columns"] > 0
        assert body["generated_features"]
        # The imputation is disclosed rather than silent.
        assert any("imput" in w for w in body["warnings"])

    def test_every_supported_op_handles_nan(self, client: TestClient):
        _upload(client, "allops.csv", _messy())
        for op in (
            '[{"type":"interaction","columns":["age","tenure"]}]',
            '[{"type":"bin","columns":["age"],"n_bins":5}]',
            '[{"type":"polynomial","columns":["age","balance"],"degree":2}]',
        ):
            r = _gen(client, "allops.csv", op)
            assert r.status_code == 200, f"{op} -> {r.text}"
            assert r.json()["new_columns"] > 0, op

    def test_imputation_does_not_leak_into_output(self, client: TestClient):
        """Only the transformed columns are filled; others keep their gaps."""
        _upload(client, "leak.csv", _messy())
        r = _gen(client, "leak.csv", '[{"type":"polynomial","columns":["tenure"],"degree":2}]')
        assert r.status_code == 200, r.text
        out = r.json()["enhanced_file"]
        saved = pd.read_csv(os.path.join(os.path.dirname(__file__), "..", "..", "dataset", out))
        # tenure had no NaN, so age must still be missing in the saved file.
        assert saved["age"].isna().sum() == 1


class TestOperationValidation:
    def test_unknown_type_is_rejected(self, client: TestClient):
        """The bug: unknown type returned 200 with zero generated features."""
        _upload(client, "val.csv", _messy())
        r = _gen(client, "val.csv", '[{"type":"create_feature","columns":["age"]}]')
        assert r.status_code == 400, r.text
        assert "Unsupported feature operation" in r.text

    def test_empty_operations_rejected(self, client: TestClient):
        _upload(client, "val2.csv", _messy())
        r = _gen(client, "val2.csv", "[]")
        assert r.status_code == 400

    def test_malformed_json_is_rejected(self, client: TestClient):
        _upload(client, "val3.csv", _messy())
        r = _gen(client, "val3.csv", "not json")
        assert r.status_code == 400
        assert "valid JSON" in r.text

    def test_unknown_column_reports_instead_of_silent_noop(self, client: TestClient):
        _upload(client, "val4.csv", _messy())
        r = _gen(client, "val4.csv", '[{"type":"bin","columns":["does_not_exist"]}]')
        assert r.status_code == 400
        assert "does_not_exist" in r.text

    def test_text_column_is_not_treated_as_numeric(self, client: TestClient):
        _upload(client, "val5.csv", _messy())
        r = _gen(client, "val5.csv", '[{"type":"bin","columns":["region"]}]')
        assert r.status_code == 400


class TestSuggestContract:
    def test_suggestions_are_generatable(self, client: TestClient):
        """Every offered suggestion must actually succeed when applied."""
        _upload(client, "sug.csv", _messy())
        s = client.get("/api/v1/datasets/sug.csv/features/suggest")
        assert s.status_code == 200, s.text
        suggestions = s.json()["suggestions"]
        assert suggestions, "expected at least one suggestion"

        import json as _json
        for sug in suggestions:
            op = {"type": sug["type"], "columns": sug["columns"]}
            if sug.get("degree"):
                op["degree"] = sug["degree"]
            if sug.get("n_bins"):
                op["n_bins"] = sug["n_bins"]
            r = _gen(client, "sug.csv", _json.dumps([op]))
            assert r.status_code == 200, f"suggestion {sug['type']} failed: {r.text}"
            assert r.json()["new_columns"] > 0, f"suggestion {sug['type']} produced nothing"

    def test_missing_column_is_offered_with_imputation_note(self, client: TestClient):
        _upload(client, "sug2.csv", _messy())
        s = client.get("/api/v1/datasets/sug2.csv/features/suggest")
        assert s.status_code == 200
        text = str(s.json())
        assert "median-imputed" in text