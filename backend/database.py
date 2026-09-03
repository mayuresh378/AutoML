import os
import time
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine, MetaData, exc, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

_raw_url = os.getenv("DATABASE_URL", "")
if _raw_url and not re.match(r"^(postgresql|postgres|sqlite)://", _raw_url.strip()):
    _raw_url = ""

if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = _raw_url or f"sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), 'automl.db')}"

is_postgres = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL

_engine_kwargs: dict = {"echo": False, "pool_pre_ping": True}
if is_postgres:
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
    _engine_kwargs["pool_recycle"] = 3600

engine = create_engine(DATABASE_URL, **_engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

shared_metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    }
)


class Base(DeclarativeBase):
    metadata = shared_metadata


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_datasets_table():
    is_pg = "postgresql" in DATABASE_URL
    try:
        with engine.connect() as conn:
            if is_pg:
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='datasets'"
                ))
            else:
                result = conn.execute(text("PRAGMA table_info(datasets)"))
            if is_pg:
                existing = {row[0] for row in result}
            else:
                existing = {row[1] for row in result}

            migrations = [
                ("tags", "JSON" if is_pg else "TEXT", "'[]'"),
                ("version", "INTEGER" if is_pg else "INTEGER", "1"),
                ("source", "VARCHAR" if is_pg else "TEXT", "'upload'"),
                ("source_url", "VARCHAR" if is_pg else "TEXT", "NULL"),
            ]
            for col, col_type, default in migrations:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE datasets ADD COLUMN {col} {col_type} DEFAULT {default}"))
                    conn.commit()
    except Exception:
        pass


def _migrate_deployments_table():
    is_pg = "postgresql" in DATABASE_URL
    try:
        with engine.connect() as conn:
            if is_pg:
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='deployments'"
                ))
                existing = {row[0] for row in result}
            else:
                result = conn.execute(text("PRAGMA table_info(deployments)"))
                existing = {row[1] for row in result}

            migrations = [
                ("deployment_type", "VARCHAR" if is_pg else "TEXT", "'rest_api'"),
                ("allow_anonymous", "BOOLEAN" if is_pg else "INTEGER", "0"),
                ("allowed_users", "JSON" if is_pg else "TEXT", "NULL"),
                ("allowed_ips", "JSON" if is_pg else "TEXT", "NULL"),
                ("rate_limit", "INTEGER" if is_pg else "INTEGER", "NULL"),
                ("api_key_required", "BOOLEAN" if is_pg else "INTEGER", "1"),
                ("docker_image", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("docker_port", "INTEGER" if is_pg else "INTEGER", "8080"),
                ("docker_compose", "TEXT" if is_pg else "TEXT", "NULL"),
                ("fastapi_code", "TEXT" if is_pg else "TEXT", "NULL"),
                ("onnx_model_path", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("download_url", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("health_check_url", "VARCHAR" if is_pg else "TEXT", "NULL"),
            ]
            for col, col_type, default in migrations:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE deployments ADD COLUMN {col} {col_type} DEFAULT {default}"))
                    conn.commit()
    except Exception:
        pass


def _migrate_experiments_table():
    is_pg = "postgresql" in DATABASE_URL
    try:
        with engine.connect() as conn:
            if is_pg:
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='experiments'"
                ))
                existing = {row[0] for row in result}
            else:
                result = conn.execute(text("PRAGMA table_info(experiments)"))
                existing = {row[1] for row in result}

            migrations = [
                ("notes", "TEXT" if is_pg else "TEXT", "NULL"),
                ("dataset_version", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("updated_at", "TIMESTAMP" if is_pg else "DATETIME", "NULL"),
            ]
            for col, col_type, default in migrations:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE experiments ADD COLUMN {col} {col_type} DEFAULT {default}"))
                    conn.commit()
    except Exception:
        pass


def _migrate_projects_table():
    is_pg = "postgresql" in DATABASE_URL
    try:
        with engine.connect() as conn:
            if is_pg:
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='projects'"
                ))
                existing = {row[0] for row in result}
            else:
                result = conn.execute(text("PRAGMA table_info(projects)"))
                existing = {row[1] for row in result}

            migrations = [
                ("problem_type", "VARCHAR" if is_pg else "TEXT", "'classification'"),
                ("visibility", "VARCHAR" if is_pg else "TEXT", "'private'"),
                ("version", "INTEGER" if is_pg else "INTEGER", "1"),
            ]
            for col, col_type, default in migrations:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE projects ADD COLUMN {col} {col_type} DEFAULT {default}"))
                    conn.commit()
    except Exception:
        pass


def _migrate_users_table():
    is_pg = "postgresql" in DATABASE_URL
    try:
        with engine.connect() as conn:
            if is_pg:
                result = conn.execute(text(
                    "SELECT column_name FROM information_schema.columns WHERE table_name='users'"
                ))
                existing = {row[0] for row in result}
            else:
                result = conn.execute(text("PRAGMA table_info(users)"))
                existing = {row[1] for row in result}

            migrations = [
                ("firebase_uid", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("profile_picture", "VARCHAR" if is_pg else "TEXT", "NULL"),
                ("last_login_at", "TIMESTAMP" if is_pg else "DATETIME", "NULL"),
            ]
            for col, col_type, default in migrations:
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {col_type} DEFAULT {default}"))
                    conn.commit()
    except Exception:
        pass


def init_db():
    from models import (User, Team, TeamMember, ApiKey, Experiment, ModelRegistry,
                        Deployment, DeploymentHistory, Pipeline, PipelineRun, Webhook, AuditLog,
                        Project, MarketplaceItem, Dataset, DatasetShare, Notification,
                        UserSession, PredictionLog, ActivityLog)
    for attempt in range(30):
        try:
            Base.metadata.create_all(bind=engine)
            _migrate_users_table()
            _migrate_datasets_table()
            _migrate_deployments_table()
            _migrate_experiments_table()
            _migrate_projects_table()
            return
        except (exc.OperationalError, TimeoutError, ConnectionError, OSError):
            if attempt == 29:
                raise
            time.sleep(1)
