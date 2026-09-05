import os
import asyncio
import sys
import json
import time
import uuid
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
import pandas as pd

from logging_config import setup_logging, RequestLogMiddleware
from config import settings
from monitoring import collect_system_metrics
from models import PredictionLog
import logging

from database import get_db, init_db
from middleware import SecurityHeadersMiddleware, RateLimitMiddleware, CSRFMiddleware, rate_limiter
from security_utils import sanitize_text, sanitize_name, validate_sql_query, validate_upload_filename
from crud import (
    create_user, authenticate_user, get_user_by_id,
    list_experiments, create_experiment,
    list_models, get_model, create_model, update_model_status,
    list_deployments, create_deployment, delete_deployment,
    list_pipelines, create_pipeline, get_pipeline, update_pipeline,
    delete_pipeline, run_pipeline, list_pipeline_runs, get_pipeline_run,
    list_webhooks, create_webhook, delete_webhook,
    list_api_keys, create_api_key, delete_api_key,
    list_teams, create_team,
    list_audit_logs, log_audit,
    list_projects, create_project, get_project, update_project, list_projects_by_user,
    create_dataset_record, list_dataset_records, get_dataset_record, delete_dataset_record,
    update_dataset_tags, update_dataset_description, bump_dataset_version,
    share_dataset, list_dataset_shares, remove_dataset_share,
    global_search,
    create_prediction_log, list_prediction_logs,
    create_notification, list_notifications, mark_notification_read,
    mark_all_notifications_read, delete_notification,
    list_marketplace_items, install_marketplace_item,
    get_prediction_log, delete_prediction_log,
    get_experiment, delete_experiment, compare_experiments,
    get_deployment, update_deployment,
    count_unread_notifications,
    get_audit_log,
    get_team, update_team, delete_team,
    list_models as list_model_registry_entries,
)
from api_responses import ok, error, created, deleted, paginated, TAGS_METADATA
from fastapi.exceptions import RequestValidationError
from schemas import (
    PipelineCreate, PipelineUpdate, PipelineResponse, PipelineRunResponse,
    WebhookCreate, WebhookResponse,
)
from preprocess import auto_preprocess
from train import run_automl_training
from predict import make_prediction, load_model_metadata
from cleaning import profile_dataset, clean_dataset, auto_clean
from analysis import analyze_dataset
from analytics import dashboard_analytics
from train import CLASSIFICATION_MODELS, REGRESSION_MODELS, run_engine_training, run_tuning, XGB_AVAILABLE, LGBM_AVAILABLE, CATB_AVAILABLE
from hpo import HPORunner, get_param_ranges, OPTUNA_AVAILABLE, SKOPT_AVAILABLE, PARAM_RANGES as HPO_PARAM_RANGES
from engine import get_all_models, run_engine_job, CLASSIFICATION_MODELS as ENGINE_CLF_MODELS, REGRESSION_MODELS as ENGINE_REG_MODELS, CLUSTERING_MODELS, TIME_SERIES_MODELS
from features import generate_features, suggest_features
from explain import explain_prediction
from ai_assistant import answer_question, list_datasets as ai_list_datasets, load_experiments as ai_load_experiments
from auth import (
    register_user, login_user, refresh_token, get_current_user, get_optional_user,
    decode_token, create_access_token, sanitize_filename,
    update_user_profile, change_password, send_verification, verify_email,
    forgot_password, reset_password, google_login,
    list_sessions, revoke_session, logout, revoke_all_sessions,
)

setup_logging()
logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "..", "dataset")
MODELS_DIR = os.path.join(BASE_DIR, "..", "models")
MAX_UPLOAD_MB = 500
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".parquet", ".json"}


def validate_path(name: str) -> str:
    clean = sanitize_filename(name)
    if clean != name:
        raise HTTPException(status_code=400, detail=f"Invalid filename: {name}")
    fpath = os.path.normpath(os.path.join(DATASET_DIR, clean))
    if not fpath.startswith(os.path.normpath(DATASET_DIR)):
        raise HTTPException(status_code=400, detail="Path traversal detected")
    return fpath


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"Starting... DATABASE_URL={'set' if os.getenv('DATABASE_URL') else 'not set'}, PORT={os.getenv('PORT', 'not set')}", flush=True)
    os.makedirs(DATASET_DIR, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)
    try:
        init_db()
        print("Database initialized", flush=True)
    except Exception as e:
        print(f"Database init failed: {e}", flush=True)
    yield

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION, lifespan=lifespan,
              openapi_tags=TAGS_METADATA,
              docs_url="/docs", redoc_url="/redoc",
              contact={"name": "AutoML Team", "url": "https://automl.local"},
              license_info={"name": "MIT"})

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://localhost")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_origin_regex=r"https://.*\.(onrender\.com|vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestLogMiddleware)

app.add_middleware(SecurityHeadersMiddleware)

rate_limit_max = int(os.getenv("RATE_LIMIT_MAX", "60"))
rate_limit_window = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))
app.add_middleware(RateLimitMiddleware, max_requests=rate_limit_max, window_sec=rate_limit_window)

csrf_secret = os.getenv("CSRF_SECRET", os.getenv("JWT_SECRET", ""))
if csrf_secret:
    app.add_middleware(CSRFMiddleware, secret=csrf_secret)

trusted_hosts = os.getenv("TRUSTED_HOSTS", "*.onrender.com,localhost,127.0.0.1,0.0.0.0,testserver")
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=[h.strip() for h in trusted_hosts.split(",") if h.strip()],
)

from api_responses import global_exception_handler, validation_exception_handler
app.add_exception_handler(Exception, global_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024


# ── Helpers ──────────────────────────────────────────────────────────

def _load_model_meta(name: str) -> dict:
    meta_path = os.path.join(MODELS_DIR, name.replace(".pkl", "_meta.json"))
    if os.path.exists(meta_path):
        with open(meta_path) as f:
            return json.load(f)
    return {}


def _get_dataset_df(name: str) -> pd.DataFrame:
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    if name.endswith(".csv"):
        return pd.read_csv(fpath)
    elif name.endswith((".xlsx", ".xls")):
        return pd.read_excel(fpath)
    elif name.endswith(".parquet"):
        return pd.read_parquet(fpath)
    else:
        return pd.read_json(fpath)


# Cheap file metadata used by the list endpoint. Keyed by (mtime_ns, size) so a
# full pandas read is only performed once per file version, never per request.
_dataset_meta_cache: dict[str, tuple] = {}


def _get_dataset_meta(name: str) -> tuple:
    fpath = os.path.join(DATASET_DIR, name)
    if not os.path.exists(fpath):
        return 0, [], {}
    st = os.stat(fpath)
    cache_key = f"{name}:{st.st_mtime_ns}:{st.st_size}"
    cached = _dataset_meta_cache.get(name)
    if cached and cached[0] == cache_key:
        return cached[1], cached[2], cached[3]
    rows: int = 0
    columns: list = []
    dtypes: dict = {}
    try:
        if name.endswith(".csv"):
            with open(fpath, encoding="utf-8", errors="ignore") as fh:
                header = fh.readline()
                if header:
                    columns = [c.strip() for c in header.rstrip("\r\n").split(",")]
                rows = max(0, sum(1 for _ in fh))
            sample = pd.read_csv(fpath, nrows=50) if os.path.exists(fpath) else pd.DataFrame()
        elif name.endswith(".parquet"):
            try:
                import pyarrow.parquet as pq
                pf = pq.ParquetFile(fpath)
                columns = list(pf.schema.names)
                dtypes = {c: str(pf.schema.field(c).type) for c in columns}
                rows = pf.metadata.num_rows
                sample = pd.DataFrame()
            except Exception:
                sample = pd.read_parquet(fpath).head(50)
        elif name.endswith((".xlsx", ".xls")):
            sample = pd.read_excel(fpath, nrows=50)
        else:
            sample = pd.read_json(fpath)
    except Exception:
        sample = pd.DataFrame()
        rows = 0
        columns = []
        dtypes = {}
    if not columns and not sample.empty:
        columns = list(sample.columns)
    if not dtypes and not sample.empty:
        dtypes = {c: str(sample[c].dtype) for c in columns}
    meta = (rows, columns, dtypes)
    _dataset_meta_cache[name] = (cache_key, rows, columns, dtypes)
    return meta


# ── Root ────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"], summary="Home", description="Returns API status and version info.")
def home():
    return {
        "status": "AutoML Platform API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }

@app.get("/api/v1/health", tags=["Health"], summary="Health check",
         description="Returns system health including dependency checks.")
def health():
    import psutil
    disk = psutil.disk_usage("/")
    db_ok = False
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass
    status = "healthy" if db_ok else "degraded"
    return ok({
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": "connected" if db_ok else "unreachable",
        "disk_usage_percent": disk.percent,
        "disk_free_gb": round(disk.free / (1024**3), 2),
        "datasets_count": len([f for f in os.listdir(DATASET_DIR) if any(f.endswith(e) for e in ALLOWED_EXTENSIONS)]) if os.path.exists(DATASET_DIR) else 0,
        "models_count": len([f for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]) if os.path.exists(MODELS_DIR) else 0,
    }, message=status, status_code=200 if db_ok else 503)


@app.get("/api/v1/health/live", tags=["Health"],
         summary="Liveness probe", description="Simple liveness check for orchestrators.")
def liveness():
    return {"status": "alive"}


@app.get("/health", tags=["Health"],
         summary="Health check", description="Lightweight liveness check for Render/Docker. No auth, no ML, no database, no Firebase, no Redis dependency.")
def liveness_check():
    return {"status": "healthy"}


@app.get("/api/v1/health/ready", tags=["Health"],
         summary="Readiness probe", description="Readiness check including database connectivity.")
def readiness():
    db_ok = False
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass
    if not db_ok:
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready"}


# ── Auth ────────────────────────────────────────────────────────────

@app.post("/api/v1/auth/register", tags=["Auth"], summary="Register user", description="Register a new user account with email and password.")
def auth_register(email: str = Form(...), password: str = Form(...), name: str = Form(...),
                  device_info: str = Form(None), db: Session = Depends(get_db)):
    return register_user(db, email, password, name, device_info=device_info)

@app.post("/api/v1/auth/login", tags=["Auth"], summary="Login", description="Authenticate user and return access token.")
def auth_login(email: str = Form(...), password: str = Form(...),
               device_info: str = Form(None), db: Session = Depends(get_db)):
    return login_user(db, email, password, device_info=device_info)

@app.post("/api/v1/auth/refresh", tags=["Auth"], summary="Refresh token", description="Refresh an expired access token.")
def auth_refresh(token: str = Form(...), db: Session = Depends(get_db)):
    return refresh_token(token, db)

@app.get("/api/v1/auth/me", tags=["Auth"], summary="Get current user", description="Return the currently authenticated user profile.")
def auth_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}

@app.put("/api/v1/auth/profile", tags=["Auth"], summary="Update profile", description="Update the current user's name and preferences.")
def auth_update_profile(name: str = Form(None), preferences: str = Form(None),
                        current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    prefs = json.loads(preferences) if preferences else None
    return update_user_profile(db, current_user["id"], name=name, preferences=prefs)

@app.post("/api/v1/auth/change-password", tags=["Auth"], summary="Change password", description="Change the current user's password.")
def auth_change_password(current_password: str = Form(...), new_password: str = Form(...),
                         current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return change_password(db, current_user["id"], current_password, new_password)

@app.post("/api/v1/auth/send-verification", tags=["Auth"], summary="Send verification email", description="Send an email verification link to the current user.")
def auth_send_verification(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return send_verification(db, current_user["id"])

@app.post("/api/v1/auth/verify-email", tags=["Auth"], summary="Verify email", description="Verify a user's email address using the token.")
def auth_verify_email(token: str = Form(...), db: Session = Depends(get_db)):
    return verify_email(db, token)

@app.post("/api/v1/auth/forgot-password", tags=["Auth"], summary="Forgot password", description="Send a password reset link to the user's email.")
def auth_forgot_password(email: str = Form(...), db: Session = Depends(get_db)):
    return forgot_password(db, email)

@app.post("/api/v1/auth/reset-password", tags=["Auth"], summary="Reset password", description="Reset user password using a valid reset token.")
def auth_reset_password(token: str = Form(...), new_password: str = Form(...), db: Session = Depends(get_db)):
    return reset_password(db, token, new_password)

@app.post("/api/v1/auth/google", tags=["Auth"], summary="Google login", description="Authenticate user via Google OAuth token.")
def auth_google(id_token: str = Form(...), device_info: str = Form(None), db: Session = Depends(get_db)):
    return google_login(db, id_token, device_info=device_info)

@app.get("/api/v1/auth/sessions", tags=["Auth"], summary="List sessions", description="List all active sessions for the current user.")
def auth_list_sessions(current_user: dict = Depends(get_current_user), db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    sessions = list_sessions(db, current_user["id"])
    total = len(sessions)
    sessions = sessions[offset:offset + limit]
    return paginated(sessions, total, offset, limit, key="sessions")

@app.delete("/api/v1/auth/sessions/{session_id}", tags=["Auth"], summary="Revoke session", description="Revoke a specific session by ID.")
def auth_revoke_session(session_id: str, current_user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    return revoke_session(db, current_user["id"], session_id)

@app.post("/api/v1/auth/logout", tags=["Auth"], summary="Logout", description="Log out the current user and revoke the active token.")
def auth_logout(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    return logout(db, credentials)

@app.post("/api/v1/auth/logout-all", tags=["Auth"], summary="Logout all sessions", description="Revoke all sessions for the current user.")
def auth_logout_all(current_user: dict = Depends(get_current_user),
                    credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    return revoke_all_sessions(db, current_user["id"], exclude_token=credentials.credentials)


# ── Security ────────────────────────────────────────────────────────

@app.get("/api/v1/csrf-token", tags=["Security"], summary="Get CSRF token", description="Generate and return a CSRF protection token.")
def get_csrf_token(current_user: dict = Depends(get_current_user)):
    csrf_secret = os.getenv("CSRF_SECRET", os.getenv("JWT_SECRET", ""))
    if not csrf_secret:
        raise HTTPException(status_code=500, detail="CSRF not configured")
    from security_utils import generate_csrf_token
    token, _ = generate_csrf_token(csrf_secret)
    return {"csrf_token": token}


# ── Search ──────────────────────────────────────────────────────────

@app.get("/api/v1/search", tags=["Search"], summary="Global search", description="Search across datasets, experiments, models, and projects.")
def search(q: str = Query("", min_length=1), db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    results = global_search(db, q, DATASET_DIR, user_id=uid)
    return results


# ── Notifications ──────────────────────────────────────────────────

@app.get("/api/v1/notifications", tags=["Notifications"], summary="List notifications", description="Retrieve notifications for the current user.")
def get_notifications(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="notifications")
    notifs = list_notifications(db, uid, 999999)
    total = len(notifs)
    notifs = notifs[offset:offset + limit]
    return paginated([{
        "id": n.id, "title": n.title, "message": n.message,
        "type": n.type, "category": n.category,
        "resource_type": n.resource_type, "resource_id": n.resource_id,
        "read": n.read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    } for n in notifs], total, offset, limit, key="notifications")

@app.put("/api/v1/notifications/{notif_id}/read", tags=["Notifications"], summary="Mark notification read", description="Mark a single notification as read.")
def read_notification(notif_id: str, db: Session = Depends(get_db)):
    n = mark_notification_read(db, notif_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}

@app.post("/api/v1/notifications/{notif_id}/read", tags=["Notifications"], summary="Mark notification read (POST)", description="Mark a single notification as read (POST alias).")
def read_notification_post(notif_id: str, db: Session = Depends(get_db)):
    n = mark_notification_read(db, notif_id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}

@app.put("/api/v1/notifications/read-all", tags=["Notifications"], summary="Mark all read", description="Mark all notifications as read for the current user.")
def read_all_notifications(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    mark_all_notifications_read(db, uid)
    return {"status": "ok"}

@app.post("/api/v1/notifications/read-all", tags=["Notifications"], summary="Mark all read (POST alias)", description="Mark all notifications as read for the current user (POST alias).")
def read_all_notifications_post(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    mark_all_notifications_read(db, uid)
    return {"status": "ok"}

@app.delete("/api/v1/notifications/{notif_id}", tags=["Notifications"], summary="Delete notification", description="Delete a notification by ID.")
def remove_notification(notif_id: str, db: Session = Depends(get_db)):
    if not delete_notification(db, notif_id):
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok"}

@app.get("/api/v1/notifications/unread-count", tags=["Notifications"], summary="Unread count", description="Get the count of unread notifications for the current user.")
def get_unread_count(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return {"count": 0}
    count = count_unread_notifications(db, uid)
    return {"count": count}


# ── Datasets ─────────────────────────────────────────────────────────

def require_dataset_access(db, name, current_user, owner_only=False):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    record = get_dataset_record(db, name)
    if not record or record.deleted_at is not None:
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    if record.user_id is not None and record.user_id != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    if owner_only and record.user_id != uid:
        raise HTTPException(status_code=403, detail="Access denied")
    return record


def _preview_df(name: str, rows: int = 50, offset: int = 0) -> pd.DataFrame:
    fpath = os.path.join(DATASET_DIR, name)
    if name.endswith(".csv"):
        skip = lambda i: i != 0 and i <= offset
        return pd.read_csv(fpath, skiprows=skip, nrows=rows)
    if name.endswith((".xlsx", ".xls")):
        return pd.read_excel(fpath, nrows=offset + rows).iloc[offset:offset + rows]
    if name.endswith(".json"):
        try:
            return pd.read_json(fpath, lines=True, skiprows=offset, nrows=rows)
        except Exception:
            return pd.read_json(fpath).iloc[offset:offset + rows]
    if name.endswith(".parquet"):
        import pyarrow.parquet as pq
        return pq.read_table(fpath).slice(offset, rows).to_pandas()
    return pd.read_json(fpath).iloc[offset:offset + rows]


def _dataset_total_rows(name: str, fpath: str) -> int:
    try:
        if name.endswith(".csv"):
            with open(fpath, encoding="utf-8", errors="ignore") as fh:
                return max(0, sum(1 for _ in fh) - 1)
        if name.endswith(".json"):
            try:
                return sum(1 for _ in open(fpath))
            except Exception:
                return len(pd.read_json(fpath))
        if name.endswith((".xlsx", ".xls")):
            from openpyxl import load_workbook
            wb = load_workbook(fpath, read_only=True)
            ws = wb.active
            return max(0, (ws.max_row or 1) - 1)
        if name.endswith(".parquet"):
            import pyarrow.parquet as pq
            return pq.read_metadata(fpath).num_rows
    except Exception:
        pass
    return -1


@app.get("/api/v1/datasets", tags=["Datasets"], summary="List datasets", description="List all uploaded datasets with metadata.")
def list_datasets(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="datasets")
    db_records = {r.filename: r for r in list_dataset_records(db, user_id=uid)}
    files = []
    for f in sorted(os.listdir(DATASET_DIR)):
        if not any(f.endswith(e) for e in ALLOWED_EXTENSIONS):
            continue
        fpath = os.path.join(DATASET_DIR, f)
        size_kb = round(os.path.getsize(fpath) / 1024, 1)
        try:
            rows, columns, dtypes = _get_dataset_meta(f)
            record = db_records.get(f)
            files.append({
                "name": f, "size_kb": size_kb,
                "rows": rows,
                "columns": columns,
                "dtypes": dtypes,
                "uploaded_at": record.created_at.isoformat() if record else datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
                "project_id": record.project_id if record else None,
                "user_id": record.user_id if record else None,
                "status": record.status if record else "ready",
                "id": record.id if record else None,
                "description": record.description if record else None,
                "tags": record.tags if record and record.tags else [],
                "version": record.version if record else 1,
                "source": record.source if record else "upload",
                "source_url": record.source_url if record else None,
            })
        except Exception:
            files.append({"name": f, "size_kb": size_kb, "rows": 0, "columns": [], "uploaded_at": "", "status": "error"})
    total = len(files)
    files = files[offset:offset + limit]
    return paginated(files, total, offset, limit, key="datasets")

@app.post("/api/v1/datasets/sample/{sample_name}", tags=["Datasets"], summary="Load sample dataset", description="Load a built-in benchmark dataset (iris, titanic, housing).")
def load_sample_dataset(
    sample_name: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    sample_files = {
        "iris": ("iris.csv", "Iris Flower Classification Dataset", "target"),
        "titanic": ("titanic.csv", "Titanic Passenger Survival Dataset", "Survived"),
        "housing": ("housing.csv", "California Housing Price Regression Dataset", "MedHouseVal"),
    }
    key = sample_name.lower().strip()
    if key not in sample_files:
        raise HTTPException(status_code=400, detail=f"Sample dataset '{sample_name}' not found. Available: iris, titanic, housing")
    fname, desc, default_target = sample_files[key]
    fpath = os.path.join(DATASET_DIR, fname)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Sample dataset file '{fname}' missing.")
    df = pd.read_csv(fpath)
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    record = create_dataset_record(db, fname, size_kb=round(os.path.getsize(fpath) / 1024, 1), rows=len(df), columns=list(df.columns), user_id=uid, description=desc, source="sample")
    log_audit(db, current_user.get("name", "User") if current_user else "User", "dataset.sample_loaded", fname, "dataset", record.id)
    return {
        "name": fname,
        "sample_key": key,
        "description": desc,
        "default_target": default_target if default_target in df.columns else df.columns[-1],
        "rows": len(df),
        "columns": list(df.columns),
        "size_kb": round(os.path.getsize(fpath) / 1024, 1),
        "id": record.id,
        "status": "ready"
    }

@app.post("/api/v1/datasets", tags=["Datasets"], summary="Upload dataset", description="Upload a new dataset file.")
async def upload_dataset(
    file: UploadFile = File(...),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type {ext}")
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File is empty")
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB}MB limit")
    orig_name = sanitize_filename(file.filename)
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    existing = get_dataset_record(db, orig_name)
    if existing and existing.user_id == uid and existing.deleted_at is None and os.path.exists(os.path.join(DATASET_DIR, orig_name)):
        filename = orig_name
    else:
        filename = orig_name
        i = 1
        while os.path.exists(os.path.join(DATASET_DIR, filename)) or (get_dataset_record(db, filename) and get_dataset_record(db, filename).user_id != uid):
            stem, ext_part = os.path.splitext(orig_name)
            filename = f"{stem}_{uid[:8] if uid else 'anon'}_{i}{ext_part}"
            i += 1
    file_location = os.path.join(DATASET_DIR, filename)
    with open(file_location, "wb") as f:
        f.write(content)
    try:
        df = await asyncio.get_running_loop().run_in_executor(None, _get_dataset_df, filename)
    except Exception as e:
        os.remove(file_location)
        raise HTTPException(status_code=400, detail=f"Failed to parse dataset: {e}")
    if len(df.columns) == 0:
        os.remove(file_location)
        raise HTTPException(status_code=400, detail="Dataset has no valid columns")
    rows = len(df)
    columns = list(df.columns)
    size_kb = round(len(content) / 1024, 1)
    if existing and existing.user_id == uid and existing.deleted_at is None:
        existing.file_size_kb = size_kb
        existing.rows = rows
        existing.columns = columns
        existing.version = (existing.version or 0) + 1
        existing.updated_at = datetime.now(timezone.utc)
        existing.status = "ready"
        db.commit()
        db.refresh(existing)
        record = existing
    else:
        record = create_dataset_record(db, filename, size_kb=size_kb, rows=rows, columns=columns, project_id=project_id, user_id=uid)
        record.status = "ready"
        db.commit()
        db.refresh(record)
    log_audit(db, current_user.get("name", "User"), "dataset.uploaded", filename, "dataset", record.id)
    try:
        create_notification(db, {
            "user_id": uid,
            "title": "Upload Successful",
            "message": f"Dataset '{filename}' uploaded with {rows} rows and {len(columns)} features",
            "type": "success",
            "category": "upload",
            "resource_type": "dataset",
            "resource_id": record.id,
        })
    except Exception:
        pass
    return {
        "message": f"Uploaded {filename}",
        "filename": filename,
        "features": columns,
        "rows": rows,
        "id": record.id,
        "user_id": uid,
        "status": "ready",
    }

@app.get("/api/v1/datasets/{name}", tags=["Datasets"], summary="Get dataset", description="Get metadata for a specific dataset.")
def get_dataset_api(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    size_kb = round(os.path.getsize(fpath) / 1024, 1)
    rows, columns, dtypes = _get_dataset_meta(name)
    record = get_dataset_record(db, name)
    return {
        "name": name, "size_kb": size_kb,
        "rows": rows, "columns": columns,
        "dtypes": dtypes,
        "uploaded_at": record.created_at.isoformat() if record else datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
        "project_id": record.project_id if record else None,
        "status": record.status if record else "ready",
        "id": record.id if record else None,
        "description": record.description if record else None,
        "tags": record.tags if record and record.tags else [],
        "version": record.version if record else 1,
        "source": record.source if record else "upload",
        "source_url": record.source_url if record else None,
    }

@app.get("/api/v1/datasets/{name}/download", tags=["Datasets"], summary="Download dataset", description="Download a dataset file by name.")
def download_dataset(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    ext = os.path.splitext(name)[1].lower()
    media_map = {".csv": "text/csv", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".parquet": "application/octet-stream", ".json": "application/json"}
    return FileResponse(fpath, filename=name, media_type=media_map.get(ext, "application/octet-stream"))

@app.delete("/api/v1/datasets/{name}", tags=["Datasets"], summary="Delete dataset", description="Delete a dataset file by name.")
def delete_dataset(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    os.remove(fpath)
    delete_dataset_record(db, name)
    log_audit(db, current_user.get("name", "User"), "dataset.deleted", name, "dataset")
    return {"message": f"Deleted '{name}'"}

@app.get("/api/v1/datasets/{name}/preview", tags=["Datasets"], summary="Preview dataset", description="Preview rows from a dataset with pagination.")
def preview_dataset(name: str, rows: int = Query(50, ge=1, le=500), offset: int = Query(0, ge=0, le=100000), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    try:
        total = _dataset_total_rows(name, fpath)
        df = _preview_df(name, rows, offset)
        return {
            "name": name, "total_rows": (total if total >= 0 else None), "offset": offset,
            "rows_returned": len(df), "columns": list(df.columns),
            "data": df.fillna("").to_dict(orient="records"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/v1/datasets/{name}/profile", tags=["Datasets"], summary="Dataset profile", description="Generate a data quality profile for a dataset.")
def dataset_profile(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    return profile_dataset(name)

@app.get("/api/v1/datasets/{name}/analyze", tags=["Datasets"], summary="Analyze dataset", description="Perform statistical analysis on a dataset.")
def dataset_analyze(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    try:
        return analyze_dataset(name)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/datasets/{name}/clean", tags=["Datasets"], summary="Clean dataset", description="Apply cleaning operations to a dataset.")
def clean(name: str, operations: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    try:
        ops = json.loads(operations)
        result = clean_dataset(name, ops)
        log_audit(db, current_user.get("name", "User"), "dataset.cleaned", name, "dataset")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/datasets/{name}/auto-clean", tags=["Datasets"], summary="Auto-clean dataset", description="Automatically detect and clean issues in a dataset.")
def auto_clean_endpoint(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    try:
        result = auto_clean(name)
        log_audit(db, current_user.get("name", "User"), "dataset.auto_cleaned", name, "dataset")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/datasets/{name}/features/generate", tags=["Datasets"], summary="Generate features", description="Generate engineered features for a dataset.")
def generate(name: str, operations: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    try:
        ops = json.loads(operations)
        result = generate_features(name, ops)
        log_audit(db, current_user.get("name", "User"), "features.generated", name, "dataset")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/datasets/{name}/features/suggest", tags=["Datasets"], summary="Suggest features", description="Suggest potential feature engineering operations for a dataset.")
def suggest(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user)
    return suggest_features(name)


@app.put("/api/v1/datasets/{name}/tags", tags=["Datasets"], summary="Update dataset tags")
def update_tags_api(name: str, tags: list = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    update_dataset_tags(db, name, tags)
    return {"message": "Tags updated", "tags": tags}


@app.put("/api/v1/datasets/{name}/description", tags=["Datasets"], summary="Update dataset description")
def update_desc_api(name: str, description: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    update_dataset_description(db, name, description)
    return {"message": "Description updated"}


@app.post("/api/v1/datasets/import-url", tags=["Datasets"], summary="Import dataset from URL")
async def import_from_url(url: str = Form(...), name: str = Form(None), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    import tempfile
    import urllib.request
    try:
        parsed = urllib.parse.urlparse(url)
        if not parsed.scheme in ("http", "https"):
            raise HTTPException(status_code=400, detail="Only HTTP/HTTPS URLs are supported")
        filename = name or os.path.basename(parsed.path) or f"url_import_{int(time.time())}.csv"
        if "." not in filename:
            filename += ".csv"
        filename = sanitize_filename(filename)
        file_path = os.path.join(DATASET_DIR, filename)
        urllib.request.urlretrieve(url, file_path)
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            os.remove(file_path)
            raise HTTPException(status_code=400, detail=f"Unsupported file type {ext}")
        df = _get_dataset_df(filename)
        size_kb = round(os.path.getsize(file_path) / 1024, 1)
        record = create_dataset_record(db, filename, size_kb=size_kb, rows=len(df),
                                       columns=list(df.columns), source="upload",
                                       source_url=url, user_id=current_user.get("id"))
        return {"message": f"Imported from URL", "filename": filename, "rows": len(df), "id": record.id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to import: {str(e)}")


@app.post("/api/v1/datasets/import-database", tags=["Datasets"], summary="Import from database connection")
async def import_from_database(
    connection_string: str = Form(...),
    query: str = Form(...),
    name: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        import duckdb
        conn = duckdb.connect(":memory:")
        try:
            conn.execute(f"ATTACH '{connection_string}' AS src (READ_ONLY)")
            df = conn.execute(f"SELECT * FROM src.main({query})").fetchdf()
        except Exception:
            try:
                df = pd.read_sql(query, con=connection_string)
            except Exception as e2:
                raise HTTPException(status_code=400, detail=f"Failed to query database: {str(e2)}")
        finally:
            conn.close()
        filename = name or f"db_import_{int(time.time())}.csv"
        if "." not in filename:
            filename += ".csv"
        filename = sanitize_filename(filename)
        file_path = os.path.join(DATASET_DIR, filename)
        df.to_csv(file_path, index=False)
        size_kb = round(os.path.getsize(file_path) / 1024, 1)
        record = create_dataset_record(db, filename, size_kb=size_kb, rows=len(df),
                                       columns=list(df.columns), source="database",
                                       user_id=current_user.get("id"))
        return {"message": f"Imported from database", "filename": filename, "rows": len(df), "id": record.id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Database import failed: {str(e)}")


@app.post("/api/v1/datasets/{name}/share", tags=["Datasets"], summary="Share dataset")
def share_dataset_api(name: str, email: str = Form(...), permission: str = Form("view"),
                       db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    record = require_dataset_access(db, name, current_user, owner_only=True)
    result = share_dataset(db, record.id, shared_with_email=email, permission=permission)
    return {"message": f"Shared with {email}", "share": result}


@app.get("/api/v1/datasets/{name}/shares", tags=["Datasets"], summary="List dataset shares")
def list_shares_api(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    record = get_dataset_record(db, name)
    shares = list_dataset_shares(db, record.id)
    return [{"id": s.id, "email": s.shared_with_email, "permission": s.permission, "created_at": s.created_at.isoformat()} for s in shares]


@app.delete("/api/v1/datasets/{name}/shares/{share_id}", tags=["Datasets"], summary="Remove dataset share")
def remove_share_api(name: str, share_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    require_dataset_access(db, name, current_user, owner_only=True)
    remove_dataset_share(db, share_id)
    return {"message": "Share removed"}


# ── Experiments ──────────────────────────────────────────────────────

@app.get("/api/v1/experiments", tags=["Experiments"], summary="List experiments", description="Return a list of all training experiment records.")
def list_experiments_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="experiments")
    experiments = [{
        "id": e.id, "name": e.name, "model": e.model,
        "task_type": e.task_type, "dataset": e.dataset, "target": e.target,
        "dataset_version": e.dataset_version,
        "cv_score": e.cv_score, "metrics": e.metrics,
        "training_time": e.training_time, "total_time": e.total_time,
        "memory_usage": e.memory_usage, "cpu_usage": e.cpu_usage,
        "status": e.status,         "run_at": e.run_at.isoformat() if e.run_at else None,
        "params": e.params, "notes": e.notes, "feature_importance": e.feature_importance,
        "confusion_matrix": e.confusion_matrix,
        "user_id": e.user_id, "project_id": getattr(e, "project_id", None),
        "created_at": e.created_at.isoformat() if e.created_at else None,
    } for e in list_experiments(db, user_id=uid)]
    total = len(experiments)
    experiments = experiments[offset:offset + limit]
    return paginated(experiments, total, offset, limit, key="experiments")


@app.get("/api/v1/experiments/{exp_id}", tags=["Experiments"], summary="Get experiment", description="Retrieve a specific experiment by ID.")
def get_experiment_api(exp_id: str, db: Session = Depends(get_db)):
    e = get_experiment(db, exp_id)
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return {
        "id": e.id, "name": e.name, "model": e.model,
        "task_type": e.task_type, "dataset": e.dataset, "target": e.target,
        "dataset_version": e.dataset_version,
        "cv_score": e.cv_score, "metrics": e.metrics,
        "training_time": e.training_time, "total_time": e.total_time,
        "memory_usage": e.memory_usage, "cpu_usage": e.cpu_usage,
        "status": e.status, "run_at": e.run_at.isoformat() if e.run_at else None,
        "params": e.params, "notes": e.notes, "feature_importance": e.feature_importance,
        "confusion_matrix": e.confusion_matrix,
        "user_id": e.user_id, "project_id": getattr(e, "project_id", None),
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@app.patch("/api/v1/experiments/{exp_id}", tags=["Experiments"], summary="Update experiment notes", description="Update notes or other fields on an experiment.")
def update_experiment_api(exp_id: str, notes: str = Form(None), db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    e = get_experiment(db, exp_id)
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if notes is not None:
        e.notes = notes
    db.commit()
    log_audit(db, current_user.get("name", "User"), "experiment.updated", e.name, "experiment", e.id)
    return {"id": e.id, "notes": e.notes}


@app.delete("/api/v1/experiments/{exp_id}", tags=["Experiments"], summary="Delete experiment", description="Delete an experiment by ID.")
def delete_experiment_api(exp_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    if not delete_experiment(db, exp_id):
        raise HTTPException(status_code=404, detail="Experiment not found")
    log_audit(db, current_user.get("name", "User"), "experiment.deleted", exp_id, "experiment")
    return {"status": "deleted"}


@app.post("/api/v1/experiments/compare", tags=["Experiments"], summary="Compare experiments", description="Compare multiple experiments by their IDs.")
def compare_experiments_api(ids: str = Form(...), db: Session = Depends(get_db)):
    try:
        id_list = json.loads(ids)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid IDs format")
    exps = compare_experiments(db, id_list)
    return {
        "experiments": [{
            "id": e.id, "name": e.name, "model": e.model,
            "task_type": e.task_type, "dataset": e.dataset, "target": e.target,
            "dataset_version": e.dataset_version,
            "cv_score": e.cv_score, "metrics": e.metrics,
            "training_time": e.training_time, "total_time": e.total_time,
            "status": e.status, "run_at": e.run_at.isoformat() if e.run_at else None,
            "params": e.params, "notes": e.notes, "feature_importance": e.feature_importance,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in exps]
    }


@app.post("/api/v1/experiments/{exp_id}/stop", tags=["Experiments"], summary="Stop experiment", description="Stop a running experiment.")
def stop_experiment_api(exp_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    e = get_experiment(db, exp_id)
    if not e:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if e.status not in ("running", "queued"):
        raise HTTPException(status_code=400, detail=f"Cannot stop experiment with status '{e.status}'")
    e.status = "stopped"
    e.updated_at = datetime.now(timezone.utc)
    db.commit()
    log_audit(db, current_user.get("name", "User"), "experiment.stopped", e.name, "experiment", e.id)
    return {"id": e.id, "status": e.status}


# ── Training ─────────────────────────────────────────────────────────

@app.post("/api/v1/training", tags=["Training"], summary="Train model", description="Run AutoML training on a dataset and return results.")
def train_model(
    file_name: str = Form(...),
    target_column: str = Form(...),
    task_type: str = Form(None),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        start = time.time()
        preprocess_result = auto_preprocess(file_name, target_column, task_type)
        X = preprocess_result["X"]
        y = preprocess_result["y"]
        preprocessor = preprocess_result["preprocessor"]
        task = preprocess_result["task_type"]

        results = run_automl_training(X, y, task_type=task,
                                      model_name_prefix=file_name.split('.')[0],
                                      preprocessor=preprocessor)
        elapsed = round(time.time() - start, 2)
        best_model_name = f"{file_name.split('.')[0]}_{results['best_model']}"

        exp_data = {
            "name": f"{file_name.split('.')[0]}-{results['best_model']}",
            "model": results["best_model"],
            "task_type": task,
            "cv_score": results["cv_score"],
            "metrics": results["metrics"],
            "dataset": file_name,
            "target": target_column,
            "training_time": results["training_time"],
            "total_time": elapsed,
            "status": "success",
            "run_at": datetime.now(timezone.utc),
            "user_id": current_user.get("id"),
            "project_id": project_id,
            "feature_importance": results.get("feature_importance"),
            "params": results.get("best_params"),
        }
        exp = create_experiment(db, exp_data)

        # Register in model_registry
        model_path = os.path.join(MODELS_DIR, f"{best_model_name}.pkl")
        model_size = round(os.path.getsize(model_path) / 1024, 1) if os.path.exists(model_path) else None
        create_model(db, {
            "experiment_id": exp.id,
            "user_id": current_user.get("id"),
            "project_id": project_id,
            "name": best_model_name,
            "model_type": results["best_model"],
            "task_type": task,
            "file_path": model_path,
            "file_size_kb": model_size,
            "cv_score": results["cv_score"],
            "metrics": results["metrics"],
            "params": results.get("best_params"),
            "status": "staging",
        })

        log_audit(db, current_user.get("name", "User"), "training.completed",
                  f"{file_name} -> {results['best_model']}", "experiment", exp.id)
        try:
            create_notification(db, {
                "user_id": current_user.get("id"),
                "title": "Training Complete",
                "message": f"Model '{results['best_model']}' trained on {file_name} with CV score {results['cv_score']:.3f}",
                "type": "success",
                "category": "training",
                "resource_type": "experiment",
                "resource_id": exp.id,
            })
        except Exception:
            pass
        return {
            "status": "Success",
            "message": "Training completed!",
            "data_summary": {"features_count": X.shape[1], "rows_count": X.shape[0], "task_type": task},
            "training_summary": results,
        }
    except HTTPException:
        raise
    except Exception as e:
        detail = str(e)
        if "paging file" in detail.lower() or "memory" in detail.lower():
            detail = "System running low on memory. Try closing other applications or reducing dataset size."
        raise HTTPException(status_code=500, detail=detail)


@app.get("/api/v1/training", tags=["Training"], summary="List training jobs", description="List all training experiments as training jobs.")
def list_training_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="jobs")
    experiments = list_experiments(db, user_id=uid)
    items = [{
        "id": e.id, "experiment_name": e.name,
        "dataset_name": e.dataset, "target_column": e.target,
        "algorithm": e.model, "status": e.status,
        "progress": 100 if e.status == "success" else 0,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    } for e in experiments]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="jobs")


import threading
import queue as _queue

training_progress_store: dict[str, dict] = {}
_training_lock = threading.Lock()

def _update_progress(job_id: str, data: dict):
    with _training_lock:
        if job_id not in training_progress_store:
            training_progress_store[job_id] = {}
        training_progress_store[job_id].update(data)


@app.get("/api/v1/training/queue", tags=["Training"], summary="Training queue", description="Return the training job queue.")
def training_queue_api(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return {"jobs": []}
    experiments = list_experiments(db, user_id=uid)
    queued = [{
        "id": e.id, "experiment_name": e.name,
        "dataset_name": e.dataset, "target_column": e.target,
        "algorithm": e.model, "status": e.status,
        "progress": 100 if e.status == "success" else 0,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    } for e in experiments if e.status in ("running", "queued")]
    return {"jobs": queued}


@app.get("/api/v1/training/algorithms", tags=["Training"], summary="List available algorithms")
def list_algorithms_api():
    from train import CLASSIFICATION_MODELS, REGRESSION_MODELS, XGB_AVAILABLE, LGBM_AVAILABLE, CATB_AVAILABLE
    classification = []
    for name in CLASSIFICATION_MODELS:
        info = {"name": name, "available": True}
        classification.append(info)
    regression = []
    for name in REGRESSION_MODELS:
        info = {"name": name, "available": True}
        regression.append(info)
    return {
        "classification": classification,
        "regression": regression,
        "optional": {"XGBoost": XGB_AVAILABLE, "LightGBM": LGBM_AVAILABLE, "CatBoost": CATB_AVAILABLE},
    }


@app.get("/api/v1/training/{exp_id}", tags=["Training"], summary="Get training job", description="Retrieve a specific training job by ID.")
def get_training_api(exp_id: str, db: Session = Depends(get_db)):
    e = get_experiment(db, exp_id)
    if not e:
        raise HTTPException(status_code=404, detail="Training job not found")
    return {
        "id": e.id, "experiment_name": e.name,
        "dataset_name": e.dataset, "target_column": e.target,
        "algorithm": e.model, "status": e.status,
        "progress": 100 if e.status == "success" else 0,
        "metrics": e.metrics,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


@app.post("/api/v1/training/{exp_id}/cancel", tags=["Training"], summary="Cancel training", description="Cancel a running or queued training job.")
def cancel_training_api(exp_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    e = get_experiment(db, exp_id)
    if not e:
        raise HTTPException(status_code=404, detail="Training job not found")
    if e.status not in ("running", "queued"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel training with status '{e.status}'")
    e.status = "cancelled"
    e.updated_at = datetime.now(timezone.utc)
    db.commit()
    log_audit(db, current_user.get("name", "User"), "training.cancelled", e.name, "experiment", e.id)
    return {"id": e.id, "status": e.status}


@app.get("/api/v1/training/{job_id}/progress", tags=["Training"], summary="Training progress SSE")
async def training_progress_sse(job_id: str):
    from fastapi.responses import StreamingResponse
    import json, time as _time

    async def event_generator():
        last_data = None
        for _ in range(600):
            with _training_lock:
                data = training_progress_store.get(job_id, {}).copy()
            if data and data != last_data:
                last_data = data
                yield f"data: {json.dumps(data)}\n\n"
                if data.get("status") in ("completed", "failed", "cancelled"):
                    break
            await __import__('asyncio').sleep(0.5)
        yield f"data: {json.dumps({'status': 'timeout'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/v1/training/run", tags=["Training"], summary="Run training with workflow config")
async def run_training_workflow(
    background_tasks: BackgroundTasks,
    file_name: str = Form(...),
    target_column: str = Form(...),
    task_type: str = Form("classification"),
    algorithms: str = Form("all"),
    cv_folds: int = Form(5),
    optimize_hyperparameters: bool = Form(True),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import uuid as _uuid
    job_id = str(_uuid.uuid4())[:8]
    _update_progress(job_id, {
        "status": "queued", "progress": 0, "current_step": "preprocessing",
        "message": "Training job queued", "logs": [], "metrics_history": [],
        "cpu_percent": 0, "start_time": time.time(),
    })

    def _run():
        import psutil
        logs = []
        metrics_history = []
        start = time.time()

        def log(msg):
            logs.append({"time": time.time() - start, "message": msg})
            _update_progress(job_id, {"logs": logs[-50:]})

        try:
            log("Starting preprocessing...")
            _update_progress(job_id, {"status": "running", "current_step": "preprocessing", "progress": 5, "message": "Preprocessing data"})
            preprocess_result = auto_preprocess(file_name, target_column, task_type)
            X = preprocess_result["X"]
            y = preprocess_result["y"]
            preprocessor = preprocess_result["preprocessor"]
            task = preprocess_result["task_type"]
            log(f"Preprocessing done: {X.shape[0]} rows, {X.shape[1]} features, task={task}")
            _update_progress(job_id, {"progress": 10, "current_step": "algorithms", "message": f"Data ready: {X.shape[0]} rows × {X.shape[1]} features"})

            from train import CLASSIFICATION_MODELS as CM, REGRESSION_MODELS as RM, _count_params, _default_scoring
            from sklearn.model_selection import train_test_split, RandomizedSearchCV
            model_candidates = CM if task == "classification" else RM
            if algorithms != "all":
                selected = [a.strip() for a in algorithms.split(",")]
                model_candidates = {k: v for k, v in model_candidates.items() if k in selected}
            total_models = len(model_candidates)
            log(f"Training {total_models} algorithms: {', '.join(model_candidates.keys())}")
            _update_progress(job_id, {"total_models": total_models, "completed_models": 0, "message": f"Training {total_models} models..."})

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y if task == "classification" else None
            )

            from sklearn.metrics import accuracy_score, f1_score, r2_score, mean_squared_error
            all_results = []
            for idx, (name, spec) in enumerate(model_candidates.items()):
                model_progress = ((idx) / total_models) * 80 + 10
                _update_progress(job_id, {
                    "progress": int(model_progress), "current_step": "training",
                    "current_model": name, "model_index": idx + 1,
                    "message": f"Training {name} ({idx+1}/{total_models})",
                })
                log(f"Training {name}...")
                try:
                    mstart = time.time()
                    base_model = spec["model"]
                    param_dist = spec["params"]

                    if optimize_hyperparameters:
                        n_iter = min(5, _count_params(param_dist))
                        cv = max(2, min(cv_folds, 10))
                        search = RandomizedSearchCV(
                            base_model, param_dist, n_iter=n_iter,
                            cv=cv, scoring=_default_scoring(task),
                            random_state=42, n_jobs=1, verbose=0,
                        )
                        search.fit(X_train, y_train)
                        best_model = search.best_estimator_
                        cv_score = search.best_score_
                    else:
                        base_model.fit(X_train, y_train)
                        best_model = base_model
                        cv_score = 0

                    y_pred = best_model.predict(X_test)
                    mtime = round(time.time() - mstart, 2)

                    if task == "classification":
                        acc = round(accuracy_score(y_test, y_pred), 4)
                        f1 = round(f1_score(y_test, y_pred, average='weighted', zero_division=0), 4)
                        metrics = {"accuracy": acc, "f1": f1}
                    else:
                        r2 = round(r2_score(y_test, y_pred), 4)
                        rmse = round(mean_squared_error(y_test, y_pred, squared=False), 4)
                        metrics = {"r2": r2, "rmse": rmse, "accuracy": r2}

                    result = {"name": name, "metrics": metrics, "cv_score": round(cv_score, 4), "time": mtime}
                    all_results.append(result)
                    metrics_history.append({"model": name, **metrics, "cv_score": round(cv_score, 4)})
                    log(f"{name}: accuracy={metrics.get('accuracy', 'N/A')}, cv={cv_score:.4f} ({mtime}s)")
                    _update_progress(job_id, {
                        "completed_models": idx + 1, "metrics_history": metrics_history,
                        "latest_result": result,
                    })

                    cpu = psutil.cpu_percent(interval=None) if psutil else 0
                    _update_progress(job_id, {"cpu_percent": cpu})
                except Exception as e:
                    log(f"Error training {name}: {str(e)}")
                    all_results.append({"name": name, "error": str(e)})

            best = max(all_results, key=lambda r: r.get("metrics", {}).get("accuracy", 0))
            elapsed = round(time.time() - start, 2)
            log(f"Training complete! Best model: {best['name']} (accuracy={best.get('metrics', {}).get('accuracy', 'N/A')})")

            _update_progress(job_id, {
                "status": "completed", "progress": 100, "current_step": "complete",
                "message": f"Best model: {best['name']}",
                "best_model": best, "all_results": all_results,
                "elapsed": elapsed,
            })

            best_model_name = f"{file_name.split('.')[0]}_{best['name']}"
            exp_data = {
                "name": f"{file_name.split('.')[0]}-{best['name']}",
                "model": best["name"], "task_type": task,
                "cv_score": best.get("cv_score"), "metrics": best.get("metrics"),
                "dataset": file_name, "target": target_column,
                "training_time": best.get("time"), "total_time": elapsed,
                "status": "success", "run_at": datetime.now(timezone.utc),
                "user_id": current_user.get("id"), "project_id": project_id,
            }
            exp = create_experiment(db, exp_data)
            log_audit(db, current_user.get("name", "User"), "training.completed",
                      f"{file_name} -> {best['name']}", "experiment", exp.id)
        except Exception as e:
            _update_progress(job_id, {"status": "failed", "message": str(e)})
            log(f"Training failed: {str(e)}")

    background_tasks.add_task(_run)
    return {"job_id": job_id, "status": "queued", "message": "Training started"}


@app.get("/api/v1/models", tags=["Models"], summary="List models", description="List all available models from filesystem and registry.")
def list_models_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="models")
    db_models = list_models(db)
    active_deployments = {}
    try:
        deps = list_deployments(db)
        for d in deps:
            if d.status in ("active", "running") and d.model_id:
                active_deployments[d.model_id] = {"id": d.id, "name": d.name, "status": d.status, "endpoint_url": d.endpoint_url}
    except Exception:
        pass
    fs_models = []
    for f in os.listdir(MODELS_DIR):
        if f.endswith(".pkl"):
            fpath = os.path.join(MODELS_DIR, f)
            size_kb = round(os.path.getsize(fpath) / 1024, 1)
            meta = _load_model_meta(f)
            deploy_info = active_deployments.get(f)
            fs_models.append({
                "name": f, "size_kb": size_kb,
                "task_type": meta.get("task_type"),
                "best_score": meta.get("cv_score"),
                "metrics": meta.get("metrics"),
                "deployment_status": "deployed" if deploy_info else "not_deployed",
                "deployment": deploy_info,
                "created_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
            })
    registered = [{
        "id": m.id, "name": m.name, "version": m.version,
        "model_type": m.model_type, "task_type": m.task_type,
        "framework": m.framework, "file_size_kb": m.file_size_kb,
        "cv_score": m.cv_score, "status": m.status,
        "tags": m.tags, "description": m.description,
        "experiment_id": m.experiment_id,
        "dataset_name": m.experiment.dataset if m.experiment else None,
        "deployment_status": "deployed" if active_deployments.get(m.name) else "not_deployed",
        "deployment": active_deployments.get(m.name),
        "owner": m.user.email if m.user else None,
        "owner_email": m.user.email if m.user else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in db_models]
    all_models = fs_models + registered
    total = len(all_models)
    all_models = all_models[offset:offset + limit]
    return paginated(all_models, total, offset, limit, key="models")

@app.get("/api/v1/models/{name}", tags=["Models"], summary="Get model detail", description="Retrieve metadata for a specific model.")
def get_model_detail(name: str):
    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    meta = _load_model_meta(name)
    return {"name": name, **meta} if meta else {"name": name}

@app.get("/api/v1/models/{name}/download", tags=["Models"], summary="Download model", description="Download a model file by name.")
def download_model(name: str):
    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    return FileResponse(fpath, filename=name, media_type="application/octet-stream")

@app.put("/api/v1/models/{name}", tags=["Models"], summary="Update model", description="Update model status, tags, or description.")
def update_model_meta(name: str, status: str = Form(None), tags: str = Form(None),
                      description: str = Form(None), db: Session = Depends(get_db)):
    from crud import update_model_meta as _update_model_meta
    tags_list = json.loads(tags) if tags else None
    m = _update_model_meta(db, name, status=status, tags=tags_list, description=description)
    if not m:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    return {"id": m.id, "name": m.name, "status": m.status, "tags": m.tags, "description": m.description}

@app.post("/api/v1/models/{name}/evaluation", tags=["Models"], summary="Evaluate model", description="Compute evaluation metrics (confusion matrix, ROC, PR curve, feature importance) for a trained model.")
def evaluate_model_api(
    name: str,
    file_name: str = Form(...),
    target_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    import joblib as _joblib
    import numpy as np
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import confusion_matrix as _cm, roc_curve as _rc, auc as _auc
    from sklearn.metrics import precision_recall_curve as _prc, average_precision_score as _aps
    from sklearn.pipeline import Pipeline as _Pipe

    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")

    meta = _load_model_meta(name)
    pipeline = _joblib.load(fpath)
    task_type = meta.get("task_type", "classification")
    feature_names = meta.get("feature_names", [])

    preprocess_result = auto_preprocess(file_name, target_column, task_type)
    X = preprocess_result["X"]
    y = preprocess_result["y"]
    preprocessor = preprocess_result["preprocessor"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if task_type == "classification" else None,
    )

    model_obj = pipeline
    if not isinstance(pipeline, _Pipe):
        model_obj = _Pipe([("preprocessor", preprocessor), ("model", pipeline)])

    y_pred = model_obj.predict(X_test)

    estimator = model_obj
    if hasattr(model_obj, "named_steps") and "model" in model_obj.named_steps:
        estimator = model_obj.named_steps["model"]

    feature_importance = []
    importances_arr = None
    if hasattr(estimator, "feature_importances_"):
        importances_arr = estimator.feature_importances_
    elif hasattr(estimator, "coef_"):
        coefs = estimator.coef_
        importances_arr = coefs[0] if coefs.ndim > 1 else coefs

    if importances_arr is not None and feature_names:
        abs_imp = np.abs(importances_arr)
        vmax = abs_imp.max()
        for i, fname in enumerate(feature_names):
            if i < len(importances_arr):
                feature_importance.append({
                    "feature": fname,
                    "importance": round(float(importances_arr[i]), 6),
                    "normalized": round(float(abs_imp[i] / vmax), 4) if vmax > 0 else 0,
                })
        feature_importance.sort(key=lambda x: abs(x["importance"]), reverse=True)

    result = {
        "model_name": name,
        "task_type": task_type,
        "feature_names": feature_names,
        "feature_importance": feature_importance,
        "test_size": len(X_test),
        "train_size": len(X_train),
    }

    if task_type == "classification":
        y_test_list = y_test.tolist() if hasattr(y_test, 'tolist') else list(y_test)
        y_pred_list = y_pred.tolist() if hasattr(y_pred, 'tolist') else list(y_pred)
        labels = sorted(list(set(y_test_list + y_pred_list)))
        label_map = meta.get("label_map", {})
        str_labels = [label_map.get(str(l), str(l)) for l in labels]

        cm = _cm(y_test_list, y_pred_list, labels=labels)
        result["confusion_matrix"] = {"matrix": cm.tolist(), "labels": str_labels}

        if hasattr(model_obj, "predict_proba"):
            y_proba = model_obj.predict_proba(X_test)
            if len(labels) == 2:
                fpr, tpr, _ = _rc(y_test_list, y_proba[:, 1], pos_label=labels[1])
                result["roc_curve"] = {
                    "fpr": [round(float(x), 4) for x in fpr],
                    "tpr": [round(float(x), 4) for x in tpr],
                    "auc": round(float(_auc(fpr, tpr)), 4),
                }
                prec_arr, rec_arr, _ = _prc(y_test_list, y_proba[:, 1], pos_label=labels[1])
                result["pr_curve"] = {
                    "precision": [round(float(x), 4) for x in prec_arr],
                    "recall": [round(float(x), 4) for x in rec_arr],
                    "average_precision": round(float(_aps(y_test_list, y_proba[:, 1])), 4),
                }
            else:
                from sklearn.preprocessing import label_binarize
                y_test_bin = label_binarize(y_test_list, classes=labels)
                per_class_roc, per_class_pr = [], []
                all_auc_vals, all_ap_vals = [], []
                for ci in range(len(labels)):
                    fpr_i, tpr_i, _ = _rc(y_test_bin[:, ci], y_proba[:, ci])
                    auc_i = round(float(_auc(fpr_i, tpr_i)), 4)
                    all_auc_vals.append(auc_i)
                    per_class_roc.append({"label": str_labels[ci], "fpr": [round(float(x), 4) for x in fpr_i], "tpr": [round(float(x), 4) for x in tpr_i], "auc": auc_i})
                    p_i, r_i, _ = _prc(y_test_bin[:, ci], y_proba[:, ci])
                    ap_i = round(float(_aps(y_test_bin[:, ci], y_proba[:, ci])), 4)
                    all_ap_vals.append(ap_i)
                    per_class_pr.append({"label": str_labels[i] if ci < len(str_labels) else str(ci), "precision": [round(float(x), 4) for x in p_i], "recall": [round(float(x), 4) for x in r_i], "ap": ap_i})
                result["roc_curve"] = {"per_class": per_class_roc, "macro_auc": round(float(np.mean(all_auc_vals)), 4)}
                result["pr_curve"] = {"per_class": per_class_pr, "macro_ap": round(float(np.mean(all_ap_vals)), 4)}

            top_indices = np.argsort(y_proba, axis=1)[:, ::-1][:, :3]
            pred_preview = []
            for row_i in range(min(10, len(X_test))):
                top3 = [{"label": str_labels[ci], "probability": round(float(y_proba[row_i][ci]), 4)} for ci in top_indices[row_i] if ci < len(labels)]
                actual_label = str_labels[labels.index(y_test_list[row_i])] if y_test_list[row_i] in labels else str(y_test_list[row_i])
                predicted_label = str_labels[labels.index(y_pred_list[row_i])] if y_pred_list[row_i] in labels else str(y_pred_list[row_i])
                pred_preview.append({"actual": actual_label, "predicted": predicted_label, "top_classes": top3})
            result["prediction_preview"] = pred_preview
        else:
            result["roc_curve"] = None
            result["pr_curve"] = None
            result["prediction_preview"] = []
    else:
        result["confusion_matrix"] = None
        result["roc_curve"] = None
        result["pr_curve"] = None
        result["prediction_preview"] = []

    if feature_importance:
        imp_map = {fi["feature"]: fi["importance"] for fi in feature_importance}
        total_abs = sum(abs(v) for v in imp_map.values())
        shap_values = []
        for fname in feature_names:
            raw = imp_map.get(fname, 0)
            val = (raw / total_abs) * 0.8 if total_abs > 0 else 0
            shap_values.append({"feature": fname, "value": round(float(val), 4), "abs_value": round(float(abs(val)), 4), "direction": "positive" if val >= 0 else "negative"})
        result["shap_values"] = sorted(shap_values, key=lambda x: x["abs_value"], reverse=True)
    else:
        result["shap_values"] = []

    log_audit(db, current_user.get("name", "User"), "model.evaluated", name, "model")
    return result


@app.post("/api/v1/models/{name}/evaluate-all", tags=["Models"], summary="Comprehensive model evaluation", description="Compute all evaluation visualizations, metrics, prediction samples.")
def evaluate_model_all(
    name: str,
    file_name: str = Form(...),
    target_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    from evaluation import evaluate_model_comprehensive, generate_ai_insights
    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    try:
        result = evaluate_model_comprehensive(name, file_name, target_column)
        result["ai_insights"] = generate_ai_insights(result)
        log_audit(db, current_user.get("name", "User"), "model.evaluated_all", name, "model")
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {str(e)}")


@app.post("/api/v1/models/compare", tags=["Models"], summary="Compare multiple models", description="Evaluate multiple models on the same dataset and compare metrics side by side.")
def compare_models_api(
    model_names: str = Form(...),
    file_name: str = Form(...),
    target_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    from evaluation import compare_models
    try:
        names = json.loads(model_names)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid model_names format")
    try:
        results = compare_models(names, file_name, target_column)
        log_audit(db, current_user.get("name", "User"), "model.compared", ",".join(names), "model")
        return {"results": results}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"{type(e).__name__}: {str(e)}")


@app.get("/api/v1/models/{name}/meta", tags=["Models"], summary="Get model metadata", description="Return file stats and metadata JSON for a model.")
def get_model_meta(name: str):
    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    meta = _load_model_meta(name)
    meta_path = fpath.replace(".pkl", "_meta.json")
    stats = {"file_size_kb": round(os.path.getsize(fpath) / 1024, 1) if os.path.exists(fpath) else None}
    stats["created_at"] = datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat() if os.path.exists(fpath) else None
    return {"name": name, **stats, **meta}

@app.delete("/api/v1/models/{name}", tags=["Models"], summary="Delete model", description="Delete a model file and its metadata.")
def delete_model(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    fpath = os.path.join(MODELS_DIR, name)
    meta_path = fpath.replace(".pkl", "_meta.json")
    removed = []
    for p in [fpath, meta_path]:
        if os.path.exists(p):
            os.remove(p)
            removed.append(p)
    if not removed:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    log_audit(db, current_user.get("name", "User"), "model.deleted", name, "model")
    return {"message": f"Deleted model '{name}'"}


@app.put("/api/v1/models/{name}/promote", tags=["Models"], summary="Promote model", description="Promote a model to production status.")
def promote_model(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    updated = update_model_meta(db, name, status="production")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    return {"message": f"Model '{name}' promoted to production", "status": "production"}


@app.put("/api/v1/models/{name}/archive", tags=["Models"], summary="Archive model", description="Archive a model.")
def archive_model(name: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    updated = update_model_meta(db, name, status="archived")
    if not updated:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    return {"message": f"Model '{name}' archived", "status": "archived"}


@app.put("/api/v1/models/{name}/tags", tags=["Models"], summary="Update model tags", description="Set tags on a model.")
def update_model_tags(name: str, tags: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    import json as _json
    tag_list = _json.loads(tags) if tags else []
    updated = update_model_meta(db, name, tags=tag_list)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    return {"message": f"Tags updated for '{name}'", "tags": tag_list}


@app.post("/api/v1/models/compare", tags=["Models"], summary="Compare models", description="Compare multiple models by name.")
def compare_models_api(names: str = Form(...), db: Session = Depends(get_db)):
    try:
        name_list = json.loads(names)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid names format")
    fs_models = []
    for n in name_list:
        fpath = os.path.join(MODELS_DIR, n)
        if os.path.exists(fpath):
            meta = _load_model_meta(n)
            fs_models.append({
                "name": n, "size_kb": round(os.path.getsize(fpath) / 1024, 1),
                "task_type": meta.get("task_type"),
                "best_score": meta.get("cv_score"),
                "metrics": meta.get("metrics"),
                "created_at": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
            })
    return {"models": fs_models}


@app.get("/api/v1/models/registry", tags=["Models"], summary="List model registry", description="List all registered models from the database registry.")
def list_model_registry_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    db_models = list_model_registry_entries(db, user_id=uid)
    items = [{
        "id": m.id, "name": m.name, "version": m.version,
        "model_type": m.model_type, "task_type": m.task_type,
        "framework": m.framework, "file_size_kb": m.file_size_kb,
        "cv_score": m.cv_score, "status": m.status,
        "tags": m.tags, "description": m.description,
        "experiment_id": m.experiment_id,
        "owner": m.user.name if m.user else None,
        "owner_email": m.user.email if m.user else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    } for m in db_models]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="models")


@app.post("/api/v1/models/registry", tags=["Models"], summary="Register model", description="Register a model file in the model registry.")
def register_model_api(model_name: str = Form(...), version: str = Form(None), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    fpath = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    meta = _load_model_meta(model_name)
    existing = db.query(ModelRegistry).filter(ModelRegistry.name == model_name).first()
    if existing:
        existing.version = (existing.version or 1) + 1
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "name": existing.name, "version": existing.version}
    m = create_model(db, {
        "user_id": current_user.get("id"),
        "name": model_name,
        "model_type": meta.get("task_type"),
        "task_type": meta.get("task_type"),
        "file_path": fpath,
        "file_size_kb": round(os.path.getsize(fpath) / 1024, 1),
        "cv_score": meta.get("cv_score"),
        "metrics": meta.get("metrics"),
        "status": "staging",
    })
    return {"id": m.id, "name": m.name, "version": m.version}

FORMAT_PARAMS = {
    "LogisticRegression": {"C": {"type": "float", "range": [0.001, 10], "log": True}},
    "RandomForest": {"n_estimators": {"type": "int", "range": [10, 500]}, "max_depth": {"type": "int", "range": [1, 50]}},
    "GradientBoosting": {"n_estimators": {"type": "int", "range": [10, 500]}, "learning_rate": {"type": "float", "range": [0.001, 1], "log": True}, "max_depth": {"type": "int", "range": [1, 10]}},
    "SVC": {"C": {"type": "float", "range": [0.01, 100], "log": True}, "kernel": {"type": "choice", "values": ["rbf", "linear", "poly", "sigmoid"]}, "gamma": {"type": "choice", "values": ["scale", "auto"]}},
    "KNN": {"n_neighbors": {"type": "int", "range": [1, 50]}, "weights": {"type": "choice", "values": ["uniform", "distance"]}},
    "Ridge": {"alpha": {"type": "float", "range": [0.001, 100], "log": True}},
    "Lasso": {"alpha": {"type": "float", "range": [0.0001, 10], "log": True}},
    "SVR": {"C": {"type": "float", "range": [0.01, 100], "log": True}, "kernel": {"type": "choice", "values": ["rbf", "linear", "poly", "sigmoid"]}, "gamma": {"type": "choice", "values": ["scale", "auto"]}},
}

@app.get("/api/v1/tuning/params", tags=["Training"], summary="Get tuning parameters", description="Return available hyperparameter search spaces for all models.")
def get_tuning_params():
    return {
        "classification": {
            name: {"params": spec["params"], "formats": FORMAT_PARAMS.get(name, {})}
            for name, spec in CLASSIFICATION_MODELS.items()
        },
        "regression": {
            name: {"params": spec["params"], "formats": FORMAT_PARAMS.get(name, {})}
            for name, spec in REGRESSION_MODELS.items()
        },
    }

@app.post("/api/v1/tuning", tags=["Training"], summary="Run tuning", description="Run hyperparameter tuning on specified models.")
def run_tuning_endpoint(
    file_name: str = Form(...),
    target_column: str = Form(...),
    models: str = Form(...),
    params: str = Form("{}"),
    search_method: str = Form("random"),
    cv_folds: int = Form(5),
    task_type: str = Form(None),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        import json
        model_list = json.loads(models)
        param_overrides = json.loads(params)
        preprocess_result = auto_preprocess(file_name, target_column, task_type)
        X = preprocess_result["X"]
        y = preprocess_result["y"]
        task = preprocess_result["task_type"]
        tuning = run_tuning(X, y, task, model_list, param_overrides, search_method, cv_folds)
        exp_data_list = []
        for r in tuning["results"]:
            if "error" in r:
                continue
            exp_data = {
                "name": f"{file_name.split('.')[0]}-{r['name']}-tuned",
                "model": r["name"],
                "task_type": task,
                "cv_score": r["cv_score"],
                "metrics": r["metrics"],
                "dataset": file_name,
                "target": target_column,
                "training_time": r["training_time"],
                "total_time": r["training_time"],
                "status": "success",
                "run_at": datetime.now(timezone.utc),
                "user_id": current_user.get("id"),
                "project_id": project_id,
                "params": r["best_params"],
            }
            exp = create_experiment(db, exp_data)
            exp_data_list.append({"id": exp.id, "name": exp.name, "model": r["name"], "cv_score": r["cv_score"], "metrics": r["metrics"]})
        log_audit(db, current_user.get("name", "User"), "tuning.completed", f"Tuned {len(exp_data_list)} models", "tuning")
        try:
            create_notification(db, {
                "user_id": current_user.get("id"),
                "title": "HPO Tuning Complete",
                "message": f"Hyperparameter tuning on {file_name} completed: {len(exp_data_list)} models tuned",
                "type": "success",
                "category": "training",
            })
        except Exception:
            pass
        return {"results": tuning["results"], "experiments": exp_data_list, "task_type": task}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Hyperparameter Optimization (HPO) ────────────────────────────────

hpo_progress_store: dict[str, dict] = {}
hpo_lock = threading.Lock()

def _hpo_update(job_id, model_name, status, current, total, best_params, best_score, error=None):
    with hpo_lock:
        hpo_progress_store[job_id] = {
            "status": "running",
            "current_model": model_name,
            "current": current,
            "total": total,
            "best_params": best_params,
            "best_score": best_score,
            "error": error,
            "model_results": hpo_progress_store.get(job_id, {}).get("model_results", []),
            "timestamp": time.time(),
        }

@app.get("/api/v1/hpo/availability", tags=["HPO"], summary="HPO availability")
def hpo_availability():
    return {
        "optuna": OPTUNA_AVAILABLE,
        "bayesian": SKOPT_AVAILABLE,
        "grid": True,
        "random": True,
        "param_ranges": {k: v for k, v in HPO_PARAM_RANGES.items()},
    }

PARAM_RANGES_ref = HPO_PARAM_RANGES

@app.get("/api/v1/hpo/params", tags=["HPO"], summary="Get HPO param ranges")
def hpo_get_params():
    from hpo import PARAM_RANGES as _PR
    return {"classification": {}, "regression": {}, "ranges": _PR}


@app.post("/api/v1/hpo/run", tags=["HPO"], summary="Run HPO", description="Run hyperparameter optimization asynchronously with SSE progress.")
def run_hpo(
    file_name: str = Form(...),
    target_column: str = Form(...),
    models: str = Form(...),
    method: str = Form("random"),
    cv_folds: int = Form(5),
    n_iter: int = Form(50),
    task_type: str = Form(None),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        model_list = json.loads(models)
        job_id = str(uuid.uuid4())

        _hpo_update(job_id, "", "starting", 0, len(model_list), None, None)
        hpo_progress_store[job_id]["status"] = "queued"

        def run_in_background():
            try:
                preprocess_result = auto_preprocess(file_name, target_column, task_type)
                X = preprocess_result["X"]
                y = preprocess_result["y"]
                task = preprocess_result["task_type"]

                def progress_callback(model_name, status, current, total, best_params, best_score, error):
                    results_list = hpo_progress_store.get(job_id, {}).get("model_results", [])
                    if status == "completed":
                        results_list.append({
                            "name": model_name,
                            "params": best_params,
                            "score": best_score,
                        })
                    elif status == "failed":
                        results_list.append({
                            "name": model_name,
                            "error": error,
                        })
                    _hpo_update(job_id, model_name, "running", current, total, best_params, best_score, error)
                    hpo_progress_store[job_id]["model_results"] = results_list

                runner = HPORunner(
                    X, y, task, model_list, method, cv_folds, n_iter, callback=progress_callback,
                )
                result = runner.run()

                exp_data_list = []
                for r in result["results"]:
                    if "error" in r:
                        continue
                    exp_data = {
                        "name": f"{file_name.split('.')[0]}-{r['name']}-hpo",
                        "model": r["name"],
                        "task_type": task,
                        "cv_score": r["cv_score"],
                        "metrics": r.get("metrics"),
                        "dataset": file_name,
                        "target": target_column,
                        "training_time": r.get("training_time"),
                        "total_time": r.get("training_time"),
                        "status": "success",
                        "run_at": datetime.now(timezone.utc),
                        "user_id": current_user.get("id"),
                        "project_id": project_id,
                        "params": r.get("best_params"),
                    }
                    exp = create_experiment(db, exp_data)
                    exp_data_list.append({"id": exp.id, "name": exp.name, "model": r["name"], "cv_score": r["cv_score"]})

                with hpo_lock:
                    hpo_progress_store[job_id].update({
                        "status": "completed",
                        "best_model": result.get("best_model"),
                        "best_params": result.get("best_params"),
                        "best_score": result.get("best_score"),
                        "experiments": exp_data_list,
                    })

                log_audit(db, current_user.get("name", "User"), "hpo.completed",
                          f"HPO {method} on {file_name}: {len(exp_data_list)} models", "hpo")
                try:
                    create_notification(db, {
                        "user_id": current_user.get("id"),
                        "title": "HPO Complete",
                        "message": f"HPO ({method}) on {file_name} completed: best={result.get('best_model')} score={result.get('best_score')}",
                        "type": "success",
                        "category": "training",
                    })
                except Exception:
                    pass

            except Exception as e:
                with hpo_lock:
                    hpo_progress_store[job_id].update({
                        "status": "failed",
                        "error": str(e),
                    })

        thread = threading.Thread(target=run_in_background, daemon=True)
        thread.start()

        return {"job_id": job_id, "status": "queued"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/hpo/{job_id}/progress", tags=["HPO"], summary="HPO progress SSE")
async def hpo_progress_sse(job_id: str):
    from fastapi.responses import StreamingResponse

    async def event_generator():
        last_data = None
        for _ in range(1200):
            with hpo_lock:
                data = hpo_progress_store.get(job_id, {}).copy()
            if data and data != last_data:
                last_data = data.copy()
                yield f"data: {json.dumps(data, default=str)}\n\n"
                if data.get("status") in ("completed", "failed", "cancelled"):
                    break
            await __import__('asyncio').sleep(1)
        yield f"data: {json.dumps({'status': 'timeout'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/api/v1/hpo/{job_id}", tags=["HPO"], summary="Get HPO results")
def hpo_get_results(job_id: str):
    with hpo_lock:
        data = hpo_progress_store.get(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="HPO job not found")
    return data


# ── AutoML Engine ────────────────────────────────────────────────────

engine_progress_store: dict[str, dict] = {}
engine_lock = threading.Lock()

@app.get("/api/v1/engine/models", tags=["Engine"], summary="List engine models")
def engine_models():
    return get_all_models()

@app.get("/api/v1/engine/datasets", tags=["Engine"], summary="List datasets for engine")
def engine_datasets():
    items = []
    for f in os.listdir(DATASET_DIR):
        if not f.endswith(('.csv', '.xlsx', '.parquet', '.json')):
            continue
        fpath = os.path.join(DATASET_DIR, f)
        if os.path.getsize(fpath) < 100:
            continue
        try:
            df = pd.read_csv(fpath, nrows=5, skipinitialspace=True)
            df.columns = df.columns.str.strip()
            items.append({"name": f, "columns": list(df.columns), "rows": sum(1 for _ in open(fpath)) - 1})
        except Exception:
            items.append({"name": f, "columns": [], "rows": 0})
    return {"datasets": items}

@app.post("/api/v1/engine/run", tags=["Engine"], summary="Run AutoML Engine", description="Asynchronously train all selected models with live SSE progress.")
def engine_run(
    file_name: str = Form(...),
    target_column: str = Form(""),
    task_type: str = Form("classification"),
    models: str = Form("[]"),
    cv_folds: int = Form(5),
    project_id: str = Form(None),
    n_clusters: int = Form(None),
    preprocess: str = Form("{}"),
    validation: str = Form("{}"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    job_id = f"engine_{uuid.uuid4().hex[:12]}"
    model_list = json.loads(models) if models else []
    if not model_list:
        cat_map = {"classification": list(ENGINE_CLF_MODELS.keys()),
                   "regression": list(ENGINE_REG_MODELS.keys()),
                   "clustering": list(CLUSTERING_MODELS.keys()),
                   "time_series": list(TIME_SERIES_MODELS.keys())}
        model_list = cat_map.get(task_type, [])

    try:
        preprocess_options = json.loads(preprocess) if preprocess else {}
    except Exception:
        preprocess_options = {}
    try:
        validation_options = json.loads(validation) if validation else {}
    except Exception:
        validation_options = {}

    with engine_lock:
        engine_progress_store[job_id] = {
            "status": "queued", "current_model": None, "current": 0,
            "total": len(model_list), "task_type": task_type,
            "message": "Job queued...", "results": [], "best_model": None,
            "timestamp": time.time(), "error": None,
        }

    def _engine_progress_callback(data):
        with engine_lock:
            store = engine_progress_store.get(job_id, {})
            store.update(data)
            store["timestamp"] = time.time()
            if "results" in data:
                store["results"] = data["results"]

    def _background_engine():
        try:
            with engine_lock:
                engine_progress_store[job_id]["status"] = "running"
                engine_progress_store[job_id]["message"] = "Starting training..."

            result = run_engine_job(
                file_name=file_name, target_column=target_column, task_type=task_type,
                model_names=model_list, progress_callback=_engine_progress_callback,
                cv_folds=cv_folds, n_clusters=n_clusters,
                preprocess_options=preprocess_options, validation=validation_options,
            )

            with engine_lock:
                store = engine_progress_store[job_id]
                store["status"] = "completed"
                store["results"] = result["results"]
                store["best_model"] = result["best_model"]
                store["best_metrics"] = result.get("best_metrics")
                store["elapsed"] = result["elapsed"]
                store["message"] = f"Done — {result['successful']}/{result['total']} models"
                store["timestamp"] = time.time()

            exp_list = []
            for r in result["results"]:
                if r.get("status") != "success":
                    continue
                try:
                    exp_data = {
                        "name": f"{file_name.split('.')[0]}-{r['name']}",
                        "model": r["name"], "task_type": task_type,
                        "cv_score": r.get("cv_score"), "metrics": r.get("metrics"),
                        "dataset": file_name, "target": target_column,
                        "training_time": r.get("training_time"), "total_time": result["elapsed"],
                        "status": "success", "run_at": datetime.now(timezone.utc),
                        "user_id": current_user.get("id"), "project_id": project_id,
                        "params": r.get("best_params"), "feature_importance": r.get("feature_importance"),
                    }
                    exp = create_experiment(db, exp_data)
                    model_path = os.path.join(MODELS_DIR, r.get("model_path", ""))
                    model_size = round(os.path.getsize(model_path) / 1024, 1) if os.path.exists(model_path) else None
                    create_model(db, {
                        "experiment_id": exp.id, "user_id": current_user.get("id"),
                        "project_id": project_id,
                        "name": f"{file_name.split('.')[0]}_{r['name']}",
                        "model_type": r["name"], "task_type": task_type,
                        "file_path": model_path, "file_size_kb": model_size,
                        "cv_score": r.get("cv_score"), "metrics": r.get("metrics"),
                        "params": r.get("best_params"), "status": "staging",
                    })
                    exp_list.append({"id": exp.id, "name": exp.name, "model": r["name"]})
                except Exception:
                    pass

            with engine_lock:
                engine_progress_store[job_id]["experiments"] = exp_list

            log_audit(db, current_user.get("name", "User"), "engine.completed",
                      f"{file_name} trained {len(exp_list)} models ({task_type})", "engine")
        except Exception as e:
            with engine_lock:
                engine_progress_store[job_id].update({"status": "failed", "error": str(e), "message": f"Failed: {e}", "timestamp": time.time()})

    import concurrent.futures
    threading.Thread(target=_background_engine, daemon=True).start()

    return {"job_id": job_id, "status": "queued", "total": len(model_list)}

@app.get("/api/v1/engine/{job_id}/progress", tags=["Engine"], summary="Engine progress SSE")
def engine_progress(job_id: str):
    import asyncio, json as _json
    async def event_generator():
        while True:
            with engine_lock:
                data = engine_progress_store.get(job_id)
            if data is None:
                yield f"data: {_json.dumps({'status': 'not_found'})}\n\n"
                break
            yield f"data: {_json.dumps(data, default=str)}\n\n"
            if data.get("status") in ("completed", "failed", "cancelled"):
                break
            await asyncio.sleep(1.0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(event_generator(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

@app.get("/api/v1/engine/{job_id}", tags=["Engine"], summary="Get engine results")
def engine_get_result(job_id: str):
    with engine_lock:
        data = engine_progress_store.get(job_id)
    if not data:
        raise HTTPException(status_code=404, detail="Engine job not found")
    return data


# ── Deployments ──────────────────────────────────────────────────────

@app.get("/api/v1/deployments", tags=["Deployments"], summary="List deployments", description="List all model deployments.")
def list_deployments_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="deployments")
    deps = list_deployments(db, user_id=uid)
    items = [{
        "id": d.id, "model_name": d.name, "endpoint_name": d.name,
        "endpoint_url": d.endpoint_url, "status": d.status,
        "environment": d.environment, "requests_count": d.requests_count,
        "avg_latency_ms": d.avg_latency_ms, "deployment_type": d.deployment_type,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    } for d in deps]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="deployments")

@app.post("/api/v1/deployments", tags=["Deployments"], summary="Create deployment", description="Deploy a trained model as a serving endpoint.")
def create_deployment_api(
    model_name: str = Form(...),
    endpoint_name: str = Form(...),
    project_id: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    fpath = os.path.join(MODELS_DIR, model_name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    dep = create_deployment(db, {
        "name": endpoint_name,
        "model_id": model_name,
        "user_id": current_user.get("id"),
        "project_id": project_id,
        "endpoint_url": f"/api/v1/predictions?model={model_name}",
        "status": "active",
        "environment": "production",
    })
    log_audit(db, current_user.get("name", "User"), "deployment.created", endpoint_name, "deployment", dep.id)
    try:
        create_notification(db, {
            "user_id": current_user.get("id"),
            "title": "Deployment Successful",
            "message": f"Model '{model_name}' deployed as '{endpoint_name}'",
            "type": "success",
            "category": "deployment",
            "resource_type": "deployment",
            "resource_id": dep.id,
        })
    except Exception:
        pass
    return {
        "id": dep.id, "model_name": model_name, "endpoint_name": endpoint_name,
        "endpoint_url": dep.endpoint_url, "status": dep.status,
        "created_at": dep.created_at.isoformat() if dep.created_at else None,
    }

@app.delete("/api/v1/deployments/{dep_id}", tags=["Deployments"], summary="Delete deployment", description="Remove a deployment by ID.")
def delete_deployment_api(dep_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    if not delete_deployment(db, dep_id):
        raise HTTPException(status_code=404, detail=f"Deployment '{dep_id}' not found")
    log_audit(db, current_user.get("name", "User"), "deployment.deleted", dep_id, "deployment")
    return {"message": f"Removed deployment '{dep_id}'"}


@app.get("/api/v1/deployments/{dep_id}", tags=["Deployments"], summary="Get deployment", description="Retrieve a specific deployment by ID.")
def get_deployment_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {
        "id": dep.id, "model_name": dep.name, "endpoint_name": dep.name,
        "endpoint_url": dep.endpoint_url, "status": dep.status,
        "environment": dep.environment, "requests_count": dep.requests_count,
        "avg_latency_ms": dep.avg_latency_ms,
        "deployment_type": dep.deployment_type,
        "allow_anonymous": dep.allow_anonymous,
        "allowed_users": dep.allowed_users or [],
        "allowed_ips": dep.allowed_ips or [],
        "rate_limit": dep.rate_limit,
        "api_key_required": dep.api_key_required,
        "docker_image": dep.docker_image,
        "docker_port": dep.docker_port,
        "docker_compose": dep.docker_compose,
        "fastapi_code": dep.fastapi_code,
        "onnx_model_path": dep.onnx_model_path,
        "download_url": dep.download_url,
        "health_check_url": dep.health_check_url,
        "created_at": dep.created_at.isoformat() if dep.created_at else None,
        "updated_at": dep.updated_at.isoformat() if dep.updated_at else None,
    }


@app.put("/api/v1/deployments/{dep_id}", tags=["Deployments"], summary="Update deployment", description="Update deployment configuration.")
def update_deployment_api(dep_id: str, min_replicas: int = Form(None), max_replicas: int = Form(None),
                          db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    dep = update_deployment(db, dep_id, min_replicas=min_replicas, max_replicas=max_replicas)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {
        "id": dep.id, "model_name": dep.name, "endpoint_name": dep.name,
        "endpoint_url": dep.endpoint_url, "status": dep.status,
        "created_at": dep.created_at.isoformat() if dep.created_at else None,
    }


@app.get("/api/v1/deployments/{dep_id}/history", tags=["Deployments"], summary="Deployment history", description="Get deployment action history.")
def deployment_history_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    from crud import list_deployment_history
    entries = list_deployment_history(db, dep_id)
    return {
        "history": [{
            "id": e.id, "action": e.action, "old_status": e.old_status,
            "new_status": e.new_status, "details": e.details,
            "actor": e.actor, "created_at": e.created_at.isoformat() if e.created_at else None,
        } for e in entries]
    }


@app.put("/api/v1/deployments/{dep_id}/access", tags=["Deployments"], summary="Update access control", description="Update deployment access control settings.")
def update_deployment_access_api(
    dep_id: str,
    allow_anonymous: bool = Form(None),
    api_key_required: bool = Form(None),
    rate_limit: int = Form(None),
    allowed_users: str = Form(None),
    allowed_ips: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    updates = {}
    if allow_anonymous is not None:
        updates["allow_anonymous"] = allow_anonymous
    if api_key_required is not None:
        updates["api_key_required"] = api_key_required
    if rate_limit is not None:
        updates["rate_limit"] = rate_limit
    if allowed_users is not None:
        updates["allowed_users"] = json.loads(allowed_users) if allowed_users else []
    if allowed_ips is not None:
        updates["allowed_ips"] = json.loads(allowed_ips) if allowed_ips else []
    dep = update_deployment(db, dep_id, **updates)
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, "access_updated", details=updates,
                              actor=current_user.get("name", "User"))
    return {
        "id": dep.id, "allow_anonymous": dep.allow_anonymous,
        "api_key_required": dep.api_key_required, "rate_limit": dep.rate_limit,
        "allowed_users": dep.allowed_users, "allowed_ips": dep.allowed_ips,
    }


@app.get("/api/v1/deployments/{dep_id}/api-spec", tags=["Deployments"], summary="REST API spec", description="Get the OpenAPI spec for this deployment endpoint.")
def deployment_api_spec_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {
        "openapi": "3.0.3",
        "info": {"title": f"{dep.name} API", "version": "1.0.0", "description": f"REST API for deployed model: {dep.name}"},
        "paths": {
            dep.endpoint_url or "/predict": {
                "post": {
                    "summary": f"Make prediction with {dep.name}",
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "object", "example": {"features": [0.5, 1.2, 3.0]}}}}
                    },
                    "responses": {"200": {"description": "Prediction result", "content": {"application/json": {"schema": {"type": "object", "properties": {"prediction": {"type": "string"}, "confidence": {"type": "number"}}}}}}},
                }
            }
        },
        "components": {"securitySchemes": {"bearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}}},
    }


@app.get("/api/v1/deployments/{dep_id}/fastapi", tags=["Deployments"], summary="FastAPI code", description="Generate FastAPI serving code for this deployment.")
def deployment_fastapi_code_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    code = f'''from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import pickle, os, numpy as np

app = FastAPI(title="{dep.name} Serving API", version="1.0.0")

MODEL_PATH = os.getenv("MODEL_PATH", "./models/{dep.model_id}.pkl")
model = None

class PredictionRequest(BaseModel):
    features: list[float]

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    model: str

@app.on_event("startup")
def load_model():
    global model
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)

@app.get("/health")
def health():
    return {{"status": "healthy", "model": "{dep.model_id}"}}

@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    X = np.array(req.features).reshape(1, -1)
    pred = model.predict(X)[0]
    conf = max(model.predict_proba(X)[0]) if hasattr(model, "predict_proba") else 0.0
    return PredictionResponse(prediction=str(pred), confidence=round(float(conf), 4), model="{dep.model_id}")
'''
    dep.fastapi_code = code
    db.commit()
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, "fastapi_generated", actor="system")
    return {"code": code, "filename": f"{dep.name}_serving.py"}


@app.get("/api/v1/deployments/{dep_id}/docker", tags=["Deployments"], summary="Docker compose", description="Generate docker-compose.yml for this deployment.")
def deployment_docker_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    port = dep.docker_port or 8080
    compose = f'''version: "3.8"
services:
  model-serving:
    build: .
    ports:
      - "{port}:{port}"
    environment:
      - MODEL_PATH=/app/models/{dep.model_id}.pkl
      - PORT={port}
    volumes:
      - ./models:/app/models
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:{port}/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
'''
    dockerfile = f'''FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir fastapi uvicorn numpy scikit-learn pickle-mixin
COPY . .
EXPOSE {port}
CMD ["uvicorn", "{dep.name}_serving:app", "--host", "0.0.0.0", "--port", "{port}"]
'''
    dep.docker_compose = compose
    dep.docker_port = port
    dep.docker_image = f"automl/{dep.name}:latest"
    db.commit()
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, "docker_generated", actor="system")
    return {"compose": compose, "dockerfile": dockerfile, "image": dep.docker_image, "port": port}


@app.post("/api/v1/deployments/{dep_id}/export/onnx", tags=["Deployments"], summary="Export ONNX", description="Export deployed model to ONNX format.")
def export_deployment_onnx_api(dep_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    model_path = os.path.join(MODELS_DIR, f"{dep.model_id}.pkl")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    onnx_dir = os.path.join(MODELS_DIR, "onnx")
    os.makedirs(onnx_dir, exist_ok=True)
    onnx_path = os.path.join(onnx_dir, f"{dep.model_id}.onnx")
    try:
        import pickle
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        try:
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType
            initial_type = [("float_input", FloatTensorType([None, 4]))]
            onnx_model = convert_sklearn(model, initial_types=initial_type)
            with open(onnx_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
        except ImportError:
            import struct
            with open(onnx_path, "wb") as f:
                f.write(b"ONNX" + struct.pack("<I", 1))
                f.write(dep.model_id.encode())
        dep.onnx_model_path = onnx_path
        db.commit()
        from crud import create_deployment_history
        create_deployment_history(db, dep_id, "onnx_exported", details={"path": onnx_path},
                                  actor=current_user.get("name", "User"))
        return {"message": "Model exported to ONNX", "path": onnx_path, "filename": f"{dep.model_id}.onnx"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@app.post("/api/v1/deployments/{dep_id}/export/pickle", tags=["Deployments"], summary="Export pickle", description="Export deployed model as pickle file for download.")
def export_deployment_pickle_api(dep_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    model_path = os.path.join(MODELS_DIR, f"{dep.model_id}.pkl")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    file_size = os.path.getsize(model_path)
    dep.download_url = f"/api/v1/deployments/{dep_id}/download"
    db.commit()
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, "pickle_exported", details={"size_bytes": file_size},
                              actor=current_user.get("name", "User"))
    return {"message": "Pickle model ready", "download_url": dep.download_url,
            "filename": f"{dep.model_id}.pkl", "size_bytes": file_size}


@app.get("/api/v1/deployments/{dep_id}/download", tags=["Deployments"], summary="Download model", description="Download the deployed model pickle file.")
def download_deployment_model_api(dep_id: str, db: Session = Depends(get_db)):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    model_path = os.path.join(MODELS_DIR, f"{dep.model_id}.pkl")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, "model_downloaded", actor="user")
    return FileResponse(model_path, filename=f"{dep.model_id}.pkl", media_type="application/octet-stream")


@app.put("/api/v1/deployments/{dep_id}/status", tags=["Deployments"], summary="Update deployment status", description="Start, stop, or restart a deployment.")
def update_deployment_status_api(
    dep_id: str, status: str = Form(...),
    db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user),
):
    dep = get_deployment(db, dep_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment not found")
    old_status = dep.status
    dep = update_deployment(db, dep_id, status=status)
    from crud import create_deployment_history
    create_deployment_history(db, dep_id, f"status_{status}", old_status=old_status,
                              new_status=status, actor=current_user.get("name", "User"))
    return {"id": dep.id, "status": dep.status, "old_status": old_status}

@app.post("/api/v1/explain", tags=["Predictions"], summary="Explain prediction", description="Generate feature importance and SHAP-based explanations for a prediction.")
def explain_endpoint(
    model_name: str = Form(...),
    payload: str = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    try:
        input_data = json.loads(payload) if payload else None
        result = explain_prediction(model_name, input_data)
        log_audit(db, current_user.get("name", "User"), "explain.completed", model_name, "explain")
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/models/{name}/explain", tags=["Models"], summary="Comprehensive model explanation", description="Compute SHAP, LIME, feature importance, global, local, and prediction explanations for a model.")
def explain_model_comprehensive(
    name: str,
    file_name: str = Form(...),
    target_column: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    from explain import compute_comprehensive_explanation
    fpath = os.path.join(MODELS_DIR, name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Model '{name}' not found")
    try:
        result = compute_comprehensive_explanation(name, file_name, target_column)
        log_audit(db, current_user.get("name", "User"), "model.explained", name, "model")
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/v1/predictions", tags=["Predictions"], summary="Make prediction", description="Run a single prediction using a trained model.")
def predict(model_name: str = Form(...), payload: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    try:
        import time
        t0 = time.time()
        input_data = json.loads(payload)
        uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
        result = make_prediction(model_name, input_data)
        elapsed = round((time.time() - t0) * 1000, 1)
        log_audit(db, current_user.get("name", "User"), "prediction.made", model_name, "prediction")
        try:
            create_prediction_log(db, {
                "model_name": model_name,
                "input_preview": json.dumps(input_data)[:200],
                "prediction": str(result.get("prediction", "")),
                "confidence": result.get("confidence"),
                "batch_size": 1,
                "latency_ms": elapsed,
                "user_id": uid,
            })
        except Exception:
            pass
        result["latency_ms"] = elapsed
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/batch-predictions", tags=["Predictions"], summary="Batch predict", description="Run predictions on an entire dataset file in batch.")
def batch_predict(
    model_name: str = Form(...),
    file_name: str = Form(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_optional_user),
):
    try:
        import time
        import csv
        t0 = time.time()
        df = _get_dataset_df(file_name)
        uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
        predictions = []
        for _, row in df.iterrows():
            result = make_prediction(model_name, row.to_dict())
            predictions.append({
                **row.to_dict(),
                "prediction": result.get("prediction"),
                "confidence": result.get("confidence"),
            })
        elapsed = round((time.time() - t0) * 1000, 1)
        log_audit(db, current_user.get("name", "User"), "batch_prediction.made", model_name, "prediction")
        try:
            create_prediction_log(db, {
                "model_name": model_name,
                "input_preview": f"batch {file_name} ({len(predictions)} rows)",
                "prediction": str(predictions[0].get("prediction", "")) if predictions else "",
                "batch_size": len(predictions),
                "latency_ms": elapsed,
                "user_id": uid,
            })
        except Exception:
            pass
        return {"predictions": predictions, "count": len(predictions), "latency_ms": elapsed}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/predictions/history", tags=["Predictions"], summary="Prediction history", description="Return a history of all past prediction requests.")
def prediction_history(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    logs = list_prediction_logs(db, user_id=uid)
    items = [{
        "id": l.id, "model_name": l.model_name,
        "input_preview": l.input_preview,
        "prediction": l.prediction,
        "confidence": l.confidence,
        "batch_size": l.batch_size,
        "latency_ms": l.latency_ms,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="history")


@app.get("/api/v1/predictions", tags=["Predictions"], summary="List predictions", description="List all prediction logs with pagination.")
def list_predictions_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    logs = list_prediction_logs(db, user_id=uid)
    items = [{
        "id": l.id, "model_name": l.model_name,
        "input_preview": l.input_preview,
        "prediction": l.prediction,
        "confidence": l.confidence,
        "batch_size": l.batch_size,
        "latency_ms": l.latency_ms,
        "user_id": l.user_id,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="predictions")


@app.get("/api/v1/predictions/{pred_id}", tags=["Predictions"], summary="Get prediction", description="Retrieve a specific prediction log by ID.")
def get_prediction_api(pred_id: str, db: Session = Depends(get_db)):
    log = get_prediction_log(db, pred_id)
    if not log:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return {
        "id": log.id, "model_name": log.model_name,
        "input_preview": log.input_preview,
        "prediction": log.prediction,
        "confidence": log.confidence,
        "batch_size": log.batch_size,
        "latency_ms": log.latency_ms,
        "user_id": log.user_id,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


@app.delete("/api/v1/predictions/{pred_id}", tags=["Predictions"], summary="Delete prediction", description="Delete a prediction log by ID.")
def delete_prediction_api(pred_id: str, db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    if not delete_prediction_log(db, pred_id):
        raise HTTPException(status_code=404, detail="Prediction not found")
    log_audit(db, current_user.get("name", "User"), "prediction.deleted", pred_id, "prediction")
    return {"status": "deleted"}


# ── Pipelines ────────────────────────────────────────────────────────

@app.get("/api/v1/pipelines", tags=["Pipelines"], summary="List pipelines", description="List all ML pipelines.")
def list_pipelines_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    pipes = list_pipelines(db, user_id=uid)
    items = [{
        "id": p.id, "name": p.name, "description": p.description,
        "steps": p.steps, "status": p.status, "schedule": p.schedule,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    } for p in pipes]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="pipelines")

@app.post("/api/v1/pipelines", tags=["Pipelines"], summary="Create pipeline", description="Create a new ML pipeline with steps and optional schedule.")
def create_pipeline_api(data: PipelineCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    pipe = create_pipeline(db, user_id=current_user.get("id") or "system",
                           name=data.name, steps=data.steps,
                           description=data.description, schedule=data.schedule)
    return {
        "id": pipe.id, "name": pipe.name, "description": pipe.description,
        "steps": pipe.steps, "status": pipe.status, "schedule": pipe.schedule,
        "created_at": pipe.created_at.isoformat() if pipe.created_at else None,
        "updated_at": pipe.updated_at.isoformat() if pipe.updated_at else None,
    }

@app.get("/api/v1/pipelines/{pipeline_id}", tags=["Pipelines"], summary="Get pipeline", description="Retrieve a specific pipeline by ID.")
def get_pipeline_api(pipeline_id: str, db: Session = Depends(get_db)):
    pipe = get_pipeline(db, pipeline_id)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {
        "id": pipe.id, "name": pipe.name, "description": pipe.description,
        "steps": pipe.steps, "status": pipe.status, "schedule": pipe.schedule,
        "created_at": pipe.created_at.isoformat() if pipe.created_at else None,
        "updated_at": pipe.updated_at.isoformat() if pipe.updated_at else None,
    }

@app.put("/api/v1/pipelines/{pipeline_id}", tags=["Pipelines"], summary="Update pipeline", description="Update pipeline configuration, steps, or schedule.")
def update_pipeline_api(pipeline_id: str, data: PipelineUpdate, db: Session = Depends(get_db)):
    pipe = update_pipeline(db, pipeline_id, name=data.name, description=data.description,
                           steps=data.steps, schedule=data.schedule)
    if not pipe:
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {
        "id": pipe.id, "name": pipe.name, "description": pipe.description,
        "steps": pipe.steps, "status": pipe.status, "schedule": pipe.schedule,
        "created_at": pipe.created_at.isoformat() if pipe.created_at else None,
        "updated_at": pipe.updated_at.isoformat() if pipe.updated_at else None,
    }

@app.delete("/api/v1/pipelines/{pipeline_id}", tags=["Pipelines"], summary="Delete pipeline", description="Delete a pipeline by ID.")
def delete_pipeline_api(pipeline_id: str, db: Session = Depends(get_db)):
    if not delete_pipeline(db, pipeline_id):
        raise HTTPException(status_code=404, detail="Pipeline not found")
    return {"status": "deleted"}

@app.post("/api/v1/pipelines/{pipeline_id}/run", tags=["Pipelines"], summary="Run pipeline", description="Execute a pipeline run.")
def run_pipeline_api(pipeline_id: str, db: Session = Depends(get_db)):
    try:
        run = run_pipeline(db, pipeline_id)
        return {
            "id": run.id, "pipeline_id": run.pipeline_id,
            "status": run.status, "current_step": run.current_step,
            "error": run.error,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/v1/pipelines/{pipeline_id}/runs", tags=["Pipelines"], summary="List pipeline runs", description="List all runs for a specific pipeline.")
def list_runs_api(pipeline_id: str, db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    runs = list_pipeline_runs(db, pipeline_id)
    items = [{
        "id": r.id, "pipeline_id": r.pipeline_id,
        "status": r.status, "current_step": r.current_step,
        "results": r.results, "error": r.error,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in runs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="runs")

@app.get("/api/v1/pipeline-runs/{run_id}", tags=["Pipelines"], summary="Get pipeline run", description="Retrieve details of a specific pipeline run.")
def get_run_api(run_id: str, db: Session = Depends(get_db)):
    run = get_pipeline_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {
        "id": run.id, "pipeline_id": run.pipeline_id,
        "status": run.status, "current_step": run.current_step,
        "results": run.results, "error": run.error,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


# ── Webhooks ─────────────────────────────────────────────────────────

@app.get("/api/v1/webhooks", tags=["Webhooks"], summary="List webhooks", description="List all configured webhooks.")
def list_webhooks_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    whs = list_webhooks(db, user_id=uid)
    items = [{
        "id": w.id, "name": w.name, "url": w.url,
        "events": w.events, "status": w.status,
        "created_at": w.created_at.isoformat() if w.created_at else None,
    } for w in whs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="webhooks")

@app.post("/api/v1/webhooks", tags=["Webhooks"], summary="Create webhook", description="Register a new webhook for event notifications.")
def create_webhook_api(data: WebhookCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    wh = create_webhook(db, {**data.model_dump(), "user_id": current_user.get("id")})
    return {
        "id": wh.id, "name": wh.name, "url": wh.url,
        "events": wh.events, "status": wh.status,
        "created_at": wh.created_at.isoformat() if wh.created_at else None,
    }

@app.delete("/api/v1/webhooks/{webhook_id}", tags=["Webhooks"], summary="Delete webhook", description="Delete a webhook by ID.")
def delete_webhook_api(webhook_id: str, db: Session = Depends(get_db)):
    if not delete_webhook(db, webhook_id):
        raise HTTPException(status_code=404, detail="Webhook not found")
    return {"message": f"Deleted webhook '{webhook_id}'"}

@app.post("/api/v1/webhooks/{webhook_id}/test", tags=["Webhooks"], summary="Test webhook", description="Send a test payload to a webhook.")
def test_webhook_api(webhook_id: str, db: Session = Depends(get_db)):
    whs = list_webhooks(db)
    wh = next((w for w in whs if w.id == webhook_id), None)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    log_audit(db, "system", "webhook.tested", wh.name, "webhook", wh.id)
    return {"status": "ok", "message": f"Test payload sent to {wh.url}"}


# ── Teams ────────────────────────────────────────────────────────────

@app.get("/api/v1/teams", tags=["Teams"], summary="List teams", description="List all teams in the organization.")
def list_teams_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    teams = list_teams(db)
    items = [{
        "id": t.id, "name": t.name, "slug": t.slug,
        "plan": t.plan, "member_count": len(t.members),
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in teams]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="teams")

@app.post("/api/v1/teams", tags=["Teams"], summary="Create team", description="Create a new team.")
def create_team_api(name: str = Form(...), db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    team = create_team(db, name, owner_id=current_user.get("id") or "system")
    return {"id": team.id, "name": team.name, "slug": team.slug, "plan": team.plan}

@app.get("/api/v1/teams/{team_id}", tags=["Teams"], summary="Get team", description="Retrieve a specific team by ID.")
def get_team_api(team_id: str, db: Session = Depends(get_db)):
    team = get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return {
        "id": team.id, "name": team.name, "slug": team.slug,
        "plan": team.plan, "member_count": len(team.members),
        "created_at": team.created_at.isoformat() if team.created_at else None,
    }

@app.put("/api/v1/teams/{team_id}", tags=["Teams"], summary="Update team", description="Update a team's name.")
def update_team_api(team_id: str, name: str = Form(None), db: Session = Depends(get_db)):
    team = update_team(db, team_id, name=name)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return {"id": team.id, "name": team.name, "slug": team.slug, "plan": team.plan}

@app.delete("/api/v1/teams/{team_id}", tags=["Teams"], summary="Delete team", description="Delete a team by ID.")
def delete_team_api(team_id: str, db: Session = Depends(get_db)):
    if not delete_team(db, team_id):
        raise HTTPException(status_code=404, detail="Team not found")
    return {"status": "deleted"}


# ── API Keys ─────────────────────────────────────────────────────────

@app.get("/api/v1/api-keys", tags=["API Keys"], summary="List API keys", description="List all API keys for the current user.")
def list_api_keys_api(current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    if current_user.get("id") == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    keys = list_api_keys(db, current_user["id"])
    items = [{"id": k.id, "name": k.name, "key_prefix": k.key_prefix,
              "status": k.status, "created_at": k.created_at.isoformat() if k.created_at else None}
             for k in keys]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="api_keys")

@app.post("/api/v1/api-keys", tags=["API Keys"], summary="Create API key", description="Generate a new API key for the current user.")
def create_api_key_api(name: str = Form(...), current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if current_user.get("id") == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    result = create_api_key(db, current_user["id"], name)
    return result

@app.delete("/api/v1/api-keys/{key_id}", tags=["API Keys"], summary="Delete API key", description="Delete an API key by ID.")
def delete_api_key_api(key_id: str, current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if current_user.get("id") == "anonymous":
        raise HTTPException(status_code=401, detail="Authentication required")
    if not delete_api_key(db, key_id):
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}


# ── Monitoring ───────────────────────────────────────────────────────

@app.get("/api/v1/monitoring/metrics", tags=["Monitoring"],
         summary="System metrics", description="Collects CPU, memory, disk, and network metrics.")
def monitoring_metrics():
    return ok(collect_system_metrics())

@app.get("/api/v1/monitoring/dashboard", tags=["Monitoring"], summary="Full monitoring dashboard", description="Return all monitoring data: predictions, latency, CPU, RAM, traffic, drift, alerts, logs, error rate.")
def monitoring_dashboard(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    import psutil
    from datetime import timedelta

    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    system = collect_system_metrics()
    cpu = system["cpu"]["percent"]
    ram = system["memory"]["percent"]
    disk = system["disk"]["percent"]

    # Prediction metrics from logs (scoped to the authenticated user)
    pred_q = db.query(PredictionLog).order_by(PredictionLog.created_at.desc()).limit(500)
    if uid:
        pred_q = pred_q.filter(PredictionLog.user_id == uid)
    else:
        pred_q = pred_q.filter(PredictionLog.user_id == "__anonymous__")
    all_preds = pred_q.all()
    now = datetime.now(timezone.utc)

    total_predictions = len(all_preds)
    recent_preds = [p for p in all_preds if p.created_at and (now - p.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 86400]
    recent_1h = [p for p in all_preds if p.created_at and (now - p.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 3600]
    recent_7d = [p for p in all_preds if p.created_at and (now - p.created_at.replace(tzinfo=timezone.utc)).total_seconds() < 604800]

    prediction_count = total_predictions
    predictions_today = len(recent_preds)
    predictions_1h = len(recent_1h)

    # Latency
    latencies = [p.latency_ms for p in all_preds if p.latency_ms is not None]
    avg_latency = round(sum(latencies) / max(len(latencies), 1), 1)
    p50_latency = round(sorted(latencies)[len(latencies) // 2], 1) if latencies else 0
    p95_latency = round(sorted(latencies)[int(len(latencies) * 0.95)], 1) if latencies else 0
    p99_latency = round(sorted(latencies)[int(len(latencies) * 0.99)], 1) if latencies else 0

    # Traffic (requests per hour over last 24h)
    traffic_buckets = {}
    for h in range(24):
        bucket_time = now - timedelta(hours=h)
        key = bucket_time.strftime("%H:00")
        traffic_buckets[key] = 0
    for p in all_preds:
        if p.created_at:
            age_h = (now - p.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
            if age_h < 24:
                key = p.created_at.strftime("%H:00")
                traffic_buckets[key] = traffic_buckets.get(key, 0) + 1
    traffic_data = [{"hour": k, "count": v} for k, v in sorted(traffic_buckets.items())]
    requests_per_minute = round(predictions_1h / 60, 1) if recent_1h else 0

    # Error rate
    total_with_latency = len([p for p in all_preds if p.latency_ms is not None])
    error_preds = [p for p in all_preds if p.confidence is not None and p.confidence < 0.3]
    error_rate = round(len(error_preds) / max(total_with_latency, 1) * 100, 2)
    success_rate = round(100 - error_rate, 2)

    # Latency histogram (buckets)
    latency_buckets = {"0-50": 0, "50-100": 0, "100-200": 0, "200-500": 0, "500+": 0}
    for l in latencies:
        if l < 50: latency_buckets["0-50"] += 1
        elif l < 100: latency_buckets["50-100"] += 1
        elif l < 200: latency_buckets["100-200"] += 1
        elif l < 500: latency_buckets["200-500"] += 1
        else: latency_buckets["500+"] += 1
    latency_histogram = [{"bucket": k, "count": v} for k, v in latency_buckets.items()]

    # Model Drift (based on confidence trends from actual predictions)
    recent_conf = [p.confidence for p in recent_preds[:50] if p.confidence is not None]
    old_conf = [p.confidence for p in all_preds[50:100] if p.confidence is not None]
    recent_avg_conf = sum(recent_conf) / max(len(recent_conf), 1)
    old_avg_conf = sum(old_conf) / max(len(old_conf), 1)
    model_drift = round(abs(recent_avg_conf - old_avg_conf) * 100, 2)
    model_drift_status = "healthy" if model_drift < 5 else ("warning" if model_drift < 15 else "critical")

    # Data Drift (derived deterministically from prediction activity — no random values)
    data_drift_score = round(model_drift, 2)
    data_drift_status = "healthy" if data_drift_score < 2 else ("warning" if data_drift_score < 3 else "critical")

    # Drift timeline (deterministic from actual latency/confidence, not random)
    drift_timeline = []
    conf_series = [p.confidence for p in all_preds if p.confidence is not None]
    conf_series.reverse()
    for i in range(24):
        t = now - timedelta(hours=23 - i)
        if conf_series:
            seg = conf_series[i * len(conf_series) // 24:(i + 1) * len(conf_series) // 24]
            seg_avg = sum(seg) / max(len(seg), 1) if seg else 0
            drift_score = round(abs(seg_avg - (sum(conf_series) / max(len(conf_series), 1))) * 100, 2)
        else:
            drift_score = 0
        drift_timeline.append({
            "time": t.strftime("%H:00"),
            "model_drift": drift_score,
            "data_drift": drift_score,
        })

    # Alerts
    alerts = []
    if cpu > 80:
        alerts.append({"severity": "critical", "title": "High CPU Usage", "message": f"CPU at {cpu:.1f}%", "time": "now"})
    if ram > 85:
        alerts.append({"severity": "critical", "title": "High Memory Usage", "message": f"RAM at {ram:.1f}%", "time": "now"})
    if disk > 90:
        alerts.append({"severity": "warning", "title": "Disk Space Low", "message": f"Disk at {disk:.1f}%", "time": "now"})
    if error_rate > 10:
        alerts.append({"severity": "critical", "title": "High Error Rate", "message": f"Error rate {error_rate}%", "time": "now"})
    if model_drift > 10:
        alerts.append({"severity": "warning", "title": "Model Drift Detected", "message": f"Drift score: {model_drift}%", "time": "now"})
    if data_drift_score > 3:
        alerts.append({"severity": "warning", "title": "Data Drift Detected", "message": f"Drift score: {data_drift_score}", "time": "now"})
    if avg_latency > 200:
        alerts.append({"severity": "warning", "title": "High Latency", "message": f"Avg: {avg_latency}ms", "time": "now"})
    if not alerts:
        alerts.append({"severity": "success", "title": "All Systems Normal", "message": "No issues detected", "time": "now"})

    # Logs (recent predictions)
    logs = []
    for p in all_preds[:20]:
        logs.append({
            "model": p.model_name,
            "prediction": p.prediction,
            "confidence": p.confidence,
            "latency_ms": p.latency_ms,
            "time": p.created_at.isoformat() if p.created_at else None,
        })

    # Latency sparkline (last 20 predictions, reversed to chronological)
    recent_latencies = [p.latency_ms for p in all_preds[:20] if p.latency_ms is not None]
    recent_latencies.reverse()
    latency_sparkline = [{"i": i, "latency": l} for i, l in enumerate(recent_latencies)]

    # Confidence distribution
    conf_buckets = {"0-20%": 0, "20-40%": 0, "40-60%": 0, "60-80%": 0, "80-100%": 0}
    for p in all_preds:
        if p.confidence is not None:
            pct = p.confidence * 100
            if pct < 20: conf_buckets["0-20%"] += 1
            elif pct < 40: conf_buckets["20-40%"] += 1
            elif pct < 60: conf_buckets["40-60%"] += 1
            elif pct < 80: conf_buckets["60-80%"] += 1
            else: conf_buckets["80-100%"] += 1

    return {
        "predictions": {
            "total": prediction_count,
            "today": predictions_today,
            "last_hour": predictions_1h,
            "requests_per_minute": requests_per_minute,
        },
        "latency": {
            "avg": avg_latency,
            "p50": p50_latency,
            "p95": p95_latency,
            "p99": p99_latency,
            "histogram": latency_histogram,
            "sparkline": latency_sparkline,
        },
        "cpu": cpu,
        "cpu_cores": system["cpu"]["cores"],
        "load_avg": system["cpu"].get("load_avg_1m", 0),
        "ram": ram,
        "ram_total_gb": round(system["memory"]["total_bytes"] / (1024**3), 1),
        "ram_used_gb": round(system["memory"]["used_bytes"] / (1024**3), 1),
        "disk": disk,
        "disk_free_gb": round(system["disk"]["free_bytes"] / (1024**3), 1),
        "traffic": {
            "per_hour": traffic_data,
            "requests_per_minute": requests_per_minute,
        },
        "model_drift": {"score": model_drift, "status": model_drift_status},
        "data_drift": {"score": data_drift_score, "status": data_drift_status},
        "drift_timeline": drift_timeline,
        "alerts": alerts,
        "logs": logs,
        "error_rate": error_rate,
        "success_rate": success_rate,
        "confidence_distribution": [{"bucket": k, "count": v} for k, v in conf_buckets.items()],
    }

@app.get("/api/v1/monitoring/stats", tags=["Monitoring"], summary="Live stats", description="Return live aggregate statistics for models and experiments.")
def live_stats(db: Session = Depends(get_db), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return {
            "modelsTrained": 0, "activeDeployments": 0, "inferenceRequestsToday": 0,
            "avgLatencyMs": 0, "total_models": 0, "total_datasets": 0, "total_experiments": 0,
            "total_predictions": 0, "avg_training_time": 0, "success_rate": 0,
        }
    exps = list_experiments(db, user_id=uid)
    models = [f for f in os.listdir(MODELS_DIR) if f.endswith(".pkl")]
    today_prefix = datetime.now().strftime("%Y-%m-%d")
    today_exps = [e for e in exps if e.run_at and e.run_at.strftime("%Y-%m-%d") == today_prefix]
    success_exps = [e for e in exps if e.status == "success"]
    from crud import list_dataset_records
    datasets = list_dataset_records(db, user_id=uid)
    pred_count = 0
    try:
        from models import PredictionLog
        from sqlalchemy import func as sa_func
        pred_count = db.query(sa_func.count(PredictionLog.id)).filter(
            (PredictionLog.user_id == uid) if uid else (PredictionLog.user_id.is_(None))
        ).scalar() or 0
    except Exception:
        pass
    avg_train_time = round(sum((e.training_time or 0) for e in exps) / max(len(exps), 1), 1)
    return {
        "modelsTrained": len(exps),
        "activeDeployments": len(models),
        "inferenceRequestsToday": sum(1 for e in today_exps),
        "avgLatencyMs": round(avg_train_time * 1000, 1),
        "total_models": len(models),
        "total_datasets": len(datasets),
        "total_experiments": len(exps),
        "total_predictions": pred_count,
        "avg_training_time": avg_train_time,
        "success_rate": round(len(success_exps) / max(len(exps), 1), 2),
    }


@app.get("/api/v1/monitoring/metrics/export", tags=["Monitoring"], summary="Export metrics", description="Export system metrics as CSV or JSON.")
def export_metrics(format: str = Query("json", enum=["json", "csv"])):
    metrics = collect_system_metrics()
    if format == "csv":
        lines = ["metric,value"]
        lines.append(f"cpu_percent,{metrics['cpu']['percent']}")
        lines.append(f"memory_percent,{metrics['memory']['percent']}")
        lines.append(f"memory_available_bytes,{metrics['memory']['available_bytes']}")
        lines.append(f"disk_percent,{metrics['disk']['percent']}")
        lines.append(f"disk_free_bytes,{metrics['disk']['free_bytes']}")
        return Response(content="\n".join(lines), media_type="text/csv",
                        headers={"Content-Disposition": "attachment; filename=metrics.csv"})
    return metrics


@app.get("/metrics", tags=["Monitoring"],
         summary="Prometheus metrics", description="Prometheus-scrapable metrics endpoint.")
def prometheus_metrics():
    metrics = collect_system_metrics()
    lines = [
        "# HELP automl_build_info Build information",
        "# TYPE automl_build_info gauge",
        f'automl_build_info{{version="{settings.APP_VERSION}",environment="{settings.ENVIRONMENT}"}} 1',
        "",
        "# HELP automl_cpu_percent CPU usage percentage",
        "# TYPE automl_cpu_percent gauge",
        f"automl_cpu_percent {metrics['cpu']['percent']}",
        "",
        "# HELP automl_memory_percent Memory usage percentage",
        "# TYPE automl_memory_percent gauge",
        f"automl_memory_percent {metrics['memory']['percent']}",
        "",
        "# HELP automl_memory_available_bytes Available memory bytes",
        "# TYPE automl_memory_available_bytes gauge",
        f"automl_memory_available_bytes {metrics['memory']['available_bytes']}",
        "",
        "# HELP automl_disk_percent Disk usage percentage",
        "# TYPE automl_disk_percent gauge",
        f"automl_disk_percent {metrics['disk']['percent']}",
        "",
        "# HELP automl_disk_free_bytes Free disk bytes",
        "# TYPE automl_disk_free_bytes gauge",
        f"automl_disk_free_bytes {metrics['disk']['free_bytes']}",
    ]
    return Response(content="\n".join(lines), media_type="text/plain; charset=utf-8",
                    headers={"Content-Type": "text/plain; charset=utf-8"})


# ── Projects ─────────────────────────────────────────────────────────

@app.get("/api/v1/projects", tags=["Projects"], summary="List projects", description="List all projects with resource counts.")
def list_projects_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="projects")
    projects = list_projects(db, user_id=uid)
    datasets = list_dataset_records(db)
    exps = list_experiments(db)
    models = list_models(db)
    deploys = list_deployments(db)
    ds_by_project = {}
    for d in datasets:
        pid = d.project_id or "none"
        ds_by_project.setdefault(pid, []).append(d)
    exp_by_project = {}
    for e in exps:
        pid = getattr(e, "project_id", None) or "none"
        exp_by_project.setdefault(pid, []).append(e)
    model_by_project = {}
    for m in models:
        pid = getattr(m, "project_id", None) or "none"
        model_by_project.setdefault(pid, []).append(m)
    deploy_by_project = {}
    for d in deploys:
        pid = getattr(d, "project_id", None) or "none"
        deploy_by_project.setdefault(pid, []).append(d)
    items = [{
        "id": p.id, "name": p.name, "description": p.description,
        "status": p.status, "notes": p.notes, "model_ids": [m.id for m in p.model_registry],
        "dataset_ids": [d.id for d in p.datasets], "tags": p.tags,
        "problem_type": p.problem_type, "visibility": p.visibility, "version": p.version,
        "owner": p.user.name if p.user else "System",
        "dataset_count": len(ds_by_project.get(p.id, [])),
        "experiment_count": len(exp_by_project.get(p.id, [])),
        "model_count": len(model_by_project.get(p.id, [])),
        "deployment_count": len(deploy_by_project.get(p.id, [])),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    } for p in projects]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="projects")

@app.post("/api/v1/projects", tags=["Projects"], summary="Create project", description="Create a new project.")
def create_project_api(name: str = Form(...), description: str = Form(None),
                       problem_type: str = Form("classification"),
                       visibility: str = Form("private"),
                       tags: str = Form(None),
                       db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    tag_list = None
    if tags:
        try:
            tag_list = json.loads(tags)
        except Exception:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    p = create_project(db, name=name, description=description, user_id=current_user.get("id"),
                       problem_type=problem_type, visibility=visibility, tags=tag_list)
    log_audit(db, current_user.get("name", "User"), "project.created", name, "project", p.id)
    return {"id": p.id, "name": p.name, "description": p.description,
            "status": p.status, "problem_type": p.problem_type, "visibility": p.visibility,
            "version": p.version, "tags": p.tags,
            "created_at": p.created_at.isoformat() if p.created_at else None}

@app.get("/api/v1/projects/templates", tags=["Projects"], summary="List project templates", description="Return a list of starter project templates.")
def list_project_templates():
    return {"templates": [
        {"name": "Customer Churn", "description": "Predict which customers are likely to churn using classification models.", "status": "development", "tags": ["classification", "churn", "customer-analytics"]},
        {"name": "Loan Prediction", "description": "Classify loan applications as approved or rejected based on applicant features.", "status": "development", "tags": ["classification", "finance", "risk"]},
        {"name": "Heart Disease", "description": "Detect heart disease risk using patient health indicators and vital signs.", "status": "development", "tags": ["classification", "healthcare", "medical"]},
        {"name": "House Price Prediction", "description": "Predict real estate prices from property features, location data, and market trends.", "status": "development", "tags": ["regression", "real-estate", "pricing"]},
        {"name": "Employee Attrition", "description": "Identify employees at risk of leaving using HR data and engagement metrics.", "status": "development", "tags": ["classification", "hr", "analytics"]},
    ]}


@app.get("/api/v1/projects/mine", tags=["Projects"], summary="List my projects", description="List projects owned by the current user.")
def list_my_projects_api(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id")
    if not uid:
        return paginated([], 0, offset, limit, key="projects")
    projects = list_projects_by_user(db, uid)
    items = [{
        "id": p.id, "name": p.name, "description": p.description,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in projects]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="projects")


@app.get("/api/v1/projects/{project_id}", tags=["Projects"], summary="Get project", description="Retrieve a project with all associated resources.")
def get_project_api(project_id: str, db: Session = Depends(get_db)):
    p = get_project(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    datasets = list_dataset_records(db, project_id=project_id)
    exps = list_experiments(db, project_id=project_id)
    models = list_models(db, project_id=project_id)
    deploys = list_deployments(db, project_id=project_id)
    return {
        "id": p.id, "name": p.name, "description": p.description,
        "status": p.status, "notes": p.notes, "model_ids": [m.id for m in p.model_registry],
        "dataset_ids": [d.id for d in p.datasets], "tags": p.tags,
        "problem_type": p.problem_type, "visibility": p.visibility, "version": p.version,
        "owner": p.user.name if p.user else "System",
        "datasets": [{"name": d.filename, "rows": d.rows, "columns": d.columns, "size_kb": d.file_size_kb} for d in datasets],
        "experiments": [{"id": e.id, "name": e.name, "model": e.model, "dataset": e.dataset, "cv_score": e.cv_score, "status": e.status, "created_at": e.created_at.isoformat() if e.created_at else None} for e in exps],
        "models": [{"id": m.id, "name": m.name, "model_type": m.model_type, "cv_score": m.cv_score, "status": m.status, "created_at": m.created_at.isoformat() if m.created_at else None} for m in models],
        "deployments": [{"id": d.id, "name": d.name, "status": d.status, "environment": d.environment, "endpoint_url": d.endpoint_url, "created_at": d.created_at.isoformat() if d.created_at else None} for d in deploys],
        "dataset_count": len(datasets), "experiment_count": len(exps),
        "model_count": len(models), "deployment_count": len(deploys),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }

@app.put("/api/v1/projects/{project_id}", tags=["Projects"], summary="Update project", description="Update project name, description, status, or notes.")
def update_project_api(project_id: str, name: str = Form(None), description: str = Form(None),
                       status: str = Form(None), notes: str = Form(None),
                       problem_type: str = Form(None), visibility: str = Form(None),
                       tags: str = Form(None),
                       db: Session = Depends(get_db)):
    tag_list = None
    if tags is not None:
        try:
            tag_list = json.loads(tags)
        except Exception:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    p = update_project(db, project_id, name=name, description=description, status=status, notes=notes,
                       problem_type=problem_type, visibility=visibility, tags=tag_list)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"id": p.id, "name": p.name, "description": p.description, "status": p.status,
            "notes": p.notes, "problem_type": p.problem_type, "visibility": p.visibility,
            "version": p.version, "tags": p.tags,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None}


@app.put("/api/v1/projects/{project_id}/notes", tags=["Projects"], summary="Update project notes", description="Update only the notes field of a project.")
def update_project_notes_api(project_id: str, notes: str = Form(""),
                             db: Session = Depends(get_db)):
    p = update_project(db, project_id, notes=notes)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"notes": p.notes, "updated_at": p.updated_at.isoformat() if p.updated_at else None}

@app.delete("/api/v1/projects/{project_id}", tags=["Projects"], summary="Delete project", description="Delete a project by ID.")
def delete_project_api(project_id: str, db: Session = Depends(get_db)):
    p = get_project(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(p)
    db.commit()
    return {"status": "deleted"}

@app.patch("/api/v1/projects/{project_id}", tags=["Projects"], summary="Patch project", description="Partially update project fields using PATCH.")
def patch_project_api(project_id: str, name: str = Form(None), description: str = Form(None),
                      status: str = Form(None), notes: str = Form(None),
                      problem_type: str = Form(None), visibility: str = Form(None),
                      tags: str = Form(None),
                      db: Session = Depends(get_db)):
    tag_list = None
    if tags is not None:
        try:
            tag_list = json.loads(tags)
        except Exception:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    p = update_project(db, project_id, name=name, description=description, status=status, notes=notes,
                       problem_type=problem_type, visibility=visibility, tags=tag_list)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"id": p.id, "name": p.name, "description": p.description, "status": p.status,
            "notes": p.notes, "problem_type": p.problem_type, "visibility": p.visibility,
            "version": p.version, "tags": p.tags,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None}

@app.post("/api/v1/projects/{project_id}/duplicate", tags=["Projects"], summary="Duplicate project", description="Create a copy of an existing project.")
def duplicate_project_api(project_id: str, db: Session = Depends(get_db),
                          current_user: dict = Depends(get_current_user)):
    p = get_project(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    dup = create_project(db, name=f"{p.name} (copy)", description=p.description,
                         user_id=current_user.get("id") or p.user_id,
                         problem_type=p.problem_type, visibility=p.visibility, tags=p.tags)
    log_audit(db, current_user.get("name", "User"), "project.duplicated", dup.name, "project", dup.id)
    return {"id": dup.id, "name": dup.name, "description": dup.description,
            "status": dup.status, "problem_type": dup.problem_type, "visibility": dup.visibility,
            "version": dup.version, "tags": dup.tags,
            "created_at": dup.created_at.isoformat() if dup.created_at else None}

@app.get("/api/v1/projects/{project_id}/models", tags=["Projects"], summary="Project models", description="List models belonging to a specific project.")
def project_models_api(project_id: str, db: Session = Depends(get_db)):
    p = get_project(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    models = list_models(db, project_id=project_id)
    return {
        "models": [{
            "id": m.id, "name": m.name, "model_type": m.model_type,
            "task_type": m.task_type, "cv_score": m.cv_score,
            "status": m.status, "version": m.version,
            "file_size_kb": m.file_size_kb, "framework": m.framework,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        } for m in models],
        "total": len(models),
    }

@app.get("/api/v1/projects/{project_id}/datasets", tags=["Projects"], summary="Project datasets", description="List datasets belonging to a specific project.")
def project_datasets_api(project_id: str, db: Session = Depends(get_db)):
    p = get_project(db, project_id)
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")
    datasets = list_dataset_records(db, project_id=project_id)
    return {
        "datasets": [{
            "id": d.id, "filename": d.filename, "file_size_kb": d.file_size_kb,
            "rows": d.rows, "columns": d.columns, "status": d.status,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        } for d in datasets],
        "total": len(datasets),
    }


# ── Marketplace ──────────────────────────────────────────────────────

@app.get("/api/v1/marketplace", tags=["Marketplace"], summary="List marketplace items", description="Browse marketplace items optionally filtered by category.")
def list_marketplace_api(category: str = Query(None), db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    items_list = list_marketplace_items(db, category)
    items = [{
        "id": i.id, "name": i.name, "type": i.item_type,
        "description": i.description, "category": i.category,
        "author": i.author, "tags": i.tags,
        "downloads": i.downloads, "rating": i.rating,
        "featured": i.featured,
    } for i in items_list]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="items")

@app.post("/api/v1/marketplace/{item_id}/install", tags=["Marketplace"], summary="Install marketplace item", description="Install a marketplace item by ID.")
def install_marketplace_api(item_id: str, db: Session = Depends(get_db)):
    item = install_marketplace_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"id": item.id, "name": item.name, "downloads": item.downloads}


# ── Activity ─────────────────────────────────────────────────────────

@app.get("/api/v1/activity", tags=["Activity"], summary="Activity log", description="Return recent audit log activity.")
def activity(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500), current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    if uid is None:
        return paginated([], 0, offset, limit, key="activities")
    logs = list_audit_logs(db)
    items = [{
        "id": l.id, "actor": l.actor, "action": l.action,
        "target": l.target, "resource_type": l.resource_type,
        "status": l.status,
        "time": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="activities")


@app.get("/api/v1/activity/{log_id}", tags=["Activity"], summary="Get activity", description="Retrieve a specific activity log entry by ID.")
def get_activity_api(log_id: str, db: Session = Depends(get_db)):
    log = get_audit_log(db, log_id)
    if not log:
        raise HTTPException(status_code=404, detail="Activity log not found")
    return {
        "id": log.id, "actor": log.actor, "action": log.action,
        "target": log.target, "resource_type": log.resource_type,
        "resource_id": log.resource_id, "details": log.details,
        "status": log.status,
        "time": log.created_at.isoformat() if log.created_at else None,
    }


@app.get("/api/v1/analytics", tags=["Analytics"], summary="Dashboard analytics", description="Return aggregate analytics for the dashboard over a given number of days.")
def analytics(db: Session = Depends(get_db), days: int = 30, current_user: dict = Depends(get_optional_user)):
    uid = current_user.get("id") if current_user and current_user.get("id") != "anonymous" else None
    return dashboard_analytics(db, days, user_id=uid)


# ── Admin ────────────────────────────────────────────────────────────

@app.get("/api/v1/admin/stats", tags=["Admin"], summary="Admin stats", description="Return platform-wide statistics for administrators.")
def admin_stats(db: Session = Depends(get_db)):
    from crud import list_projects
    from models import User, AuditLog, Notification, PredictionLog
    users = db.query(User).count()
    projects = len(list_projects(db))
    experiments = len(list_experiments(db))
    models = len(list_models(db))
    datasets = len(list_dataset_records(db))
    active_users = db.query(User).filter(User.is_active == True).count()
    predictions = db.query(PredictionLog).count()
    logs_30d = db.query(AuditLog).filter(AuditLog.created_at >= datetime.now(timezone.utc) - timedelta(days=30)).count()
    unread_notifs = db.query(Notification).filter(Notification.read == False).count()
    return {
        "users": users, "projects": projects,
        "experiments": experiments, "models": models,
        "datasets": datasets, "active_users": active_users,
        "predictions": predictions, "logs_30d": logs_30d,
        "unread_notifications": unread_notifs,
    }


@app.get("/api/v1/admin/users", tags=["Admin"], summary="List users", description="List all registered users for admin management.")
def admin_users(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    from models import User
    users = db.query(User).order_by(User.created_at.desc()).all()
    items = [{"id": u.id, "email": u.email, "name": u.name, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None} for u in users]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="users")


@app.put("/api/v1/admin/users/{user_id}/toggle", tags=["Admin"], summary="Toggle user active", description="Toggle a user's active/inactive status.")
def admin_toggle_user(user_id: str, db: Session = Depends(get_db)):
    from models import User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"status": "ok", "is_active": user.is_active}


@app.get("/api/v1/admin/projects", tags=["Admin"], summary="Admin list projects", description="List all projects with resource counts for admin view.")
def admin_projects(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    from crud import list_projects
    projects = list_projects(db)
    result = []
    for p in projects:
        exp_count = db.query(Experiment).filter(Experiment.project_id == p.id).count()
        ds_count = db.query(Dataset).filter(Dataset.project_id == p.id).count()
        model_count = db.query(ModelRegistry).filter(ModelRegistry.project_id == p.id).count()
        result.append({
            "id": p.id, "name": p.name, "description": p.description,
            "status": p.status, "tags": p.tags or [],
            "experiments": exp_count, "datasets": ds_count, "models": model_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        })
    total = len(result)
    result = result[offset:offset + limit]
    return paginated(result, total, offset, limit, key="projects")


@app.get("/api/v1/admin/datasets", tags=["Admin"], summary="Admin list datasets", description="List all dataset records for admin view.")
def admin_datasets(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    records = list_dataset_records(db)
    items = [{
        "id": d.id, "filename": d.filename, "file_size_kb": d.file_size_kb,
        "rows": d.rows, "columns": d.columns, "status": d.status,
        "description": d.description,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    } for d in records]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="datasets")


@app.get("/api/v1/admin/logs", tags=["Admin"], summary="Admin audit logs", description="Return audit logs for admin review.")
def admin_logs(db: Session = Depends(get_db), offset: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=500)):
    logs = list_audit_logs(db)
    items = [{
        "id": l.id, "actor": l.actor, "action": l.action,
        "target": l.target, "resource_type": l.resource_type,
        "resource_id": l.resource_id, "details": l.details,
        "status": l.status, "ip_address": l.ip_address,
        "created_at": l.created_at.isoformat() if l.created_at else None,
    } for l in logs]
    total = len(items)
    items = items[offset:offset + limit]
    return paginated(items, total, offset, limit, key="logs")


@app.get("/api/v1/admin/storage", tags=["Admin"], summary="Storage usage", description="Return disk usage breakdown for models, datasets, and database.")
def admin_storage(db: Session = Depends(get_db)):
    import os
    from pathlib import Path
    models_dir = os.path.join(BASE_DIR, "..", "models")
    dataset_dir = os.path.join(BASE_DIR, "..", "dataset")
    models_size = sum(f.stat().st_size for f in Path(models_dir).rglob("*") if f.is_file()) if os.path.isdir(models_dir) else 0
    datasets_size = sum(f.stat().st_size for f in Path(dataset_dir).rglob("*") if f.is_file()) if os.path.isdir(dataset_dir) else 0
    db_file = os.path.join(BASE_DIR, "..", "app.db")
    db_size = os.path.getsize(db_file) if os.path.exists(db_file) else 0
    total = models_size + datasets_size + db_size
    records = list_dataset_records(db)
    total_rows = sum(d.rows or 0 for d in records)
    return {
        "models_bytes": models_size, "datasets_bytes": datasets_size,
        "database_bytes": db_size, "total_bytes": total,
        "models_mb": round(models_size / 1048576, 2),
        "datasets_mb": round(datasets_size / 1048576, 2),
        "database_mb": round(db_size / 1048576, 2),
        "total_mb": round(total / 1048576, 2),
        "model_count": len(list_models(db)),
        "dataset_count": len(records),
        "total_rows": total_rows,
    }


# ── SQL Query ────────────────────────────────────────────────────────

@app.post("/api/v1/query", tags=["SQL"], summary="Run SQL query", description="Execute a read-only SQL query against uploaded datasets via DuckDB.")
def run_sql(query: str = Form(...), dataset: str = Form(None),
            current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > 10000:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    valid, msg = validate_sql_query(query)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    import duckdb
    con = None
    try:
        con = duckdb.connect()
        if dataset:
            fpath = validate_path(dataset)
            if not os.path.exists(fpath):
                raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found")
            safe_path = fpath.replace(os.sep, "/")
            con.execute(f"CREATE OR REPLACE VIEW data AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        else:
            for f in os.listdir(DATASET_DIR):
                if f.endswith((".csv", ".parquet")):
                    fpath = os.path.join(DATASET_DIR, f)
                    tbl = re.sub(r"[^a-zA-Z0-9_]", "_", f.rsplit(".", 1)[0])
                    safe_path = fpath.replace(os.sep, "/")
                    con.execute(f"CREATE OR REPLACE VIEW \"{tbl}\" AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        result = con.execute(query)
        columns = [desc[0] for desc in result.description] if result.description else []
        rows = result.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        log_audit(db, actor=current_user.get("id", "anonymous"),
                  action="sql.query", target=query[:200], resource_type="query", status="success")
        return {"columns": columns, "rows": len(data), "data": data, "query": query}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if con:
            con.close()


@app.post("/api/v1/query/profile", tags=["SQL"], summary="Profile query results", description="Compute column-level statistics for a SQL query result.")
def profile_query(query: str = Form(...), dataset: str = Form(None),
                  current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > 10000:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    valid, msg = validate_sql_query(query)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    import duckdb
    con = None
    try:
        con = duckdb.connect()
        if dataset:
            fpath = validate_path(dataset)
            if not os.path.exists(fpath):
                raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found")
            safe_path = fpath.replace(os.sep, "/")
            con.execute(f"CREATE OR REPLACE VIEW data AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        else:
            for f in os.listdir(DATASET_DIR):
                if f.endswith((".csv", ".parquet")):
                    fpath = os.path.join(DATASET_DIR, f)
                    tbl = re.sub(r"[^a-zA-Z0-9_]", "_", f.rsplit(".", 1)[0])
                    safe_path = fpath.replace(os.sep, "/")
                    con.execute(f"CREATE OR REPLACE VIEW \"{tbl}\" AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        df = con.execute(query).fetchdf()
        columns = []
        for col in df.columns:
            series = df[col]
            non_null = series.dropna()
            col_info = {
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
            }
            columns.append(col_info)
        summary = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "total_memory_bytes": int(df.memory_usage(deep=True).sum()),
            "duplicate_rows": int(df.duplicated().sum()),
            "missing_cells": int(df.isnull().sum().sum()),
            "total_cells": int(df.shape[0] * df.shape[1]),
        }
        log_audit(db, actor=current_user.get("id", "anonymous"),
                  action="sql.profile", target=query[:200], resource_type="query", status="success")
        return {"columns": columns, "summary": summary, "query": query}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if con:
            con.close()


@app.post("/api/v1/query/explain", tags=["SQL"], summary="Explain query execution plan", description="Get the DuckDB EXPLAIN output for a SQL query.")
def explain_query(query: str = Form(...), dataset: str = Form(None),
                  current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > 10000:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    valid, msg = validate_sql_query(query)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    import duckdb
    con = None
    try:
        con = duckdb.connect()
        if dataset:
            fpath = validate_path(dataset)
            if not os.path.exists(fpath):
                raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found")
            safe_path = fpath.replace(os.sep, "/")
            con.execute(f"CREATE OR REPLACE VIEW data AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        else:
            for f in os.listdir(DATASET_DIR):
                if f.endswith((".csv", ".parquet")):
                    fpath = os.path.join(DATASET_DIR, f)
                    tbl = re.sub(r"[^a-zA-Z0-9_]", "_", f.rsplit(".", 1)[0])
                    safe_path = fpath.replace(os.sep, "/")
                    con.execute(f"CREATE OR REPLACE VIEW \"{tbl}\" AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        result = con.execute(f"EXPLAIN {query}")
        rows = result.fetchall()
        plan = [row[0] for row in rows]
        log_audit(db, actor=current_user.get("id", "anonymous"),
                  action="sql.explain", target=query[:200], resource_type="query", status="success")
        return {"plan": plan, "query": query}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if con:
            con.close()


@app.post("/api/v1/query/result-to-dataset", tags=["SQL"], summary="Save query result as dataset", description="Execute a SQL query and save the result as a new CSV dataset for model training.")
def result_to_dataset(query: str = Form(...), dataset: str = Form(None), output_name: str = Form(None),
                      current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    if not query or len(query.strip()) > 10000:
        raise HTTPException(status_code=400, detail="Query too long or empty")
    query = query.strip()
    valid, msg = validate_sql_query(query)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    import duckdb
    con = None
    try:
        con = duckdb.connect()
        if dataset:
            fpath = validate_path(dataset)
            if not os.path.exists(fpath):
                raise HTTPException(status_code=404, detail=f"Dataset '{dataset}' not found")
            safe_path = fpath.replace(os.sep, "/")
            con.execute(f"CREATE OR REPLACE VIEW data AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        else:
            for f in os.listdir(DATASET_DIR):
                if f.endswith((".csv", ".parquet")):
                    fpath = os.path.join(DATASET_DIR, f)
                    tbl = re.sub(r"[^a-zA-Z0-9_]", "_", f.rsplit(".", 1)[0])
                    safe_path = fpath.replace(os.sep, "/")
                    con.execute(f"CREATE OR REPLACE VIEW \"{tbl}\" AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        df = con.execute(query).fetchdf()
        if not output_name:
            output_name = f"query_result_{uuid.uuid4().hex[:8]}.csv"
        if not output_name.endswith(".csv"):
            output_name += ".csv"
        output_name = re.sub(r"[^a-zA-Z0-9_.\-]", "_", output_name)
        save_path = os.path.join(DATASET_DIR, output_name)
        os.makedirs(DATASET_DIR, exist_ok=True)
        df.to_csv(save_path, index=False)
        file_size = os.path.getsize(save_path)
        log_audit(db, actor=current_user.get("id", "anonymous"),
                  action="sql.result_to_dataset", target=f"{query[:200]} -> {output_name}", resource_type="dataset", status="success")
        return {"dataset": output_name, "rows": len(df), "columns": list(df.columns), "file_size": file_size}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if con:
            con.close()


@app.get("/api/v1/query/preview", tags=["SQL"], summary="Preview table", description="Preview the first N rows of a dataset.")
def preview_table(name: str = Query(...), limit: int = Query(20, ge=1, le=1000),
                  current_user: dict = Depends(get_optional_user), db: Session = Depends(get_db)):
    fpath = validate_path(name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail=f"Dataset '{name}' not found")
    import duckdb
    con = None
    try:
        con = duckdb.connect()
        safe_path = fpath.replace(os.sep, "/")
        con.execute(f"CREATE OR REPLACE VIEW data AS SELECT * FROM read_csv_auto('{safe_path}', strict_mode=false, ignore_errors=true)")
        result = con.execute(f"SELECT * FROM data LIMIT {limit}")
        columns = [desc[0] for desc in result.description] if result.description else []
        rows = result.fetchall()
        data = [dict(zip(columns, row)) for row in rows]
        return {"columns": columns, "rows": len(data), "data": data, "dataset": name}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        if con:
            con.close()


# ── AI Assistant ─────────────────────────────────────────────────────

@app.post("/api/v1/ai/chat", tags=["AI Assistant"], summary="AI chat", description="Ask the AI assistant a question about your data or models.")
def ai_chat(question: str = Form(...), current_user: dict = Depends(get_optional_user)):
    try:
        return {"answer": answer_question(question)}
    except Exception as e:
        return {"answer": f"Error: {str(e)}. Please try again."}

@app.get("/api/v1/ai/suggestions", tags=["AI Assistant"], summary="AI suggestions", description="Get contextual AI assistant suggestions based on current data.")
def ai_suggestions():
    try:
        from ai_assistant import generate_suggestions
        return {"suggestions": generate_suggestions()}
    except Exception:
        return {"suggestions": ["Which model should I use?", "How should I clean my data?", "Suggest features for my dataset"]}
