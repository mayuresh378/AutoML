"""Validation coverage for target analysis and HPO guard rails.

Previously this was a standalone script that called `sys.exit()` at import time,
which aborted pytest collection for the whole directory. It is now a normal
pytest module, and each case writes into `tmp_path` via the `hpo_ds`
fixture instead of the real `dataset/` folder.
"""
import os
import sys

import numpy as np
import pandas as pd
import pytest

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE not in sys.path:
    sys.path.insert(0, BASE)

from preprocess import auto_preprocess, analyze_target  # noqa: E402
from hpo import HPORunner, friendly_hpo_error  # noqa: E402


@pytest.fixture
def hpo_ds(tmp_path, monkeypatch):
    """Redirect the dataset directory used by preprocess/hpo to a temp folder."""
    monkeypatch.setattr("preprocess.DATASET_DIR", str(tmp_path))

    def _write(df):
        path = tmp_path / "hpo_case.csv"
        df.to_csv(path, index=False)
        return path.name

    return _write


def test_balanced_classification(hpo_ds):
    rng = np.random.RandomState(0)
    df = pd.DataFrame({
        "f1": rng.randn(180),
        "f2": rng.randn(180),
        "target": ["A"] * 60 + ["B"] * 60 + ["C"] * 60,
    })
    a = analyze_target(hpo_ds(df), "target", cv_folds=5)
    assert a["task_type"] == "classification"
    assert a["n_classes"] == 3
    assert a["min_class_count"] == 60
    assert a["safe_cv_folds"] == 5
    assert a["cv_adjusted"] is False
    assert a["blocked"] is False
    assert a["warning"] is None


def test_regression(hpo_ds):
    rng = np.random.RandomState(1)
    df = pd.DataFrame({"cgpa": rng.uniform(6, 9.5, 220), "package": rng.uniform(3, 18, 220)})
    a = analyze_target(hpo_ds(df), "package", cv_folds=7)
    assert a["task_type"] == "regression"
    assert a["safe_cv_folds"] == 7
    assert a["blocked"] is False


def test_imbalanced_min1_blocked(hpo_ds):
    df = pd.DataFrame({
        "f1": np.random.RandomState(2).randn(51),
        "label": ["A"] * 30 + ["B"] * 20 + ["C"] * 1,
    })
    a = analyze_target(hpo_ds(df), "label", cv_folds=5)
    assert a["blocked"] is True
    assert a["min_class_count"] == 1
    assert "1 sample" in (a["block_reason"] or "")
    assert a["cv_valid"] is False


def test_imbalanced_min3_clamps_cv(hpo_ds):
    df = pd.DataFrame({
        "f1": np.random.RandomState(3).randn(53),
        "label": ["A"] * 10 + ["B"] * 40 + ["C"] * 3,
    })
    name = hpo_ds(df)
    a = analyze_target(name, "label", cv_folds=5)
    assert a["blocked"] is False
    assert a["min_class_count"] == 3
    assert a["safe_cv_folds"] == 3
    assert a["cv_adjusted"] is True
    assert a["cv_valid"] is True

    # The runner must clamp CV too, or StratifiedKFold crashes at fit time.
    pp = auto_preprocess(name, "label", None)
    runner = HPORunner(pp["X"], pp["y"], "classification", ["KNN"], "random", 5, n_iter=3)
    assert runner.cv_folds == 3
    res = runner.run()
    ok = [r for r in res["results"] if "error" not in r]
    assert len(ok) == 1, res["results"]


def test_high_cardinality_identifier(hpo_ds):
    products = [
        f"Product {i} - {chr(65 + (i % 26))}{chr(97 + (i % 26))} Series" for i in range(200)
    ]
    df = pd.DataFrame({"feature": np.random.RandomState(4).randn(200), "product_name": products})
    a = analyze_target(hpo_ds(df), "product_name", cv_folds=5)
    assert a["task_type"] == "classification"
    assert a["high_cardinality"] is True
    assert a["identifier_like"] is True
    assert a["warning"] is not None
    assert len(a["example_values"]) > 0
    assert a["blocked"] is True


def test_friendly_errors():
    assert "Each class must have at least 2 samples" in friendly_hpo_error(
        "The least populated class in y has only 1 member, which is too few. "
        "The minimum number of groups for any class cannot be less than 2."
    )
    assert "data type" in friendly_hpo_error("Unknown label type: 'continuous'")
    assert friendly_hpo_error("Some random sklearn error") == "Some random sklearn error"


def test_hpo_constructor_block(hpo_ds):
    df = pd.DataFrame({"f1": np.random.RandomState(5).randn(30), "label": ["a"] * 29 + ["b"] * 1})
    pp = auto_preprocess(hpo_ds(df), "label", None)
    with pytest.raises(ValueError) as exc:
        HPORunner(pp["X"], pp["y"], "classification", ["RandomForest"], "random", 5, n_iter=2)
    assert "at least 2 samples" in str(exc.value)