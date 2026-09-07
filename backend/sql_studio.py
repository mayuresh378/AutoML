"""SQL Studio backend: safe, user-scoped SQL execution over uploaded datasets.

Replaces the original ad-hoc SQL endpoints in main.py with a hardened
implementation that provides:
  - Required authentication on every request endpoint
  - Per-user dataset authorization (owner / sample / shared / system-owned only)
  - Read-only sandbox (DuckDB in-memory) with a destructive-op confirmation flow
  - Real query cancellation and hard timeouts via DuckDB interrupt()
  - Server-side result pagination, schema catalog, CSV/JSON export
  - Server-persisted query history and saved queries
  - Heuristic NL -> SQL generation (clearly labeled as AI-generated)
"""

import os
import re
import time
import uuid
import json
import csv
import io
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from datetime import datetime
from threading import Lock
from typing import Optional

import duckdb
from fastapi import APIRouter, Depends, Form, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from auth import get_current_user
from crud import (add_query_history, log_audit, list_query_history,
                  delete_query_history, clear_query_history,
                  create_saved_query, list_saved_queries, update_saved_query,
                  delete_saved_query, create_dataset_record)
from database import get_db
from models import Dataset, DatasetShare
from security_utils import analyze_sql_safety

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "dataset"))

sql_router = APIRouter(prefix="/api/v1", tags=["SQL Studio"])
ai_router = APIRouter(prefix="/api/v1", tags=["SQL Studio AI"])

MAX_QUERY_LEN = 10_000
MAX_RESULT_ROWS = 100_000
QUERY_TIMEOUT_SECONDS = 30
CACHE_TTL_SECONDS = 600
EXPORT_MAX_ROWS = 500_000

_executor = ThreadPoolExecutor(max_workers=4)

_RUNNING: dict[str, dict] = {}          # query_id -> {conn, user_id, cancelled, started}
_RESULT_CACHE: dict[str, dict] = {}     # query_id -> cached result (user-scoped)
_CLIENT_RUNS: dict[str, str] = {}       # client-generated id -> current query_id (for cancel)
_CACHE_LOCK = Lock()


def _sanitize_table_name(filename: str) -> str:
    stem = filename.rsplit(".", 1)[0]
    tbl = re.sub(r"[^a-zA-Z0-9_]", "_", stem)
    if not tbl or not tbl[0].isalpha():
        tbl = "t_" + tbl
    return tbl


def _authorized_dataset_filenames(db: Session, user: dict) -> list:
    """Filenames visible to the current user.

    Mirrors the `/api/v1/datasets` visibility rules and additionally honors
    explicit DatasetShare entries (by user id or email).
    """
    uid = user.get("id") if user else None
    email = (user.get("email") or "").lower()
    records = {r.filename: r for r in db.query(Dataset).filter(Dataset.deleted_at.is_(None)).all()}
    shares: dict[str, list] = defaultdict(list)
    for s in db.query(DatasetShare).all():
        shares[s.dataset_id].append(s)
    allowed = []
    if os.path.isdir(DATASET_DIR):
        for f in sorted(os.listdir(DATASET_DIR)):
            if not any(f.endswith(e) for e in (".csv", ".parquet")):
                continue
            rec = records.get(f)
            visible = False
            if rec is None or rec.user_id is None:
                visible = True
            elif uid and rec.user_id == uid:
                visible = True
            elif rec.source == "sample":
                visible = True
            elif uid and any(
                (s.shared_with_user_id and s.shared_with_user_id == uid) or
                (s.shared_with_email and s.shared_with_email.lower() == email)
                for s in shares.get(rec.id, [])
            ):
                visible = True
            if visible:
                allowed.append(f)
    return allowed


def _find_dataset(db: Session, user: dict, dataset: str) -> Optional[str]:
    """Look up an actual authorized filename for `dataset` (filename or table view name)."""
    allowed = _authorized_dataset_filenames(db, user)
    by_table = {_sanitize_table_name(f): f for f in allowed}
    if dataset in allowed:
        return dataset
    if dataset in by_table:
        return by_table[dataset]
    return None


def _require_dataset(db: Session, user: dict, dataset: str) -> tuple[str, str]:
    filename = _find_dataset(db, user, dataset)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found or not accessible to you")
    fpath = os.path.normpath(os.path.join(DATASET_DIR, filename))
    if not fpath.startswith(os.path.normpath(DATASET_DIR)):
        raise HTTPException(status_code=400, detail="Invalid dataset path")
    return fpath, _sanitize_table_name(filename)


def _safety_check(query: str, confirm_destructive: bool) -> dict:
    analysis = analyze_sql_safety(query)
    if not analysis["ok"] and not (analysis["dangerous"] and confirm_destructive):
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_sql", "message": "; ".join(analysis["reasons"] or ["Disallowed SQL operation"]),
                    "operations": analysis["operations"]},
        )
    return analysis


def _sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _create_views(con: duckdb.DuckDBPyConnection, db: Session, user: dict, dataset: str = None):
    """Bind a `data` view (or per-file views) from authorized datasets only."""
    if dataset:
        fpath, tbl = _require_dataset(db, user, dataset)
        safe_path = fpath.replace(os.sep, "/")
        if fpath.endswith(".parquet"):
            con.execute(f'CREATE OR REPLACE VIEW "data" AS SELECT * FROM read_parquet({_sql_literal(safe_path)})')
        else:
            con.execute(f'CREATE OR REPLACE VIEW "data" AS SELECT * FROM read_csv_auto({_sql_literal(safe_path)}, strict_mode=false, ignore_errors=true)')
        return tbl
    for f in _authorized_dataset_filenames(db, user):
        fpath = os.path.join(DATASET_DIR, f)
        tbl = _sanitize_table_name(f)
        safe_path = fpath.replace(os.sep, "/")
        if fpath.endswith(".parquet"):
            con.execute(f'CREATE OR REPLACE VIEW "{tbl}" AS SELECT * FROM read_parquet({_sql_literal(safe_path)})')
        else:
            con.execute(f'CREATE OR REPLACE VIEW "{tbl}" AS SELECT * FROM read_csv_auto({_sql_literal(safe_path)}, strict_mode=false, ignore_errors=true)')


def _fetch_result(result) -> tuple[list, list, int, bool]:
    """Consume a DuckDB result in bounded chunks.

    Returns (columns, capped_rows, total_rows, truncated). Python-side memory is
    bounded by MAX_RESULT_ROWS while still providing an exact row count.
    """
    columns = [desc[0] for desc in result.description] if result.description else []
    rows = []
    total = 0
    while True:
        batch = result.fetchmany(5000)
        if not batch:
            break
        total += len(batch)
        if len(rows) < MAX_RESULT_ROWS:
            need = MAX_RESULT_ROWS - len(rows)
            for row in batch[:need]:
                rows.append(dict(zip(columns, row)))
    return columns, rows, total, total > MAX_RESULT_ROWS


def _register(query_id: str, con, user_id: str):
    with _CACHE_LOCK:
        _RUNNING[query_id] = {"conn": con, "user_id": user_id, "cancelled": False, "started": time.time()}


def _unregister(query_id: str):
    with _CACHE_LOCK:
        _RUNNING.pop(query_id, None)


def _iscancelled(query_id: str) -> bool:
    with _CACHE_LOCK:
        entry = _RUNNING.get(query_id)
        return bool(entry and entry["cancelled"])


def _run_sandbox(query: str, dataset: str, db: Session, user: dict, query_id: str,
                 out: dict) -> None:
    """Executed on a worker thread. Stores the outcome into `out`."""
    con = None
    started = time.monotonic()
    try:
        con = duckdb.connect()
        _register(query_id, con, user.get("id"))
        _create_views(con, db, user, dataset)
        result = con.execute(query)
        columns, rows, total, truncated = _fetch_result(result)
        out.update({
            "status": "success",
            "columns": columns,
            "rows_data": rows,
            "total_rows": total,
            "truncated": truncated,
            "execution_time_ms": round((time.monotonic() - started) * 1000, 1),
            "query_id": query_id,
        })
    except HTTPException as he:
        out.update({"status": "error", "error": str(he.detail),
                    "status_code": he.status_code,
                    "execution_time_ms": round((time.monotonic() - started) * 1000, 1)})
    except Exception as e:
        if _iscancelled(query_id):
            out.update({"status": "cancelled",
                        "execution_time_ms": round((time.monotonic() - started) * 1000, 1)})
        else:
            out.update({"status": "error", "error": str(e)})
    finally:
        if con is not None:
            try:
                con.close()
            except Exception:
                pass
        _unregister(query_id)


def _run_with_guard(query: str, dataset: str, db: Session, user: dict,
                    timeout: int = QUERY_TIMEOUT_SECONDS, client_id: str = None) -> dict:
    query_id = f"q_{uuid.uuid4().hex}"
    if client_id:
        with _CACHE_LOCK:
            _CLIENT_RUNS[client_id] = query_id
    out: dict = {}
    try:
        future = _executor.submit(_run_sandbox, query, dataset, db, user, query_id, out)
        try:
            future.result(timeout=timeout)
        except FutureTimeoutError:
            conn = None
            with _CACHE_LOCK:
                entry = _RUNNING.get(query_id)
                if entry:
                    entry["cancelled"] = True
                    conn = entry["conn"]
            if conn is not None:
                try:
                    conn.interrupt()
                except Exception:
                    pass
            try:
                future.result(timeout=5)
            except Exception:
                pass
            if out.get("status") not in ("success", "cancelled"):
                out.update({"status": "timeout", "error": f"Query timed out after {timeout}s"})
        except TimeoutError:
            out.update({"status": "timeout", "error": f"Query timed out after {timeout}s"})
        except Exception as e:
            out.update({"status": "error", "error": str(e)})
    finally:
        if client_id:
            with _CACHE_LOCK:
                _CLIENT_RUNS.pop(client_id, None)
    return out


def _record_history(db: Session, user: dict, query: str, dataset: str, result: dict) -> None:
    if result.get("status") == "success":
        add_query_history(db, user.get("id"), query, dataset,
                          execution_time_ms=result.get("execution_time_ms"),
                          rows_returned=result.get("total_rows"),
                          status="success")
    else:
        add_query_history(db, user.get("id"), query, dataset,
                          execution_time_ms=result.get("execution_time_ms"),
                          status=result.get("status") or "failed",
                          error=(result.get("error") or "")[:500])


def _iso(value):
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    if isinstance(value, (list, tuple, dict)):
        return json.dumps(value, default=str)
    return str(value)


def _cell_json(value):
    if value is None:
        return None
    if isinstance(value, (int, float, bool)):
        return value
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


# ── Core run endpoints ──────────────────────────────────────────────

@sql_router.post("/query", status_code=200, summary="Run SQL query",
                 description="Execute a sandboxed SQL query against datasets you can access.")
@sql_router.post("/query/run", status_code=200, include_in_schema=False)
def run_sql(query: str = Form(...), dataset: str = Form(None),
            confirm_destructive: bool = Form(False), page: int = Form(1, ge=1),
            page_size: int = Form(100000, ge=1, le=100000),
            client_id: str = Form(None),
            current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    safety = _safety_check(query, confirm_destructive)
    if safety["dangerous"] and not confirm_destructive:
        return {"status": "requires_confirmation", "operations": safety["operations"],
                "query": query,
                "message": f"This query performs the following destructive operation(s): {', '.join(safety['operations'])}. "
                           "Run it only if you really intended this. Nothing has been executed."}

    result = _run_with_guard(query, dataset, db, current_user, client_id=client_id)
    log_audit(db, current_user.get("id"), "sql.query", query[:200], "query",
              status=result.get("status") or "error")
    _record_history(db, current_user, query, dataset, result)
    if result.get("status") == "error":
        detail = result.get("error", "Query failed")
        status_code = result.get("status_code")
        if status_code:
            raise HTTPException(status_code=status_code, detail=detail)
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": detail})
    if result.get("status") in ("timeout", "cancelled"):
        return {"status": result.get("status"), "query_id": None,
                "message": result.get("error", "Query " + result.get("status", ""))}

    query_id = result["query_id"]
    cols = result["columns"]
    all_rows = result.get("rows_data", [])
    total = result.get("total_rows", len(all_rows))
    start = (page - 1) * page_size
    page_rows = all_rows[start:start + page_size]
    truncated = result.get("truncated", len(all_rows) > MAX_RESULT_ROWS)
    with _CACHE_LOCK:
        _prune_cache()
        _RESULT_CACHE[query_id] = {
            "columns": cols, "all_rows": all_rows, "total_rows": total,
            "truncated": truncated,
            "query": query, "dataset": dataset,
            "user_id": current_user.get("id"),
            "created_at": time.time() + CACHE_TTL_SECONDS,
            "execution_time_ms": result.get("execution_time_ms"),
        }
    log_audit(db, current_user.get("id"), "sql.query_result", f"{query[:150]} -> {total} rows", "query")
    return {
        "status": "success", "query_id": query_id, "columns": cols,
        "rows": len(page_rows), "data": page_rows, "total_rows": total,
        "truncated": truncated,
        "page": page, "page_size": page_size,
        "execution_time_ms": result.get("execution_time_ms"), "query": query,
    }


def _prune_cache():
    now = time.time()
    stale = [k for k, v in _RESULT_CACHE.items() if v["created_at"] < now]
    for k in stale:
        _RESULT_CACHE.pop(k, None)


def _cached_result(query_id: str, user_id: str):
    with _CACHE_LOCK:
        cached = _RESULT_CACHE.get(query_id)
    if not cached or cached["user_id"] != user_id or cached["created_at"] < time.time():
        raise HTTPException(status_code=404, detail="Query result not found or expired")
    return cached


@sql_router.get("/query/schema", summary="Get available tables and columns")
def get_schema(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    records = {r.filename: r for r in db.query(Dataset).filter(Dataset.deleted_at.is_(None)).all()}
    datasets = []
    for f in _authorized_dataset_filenames(db, current_user):
        fpath = os.path.join(DATASET_DIR, f)
        rec = records.get(f)
        try:
            columns = []
            rows = None
            if f.endswith(".csv"):
                with open(fpath, encoding="utf-8", errors="ignore") as fh:
                    header = fh.readline()
                    rows = max(0, sum(1 for _ in fh))
                if header:
                    import pandas as pd
                    sample = pd.read_csv(fpath, nrows=5)
                    columns = [{"name": c, "type": str(sample[c].dtype)} for c in sample.columns]
            else:
                import pandas as pd
                sample = pd.read_parquet(fpath).head(5)
                columns = [{"name": c, "type": str(sample[c].dtype)} for c in sample.columns]
                try:
                    import pyarrow.parquet as pq
                    rows = pq.read_metadata(fpath).num_rows
                except Exception:
                    rows = None
            datasets.append({
                "name": f,
                "table": _sanitize_table_name(f),
                "rows": rows,
                "columns": columns,
                "size_kb": round(os.path.getsize(fpath) / 1024, 1),
                "source": rec.source if rec else "upload",
                "shared": bool(rec and rec.user_id and rec.user_id != current_user.get("id")),
                "owned_by_me": bool(rec and rec.user_id == current_user.get("id")),
            })
        except Exception as e:
            datasets.append({"name": f, "table": _sanitize_table_name(f), "rows": None,
                             "columns": [], "size_kb": round(os.path.getsize(fpath) / 1024, 1),
                             "source": "upload", "shared": False, "owned_by_me": False,
                             "error": str(e)})
    return {"connection": "duckdb", "engine": "sandbox (in-memory, per request)",
            "note": "Read-only sandbox session; destructive SQL runs in an ephemeral instance.",
            "datasets": datasets}


@sql_router.get("/query/schema/{table}", summary="Get column catalog for a table")
def get_table_schema(table: str, current_user: dict = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    filename = _find_dataset(db, current_user, table)
    if not filename:
        raise HTTPException(status_code=404, detail=f"Table '{table}' not found or not accessible")
    fpath = os.path.join(DATASET_DIR, filename)
    con = None
    try:
        con = duckdb.connect()
        safe_path = fpath.replace(os.sep, "/")
        if filename.endswith(".parquet"):
            con.execute(f'CREATE OR REPLACE VIEW "t" AS SELECT * FROM read_parquet({_sql_literal(safe_path)})')
        else:
            con.execute(f'CREATE OR REPLACE VIEW "t" AS SELECT * FROM read_csv_auto({_sql_literal(safe_path)}, strict_mode=false, ignore_errors=true)')
        cols = con.execute("DESCRIBE table t").fetchall()
        columns = [{"name": c[0], "type": c[1], "null": str(c[2]).upper() == "YES", "key": c[3]} for c in cols]
        return {"table": table, "filename": filename, "column_count": len(columns), "columns": columns}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": str(e)})
    finally:
        if con:
            con.close()


@sql_router.get("/query/preview", summary="Preview a table")
def preview_table(name: str = Query(...), limit: int = Query(20, ge=1, le=1000),
                  current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    fpath, _ = _require_dataset(db, current_user, name)
    con = None
    try:
        con = duckdb.connect()
        safe_path = fpath.replace(os.sep, "/")
        if fpath.endswith(".parquet"):
            con.execute(f'CREATE OR REPLACE VIEW "data" AS SELECT * FROM read_parquet({_sql_literal(safe_path)})')
        else:
            con.execute(f'CREATE OR REPLACE VIEW "data" AS SELECT * FROM read_csv_auto({_sql_literal(safe_path)}, strict_mode=false, ignore_errors=true)')
        result = con.execute(f"SELECT * FROM data LIMIT {limit}")
        columns = [desc[0] for desc in result.description] if result.description else []
        rows = result.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        return {"columns": columns, "rows": len(data), "data": data, "dataset": name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": str(e)})
    finally:
        if con:
            con.close()


# ── Profile / explain / validate ────────────────────────────────────

@sql_router.post("/query/profile", summary="Profile query results")
def profile_query(query: str = Form(...), dataset: str = Form(None),
                  confirm_destructive: bool = Form(False),
                  current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    safety = _safety_check(query, confirm_destructive)
    if safety["dangerous"] and not confirm_destructive:
        return {"status": "requires_confirmation", "operations": safety["operations"],
                "message": "Profile would analyze a destructive operation; confirm to continue."}
    import pandas as pd
    con = None
    try:
        con = duckdb.connect()
        _create_views(con, db, current_user, dataset)
        df = con.execute(query).fetchdf()
        columns = []
        for col in df.columns:
            series = df[col]
            non_null = series.dropna()
            columns.append({
                "name": col,
                "dtype": str(series.dtype),
                "null_count": int(series.isnull().sum()),
                "null_pct": round(float(series.isnull().sum()) / max(len(series), 1) * 100, 2),
                "unique_count": int(series.nunique()),
                "unique_pct": round(float(series.nunique()) / max(len(series), 1) * 100, 2),
                "duplicate_count": int(len(series) - series.nunique()),
                "min_value": str(non_null.min()) if len(non_null) > 0 else None,
                "max_value": str(non_null.max()) if len(non_null) > 0 else None,
                "mean_value": round(float(non_null.mean()), 4) if len(non_null) > 0 and pd.api.types.is_numeric_dtype(series) else None,
                "median_value": round(float(non_null.median()), 4) if len(non_null) > 0 and pd.api.types.is_numeric_dtype(series) else None,
                "std_value": round(float(non_null.std()), 4) if len(non_null) > 1 and pd.api.types.is_numeric_dtype(series) else None,
                "memory_bytes": int(series.memory_usage(deep=True)),
                "sample_values": [str(v) for v in non_null.unique()[:5].tolist()],
            })
        summary = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "total_memory_bytes": int(df.memory_usage(deep=True).sum()),
            "duplicate_rows": int(df.duplicated().sum()),
            "missing_cells": int(df.isnull().sum().sum()),
            "total_cells": int(df.shape[0] * df.shape[1]),
        }
        log_audit(db, current_user.get("id"), "sql.profile", query[:200], "query", status="success")
        return {"columns": columns, "summary": summary, "query": query}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": str(e)})
    finally:
        if con:
            con.close()


@sql_router.post("/query/explain", summary="Explain query execution plan")
def explain_query(query: str = Form(...), dataset: str = Form(None),
                  confirm_destructive: bool = Form(False),
                  current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    safety = _safety_check(query, confirm_destructive)
    if safety["dangerous"] and not confirm_destructive:
        return {"status": "requires_confirmation", "operations": safety["operations"],
                "message": "Explain would analyze a destructive operation; confirm to continue."}
    con = None
    try:
        con = duckdb.connect()
        _create_views(con, db, current_user, dataset)
        result = con.execute(f"EXPLAIN {query}")
        rows = result.fetchall()
        plan = [row[0] for row in rows]
        log_audit(db, current_user.get("id"), "sql.explain", query[:200], "query", status="success")
        return {"plan": plan, "query": query}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": str(e)})
    finally:
        if con:
            con.close()


@sql_router.post("/query/validate", summary="Validate a SQL query")
def validate_query(query: str = Form(...), dataset: str = Form(None),
                   current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    analysis = analyze_sql_safety(query or "")
    payload = {"valid": False, "dangerous": analysis["dangerous"],
               "operations": analysis["operations"], "reasons": analysis["reasons"],
               "suggestions": [], "query": query}
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        payload["reasons"] = payload["reasons"] + ["Query too long or empty"]
        return payload
    if not analysis["ok"]:
        return payload
    if analysis["dangerous"]:
        payload["valid"] = True
        payload["reasons"] = ["Query contains destructive operations and will require confirmation."]
        return payload
    con = None
    try:
        con = duckdb.connect()
        _create_views(con, db, current_user, dataset)
        con.execute(query).fetchall()
        payload["valid"] = True
        payload["reasons"] = ["Query is valid and read-only."]
        payload["suggestions"] = _suggestions_for(query)
    except Exception as e:
        err = str(e)
        payload["reasons"] = [err[:500]]
        m = re.search(r"did you mean[^\n]*", err, re.I)
        if m:
            payload["suggestions"] = [m.group(0)]
        else:
            col = re.search(r"Column reference[^\n]*|Binder Error:[^\n]*|Catalog Error:[^\n]*", err, re.I)
            if col:
                payload["suggestions"] = [col.group(0)[:200]]
    finally:
        if con:
            con.close()
    return payload


def _suggestions_for(query: str) -> list:
    ql = query.lower()
    out = []
    if "*" in query and "limit" not in ql:
        out.append("Consider adding an explicit LIMIT to bound the result size.")
    if "group by" not in ql and any(k in ql for k in ("count(", "avg(", "sum(", "min(", "max(")):
        out.append("Aggregates without GROUP BY may collapse the result to a single row; add GROUP BY if needed.")
    return out[:3]


# ── Result → Dataset ────────────────────────────────────────────────

@sql_router.post("/query/result-to-dataset", summary="Save query result as dataset")
def result_to_dataset(query: str = Form(...), dataset: str = Form(None),
                      output_name: str = Form(None), confirm_destructive: bool = Form(False),
                      current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    safety = _safety_check(query, confirm_destructive)
    if safety["dangerous"] and not confirm_destructive:
        return {"status": "requires_confirmation", "operations": safety["operations"],
                "message": "This destructive query requires confirmation before results can be saved."}
    con = None
    try:
        con = duckdb.connect()
        _create_views(con, db, current_user, dataset)
        df = con.execute(query).fetchdf()
        if not output_name:
            output_name = f"query_result_{uuid.uuid4().hex[:8]}.csv"
        if not output_name.endswith(".csv"):
            output_name += ".csv"
        output_name = re.sub(r"[^a-zA-Z0-9_.\-]", "_", output_name)
        save_path = os.path.join(DATASET_DIR, output_name)
        os.makedirs(DATASET_DIR, exist_ok=True)
        df.to_csv(save_path, index=False)
        record = create_dataset_record(db, output_name,
                                       size_kb=round(os.path.getsize(save_path) / 1024, 1),
                                       rows=len(df), columns=list(df.columns),
                                       user_id=current_user.get("id"), source="sql_query")
        log_audit(db, current_user.get("id"), "sql.result_to_dataset",
                  f"{query[:200]} -> {output_name}", "dataset", record.id, status="success")
        return {"dataset": output_name, "id": record.id, "rows": len(df),
                "columns": list(df.columns),
                "file_size": os.path.getsize(save_path), "source": "sql_query"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail={"code": "sql_error", "message": str(e)})
    finally:
        if con:
            con.close()


# ── Export (streaming) ──────────────────────────────────────────────

@sql_router.post("/query/export", summary="Export query results (CSV or JSON)")
def export_query(query: str = Form(...), dataset: str = Form(None),
                 format: str = Form("csv"), confirm_destructive: bool = Form(False),
                 current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    fmt = format.lower().lstrip(".")
    if fmt not in ("csv", "json"):
        raise HTTPException(status_code=400, detail="format must be 'csv' or 'json'")
    safety = _safety_check(query, confirm_destructive)
    if safety["dangerous"] and not confirm_destructive:
        return {"status": "requires_confirmation", "operations": safety["operations"],
                "message": "Destructive query requires confirmation before export."}

    def stream():
        con = None
        try:
            con = duckdb.connect()
            _create_views(con, db, current_user, dataset)
            result = con.execute(query)
            columns = [desc[0] for desc in result.description] if result.description else []
            count = 0
            if fmt == "csv":
                buf = io.StringIO()
                csv.writer(buf).writerow(columns)
                yield buf.getvalue()
                while True:
                    batch = result.fetchmany(2000)
                    if not batch:
                        break
                    for row in batch:
                        count += 1
                        if count > EXPORT_MAX_ROWS:
                            yield f"\n# export truncated at {EXPORT_MAX_ROWS} rows\n"
                            return
                        buf = io.StringIO()
                        csv.writer(buf).writerow([_iso(v) for v in row])
                        yield buf.getvalue()
            else:
                yield "["
                first = True
                while True:
                    batch = result.fetchmany(2000)
                    if not batch:
                        break
                    for row in batch:
                        count += 1
                        if count > EXPORT_MAX_ROWS:
                            break
                        item = {columns[i]: _cell_json(row[i]) for i in range(len(row))}
                        payload = json.dumps(item, default=str)
                        if not first:
                            yield ","
                        yield payload
                        first = False
                    if count > EXPORT_MAX_ROWS:
                        break
                yield "]"
        except Exception as e:
            yield json.dumps({"error": str(e)})
        finally:
            if con:
                try:
                    con.close()
                except Exception:
                    pass

    fname = f"query_result_{uuid.uuid4().hex[:8]}.{fmt}"
    media = "text/csv" if fmt == "csv" else "application/json"
    headers = {"Content-Disposition": f'attachment; filename="{fname}"'}
    log_audit(db, current_user.get("id"), "sql.export", f"{query[:200]} -> {fmt}", "query", status="success")
    return StreamingResponse(stream(), media_type=media, headers=headers)


# ── History ─────────────────────────────────────────────────────────

@sql_router.get("/query/history", summary="List query history")
def get_history(limit: int = Query(100, ge=1, le=500), offset: int = Query(0, ge=0),
                current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = list_query_history(db, current_user.get("id"), limit=limit, offset=offset)
    return {"history": [{
        "id": r.id, "query": r.query, "dataset": r.dataset,
        "execution_time_ms": r.execution_time_ms, "rows_returned": r.rows_returned,
        "status": r.status, "error": r.error,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]}


@sql_router.delete("/query/history/{history_id}", summary="Delete one history entry")
def delete_history_entry(history_id: str, current_user: dict = Depends(get_current_user),
                         db: Session = Depends(get_db)):
    ok = delete_query_history(db, history_id, current_user.get("id"))
    if not ok:
        raise HTTPException(status_code=404, detail="History entry not found")
    return {"deleted": True}


@sql_router.delete("/query/history", summary="Clear query history")
def clear_history(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    deleted = clear_query_history(db, current_user.get("id"))
    return {"deleted": deleted}


# ── Saved queries ───────────────────────────────────────────────────

@sql_router.get("/query/saved", summary="List saved queries")
def get_saved(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = list_saved_queries(db, current_user.get("id"))
    return {"saved": [{
        "id": r.id, "name": r.name, "description": r.description, "query": r.query,
        "dataset": r.dataset, "folder": r.folder, "tags": r.tags or [], "pinned": r.pinned,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows]}


@sql_router.post("/query/saved", summary="Save a query")
def save_query(name: str = Form(...), query: str = Form(...), dataset: str = Form(None),
               description: str = Form(None), folder: str = Form("default"),
               tags: str = Form(None), pinned: bool = Form(False),
               current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not name.strip() or not query.strip() or len(query) > MAX_QUERY_LEN:
        raise HTTPException(status_code=400, detail="Name and query are required (query <= 10000 chars)")
    tag_list = []
    if tags:
        try:
            tag_list = json.loads(tags) if tags.startswith("[") else [t.strip() for t in tags.split(",") if t.strip()]
        except Exception:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    row = create_saved_query(db, current_user.get("id"), name.strip(), query.strip(),
                             dataset=dataset, description=description, folder=folder,
                             tags=tag_list, pinned=pinned)
    return {"id": row.id, "name": row.name, "query": row.query, "dataset": row.dataset}


@sql_router.put("/query/saved/{saved_id}", summary="Update a saved query")
def update_saved(saved_id: str, name: str = Form(None), query: str = Form(None),
                 dataset: str = Form(None), description: str = Form(None),
                 folder: str = Form(None), pinned: bool = Form(None),
                 current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    fields = {}
    if name is not None:
        fields["name"] = name.strip()
    if query is not None:
        if len(query) > MAX_QUERY_LEN:
            raise HTTPException(status_code=400, detail="Query too long")
        fields["query"] = query.strip()
    if dataset is not None:
        fields["dataset"] = dataset or None
    if description is not None:
        fields["description"] = description
    if folder is not None:
        fields["folder"] = folder
    if pinned is not None:
        fields["pinned"] = pinned
    row = update_saved_query(db, saved_id, current_user.get("id"), **fields)
    if not row:
        raise HTTPException(status_code=404, detail="Saved query not found")
    return {"id": row.id, "updated": True}


@sql_router.delete("/query/saved/{saved_id}", summary="Delete a saved query")
def delete_saved(saved_id: str, current_user: dict = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    ok = delete_saved_query(db, saved_id, current_user.get("id"))
    if not ok:
        raise HTTPException(status_code=404, detail="Saved query not found")
    return {"deleted": True}


# ── Dynamic result routes (registered last so static paths win) ─────

@sql_router.get("/query/{query_id}", summary="Fetch cached query result")
def get_query_result(query_id: str, page: int = Query(1, ge=1),
                     page_size: int = Query(50, ge=1, le=500),
                     current_user: dict = Depends(get_current_user)):
    cached = _cached_result(query_id, current_user.get("id"))
    start = (page - 1) * page_size
    page_rows = cached["all_rows"][start:start + page_size]
    return {"query_id": query_id, "columns": cached["columns"], "rows": len(page_rows),
            "data": page_rows, "total_rows": cached["total_rows"],
            "truncated": cached["truncated"], "page": page, "page_size": page_size,
            "query": cached["query"], "dataset": cached.get("dataset"),
            "execution_time_ms": cached.get("execution_time_ms")}


@sql_router.get("/query/{query_id}/page", summary="Fetch a result page", include_in_schema=False)
def get_query_page(query_id: str, page: int = Query(1, ge=1),
                   page_size: int = Query(50, ge=1, le=500),
                   current_user: dict = Depends(get_current_user)):
    cached = _cached_result(query_id, current_user.get("id"))
    start = (page - 1) * page_size
    page_rows = cached["all_rows"][start:start + page_size]
    return {"query_id": query_id, "columns": cached["columns"], "rows": len(page_rows),
            "data": page_rows, "total_rows": cached["total_rows"],
            "truncated": cached["truncated"], "page": page, "page_size": page_size}


@sql_router.post("/query/{query_id}/cancel", summary="Cancel a running query")
def cancel_query(query_id: str, current_user: dict = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    with _CACHE_LOCK:
        entry = _RUNNING.get(query_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Query is no longer running")
    if entry["user_id"] != current_user.get("id"):
        raise HTTPException(status_code=403, detail="Not your query")
    entry["cancelled"] = True
    try:
        entry["conn"].interrupt()
    except Exception:
        pass
    log_audit(db, current_user.get("id"), "sql.cancel", query_id, "query", status="success")
    return {"status": "cancelled", "message": "Cancellation requested"}


@sql_router.post("/query/cancel/client/{client_id}", summary="Cancel a running query by client id",
                 include_in_schema=False)
def cancel_query_by_client(client_id: str, current_user: dict = Depends(get_current_user),
                           db: Session = Depends(get_db)):
    with _CACHE_LOCK:
        query_id = _CLIENT_RUNS.get(client_id)
    if not query_id:
        raise HTTPException(status_code=404, detail="Query is no longer running")
    return cancel_query(query_id, current_user, db)


# ── AI SQL generation (deterministic, clearly labeled) ──────────────

@ai_router.post("/ai/sql", summary="Generate SQL from natural language (AI)")
def ai_sql(question: str = Form(...), dataset: str = Form(None),
           current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    if not question or len(question.strip()) > 2000:
        raise HTTPException(status_code=400, detail="Question is empty or too long")
    nl = question.strip().lower()
    cols = []
    if dataset:
        try:
            fpath, _ = _require_dataset(db, current_user, dataset)
            import pandas as pd
            sample = pd.read_csv(fpath, nrows=3) if fpath.endswith(".csv") else pd.read_parquet(fpath).head(3)
            cols = list(sample.columns)
        except Exception:
            cols = []
    numeric = [c for c in cols if any(k in c.lower() for k in
                ("age", "price", "value", "amount", "score", "income", "spend", "count", "qty", "rating", "percent", "latitude", "longitude", "length", "width", "height", "weight", "size_mb", "num_", "_num", "quantity"))]
    categorical = [c for c in cols if any(k in c.lower() for k in
                  ("gender", "category", "type", "status", "class", "species", "name", "country", "city", "region", "label", "product", "color", "categorical"))]

    table = "data"
    table_label = "the selected dataset" if dataset else "your datasets (use <table> in FROM)"

    if any(k in nl for k in ("count", "how many", "number of", "total")):
        if categorical:
            col = categorical[0]
            sql = f'SELECT "{col}", COUNT(*) AS count FROM {table} GROUP BY "{col}" ORDER BY count DESC'
            explanation = f"Aggregate rows in {table_label}: count how many records fall into each category of '{col}'."
        else:
            sql = f"SELECT COUNT(*) AS total_rows FROM {table}"
            explanation = f"Return the total number of rows in {table_label}."
    elif any(k in nl for k in ("max", "highest", "largest")):
        col = numeric[0] if numeric else (cols[0] if cols else "*")
        sql = f'SELECT MAX("{col}") AS "max_{col}" FROM {table}'
        explanation = f"Compute the maximum value of '{col}'."
    elif any(k in nl for k in ("min", "lowest", "smallest")):
        col = numeric[0] if numeric else (cols[0] if cols else "*")
        sql = f'SELECT MIN("{col}") AS "min_{col}" FROM {table}'
        explanation = f"Compute the minimum value of '{col}'."
    elif (any(k in nl for k in ("average", "avg", "mean")) and numeric and categorical and
          any(k in nl for k in ("by", "per", "group", "each"))):
        num = numeric[0]
        cat = categorical[0]
        sql = f'SELECT "{cat}", AVG("{num}") AS "avg_{num}" FROM {table} GROUP BY "{cat}" ORDER BY "avg_{num}" DESC'
        explanation = f"Average '{num}' grouped by '{cat}'."
    elif any(k in nl for k in ("average", "avg", "mean")):
        col = numeric[0] if numeric else (cols[0] if cols else "*")
        sql = f'SELECT AVG("{col}") AS "avg_{col}" FROM {table}'
        explanation = f"Compute the average of '{col}'."
    elif any(k in nl for k in ("sample", "preview", "first", "top", "rows", "show me some", "view", "look")):
        sql = f"SELECT * FROM {table} LIMIT 20"
        explanation = f"Preview the first 20 rows of {table_label}."
    elif any(k in nl for k in ("compare", "correlation", "relationship", "distribution", "see")):
        if categorical:
            sql = f'SELECT "{categorical[0]}", COUNT(*) AS count FROM {table} GROUP BY "{categorical[0]}"'
            explanation = f"Distribution of '{categorical[0]}' across {table_label}."
        else:
            sql = f"SELECT * FROM {table} LIMIT 50"
            explanation = "Preview records to explore the data."
    elif nl.startswith(("show", "get", "list", "select", "find")):
        if categorical:
            sql = f'SELECT * FROM {table} ORDER BY "{categorical[0]}" LIMIT 50'
            explanation = f"Select rows from {table_label} ordered by '{categorical[0]}'."
        else:
            sql = f"SELECT * FROM {table} LIMIT 50"
            explanation = f"Select the first 50 rows of {table_label}."
    else:
        sql = f"SELECT * FROM {table} LIMIT 100"
        explanation = f"Explore {table_label} with a broad preview (top 100 rows)."

    return {
        "sql": sql,
        "explanation": explanation,
        "table": table,
        "columns": cols,
        "generated_by": "generated by the platform's offline AI helper — review before running",
        "generated_at": datetime.now().isoformat(),
    }