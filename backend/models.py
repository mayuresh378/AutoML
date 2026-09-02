import uuid
from datetime import datetime, timezone
from sqlalchemy import (Column, String, Text, Integer, Float, Boolean, DateTime,
                        ForeignKey, JSON, UniqueConstraint)
from sqlalchemy.orm import relationship
from database import Base


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="member")
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    reset_token_expiry = Column(DateTime, nullable=True)
    google_id = Column(String, nullable=True, unique=True)
    avatar_url = Column(String, nullable=True)
    preferences = Column(JSON, default=dict)
    mfa_enabled = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    teams = relationship("TeamMember", back_populates="user")
    api_keys = relationship("ApiKey", back_populates="user")
    audit_logs = relationship("AuditLog", back_populates="user")
    pipelines = relationship("Pipeline", back_populates="created_by_user")
    experiments = relationship("Experiment", back_populates="user")
    model_registry = relationship("ModelRegistry", back_populates="user")
    deployments = relationship("Deployment", back_populates="user")
    datasets = relationship("Dataset", back_populates="user")
    prediction_logs = relationship("PredictionLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    projects = relationship("Project", back_populates="user")
    webhooks = relationship("Webhook", back_populates="user")
    sessions = relationship("UserSession", back_populates="user")
    activity_logs = relationship("ActivityLog", back_populates="user")


class Team(Base):
    __tablename__ = "teams"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=True)
    plan = Column(String, default="free")
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    members = relationship("TeamMember", back_populates="team")


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(String, primary_key=True, default=_uuid)
    role = Column(String, default="member")
    joined_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="teams")
    team_id = Column(String, ForeignKey("teams.id"), nullable=False)
    team = relationship("Team", back_populates="members")

    __table_args__ = (UniqueConstraint("user_id", "team_id"),)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="development")
    problem_type = Column(String, default="classification")
    visibility = Column(String, default="private")
    version = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="projects")
    experiments = relationship("Experiment", back_populates="project")
    model_registry = relationship("ModelRegistry", back_populates="project")
    deployments = relationship("Deployment", back_populates="project")
    datasets = relationship("Dataset", back_populates="project")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    key_prefix = Column(String(8), nullable=False)
    key_hash = Column(String, nullable=False)
    status = Column(String, default="active")
    last_used_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="api_keys")


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    model = Column(String, nullable=False)
    task_type = Column(String, nullable=True)
    dataset = Column(String, nullable=True)
    dataset_version = Column(String, nullable=True)
    target = Column(String, nullable=True)
    cv_score = Column(Float, nullable=True)
    metrics = Column(JSON, nullable=True)
    training_time = Column(Float, nullable=True)
    total_time = Column(Float, nullable=True)
    memory_usage = Column(Float, nullable=True)
    cpu_usage = Column(Float, nullable=True)
    status = Column(String, default="success")
    params = Column(JSON, nullable=True)
    notes = Column(String, nullable=True)
    feature_importance = Column(JSON, nullable=True)
    confusion_matrix = Column(JSON, nullable=True)
    run_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="experiments")
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    project = relationship("Project", back_populates="experiments")
    model_registry = relationship("ModelRegistry", back_populates="experiment")


class ModelRegistry(Base):
    __tablename__ = "model_registry"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    version = Column(Integer, default=1)
    model_type = Column(String, nullable=True)
    task_type = Column(String, nullable=True)
    framework = Column(String, default="sklearn")
    file_path = Column(String, nullable=True)
    file_size_kb = Column(Float, nullable=True)
    cv_score = Column(Float, nullable=True)
    metrics = Column(JSON, nullable=True)
    params = Column(JSON, nullable=True)
    status = Column(String, default="staging")
    tags = Column(JSON, default=list)
    description = Column(Text, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    experiment_id = Column(String, ForeignKey("experiments.id"), nullable=True)
    experiment = relationship("Experiment", back_populates="model_registry")
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="model_registry")
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    project = relationship("Project", back_populates="model_registry")
    deployments = relationship("Deployment", back_populates="model")


class Deployment(Base):
    __tablename__ = "deployments"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    endpoint_url = Column(String, nullable=True)
    status = Column(String, default="active")
    environment = Column(String, default="production")
    requests_count = Column(Integer, default=0)
    avg_latency_ms = Column(Float, nullable=True)
    config = Column(JSON, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    deployment_type = Column(String, default="rest_api")
    allow_anonymous = Column(Boolean, default=False)
    allowed_users = Column(JSON, nullable=True)
    allowed_ips = Column(JSON, nullable=True)
    rate_limit = Column(Integer, nullable=True)
    api_key_required = Column(Boolean, default=True)
    docker_image = Column(String, nullable=True)
    docker_port = Column(Integer, default=8080)
    docker_compose = Column(Text, nullable=True)
    fastapi_code = Column(Text, nullable=True)
    onnx_model_path = Column(String, nullable=True)
    download_url = Column(String, nullable=True)
    health_check_url = Column(String, nullable=True)

    model_id = Column(String, ForeignKey("model_registry.id"), nullable=True)
    model = relationship("ModelRegistry", back_populates="deployments")
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="deployments")
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    project = relationship("Project", back_populates="deployments")
    history = relationship("DeploymentHistory", back_populates="deployment", order_by="desc(DeploymentHistory.created_at)")


class Pipeline(Base):
    __tablename__ = "pipelines"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(JSON, default=list)
    status = Column(String, default="draft")
    schedule = Column(String, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    created_by_user = relationship("User", back_populates="pipelines")
    runs = relationship("PipelineRun", back_populates="pipeline")


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id = Column(String, primary_key=True, default=_uuid)
    status = Column(String, default="pending")
    current_step = Column(String, nullable=True)
    results = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    pipeline_id = Column(String, ForeignKey("pipelines.id"), nullable=False)
    pipeline = relationship("Pipeline", back_populates="runs")


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String, primary_key=True, default=_uuid)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)
    file_size_kb = Column(Float, nullable=True)
    rows = Column(Integer, nullable=True)
    columns = Column(JSON, nullable=True)
    status = Column(String, default="uploaded")
    description = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    version = Column(Integer, default=1)
    source = Column(String, default="upload")
    source_url = Column(String, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    project = relationship("Project", back_populates="datasets")
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="datasets")


class DatasetShare(Base):
    __tablename__ = "dataset_shares"

    id = Column(String, primary_key=True, default=_uuid)
    dataset_id = Column(String, ForeignKey("datasets.id"), nullable=False)
    shared_with_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    shared_with_email = Column(String, nullable=True)
    permission = Column(String, default="view")
    created_at = Column(DateTime, default=_now)

    dataset = relationship("Dataset")


class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id = Column(String, primary_key=True, default=_uuid)
    model_name = Column(String, nullable=False)
    input_preview = Column(String, nullable=True)
    prediction = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    batch_size = Column(Integer, default=1)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="prediction_logs")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String, default="info")
    category = Column(String, default="system")
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    read = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="notifications")


class Webhook(Base):
    __tablename__ = "webhooks"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    events = Column(JSON, default=list)
    secret = Column(String, nullable=True)
    status = Column(String, default="active")
    last_triggered_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="webhooks")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, default=_uuid)
    token_hash = Column(String, nullable=False)
    refresh_token_hash = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    last_used_at = Column(DateTime, default=_now)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="sessions")


class MarketplaceItem(Base):
    __tablename__ = "marketplace_items"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    item_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String, nullable=True)
    author = Column(String, nullable=True)
    tags = Column(JSON, default=list)
    downloads = Column(Integer, default=0)
    rating = Column(Float, default=0.0)
    featured = Column(Boolean, default=False)
    config = Column(JSON, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=_uuid)
    actor = Column(String, nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
    status = Column(String, default="success")
    severity = Column(String, default="info")
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="audit_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=_uuid)
    action = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=_now)

    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    user = relationship("User", back_populates="activity_logs")


class DeploymentHistory(Base):
    __tablename__ = "deployment_history"

    id = Column(String, primary_key=True, default=_uuid)
    deployment_id = Column(String, ForeignKey("deployments.id"), nullable=False)
    action = Column(String, nullable=False)
    old_status = Column(String, nullable=True)
    new_status = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    actor = Column(String, nullable=True)
    created_at = Column(DateTime, default=_now)

    deployment = relationship("Deployment", back_populates="history")
