import uuid
import hashlib
import os
from datetime import datetime, timedelta, timezone
from typing import Optional
import bcrypt
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import desc
from jose import jwt

from models import (User, Team, TeamMember, ApiKey, Experiment, ModelRegistry,
                    Deployment, Pipeline, PipelineRun, PredictionLog, Webhook, AuditLog,
                    Project, MarketplaceItem, Dataset, Notification, ActivityLog)

from config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')


def _create_token(user_id: str) -> str:
    return jwt.encode({"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}, SECRET_KEY, algorithm=ALGORITHM)


def _now():
    return datetime.now(timezone.utc)


def _uid():
    return str(uuid.uuid4())


def log_audit(db: Session, actor: str, action: str, target: str = None,
              resource_type: str = None, resource_id: str = None,
              details: dict = None, status: str = "success", ip_address: str = None):
    record = AuditLog(
        id=_uid(), actor=actor, action=action, target=target,
        resource_type=resource_type, resource_id=resource_id,
        details=details, status=status, ip_address=ip_address,
        created_at=_now()
    )
    try:
        db.add(record)
        db.commit()
    except Exception:
        db.rollback()
        raise


# ─── Users ──────────────────────────────────────────────────────────

def create_user(db: Session, email: str, password: str, name: str) -> dict:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise ValueError("Email already registered")
    user = User(id=_uid(), email=email, name=name, password_hash=_hash_password(password), created_at=_now())
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise
    token = _create_token(user.id)
    log_audit(db, name, "user.registered", f"User {email}", "user", user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


def authenticate_user(db: Session, email: str, password: str) -> dict:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise ValueError("Invalid email or password")
    try:
        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            raise ValueError("Invalid email or password")
    except (ValueError, AttributeError):
        raise ValueError("Invalid email or password")
    if not user.is_active:
        raise ValueError("Account is disabled")
    token = _create_token(user.id)
    log_audit(db, user.name, "user.login", f"User {email}", "user", user.id)
    return {"token": token, "user": {"id": user.id, "email": user.email, "name": user.name}}


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).options(
        selectinload(User.teams),
        selectinload(User.api_keys),
    ).filter(User.id == user_id).first()


# ─── Experiments ──────────────────────────────────────────────────────

def list_experiments(db: Session, limit: int = 100, offset: int = 0, project_id: str = None, user_id: str = None) -> list:
    q = db.query(Experiment).options(
        selectinload(Experiment.user),
        selectinload(Experiment.project),
        selectinload(Experiment.model_registry),
    ).order_by(desc(Experiment.created_at))
    if project_id:
        q = q.filter(Experiment.project_id == project_id)
    if user_id:
        q = q.filter((Experiment.user_id == user_id) | (Experiment.user_id == None))
    return q.offset(offset).limit(limit).all()


def create_experiment(db: Session, data: dict) -> Experiment:
    exp = Experiment(id=_uid(), created_at=_now(), **data)
    try:
        db.add(exp)
        db.commit()
        db.refresh(exp)
    except Exception:
        db.rollback()
        raise
    log_audit(db, data.get("user_id", "system"), "experiment.created",
              exp.name, "experiment", exp.id)
    return exp


# ─── Model Registry ─────────────────────────────────────────────────

def list_models(db: Session, limit: int = 100, offset: int = 0, project_id: str = None, user_id: str = None) -> list:
    q = db.query(ModelRegistry).options(
        selectinload(ModelRegistry.user),
        selectinload(ModelRegistry.project),
        selectinload(ModelRegistry.experiment),
    ).order_by(desc(ModelRegistry.created_at))
    if project_id:
        q = q.filter(ModelRegistry.project_id == project_id)
    if user_id:
        q = q.filter((ModelRegistry.user_id == user_id) | (ModelRegistry.user_id == None))
    return q.offset(offset).limit(limit).all()


def get_model(db: Session, model_id: str) -> Optional[ModelRegistry]:
    return db.query(ModelRegistry).filter(ModelRegistry.id == model_id).first()


def create_model(db: Session, data: dict) -> ModelRegistry:
    model = ModelRegistry(id=_uid(), created_at=_now(), **data)
    db.add(model)
    db.commit()
    db.refresh(model)
    log_audit(db, data.get("user_id", "system"), "model.created",
              model.name, "model", model.id)
    return model


def update_model_status(db: Session, model_id: str, status: str) -> Optional[ModelRegistry]:
    model = get_model(db, model_id)
    if model:
        old = model.status
        model.status = status
        model.updated_at = _now()
        db.commit()
        db.refresh(model)
        log_audit(db, "system", "model.status_changed",
                  model.name, "model", model.id, details={"from": old, "to": status})
    return model


def update_model_meta(db: Session, name: str, status: str = None, tags: list = None, description: str = None) -> Optional[ModelRegistry]:
    model = db.query(ModelRegistry).filter(ModelRegistry.name == name).first()
    if not model:
        model = db.query(ModelRegistry).filter(ModelRegistry.name == name.replace(".pkl", "")).first()
    if model:
        if status is not None:
            model.status = status
        if tags is not None:
            model.tags = tags
        if description is not None:
            model.description = description
        model.updated_at = _now()
        db.commit()
        db.refresh(model)
        log_audit(db, "system", "model.updated", model.name, "model", model.id)
    return model


# ─── Deployments ──────────────────────────────────────────────────────

def list_deployments(db: Session, limit: int = 100, offset: int = 0, project_id: str = None, user_id: str = None) -> list:
    q = db.query(Deployment).options(
        selectinload(Deployment.model),
        selectinload(Deployment.user),
        selectinload(Deployment.project),
    ).order_by(desc(Deployment.created_at))
    if project_id:
        q = q.filter(Deployment.project_id == project_id)
    if user_id:
        q = q.filter((Deployment.user_id == user_id) | (Deployment.user_id == None))
    return q.offset(offset).limit(limit).all()


def create_deployment(db: Session, data: dict) -> Deployment:
    dep = Deployment(id=_uid(), created_at=_now(), **data)
    try:
        db.add(dep)
        db.commit()
        db.refresh(dep)
    except Exception:
        db.rollback()
        raise
    log_audit(db, data.get("user_id", "system"), "deployment.created",
              dep.name, "deployment", dep.id)
    return dep


def delete_deployment(db: Session, dep_id: str) -> bool:
    dep = db.query(Deployment).filter(Deployment.id == dep_id).first()
    if dep:
        name = dep.name
        try:
            db.delete(dep)
            db.commit()
        except Exception:
            db.rollback()
            raise
        log_audit(db, "system", "deployment.deleted", name, "deployment", dep_id)
        return True
    return False


# ─── Pipelines ────────────────────────────────────────────────────────

def list_pipelines(db: Session, limit: int = 100, offset: int = 0, user_id: str = None) -> list:
    q = db.query(Pipeline).options(
        selectinload(Pipeline.runs),
        selectinload(Pipeline.created_by_user),
    ).order_by(desc(Pipeline.created_at))
    if user_id:
        q = q.filter((Pipeline.user_id == user_id) | (Pipeline.user_id == None))
    return q.offset(offset).limit(limit).all()


def create_pipeline(db: Session, user_id: str, name: str, steps: list,
                    description: str = None, schedule: str = None) -> Pipeline:
    pipe = Pipeline(id=_uid(), user_id=user_id, name=name, steps=steps,
                    description=description, schedule=schedule, created_at=_now())
    try:
        db.add(pipe)
        db.commit()
        db.refresh(pipe)
    except Exception:
        db.rollback()
        raise
    log_audit(db, user_id or "system", "pipeline.created", name, "pipeline", pipe.id)
    return pipe


def get_pipeline(db: Session, pipeline_id: str) -> Optional[Pipeline]:
    return db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()


def update_pipeline(db: Session, pipeline_id: str, name: str = None,
                    description: str = None, steps: list = None,
                    schedule: str = None) -> Optional[Pipeline]:
    pipe = get_pipeline(db, pipeline_id)
    if not pipe:
        return None
    if name is not None:
        pipe.name = name
    if description is not None:
        pipe.description = description
    if steps is not None:
        pipe.steps = steps
    if schedule is not None:
        pipe.schedule = schedule
    pipe.updated_at = _now()
    db.commit()
    db.refresh(pipe)
    log_audit(db, "system", "pipeline.updated", pipe.name, "pipeline", pipe.id)
    return pipe


def delete_pipeline(db: Session, pipeline_id: str) -> bool:
    pipe = get_pipeline(db, pipeline_id)
    if not pipe:
        return False
    name = pipe.name
    db.query(PipelineRun).filter(PipelineRun.pipeline_id == pipeline_id).delete()
    db.delete(pipe)
    db.commit()
    log_audit(db, "system", "pipeline.deleted", name, "pipeline", pipeline_id)
    return True


def run_pipeline(db: Session, pipeline_id: str) -> PipelineRun:
    from pipeline_engine import execute_pipeline_steps
    pipeline = get_pipeline(db, pipeline_id)
    if not pipeline:
        raise ValueError("Pipeline not found")
    run = PipelineRun(id=_uid(), pipeline_id=pipeline_id, status="running",
                      current_step="Starting...",
                      started_at=_now(), created_at=_now())
    db.add(run)
    pipeline.status = "running"
    db.commit()
    db.refresh(run)

    for update in execute_pipeline_steps(pipeline, run.id):
        step_info = update.get("step", "")
        step_status = update.get("status", "")
        if step_status == "failed":
            run.status = "failed"
            run.current_step = step_info
            run.error = update.get("error", "Unknown error")
            run.completed_at = _now()
            pipeline.status = "failed"
        elif step_status == "running":
            run.current_step = step_info
        elif step_info == "complete":
            run.status = "completed"
            run.current_step = "Complete"
            run.completed_at = _now()
            pipeline.status = "active"
        else:
            run.current_step = step_info
        run.results = {
            "step": step_info,
            "status": step_status,
            "state_keys": update.get("state_keys", []),
        }
        db.commit()

    db.refresh(run)
    log_audit(db, "system", "pipeline.run", pipeline.name, "pipeline", pipeline.id,
              details={"run_id": run.id, "status": run.status})
    return run


def list_pipeline_runs(db: Session, pipeline_id: str, limit: int = 20, offset: int = 0) -> list:
    return (db.query(PipelineRun).options(
        selectinload(PipelineRun.pipeline),
    ).filter(PipelineRun.pipeline_id == pipeline_id)
            .order_by(desc(PipelineRun.created_at))
            .offset(offset).limit(limit)
            .all())


def get_pipeline_run(db: Session, run_id: str) -> Optional[PipelineRun]:
    return db.query(PipelineRun).filter(PipelineRun.id == run_id).first()


# ─── Webhooks ─────────────────────────────────────────────────────────

def list_webhooks(db: Session, limit: int = 100, user_id: str = None) -> list:
    q = db.query(Webhook).order_by(desc(Webhook.created_at))
    if user_id:
        q = q.filter((Webhook.user_id == user_id) | (Webhook.user_id == None))
    return q.limit(limit).all()


def create_webhook(db: Session, data: dict) -> Webhook:
    wh = Webhook(id=_uid(), created_at=_now(), **data)
    db.add(wh)
    db.commit()
    db.refresh(wh)
    log_audit(db, data.get("user_id", "system"), "webhook.created", wh.name, "webhook", wh.id)
    return wh


def delete_webhook(db: Session, wh_id: str) -> bool:
    wh = db.query(Webhook).filter(Webhook.id == wh_id).first()
    if wh:
        name = wh.name
        db.delete(wh)
        db.commit()
        log_audit(db, "system", "webhook.deleted", name, "webhook", wh_id)
        return True
    return False


# ─── API Keys ─────────────────────────────────────────────────────────

def list_api_keys(db: Session, user_id: str) -> list:
    return db.query(ApiKey).filter(ApiKey.user_id == user_id).order_by(desc(ApiKey.created_at)).all()


def create_api_key(db: Session, user_id: str, name: str) -> dict:
    raw_key = f"amk_{uuid.uuid4().hex}"
    key_prefix = raw_key[:12]
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    api_key = ApiKey(
        id=_uid(), user_id=user_id, name=name,
        key_prefix=key_prefix, key_hash=key_hash, created_at=_now()
    )
    try:
        db.add(api_key)
        db.commit()
        db.refresh(api_key)
    except Exception:
        db.rollback()
        raise
    log_audit(db, user_id, "api_key.created", name, "api_key", api_key.id)
    return {"id": api_key.id, "name": name, "key": raw_key, "key_prefix": key_prefix}


def delete_api_key(db: Session, key_id: str) -> bool:
    ak = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if ak:
        name = ak.name
        user_id = ak.user_id
        db.delete(ak)
        db.commit()
        log_audit(db, user_id, "api_key.deleted", name, "api_key", key_id)
        return True
    return False


# ─── Teams ────────────────────────────────────────────────────────────

def list_teams(db: Session) -> list:
    return db.query(Team).all()


def create_team(db: Session, name: str, owner_id: str) -> Team:
    team = Team(id=_uid(), name=name, slug=name.lower().replace(" ", "-"), created_at=_now())
    db.add(team)
    db.commit()
    db.refresh(team)
    member = TeamMember(id=_uid(), user_id=owner_id, team_id=team.id, role="admin")
    db.add(member)
    db.commit()
    log_audit(db, owner_id, "team.created", name, "team", team.id)
    return team


# ─── Audit Log ────────────────────────────────────────────────────────

def list_audit_logs(db: Session, limit: int = 100) -> list:
    return db.query(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit).all()


# ─── Projects ─────────────────────────────────────────────────────────

def list_projects(db: Session, user_id: str = None) -> list:
    q = db.query(Project).order_by(desc(Project.created_at))
    if user_id:
        q = q.filter((Project.user_id == user_id) | (Project.user_id == None))
    return q.all()


def create_project(db: Session, name: str, user_id: str = None, description: str = None,
                   problem_type: str = "classification", visibility: str = "private",
                   tags: list = None) -> Project:
    project = Project(id=_uid(), user_id=user_id, name=name, description=description,
                      problem_type=problem_type, visibility=visibility, tags=tags or [],
                      created_at=_now())
    db.add(project)
    db.commit()
    db.refresh(project)
    log_audit(db, user_id or "system", "project.created", name, "project", project.id)
    return project


def get_project(db: Session, project_id: str) -> Optional[Project]:
    return db.query(Project).options(
        selectinload(Project.experiments),
        selectinload(Project.model_registry),
        selectinload(Project.deployments),
        selectinload(Project.datasets),
    ).filter(Project.id == project_id).first()


def update_project(db: Session, project_id: str, name: str = None,
                   description: str = None, status: str = None,
                   notes: str = None, problem_type: str = None,
                   visibility: str = None, tags: list = None) -> Optional[Project]:
    project = get_project(db, project_id)
    if not project:
        return None
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    if status is not None:
        project.status = status
    if notes is not None:
        project.notes = notes
    if problem_type is not None:
        project.problem_type = problem_type
    if visibility is not None:
        project.visibility = visibility
    if tags is not None:
        project.tags = tags
    project.updated_at = _now()
    db.commit()
    db.refresh(project)
    log_audit(db, "system", "project.updated", project.name, "project", project.id)
    return project


def list_projects_by_user(db: Session, user_id: str) -> list:
    return db.query(Project).filter(Project.user_id == user_id).order_by(desc(Project.created_at)).all()


# ─── Dataset Records ──────────────────────────────────────────────────

def create_dataset_record(db: Session, filename: str, size_kb: float = None,
                          rows: int = None, columns: list = None,
                          project_id: str = None, user_id: str = None,
                          tags: list = None, source: str = "upload",
                          source_url: str = None, version: int = 1) -> Dataset:
    record = Dataset(
        id=_uid(), filename=filename, file_size_kb=size_kb,
        rows=rows, columns=columns, project_id=project_id,
        user_id=user_id, created_at=_now(),
        tags=tags or [], source=source, source_url=source_url, version=version
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    log_audit(db, user_id or "system", "dataset.created", filename, "dataset", record.id)
    return record


def list_dataset_records(db: Session, project_id: str = None, limit: int = 100, offset: int = 0, user_id: str = None) -> list:
    q = db.query(Dataset).options(
        selectinload(Dataset.user),
        selectinload(Dataset.project),
    ).order_by(desc(Dataset.created_at))
    if project_id:
        q = q.filter(Dataset.project_id == project_id)
    if user_id:
        q = q.filter((Dataset.user_id == user_id) | (Dataset.user_id == None))
    return q.offset(offset).limit(limit).all()


def get_dataset_record(db: Session, name: str) -> Optional[Dataset]:
    return db.query(Dataset).filter(Dataset.filename == name).first()


def delete_dataset_record(db: Session, name: str, user_id: str = "system") -> bool:
    record = get_dataset_record(db, name)
    if record:
        db.delete(record)
        db.commit()
        log_audit(db, user_id, "dataset.deleted", name, "dataset", record.id)
        return True
    return False


def update_dataset_tags(db: Session, name: str, tags: list) -> Optional[Dataset]:
    record = get_dataset_record(db, name)
    if record:
        record.tags = tags
        record.updated_at = _now()
        db.commit()
        db.refresh(record)
    return record


def update_dataset_description(db: Session, name: str, description: str) -> Optional[Dataset]:
    record = get_dataset_record(db, name)
    if record:
        record.description = description
        record.updated_at = _now()
        db.commit()
        db.refresh(record)
    return record


def bump_dataset_version(db: Session, name: str) -> int:
    record = get_dataset_record(db, name)
    if record:
        record.version = (record.version or 0) + 1
        record.updated_at = _now()
        db.commit()
        db.refresh(record)
        return record.version
    return 1


def share_dataset(db: Session, dataset_id: str, shared_with_user_id: str = None,
                  shared_with_email: str = None, permission: str = "view") -> dict:
    from models import DatasetShare
    share = DatasetShare(
        id=_uid(), dataset_id=dataset_id,
        shared_with_user_id=shared_with_user_id,
        shared_with_email=shared_with_email,
        permission=permission, created_at=_now()
    )
    db.add(share)
    db.commit()
    return {"id": share.id, "permission": permission}


def list_dataset_shares(db: Session, dataset_id: str) -> list:
    from models import DatasetShare
    return db.query(DatasetShare).filter(DatasetShare.dataset_id == dataset_id).all()


def remove_dataset_share(db: Session, share_id: str) -> bool:
    from models import DatasetShare
    share = db.query(DatasetShare).filter(DatasetShare.id == share_id).first()
    if share:
        db.delete(share)
        db.commit()
        return True
    return False


# ─── Global Search ────────────────────────────────────────────────────

def global_search(db: Session, query: str, dataset_dir: str, user_id: str = None) -> dict:
    term = f"%{query}%"
    users = db.query(User).filter(
        (User.name.ilike(term)) | (User.email.ilike(term))
    ).options(
        selectinload(User.teams),
        selectinload(User.api_keys),
    ).limit(10).all()
    proj_q = db.query(Project).filter(
        (Project.name.ilike(term)) | (Project.description.ilike(term))
    ).options(
        selectinload(Project.experiments),
        selectinload(Project.model_registry),
        selectinload(Project.deployments),
        selectinload(Project.datasets),
    )
    if user_id:
        proj_q = proj_q.filter(Project.user_id == user_id)
        projects = proj_q.limit(10).all()
    else:
        projects = proj_q.limit(10).all()
    ds_q = db.query(Dataset).filter(Dataset.filename.ilike(term)).options(
        selectinload(Dataset.user),
        selectinload(Dataset.project),
    )
    if user_id:
        ds_q = ds_q.filter(Dataset.user_id == user_id)
    datasets = ds_q.limit(10).all()

    exp_q = db.query(Experiment).options(
        selectinload(Experiment.user),
        selectinload(Experiment.project),
        selectinload(Experiment.model_registry),
    ).filter(
        (Experiment.name.ilike(term)) | (Experiment.model.ilike(term)) | (Experiment.dataset.ilike(term))
    )
    if user_id:
        exp_q = exp_q.filter(Experiment.user_id == user_id)
    experiments = exp_q.limit(10).all()

    pred_q = db.query(PredictionLog).filter(
        (PredictionLog.model_name.ilike(term)) | (PredictionLog.input_preview.ilike(term)) | (PredictionLog.prediction.ilike(term))
    )
    if user_id:
        pred_q = pred_q.filter(PredictionLog.user_id == user_id)
    predictions = pred_q.limit(10).all()

    reg_q = db.query(ModelRegistry).options(
        selectinload(ModelRegistry.user),
        selectinload(ModelRegistry.project),
        selectinload(ModelRegistry.experiment),
    ).filter(
        (ModelRegistry.name.ilike(term)) | (ModelRegistry.model_type.ilike(term)) | (ModelRegistry.task_type.ilike(term))
    )
    if user_id:
        reg_q = reg_q.filter(ModelRegistry.user_id == user_id)
    registry_models = reg_q.limit(10).all()

    model_files = []
    if os.path.isdir(dataset_dir):
        parent = os.path.dirname(dataset_dir)
        if os.path.isdir(parent):
            for root, dirs, files in os.walk(parent):
                for f in files:
                    if query.lower() in f.lower():
                        rel = os.path.relpath(os.path.join(root, f), parent)
                        model_files.append({"path": rel, "name": f})
    return {
        "users": [{"id": u.id, "name": u.name, "email": u.email} for u in users],
        "projects": [{"id": p.id, "name": p.name, "description": p.description} for p in projects],
        "datasets": [{"id": d.id, "filename": d.filename, "rows": d.rows} for d in datasets],
        "models": model_files[:20],
        "experiments": [{"id": e.id, "name": e.name, "model": e.model, "dataset": e.dataset, "cv_score": e.cv_score, "status": e.status} for e in experiments],
        "predictions": [{"id": p.id, "model_name": p.model_name, "input_preview": p.input_preview, "prediction": p.prediction, "confidence": p.confidence, "created_at": str(p.created_at)[:19] if p.created_at else None} for p in predictions],
        "registry_models": [{"id": m.id, "name": m.name, "model_type": m.model_type, "task_type": m.task_type, "status": m.status, "version": m.version, "cv_score": m.cv_score} for m in registry_models],
    }


# ─── Marketplace ──────────────────────────────────────────────────────

def list_datasets(db: Session, project_id: str = None, limit: int = 100, offset: int = 0) -> list:
    q = db.query(Dataset).options(
        selectinload(Dataset.user),
        selectinload(Dataset.project),
    ).order_by(desc(Dataset.created_at))
    if project_id:
        q = q.filter(Dataset.project_id == project_id)
    return q.offset(offset).limit(limit).all()


def list_model_registry(db: Session, limit: int = 100, offset: int = 0, project_id: str = None) -> list:
    q = db.query(ModelRegistry).options(
        selectinload(ModelRegistry.user),
        selectinload(ModelRegistry.project),
        selectinload(ModelRegistry.experiment),
    ).order_by(desc(ModelRegistry.created_at))
    if project_id:
        q = q.filter(ModelRegistry.project_id == project_id)
    return q.offset(offset).limit(limit).all()


# ─── Prediction Logs ───────────────────────────────────────────────

def create_prediction_log(db: Session, data: dict) -> PredictionLog:
    log = PredictionLog(id=_uid(), created_at=_now(), **data)
    db.add(log)
    db.commit()
    return log


def list_prediction_logs(db: Session, limit: int = 100, user_id: str = None) -> list:
    q = db.query(PredictionLog).order_by(desc(PredictionLog.created_at))
    if user_id:
        q = q.filter((PredictionLog.user_id == user_id) | (PredictionLog.user_id == None))
    return q.limit(limit).all()


def get_prediction_log(db: Session, pred_id: str) -> Optional[PredictionLog]:
    return db.query(PredictionLog).filter(PredictionLog.id == pred_id).first()


def delete_prediction_log(db: Session, pred_id: str) -> bool:
    log = db.query(PredictionLog).filter(PredictionLog.id == pred_id).first()
    if log:
        db.delete(log)
        db.commit()
        return True
    return False


def get_experiment(db: Session, exp_id: str) -> Optional[Experiment]:
    return db.query(Experiment).options(
        selectinload(Experiment.user),
        selectinload(Experiment.project),
        selectinload(Experiment.model_registry),
    ).filter(Experiment.id == exp_id).first()


def delete_experiment(db: Session, exp_id: str) -> bool:
    exp = db.query(Experiment).filter(Experiment.id == exp_id).first()
    if exp:
        name = exp.name
        db.delete(exp)
        db.commit()
        log_audit(db, "system", "experiment.deleted", name, "experiment", exp_id)
        return True
    return False


def compare_experiments(db: Session, ids: list) -> list:
    return db.query(Experiment).filter(Experiment.id.in_(ids)).options(
        selectinload(Experiment.user),
        selectinload(Experiment.project),
        selectinload(Experiment.model_registry),
    ).all()


def get_deployment(db: Session, dep_id: str) -> Optional[Deployment]:
    return db.query(Deployment).filter(Deployment.id == dep_id).first()


def update_deployment(db: Session, dep_id: str, **kwargs) -> Optional[Deployment]:
    dep = get_deployment(db, dep_id)
    if not dep:
        return None
    for k, v in kwargs.items():
        if v is not None and hasattr(dep, k):
            setattr(dep, k, v)
    dep.updated_at = _now()
    db.commit()
    db.refresh(dep)
    log_audit(db, "system", "deployment.updated", dep.name, "deployment", dep.id)
    return dep


def create_deployment_history(db: Session, deployment_id: str, action: str,
                               old_status: str = None, new_status: str = None,
                               details: dict = None, actor: str = None):
    from models import DeploymentHistory
    entry = DeploymentHistory(
        id=_uid(), deployment_id=deployment_id, action=action,
        old_status=old_status, new_status=new_status,
        details=details, actor=actor, created_at=_now(),
    )
    db.add(entry)
    db.commit()
    return entry


def list_deployment_history(db: Session, deployment_id: str, limit: int = 50):
    from models import DeploymentHistory
    return db.query(DeploymentHistory).filter(
        DeploymentHistory.deployment_id == deployment_id
    ).order_by(desc(DeploymentHistory.created_at)).limit(limit).all()


def count_unread_notifications(db: Session, user_id: str = None) -> int:
    q = db.query(Notification).filter(Notification.read == False)
    if user_id:
        q = q.filter(Notification.user_id == user_id)
    return q.count()


def get_audit_log(db: Session, log_id: str) -> Optional[AuditLog]:
    return db.query(AuditLog).filter(AuditLog.id == log_id).first()


def get_team(db: Session, team_id: str) -> Optional[Team]:
    return db.query(Team).filter(Team.id == team_id).first()


def update_team(db: Session, team_id: str, name: str = None) -> Optional[Team]:
    team = get_team(db, team_id)
    if not team:
        return None
    if name is not None:
        team.name = name
        team.slug = name.lower().replace(" ", "-")
    team.updated_at = _now()
    db.commit()
    db.refresh(team)
    log_audit(db, "system", "team.updated", team.name, "team", team.id)
    return team


def delete_team(db: Session, team_id: str) -> bool:
    team = get_team(db, team_id)
    if team:
        name = team.name
        db.query(TeamMember).filter(TeamMember.team_id == team_id).delete()
        db.delete(team)
        db.commit()
        log_audit(db, "system", "team.deleted", name, "team", team_id)
        return True
    return False


# ─── Marketplace ────────────────────────────────────────────────────

def list_marketplace_items(db: Session, category: str = None) -> list:
    q = db.query(MarketplaceItem)
    if category and category != "all":
        q = q.filter(MarketplaceItem.category == category)
    return q.order_by(desc(MarketplaceItem.featured), desc(MarketplaceItem.downloads)).all()


def install_marketplace_item(db: Session, item_id: str, user_id: str = "system") -> Optional[MarketplaceItem]:
    item = db.query(MarketplaceItem).filter(MarketplaceItem.id == item_id).first()
    if item:
        item.downloads = (item.downloads or 0) + 1
        db.commit()
        db.refresh(item)
        log_audit(db, user_id, "marketplace.install", item.name, "marketplace", item.id)
    return item


# ─── Notifications ──────────────────────────────────────────────────

def create_notification(db: Session, data: dict) -> Notification:
    notif = Notification(id=_uid(), created_at=_now(), **data)
    db.add(notif)
    db.commit()
    return notif


def list_notifications(db: Session, user_id: str = None, limit: int = 50) -> list:
    q = db.query(Notification).order_by(desc(Notification.created_at))
    if user_id:
        q = q.filter(Notification.user_id == user_id)
    return q.limit(limit).all()


def mark_notification_read(db: Session, notif_id: str) -> Optional[Notification]:
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if n:
        n.read = True
        db.commit()
        db.refresh(n)
    return n


def mark_all_notifications_read(db: Session, user_id: str = None):
    q = db.query(Notification).filter(Notification.read == False)
    if user_id:
        q = q.filter(Notification.user_id == user_id)
    q.update({Notification.read: True})
    db.commit()


def delete_notification(db: Session, notif_id: str) -> bool:
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if n:
        db.delete(n)
        db.commit()
        return True
    return False


def batch_delete_notifications(db: Session, notif_ids: list[str]) -> int:
    deleted = db.query(Notification).filter(Notification.id.in_(notif_ids)).delete(synchronize_session=False)
    db.commit()
    return deleted
