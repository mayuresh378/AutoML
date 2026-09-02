from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Any
from datetime import datetime


class UserCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255, pattern=r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    name: str
    role: str
    is_active: bool
    mfa_enabled: bool
    created_at: datetime


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


class ExperimentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    model: str
    task_type: Optional[str] = None
    dataset: Optional[str] = None
    target: Optional[str] = None
    cv_score: Optional[float] = None
    metrics: Optional[Any] = None
    training_time: Optional[float] = None
    total_time: Optional[float] = None
    status: str
    run_at: Optional[datetime] = None


class ModelRegistryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    version: int
    model_type: Optional[str] = None
    task_type: Optional[str] = None
    framework: str
    file_size_kb: Optional[float] = None
    cv_score: Optional[float] = None
    status: str
    tags: list = []
    description: Optional[str] = None
    created_at: datetime


class DeploymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    endpoint_url: Optional[str] = None
    status: str
    environment: str
    requests_count: int
    created_at: datetime


class PipelineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    steps: list = []
    schedule: Optional[str] = Field(None, max_length=100)


class PipelineUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    steps: Optional[list] = None
    schedule: Optional[str] = Field(None, max_length=100)


class PipelineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: Optional[str] = None
    steps: list = []
    status: str
    schedule: Optional[str] = None
    created_at: datetime


class PipelineRunResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    pipeline_id: str
    status: str
    current_step: Optional[str] = None
    results: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class WebhookCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., max_length=500)
    events: list = []
    secret: Optional[str] = Field(None, max_length=500)


class WebhookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    url: str
    events: list = []
    status: str
    created_at: datetime


class ApiKeyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    key_prefix: str
    status: str
    created_at: datetime


class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: Optional[str] = None
    plan: str
    created_at: datetime


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    actor: Optional[str] = None
    action: str
    target: Optional[str] = None
    resource_type: Optional[str] = None
    status: str
    created_at: datetime
