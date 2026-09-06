import pandas as pd
import numpy as np
import os
import re
import math
import warnings

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")


def _dir() -> str:
    return os.environ.get("AUTOML_DATASET_DIR") or DATASET_DIR


def _base_key(name: str) -> str:
    stem = re.sub(r"\.\w+$", "", name)
    stem = re.sub(r"_v\d+$", "", stem)
    stem = re.sub(r"^(cleaned_|featurized_)", "", stem, flags=re.I)
    stem = re.sub(r"_(cleaned|featurized)$", "", stem, flags=re.I)
    return stem


def next_version_name(current_name: str, existing_files: list = None) -> str:
    """Build the next version filename for a dataset, e.g. placement_cleaned_v2.csv."""
    ext = os.path.splitext(current_name)[1]
    base = _base_key(current_name)
    existing_files = existing_files or []
    used = {_base_key(f) for f in existing_files}
    if base in used and current_name not in existing_files:
        pass
    n = 1
    while True:
        candidate = f"{base}_cleaned_v{n}{ext}"
        if candidate not in existing_files:
            return candidate, n
        n += 1


def _read_any(file_name: str) -> pd.DataFrame:
    file_path = os.path.join(_dir(), file_name)
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Dataset '{file_name}' not found.")
    if file_name.endswith(".csv"):
        return pd.read_csv(file_path, skipinitialspace=True)
    if file_name.endswith((".xlsx", ".xls")):
        return pd.read_excel(file_path)
    if file_name.endswith(".parquet"):
        return pd.read_parquet(file_path)
    return pd.read_json(file_path)


def load_dataset(file_name: str) -> pd.DataFrame:
    return _read_any(file_name)


def get_dataset_path(file_name: str) -> str:
    return os.path.join(_dir(), file_name)


def _is_numeric(s: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(s) and not pd.api.types.is_bool_dtype(s)


def _is_numeric_like(s: pd.Series) -> bool:
    if _is_numeric(s):
        return True
    try:
        conv = pd.to_numeric(s, errors="coerce")
        return conv.notna().mean() >= 0.8
    except Exception:
        return False


def _is_categorical(s: pd.Series) -> bool:
    return str(s.dtype) in ("object", "category", "bool", "str", "string") or (
        str(s.dtype) == "object"
    )


def _is_datetime_like(s: pd.Series) -> bool:
    if str(s.dtype).startswith("datetime") or str(s.dtype) in ("datetime64", "datetime64[ns]"):
        return True
    if not _is_categorical(s):
        return False
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            return pd.to_datetime(s, errors="coerce").notna().mean() >= 0.5
    except Exception:
        return False


def _column_kind(s: pd.Series) -> str:
    if _is_numeric(s):
        return "numeric"
    if _is_numeric_like(s):
        return "numeric"
    if _is_datetime_like(s):
        return "datetime"
    return "categorical"


def _num(value, nd=4):
    try:
        v = float(value)
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, nd)
    except Exception:
        return None


# ─── Profiling (backward compatible) ─────────────────────────────────

def profile_dataset(file_name: str) -> dict:
    df = load_dataset(file_name)
    profile = {
        "name": file_name,
        "rows": len(df),
        "columns": len(df.columns),
        "column_details": [],
        "missing_values": 0,
        "missing_pct": 0.0,
        "duplicates": int(df.duplicated().sum()),
        "dtypes": {},
    }

    for col in df.columns:
        col_info = {"name": col, "dtype": str(df[col].dtype), "kind": _column_kind(df[col])}
        missing = int(df[col].isnull().sum())
        col_info["missing"] = missing
        profile["missing_values"] += missing

        if df[col].dtype in ["int64", "float64"]:
            col_info["mean"] = round(float(df[col].mean()), 2) if df[col].notna().any() else None
            col_info["median"] = round(float(df[col].median()), 2) if df[col].notna().any() else None
            col_info["min"] = round(float(df[col].min()), 2) if df[col].notna().any() else None
            col_info["max"] = round(float(df[col].max()), 2) if df[col].notna().any() else None
            col_info["std"] = round(float(df[col].std()), 2) if df[col].notna().any() else None
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            col_info["outliers"] = int(((df[col] < lower) | (df[col] > upper)).sum())
        else:
            col_info["unique_values"] = int(df[col].nunique())
            if df[col].nunique() < 20:
                col_info["top_values"] = df[col].value_counts().head(5).to_dict()

        profile["column_details"].append(col_info)
        profile["dtypes"][col] = str(df[col].dtype)

    profile["missing_pct"] = round(profile["missing_values"] / (profile["rows"] * profile["columns"]) * 100, 2) if profile["columns"] > 0 else 0
    return profile


# ─── Pipeline detection ──────────────────────────────────────────────

def detect_pipeline(file_name: str) -> dict:
    df = load_dataset(file_name)
    nrows = len(df)
    ncols = len(df.columns)

    # Missing values
    missing_cols = []
    for col in df.columns:
        miss = int(df[col].isna().sum())
        if miss > 0:
            missing_cols.append({
                "name": col,
                "dtype": str(df[col].dtype),
                "kind": _column_kind(df[col]),
                "missing": miss,
                "missing_pct": round(miss / nrows * 100, 2) if nrows else 0,
            })
    total_missing = int(df.isna().sum().sum())
    missing = {
        "total": total_missing,
        "total_pct": round(total_missing / (nrows * ncols) * 100, 2) if (nrows * ncols) else 0,
        "columns": missing_cols,
    }

    # Duplicates
    dup_mask = df.duplicated(keep=False)
    dup_count = int(dup_mask.sum())
    dup_sample = df[dup_mask].head(5).fillna("").to_dict(orient="records")
    duplicates = {
        "count": dup_count,
        "pct": round(dup_count / nrows * 100, 2) if nrows else 0,
        "sample": dup_sample,
        "sample_columns": list(df.columns),
    }

    # Outliers (IQR + Z-score for every numeric column)
    outlier_cols = []
    for col in df.columns:
        if not _is_numeric(df[col]):
            continue
        s = df[col].dropna()
        if len(s) == 0:
            continue
        q1 = float(s.quantile(0.25))
        q3 = float(s.quantile(0.75))
        med = float(s.median())
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        iqr_count = int(((s < lower) | (s > upper)).sum())
        std = float(s.std())
        z_count = 0
        if std and std > 0:
            z = ((s - float(s.mean())).abs() / std)
            z_count = int((z > 3).sum())
        outlier_cols.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "min": _num(s.min()), "max": _num(s.max()),
            "q1": _num(q1), "median": _num(med), "q3": _num(q3),
            "iqr": _num(iqr), "lower": _num(lower), "upper": _num(upper),
            "outliers_iqr": iqr_count, "outliers_zscore": z_count,
            "outlier_pct": round(iqr_count / nrows * 100, 2) if nrows else 0,
        })
    outliers = {"columns": outlier_cols}

    # Encoding candidates
    encode_cols = []
    for col in df.columns:
        s = df[col]
        if not _is_categorical(s):
            continue
        if _is_datetime_like(s):
            continue
        vals = s.dropna()
        nunique = int(s.nunique())
        if nunique <= 1 or nunique > 100:
            continue
        enc = {
            "name": col,
            "dtype": str(s.dtype),
            "unique": nunique,
            "top_values": vals.value_counts().head(5).to_dict() if nunique <= 10 else None,
            "recommended": "one_hot" if nunique <= 20 else "label",
        }
        encode_cols.append(enc)
    encoding = {"columns": encode_cols}

    # Scaling candidates
    scale_cols = []
    for col in df.columns:
        if not _is_numeric(df[col]):
            continue
        s = df[col].dropna()
        if len(s) == 0:
            continue
        mn, mx = float(s.min()), float(s.max())
        scale_cols.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "min": _num(mn), "max": _num(mx),
            "mean": _num(s.mean()), "std": _num(s.std()),
            "median": _num(s.median()), "iqr": _num(float(s.quantile(0.75)) - float(s.quantile(0.25))),
            "constant": bool(mx == mn),
        })
    scaling = {"columns": scale_cols}

    return {
        "dataset": {
            "name": file_name, "rows": nrows, "columns": list(df.columns),
            "base_key": _base_key(file_name),
        },
        "missing": missing,
        "duplicates": duplicates,
        "outliers": outliers,
        "encoding": encoding,
        "scaling": scaling,
    }


# ─── Stage application ───────────────────────────────────────────────

def _apply_missing(df: pd.DataFrame, method: str, columns: list, params: dict):
    applied = []
    before_total = int(df.isna().sum().sum())
    filled_total = 0
    target = columns if columns else [c for c in df.columns if df[c].isna().any()]
    numeric_like = [c for c in target if _is_numeric_like(df[c])]
    for col in target:
        if col not in df.columns:
            continue
        before = int(df[col].isna().sum())
        if before == 0:
            continue
        is_num = col in numeric_like
        if method in ("mean", "median", "zero"):
            if is_num:
                if not _is_numeric(df[col]):
                    df[col] = pd.to_numeric(df[col], errors="coerce")
                val = df[col].mean() if method == "mean" else (df[col].median() if method == "median" else 0)
                if pd.isna(val):
                    applied.append(f"Cannot impute {col} ({method}) - no valid values")
                    continue
                df[col] = df[col].fillna(val)
            else:
                mode = df[col].dropna().mode()
                df[col] = df[col].fillna(mode[0] if len(mode) else "unknown")
        elif method == "mode":
            mode = df[col].dropna().mode()
            df[col] = df[col].fillna(mode[0] if len(mode) else "unknown")
        elif method == "unknown":
            df[col] = df[col].fillna("unknown")
        elif method in ("custom", "constant"):
            df[col] = df[col].fillna((params or {}).get("value"))
        elif method == "ffill":
            df[col] = df[col].ffill()
        elif method == "bfill":
            df[col] = df[col].bfill()
        else:
            continue
        after = int(df[col].isna().sum())
        filled = before - after
        filled_total += filled
        if filled:
            applied.append(f"Imputed {filled} missing values in {col} ({method})")
    after_total = int(df.isna().sum().sum())
    return df, {"before": before_total, "after": after_total, "filled": filled_total}, applied


def _apply_duplicates(df: pd.DataFrame, method: str, columns: list, params: dict):
    keep = "last" if method in ("last", "keep_last") else "first"
    before_rows = len(df)
    dup_mask = df.duplicated(keep=keep)
    dup_count = int(dup_mask.sum())
    if dup_count > 0:
        df = df[~dup_mask].reset_index(drop=True)
    removed = before_rows - len(df)
    applied = [f"Removed {removed} duplicate rows (keep {keep})"] if removed else ["No duplicate rows found"]
    return df, {"before": dup_count, "after": 0, "removed": removed}, applied


def _outliers_for(s: pd.Series, method: str, threshold: float):
    s = s.dropna()
    if method == "zscore":
        mean = float(s.mean())
        std = float(s.std())
        mask = pd.Series(False, index=s.index)
        if std and std > 0:
            mask = ((s - mean).abs() / std) > threshold
        return mask, {"min": _num(s.min()), "max": _num(s.max()),
                      "q1": None, "median": _num(s.median()), "q3": None, "std": _num(std), "mean": _num(mean)}
    q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    mask = (s < lower) | (s > upper)
    return mask, {"min": _num(s.min()), "max": _num(s.max()),
                  "q1": _num(q1), "median": _num(s.median()), "q3": _num(q3),
                  "lower": _num(lower), "upper": _num(upper), "iqr": _num(iqr)}


def _apply_outliers(df: pd.DataFrame, method: str, action: str, columns: list, params: dict):
    method = method or "iqr"
    action = action or "keep"
    threshold = float((params or {}).get("threshold", 3.0))
    numeric_cols = [c for c in df.columns if _is_numeric(df[c])]
    target = columns if columns else numeric_cols
    before_counts = {}
    stats = {}
    for col in target:
        if col not in df.columns or col not in numeric_cols:
            continue
        mask, st = _outliers_for(df[col], method, threshold)
        before_counts[col] = int(mask.sum())
        stats[col] = st
    applied = []
    cells_replaced = 0
    rows_removed = 0
    if action == "remove":
        before_rows = len(df)
        drop_mask = pd.Series(False, index=df.index)
        for col, cnt in before_counts.items():
            if cnt:
                m, _ = _outliers_for(df[col], method, threshold)
                drop_mask |= m
        rows_removed = int(drop_mask.sum())
        if rows_removed:
            df = df[~drop_mask].reset_index(drop=True)
        applied = [f"Removed {rows_removed} rows containing outliers ({method}, z={threshold:g})" if rows_removed
                   else "No outlier rows to remove"]
    else:
        for col in target:
            if col not in df.columns or col not in numeric_cols:
                continue
            cnt = before_counts.get(col, 0)
            if not cnt:
                continue
            mask, st = _outliers_for(df[col], method, threshold)
            if action == "cap":
                lo = st.get("lower")
                hi = st.get("upper")
                if method == "zscore":
                    mean, std = st.get("mean"), st.get("std")
                    lo, hi = (mean - threshold * std), (mean + threshold * std)
                if lo is not None and hi is not None:
                    before_vals = df[col].copy()
                    df[col] = df[col].clip(lower=lo, upper=hi)
                    cells_replaced += int((df[col] != before_vals).sum())
                applied.append(f"Capped {cnt} outliers in {col} ({method})")
            elif action == "median":
                med = df[col].median()
                n_replaced = int(mask.sum())
                df.loc[mask, col] = med
                cells_replaced += n_replaced
                applied.append(f"Replaced {n_replaced} outliers in {col} with median")
            elif action == "keep":
                applied.append(f"Detected {cnt} outliers in {col} ({method}) - kept unchanged")
    after_counts = {}
    for col in target:
        if col not in df.columns:
            continue
        m, _ = _outliers_for(df[col], method, threshold)
        after_counts[col] = int(m.sum())
    return df, {
        "method": method, "action": action,
        "before_counts": before_counts, "after_counts": after_counts,
        "rows_removed": rows_removed, "cells_replaced": cells_replaced,
    }, applied


def _apply_encoding(df: pd.DataFrame, method: str, columns: list, params: dict):
    params = params or {}
    applied = []
    columns_before = list(df.columns)
    new_columns = []
    for col in columns:
        if col not in df.columns:
            continue
        m = method if method != "per_column" else (params.get("methods") or {}).get(col, "one_hot")
        if m == "one_hot":
            nunique = int(df[col].nunique(dropna=False))
            max_cat = int(params.get("max_categories", 200))
            if nunique > max_cat:
                raise ValueError(f"Cannot one-hot encode {col}: {nunique} unique values (limit {max_cat}). Use label encoding instead.")
            dummies = pd.get_dummies(df[col], prefix=col, dummy_na=bool(df[col].isna().any()))
            dummies.columns = [re.sub(r"[^0-9a-zA-Z_]+", "_", str(c)) for c in dummies.columns]
            df = pd.concat([df.drop(columns=[col]), dummies], axis=1)
            new_columns.extend(list(dummies.columns))
            applied.append(f"One-hot encoded {col} -> {', '.join(list(dummies.columns))}")
        elif m == "label":
            df[col] = df[col].astype("category").cat.codes
            applied.append(f"Label encoded {col}")
        elif m == "ordinal":
            order = (params.get("order") or {}).get(col)
            if not order:
                uniques = sorted([str(v) for v in df[col].dropna().unique()])
                order = uniques
            mapping = {v: i for i, v in enumerate(order)}
            df[col] = df[col].map(mapping).astype("float64")
            applied.append(f"Ordinal encoded {col} -> {mapping}")
        else:
            continue
    changed_cols = [c for c in new_columns if c not in columns_before]
    unchanged = [c for c in columns if c in df.columns and c in columns_before]
    result = {
        "before_columns": columns_before,
        "after_columns": list(df.columns),
        "new_columns": changed_cols,
        "columns_unchanged": unchanged,
    }
    return df, result, applied


def _apply_scaling(df: pd.DataFrame, method: str, columns: list, params: dict):
    method = method or "standard"
    numeric_cols = [c for c in df.columns if _is_numeric(df[c])]
    target = columns if columns else numeric_cols
    applied = []
    per_col = {}
    for col in target:
        if col not in df.columns or col not in numeric_cols:
            continue
        s = df[col].dropna()
        if len(s) == 0:
            per_col[col] = {"skipped": "empty"}
            continue
        mn, mx = float(s.min()), float(s.max())
        if method == "standard":
            mean, std = float(s.mean()), float(s.std())
            if not std or math.isnan(std) or std == 0:
                per_col[col] = {"skipped": "constant"}
                applied.append(f"Skipped {col} (zero variance)")
                continue
            df[col] = (df[col] - mean) / std
            after = df[col].dropna()
            per_col[col] = {"min": _num(after.min()), "max": _num(after.max()),
                            "old_min": _num(mn), "old_max": _num(mx)}
            applied.append(f"StandardScaler applied to {col}")
        elif method == "minmax":
            rng = mx - mn
            if rng == 0 or not rng or math.isnan(rng):
                per_col[col] = {"skipped": "constant"}
                applied.append(f"Skipped {col} (zero variance)")
                continue
            df[col] = (df[col] - mn) / rng
            after = df[col].dropna()
            per_col[col] = {"min": _num(after.min()), "max": _num(after.max()),
                            "old_min": _num(mn), "old_max": _num(mx)}
            applied.append(f"MinMaxScaler applied to {col} ([{_num(mn)}-{_num(mx)}] -> [0-1])")
        elif method == "robust":
            q1, q3 = float(s.quantile(0.25)), float(s.quantile(0.75))
            iqr = q3 - q1
            med = float(s.median())
            if not iqr or math.isnan(iqr) or iqr == 0:
                per_col[col] = {"skipped": "constant"}
                applied.append(f"Skipped {col} (zero IQR)")
                continue
            df[col] = (df[col] - med) / iqr
            after = df[col].dropna()
            per_col[col] = {"min": _num(after.min()), "max": _num(after.max()),
                            "old_min": _num(mn), "old_max": _num(mx)}
            applied.append(f"RobustScaler applied to {col}")
    after_ranges = {c: (per_col[c].get("min"), per_col[c].get("max")) for c in per_col if per_col[c].get("min") is not None}
    return df, {"method": method, "per_column": per_col, "after_ranges": after_ranges}, applied


def apply_stage(file_name: str, stage: str, method: str = None,
                columns: list = None, params: dict = None) -> tuple:
    """Apply a single cleaning stage to a dataset. Returns (df, result_dict)."""
    df = load_dataset(file_name)
    df = df.copy()
    columns = columns or []
    params = params or {}
    rows_before = len(df)
    cols_before = len(df.columns)
    result = {"stage": stage, "method": method, "rows_before": rows_before, "columns_before": cols_before}

    if stage == "missing":
        df, stats, applied = _apply_missing(df, method or "median", columns, params)
        result["before_stats"] = {"total_missing": stats["before"]}
        result["after_stats"] = {"total_missing": stats["after"], "filled": stats["filled"]}
        result["summary"] = {"filled": stats["filled"]}
    elif stage == "duplicates":
        df, stats, applied = _apply_duplicates(df, method or "first", columns, params)
        result["before_stats"] = {"duplicate_rows": stats["before"]}
        result["after_stats"] = {"duplicate_rows": stats["after"], "removed": stats["removed"]}
        result["summary"] = {"removed": stats["removed"]}
    elif stage == "outliers":
        action = params.get("action") or "keep"
        df, stats, applied = _apply_outliers(df, method or "iqr", action, columns, params)
        result["before_stats"] = {"outliers": stats["before_counts"], "method": stats["method"]}
        result["after_stats"] = {"outliers": stats["after_counts"], "action": stats["action"],
                                 "rows_removed": stats["rows_removed"], "cells_replaced": stats["cells_replaced"]}
        result["summary"] = {"rows_removed": stats["rows_removed"], "cells_replaced": stats["cells_replaced"]}
    elif stage == "encoding":
        df, stats, applied = _apply_encoding(df, method or "one_hot", columns, params)
        result["before_stats"] = {"columns": stats["before_columns"]}
        result["after_stats"] = {"columns": stats["after_columns"], "new_columns": stats["new_columns"]}
        result["summary"] = {"new_columns": len(stats["new_columns"]), "added": stats["new_columns"]}
    elif stage == "scaling":
        df, stats, applied = _apply_scaling(df, method or "standard", columns, params)
        result["before_stats"] = {"ranges": {c: (v.get("old_min"), v.get("old_max")) for c, v in stats["per_column"].items() if "old_min" in v}}
        result["after_stats"] = {"ranges": {c: (v.get("min"), v.get("max")) for c, v in stats["per_column"].items() if "min" in v}}
        result["summary"] = {"scaled": sum(1 for v in stats["per_column"].values() if "min" in v)}
    else:
        raise ValueError(f"Unknown cleaning stage: {stage}")

    result["applied_operations"] = applied
    result["rows_after"] = len(df)
    result["columns_after"] = len(df.columns)
    return df, result


# ─── Legacy batch cleaning (kept for /clean and /auto-clean) ─────────

def clean_dataset(file_name: str, operations: list) -> dict:
    df = load_dataset(file_name)
    applied = []

    for op in operations:
        op_type = op.get("type")
        columns = op.get("columns", [])

        if op_type == "impute_missing":
            strategy = op.get("strategy", "median")
            cols = columns if columns else df.columns
            for col in cols:
                if col in df.columns and df[col].isnull().any():
                    if _is_numeric_like(df[col]):
                        if strategy == "median":
                            df[col] = df[col].fillna(df[col].median())
                        elif strategy == "mean":
                            df[col] = df[col].fillna(df[col].mean())
                        elif strategy == "zero":
                            df[col] = df[col].fillna(0)
                    else:
                        df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "unknown")
                    applied.append(f"Imputed missing values in {col} ({strategy})")

        elif op_type == "encode_categorical":
            for col in columns:
                if col in df.columns and df[col].dtype == "object":
                    df = pd.get_dummies(df, columns=[col], drop_first=True)
                    applied.append(f"One-hot encoded {col}")

        elif op_type == "feature_selection":
            threshold = op.get("threshold", 0.01)
            numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns
            for col in numeric_cols:
                variance = df[col].var()
                if variance < threshold:
                    df = df.drop(columns=[col])
                    applied.append(f"Dropped low-variance feature {col} (var={variance:.6f})")

    cleaned_name = next_version_name(file_name, os.listdir(_dir()) or [])[0]
    save_path = os.path.join(_dir(), cleaned_name)
    df.to_csv(save_path, index=False)

    return {
        "cleaned_file": cleaned_name,
        "rows_after": len(df),
        "columns_after": len(df.columns),
        "applied_operations": applied,
    }


def auto_clean(file_name: str) -> dict:
    df = load_dataset(file_name)
    applied = []
    step_stats = {}
    before_rows = len(df)
    before_cols = len(df.columns)

    per_step = {}

    missing_cols = []
    for col in df.columns:
        if df[col].isnull().any():
            missing_cols.append(col)
            before_miss = int(df[col].isnull().sum())
            if _is_numeric_like(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode()[0] if not df[col].mode().empty else "unknown")
            applied.append(f"Imputed {before_miss} missing values in {col}")
    step_stats["missing_values"] = len(missing_cols)
    per_step["missing"] = {"columns": missing_cols, "count": len(missing_cols)}

    dup_before = len(df)
    df = df.drop_duplicates()
    dup_removed = dup_before - len(df)
    if dup_removed > 0:
        applied.append(f"Removed {dup_removed} duplicate rows")
    step_stats["duplicates_removed"] = dup_removed
    per_step["duplicates"] = {"removed": dup_removed}

    cat_cols = df.select_dtypes(include=["object"]).columns.tolist()
    encoded_cols = []
    for col in cat_cols:
        if _is_datetime_like(df[col]):
            continue
        df = pd.get_dummies(df, columns=[col], drop_first=True)
        encoded_cols.append(col)
        applied.append(f"One-hot encoded {col}")
    step_stats["categorical_encoded"] = len(encoded_cols)
    per_step["encoding"] = {"columns": encoded_cols, "count": len(encoded_cols)}

    numeric_cols = df.select_dtypes(include=["int64", "float64"]).columns
    outlier_cols = []
    total_outliers_removed = 0
    for col in numeric_cols:
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outlier_mask = (df[col] < lower) | (df[col] > upper)
        outlier_count = int(outlier_mask.sum())
        if outlier_count > 0:
            outlier_cols.append(col)
            total_outliers_removed += outlier_count
            before = len(df)
            df = df[~outlier_mask]
            removed = before - len(df)
            if removed > 0:
                applied.append(f"Removed {removed} outliers from {col}")
    step_stats["outliers_removed"] = total_outliers_removed
    per_step["outliers"] = {"columns": outlier_cols, "total": total_outliers_removed}

    scaled_cols = []
    for col in df.select_dtypes(include=["int64", "float64"]).columns:
        mn, mx = df[col].min(), df[col].max()
        if mx - mn > 0:
            df[col] = (df[col] - mn) / (mx - mn)
            scaled_cols.append(col)
            applied.append(f"MinMax scaled {col} to [0,1]")
    step_stats["features_scaled"] = len(scaled_cols)
    per_step["scaling"] = {"columns": scaled_cols, "count": len(scaled_cols)}

    cleaned_name = next_version_name(file_name, os.listdir(_dir()) or [])[0]
    save_path = os.path.join(_dir(), cleaned_name)
    df.to_csv(save_path, index=False)

    return {
        "cleaned_file": cleaned_name,
        "rows_before": before_rows,
        "rows_after": len(df),
        "columns_before": before_cols,
        "columns_after": len(df.columns),
        "applied_operations": applied,
        "step_stats": {k: v for k, v in step_stats.items() if v > 0},
        "per_step": per_step,
        "summary": {
            "duplicates_removed": step_stats.get("duplicates_removed", 0),
            "missing_imputed": step_stats.get("missing_values", 0),
            "categorical_encoded": step_stats.get("categorical_encoded", 0),
            "outliers_removed": step_stats.get("outliers_removed", 0),
            "features_scaled": step_stats.get("features_scaled", 0),
        },
    }