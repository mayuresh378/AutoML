# AutoML Platform API Documentation

**Version:** 3.0.0 | **Base URL:** `/api/v1`

---

## Overview

RESTful JSON API served by FastAPI. Authentication via JWT Bearer token in the `Authorization` header. All responses use a standard envelope format.

**Standard success envelope:**

```json
{
  "status": "ok",
  "message": "Human-readable message",
  "data": { "key": "value" },
  "meta": { "total": 100, "offset": 0, "limit": 50 }
}
```

**Paginated list envelope:**

```json
{
  "items": [ ... ],
  "total": 150,
  "offset": 0,
  "limit": 50
}
```

**Error envelope:**

```json
{
  "status": "error",
  "message": "Human-readable error",
  "error": "Error Type",
  "status_code": 400,
  "errors": [
    { "loc": ["body", "email"], "msg": "field required", "type": "value_error.missing" }
  ]
}
```

---

## Pagination

All list endpoints accept `offset` (default `0`) and `limit` (default `50`, max `500`) query parameters.

---

## Rate Limiting

60 requests per minute per IP/API key. Headers returned on every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait (only on `429` responses) |

---

## Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user account | No |
| POST | `/api/v1/auth/login` | Login, returns JWT access + refresh tokens | No |
| POST | `/api/v1/auth/refresh` | Refresh an expired access token | No |
| GET | `/api/v1/auth/me` | Get current user profile | Yes |
| PUT | `/api/v1/auth/profile` | Update current user name and preferences | Yes |
| POST | `/api/v1/auth/change-password` | Change password (requires current password) | Yes |
| POST | `/api/v1/auth/send-verification` | Send email verification link | Yes |
| POST | `/api/v1/auth/verify-email` | Verify email with token | No |
| POST | `/api/v1/auth/forgot-password` | Send password reset email | No |
| POST | `/api/v1/auth/reset-password` | Reset password with token | No |
| POST | `/api/v1/auth/google` | Google OAuth login | No |
| GET | `/api/v1/auth/sessions` | List all active sessions (paginated) | Yes |
| DELETE | `/api/v1/auth/sessions/{session_id}` | Revoke a specific session | Yes |
| POST | `/api/v1/auth/logout` | Logout current session | Yes |
| POST | `/api/v1/auth/logout-all` | Revoke all sessions for current user | Yes |

### POST `/api/v1/auth/register`

Register a new user with email and password.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | User email address |
| `password` | string | yes | Account password |
| `name` | string | yes | Display name |
| `device_info` | string | no | Device description for session tracking |

**Response** `201 Created`:

```json
{
  "status": "ok",
  "message": "Registration successful",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer",
    "user": { "id": "uuid", "email": "user@example.com", "name": "User" }
  }
}
```

### POST `/api/v1/auth/login`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | User email |
| `password` | string | yes | Account password |
| `device_info` | string | no | Device description |

**Response** `200 OK`: Same structure as register response.

### POST `/api/v1/auth/refresh`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Refresh token from login |

### POST `/api/v1/auth/google`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id_token` | string | yes | Google OAuth ID token |
| `device_info` | string | no | Device description |

### POST `/api/v1/auth/change-password`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `current_password` | string | yes | Current password |
| `new_password` | string | yes | New password |

### POST `/api/v1/auth/forgot-password`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | Registered email address |

### POST `/api/v1/auth/reset-password`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | yes | Reset token from email |
| `new_password` | string | yes | New password |

### PUT `/api/v1/auth/profile`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New display name |
| `preferences` | string (JSON) | no | User preferences object as JSON string |

---

## Security

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/csrf-token` | Generate and return a CSRF protection token | No |

---

## Datasets

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/datasets` | List all datasets (paginated) | No |
| POST | `/api/v1/datasets` | Upload new dataset | Optional |
| GET | `/api/v1/datasets/{name}/download` | Download dataset file | No |
| DELETE | `/api/v1/datasets/{name}` | Delete dataset | Optional |
| GET | `/api/v1/datasets/{name}/preview` | Preview rows with pagination | No |
| GET | `/api/v1/datasets/{name}/profile` | Data quality profile statistics | No |
| GET | `/api/v1/datasets/{name}/analyze` | Statistical analysis | No |
| POST | `/api/v1/datasets/{name}/clean` | Apply cleaning operations | Optional |
| POST | `/api/v1/datasets/{name}/auto-clean` | Auto-detect and clean issues | Optional |
| POST | `/api/v1/datasets/{name}/features/generate` | Generate engineered features | Optional |
| GET | `/api/v1/datasets/{name}/features/suggest` | Suggest feature engineering operations | No |

**Supported file types:** `.csv`, `.xlsx`, `.parquet`, `.json`  
**Max upload size:** Configurable via `MAX_UPLOAD_MB` environment variable.

### GET `/api/v1/datasets`

List all uploaded datasets with metadata.

**Query parameters:** `offset`, `limit`

**Response** `200 OK`:

```json
{
  "datasets": [
    {
      "name": "titanic.csv",
      "size_kb": 61.2,
      "rows": 891,
      "columns": ["PassengerId", "Survived", "Pclass", "Name", ...],
      "dtypes": {"PassengerId": "int64", "Survived": "int64", "Name": "object"},
      "uploaded_at": "2026-07-14T12:00:00",
      "project_id": null,
      "status": "ready"
    }
  ],
  "total": 5,
  "offset": 0,
  "limit": 50
}
```

### POST `/api/v1/datasets`

Upload a new dataset file.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | yes | Dataset file |
| `project_id` | string | no | Associate with a project |

**Response** `200 OK`:

```json
{
  "message": "Uploaded titanic.csv",
  "filename": "titanic.csv",
  "features": ["PassengerId", "Survived", "Pclass"],
  "rows": 891,
  "id": "uuid"
}
```

### GET `/api/v1/datasets/{name}/preview`

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `rows` | int | 50 | Number of rows (max 500) |
| `offset` | int | 0 | Row offset |

**Response** `200 OK`:

```json
{
  "name": "titanic.csv",
  "total_rows": 891,
  "offset": 0,
  "rows_returned": 50,
  "columns": ["PassengerId", "Survived"],
  "data": [{"PassengerId": 1, "Survived": 0}, ...]
}
```

### GET `/api/v1/datasets/{name}/analyze`

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `target` | string | no | Target column for analysis |

Returns statistical summaries, correlations, missing value analysis, and distribution info.

### POST `/api/v1/datasets/{name}/clean`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operations` | string (JSON) | yes | Cleaning operations array, e.g. `[{"op": "fill_missing", "column": "age", "method": "median"}]` |

### POST `/api/v1/datasets/{name}/features/generate`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operations` | string (JSON) | yes | Feature generation operations array |

---

## Experiments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/experiments` | List training experiments (paginated) | Optional |

**Query parameters:** `offset`, `limit`

**Response item fields:** `id`, `name`, `model`, `task_type`, `dataset`, `target`, `cv_score`, `metrics`, `training_time`, `total_time`, `memory_usage`, `cpu_usage`, `status`, `runAt`, `params`, `feature_importance`, `confusion_matrix`, `user_id`, `project_id`, `created_at`

---

## Training

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/training` | Run AutoML training | Optional |
| POST | `/api/v1/tuning` | Hyperparameter tuning | Optional |
| GET | `/api/v1/tuning/params` | Get available HPO search spaces | No |
| GET | `/api/v1/engine/models` | List available AutoML engine models | No |
| POST | `/api/v1/engine/train` | Train multiple models via engine | Optional |

### POST `/api/v1/training`

Run full AutoML training on a dataset. Automatically preprocesses data, trains multiple models, and selects the best.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_name` | string | yes | Dataset filename (e.g. `titanic.csv`) |
| `target_column` | string | yes | Target column name |
| `task_type` | string | no | `classification` or `regression` (auto-detected if omitted) |
| `project_id` | string | no | Associate with a project |

**Response** `200 OK`:

```json
{
  "status": "Success",
  "message": "Training completed!",
  "data_summary": { "features_count": 10, "rows_count": 891, "task_type": "classification" },
  "training_summary": {
    "best_model": "RandomForest",
    "cv_score": 0.832,
    "metrics": { "accuracy": 0.83, "f1": 0.81 },
    "training_time": 2.34,
    "feature_importance": {"Pclass": 0.15, "Age": 0.12},
    "best_params": {"n_estimators": 200}
  }
}
```

### POST `/api/v1/tuning`

Run hyperparameter tuning on specified models.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_name` | string | yes | Dataset filename |
| `target_column` | string | yes | Target column name |
| `models` | string (JSON) | yes | JSON array of model names, e.g. `["RandomForest", "GradientBoosting"]` |
| `params` | string (JSON) | no | Parameter overrides (default `{}`) |
| `search_method` | string | no | `random` (default) or `grid` |
| `cv_folds` | int | no | Cross-validation folds (default `5`) |
| `task_type` | string | no | `classification` or `regression` |
| `project_id` | string | no | Associate with a project |

**Response** `200 OK`:

```json
{
  "results": [
    {
      "name": "RandomForest",
      "cv_score": 0.851,
      "metrics": {"accuracy": 0.85, "f1": 0.83},
      "best_params": {"n_estimators": 300, "max_depth": 15},
      "training_time": 4.2
    }
  ],
  "experiments": [{"id": "uuid", "name": "titanic-RandomForest-tuned", ...}],
  "task_type": "classification"
}
```

### GET `/api/v1/tuning/params`

Returns available hyperparameter search spaces for all models, grouped by task type.

**Response** `200 OK`:

```json
{
  "classification": {
    "LogisticRegression": {
      "params": [{"name": "C", "type": "float", "range": [0.001, 10]}],
      "formats": {"C": {"type": "float", "range": [0.001, 10], "log": true}}
    }
  },
  "regression": { ... }
}
```

### GET `/api/v1/engine/models`

Returns available AutoML engine models and framework availability status.

**Response** `200 OK`:

```json
{
  "classification": ["LogisticRegression", "RandomForest", "GradientBoosting", "SVC", "KNN"],
  "regression": ["Ridge", "Lasso", "RandomForest", "GradientBoosting", "SVR"],
  "all": ["LogisticRegression", "RandomForest", ...],
  "optional": {
    "XGBoost": false,
    "LightGBM": false,
    "CatBoost": false
  }
}
```

### POST `/api/v1/engine/train`

Train multiple models via the AutoML engine pipeline.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file_name` | string | yes | Dataset filename |
| `target_column` | string | yes | Target column name |
| `models` | string (JSON) | yes | JSON array of model names |
| `task_type` | string | no | `classification` or `regression` |
| `project_id` | string | no | Associate with a project |

**Response** `200 OK`:

```json
{
  "results": [
    {"name": "RandomForest", "cv_score": 0.832, "metrics": {...}, "training_time": 1.5},
    {"name": "GradientBoosting", "cv_score": 0.851, "metrics": {...}, "training_time": 2.1}
  ],
  "experiments": [{"id": "uuid", "name": "titanic-RandomForest", "model": "RandomForest", "cv_score": 0.832}],
  "best_model": "GradientBoosting",
  "task_type": "classification",
  "elapsed": 3.6
}
```

---

## Models

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/models` | List all models (paginated) | Optional |
| GET | `/api/v1/models/{name}` | Get model metadata | No |
| GET | `/api/v1/models/{name}/download` | Download model file (`.pkl`) | No |
| GET | `/api/v1/models/{name}/meta` | Get model file stats and metadata JSON | No |
| PUT | `/api/v1/models/{name}` | Update model status, tags, description | No |
| DELETE | `/api/v1/models/{name}` | Delete model and its metadata | Optional |

### GET `/api/v1/models`

Returns both filesystem models (`.pkl` files) and registered models from the database.

**Query parameters:** `offset`, `limit`

**Response item fields:** `name`, `size_kb`, `task_type`, `best_score`, `metrics`, `created_at`, `id`, `version`, `model_type`, `framework`, `file_size_kb`, `cv_score`, `status`, `tags`, `description`, `experiment_id`

### GET `/api/v1/models/{name}`

**Response** `200 OK`:

```json
{
  "name": "titanic_RandomForest.pkl",
  "task_type": "classification",
  "cv_score": 0.832,
  "metrics": {"accuracy": 0.83, "f1": 0.81},
  "best_params": {"n_estimators": 200}
}
```

### GET `/api/v1/models/{name}/download`

Returns the model file as `application/octet-stream` attachment.

### PUT `/api/v1/models/{name}`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | no | New status (e.g. `staging`, `production`, `archived`) |
| `tags` | string (JSON) | no | JSON array of tag strings |
| `description` | string | no | Model description |

---

## Deployments

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/deployments` | List all deployments (paginated) | Optional |
| POST | `/api/v1/deployments` | Create a new deployment | Optional |
| DELETE | `/api/v1/deployments/{dep_id}` | Delete a deployment | Optional |

### GET `/api/v1/deployments`

**Response item fields:** `id`, `model_name`, `endpoint_name`, `endpoint_url`, `status`, `environment`, `requests_count`, `avg_latency_ms`, `created_at`

### POST `/api/v1/deployments`

Deploy a trained model as a serving endpoint.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | yes | Model filename (e.g. `titanic_RandomForest.pkl`) |
| `endpoint_name` | string | yes | Custom endpoint name |
| `project_id` | string | no | Associate with a project |

**Response** `201 Created`:

```json
{
  "id": "uuid",
  "model_name": "titanic_RandomForest.pkl",
  "endpoint_name": "titanic-production",
  "endpoint_url": "/api/v1/predictions?model=titanic_RandomForest.pkl",
  "status": "active",
  "created_at": "2026-07-14T12:00:00"
}
```

---

## Predictions

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/predictions` | Single prediction | Optional |
| POST | `/api/v1/batch-predictions` | Batch predictions on dataset file | Optional |
| POST | `/api/v1/explain` | Explain prediction (SHAP/feature importance) | Optional |
| GET | `/api/v1/predictions/history` | Prediction history (paginated) | Optional |

### POST `/api/v1/predictions`

Run a single prediction using a trained model.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | yes | Model filename |
| `payload` | string (JSON) | yes | Input features as JSON object |

**Response** `200 OK`:

```json
{
  "prediction": 1,
  "confidence": 0.87,
  "latency_ms": 12.3
}
```

### POST `/api/v1/batch-predictions`

Run predictions on every row of a dataset file.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | yes | Model filename |
| `file_name` | string | yes | Dataset filename |

**Response** `200 OK`:

```json
{
  "predictions": [
    {"PassengerId": 1, "Pclass": 3, "prediction": 0, "confidence": 0.92},
    {"PassengerId": 2, "Pclass": 1, "prediction": 1, "confidence": 0.78}
  ],
  "count": 891,
  "latency_ms": 12450.0
}
```

### POST `/api/v1/explain`

Generate feature importance and SHAP-based explanations for a model prediction.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model_name` | string | yes | Model filename |
| `payload` | string (JSON) | no | Input features as JSON object (uses training data if omitted) |

### GET `/api/v1/predictions/history`

Returns a paginated log of all past prediction requests.

**Query parameters:** `offset`, `limit`

**Response item fields:** `id`, `model_name`, `input_preview`, `prediction`, `confidence`, `batch_size`, `latency_ms`, `created_at`

---

## Pipelines

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/pipelines` | List all pipelines (paginated) | Optional |
| POST | `/api/v1/pipelines` | Create a pipeline | Optional |
| GET | `/api/v1/pipelines/{pipeline_id}` | Get pipeline details | No |
| PUT | `/api/v1/pipelines/{pipeline_id}` | Update pipeline config | No |
| DELETE | `/api/v1/pipelines/{pipeline_id}` | Delete pipeline | No |
| POST | `/api/v1/pipelines/{pipeline_id}/run` | Execute a pipeline run | No |
| GET | `/api/v1/pipelines/{pipeline_id}/runs` | List pipeline run history (paginated) | No |
| GET | `/api/v1/pipeline-runs/{run_id}` | Get specific run details | No |

### POST `/api/v1/pipelines`

**Request body** (`application/json`):

```json
{
  "name": "My Pipeline",
  "description": "Training pipeline",
  "steps": [
    {"type": "preprocess", "params": {}},
    {"type": "train", "params": {"model": "RandomForest"}},
    {"type": "evaluate", "params": {}}
  ],
  "schedule": null
}
```

**Pipeline object fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `name` | string | Pipeline name |
| `description` | string | Description |
| `steps` | array | Ordered list of pipeline step objects |
| `status` | string | `idle`, `running`, `completed`, `failed` |
| `schedule` | string | Cron expression or `null` |
| `created_at` | ISO timestamp | Creation time |
| `updated_at` | ISO timestamp | Last update time |

### POST `/api/v1/pipelines/{pipeline_id}/run`

**Response** `200 OK`:

```json
{
  "id": "run-uuid",
  "pipeline_id": "pipeline-uuid",
  "status": "completed",
  "current_step": 2,
  "error": null,
  "started_at": "2026-07-14T12:00:00",
  "completed_at": "2026-07-14T12:00:15"
}
```

---

## Projects

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/projects` | List all projects (paginated) | Optional |
| POST | `/api/v1/projects` | Create project | Optional |
| GET | `/api/v1/projects/templates` | List starter project templates | No |
| GET | `/api/v1/projects/mine` | List current user's projects (paginated) | Optional |
| GET | `/api/v1/projects/{project_id}` | Get project with all associated resources | No |
| PUT | `/api/v1/projects/{project_id}` | Update project | No |
| PUT | `/api/v1/projects/{project_id}/notes` | Update project notes only | No |
| DELETE | `/api/v1/projects/{project_id}` | Delete project | No |

### POST `/api/v1/projects`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Project name |
| `description` | string | no | Project description |

**Response** `201 Created`:

```json
{
  "id": "uuid",
  "name": "Customer Churn Prediction",
  "description": "Predict customer churn",
  "status": "development",
  "created_at": "2026-07-14T12:00:00"
}
```

### GET `/api/v1/projects/templates`

Returns a fixed list of starter project templates.

**Response** `200 OK`:

```json
{
  "templates": [
    {
      "name": "Customer Churn",
      "description": "Predict which customers are likely to churn using classification models.",
      "status": "development",
      "tags": ["classification", "churn", "customer-analytics"]
    },
    {
      "name": "Loan Prediction",
      "description": "Classify loan applications as approved or rejected.",
      "status": "development",
      "tags": ["classification", "finance", "risk"]
    },
    {
      "name": "Heart Disease",
      "description": "Detect heart disease risk using patient health indicators.",
      "status": "development",
      "tags": ["classification", "healthcare", "medical"]
    },
    {
      "name": "House Price Prediction",
      "description": "Predict real estate prices from property features.",
      "status": "development",
      "tags": ["regression", "real-estate", "pricing"]
    },
    {
      "name": "Employee Attrition",
      "description": "Identify employees at risk of leaving.",
      "status": "development",
      "tags": ["classification", "hr", "analytics"]
    }
  ]
}
```

### GET `/api/v1/projects/{project_id}`

Returns the project with all associated datasets, experiments, models, and deployments.

**Response** `200 OK`:

```json
{
  "id": "uuid",
  "name": "Customer Churn",
  "description": "Predict churn",
  "status": "development",
  "notes": "Progress notes...",
  "tags": ["classification"],
  "datasets": [{"name": "churn.csv", "rows": 5000, "columns": [...], "size_kb": 200}],
  "experiments": [{"id": "uuid", "name": "churn-RandomForest", "model": "RandomForest", "cv_score": 0.87}],
  "models": [{"id": "uuid", "name": "churn_RandomForest", "model_type": "RandomForest", "cv_score": 0.87, "status": "staging"}],
  "deployments": [],
  "dataset_count": 1,
  "experiment_count": 1,
  "model_count": 1,
  "deployment_count": 0,
  "created_at": "2026-07-14T12:00:00",
  "updated_at": "2026-07-14T12:30:00"
}
```

### PUT `/api/v1/projects/{project_id}`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | no | New project name |
| `description` | string | no | New description |
| `status` | string | no | New status |
| `notes` | string | no | Project notes |

### PUT `/api/v1/projects/{project_id}/notes`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `notes` | string | no | Notes text (defaults to `""`) |

---

## Search & Activity

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/search` | Global search across all resources | No |
| GET | `/api/v1/activity` | Activity audit log (paginated) | No |
| GET | `/api/v1/analytics` | Dashboard aggregate analytics | No |

### GET `/api/v1/search`

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `q` | string | yes | Search query (min 1 character) |

Searches across datasets, experiments, models, and projects.

### GET `/api/v1/activity`

Returns the audit log of all platform actions.

**Query parameters:** `offset`, `limit`

**Response item fields:** `id`, `actor`, `action`, `target`, `resource_type`, `status`, `time`

### GET `/api/v1/analytics`

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | int | 30 | Number of days to aggregate |

Returns aggregate dashboard analytics (training counts, model performance trends, etc.).

---

## Notifications

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/notifications` | List notifications (paginated) | Optional |
| PUT | `/api/v1/notifications/{notif_id}/read` | Mark notification as read | No |
| PUT | `/api/v1/notifications/read-all` | Mark all notifications as read | Optional |
| DELETE | `/api/v1/notifications/{notif_id}` | Delete a notification | No |

### GET `/api/v1/notifications`

**Query parameters:** `offset`, `limit`

**Response item fields:** `id`, `title`, `message`, `type`, `category`, `resource_type`, `resource_id`, `read`, `created_at`

**Notification types:** `success`, `error`, `info`, `warning`  
**Categories:** `upload`, `training`, `deployment`, `system`

---

## Webhooks

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/webhooks` | List all webhooks (paginated) | Optional |
| POST | `/api/v1/webhooks` | Create webhook | Optional |
| DELETE | `/api/v1/webhooks/{webhook_id}` | Delete webhook | No |

### POST `/api/v1/webhooks`

**Request body** (`application/json`):

```json
{
  "name": "Slack Notifications",
  "url": "https://hooks.slack.com/services/...",
  "events": ["training.completed", "deployment.created"]
}
```

**Webhook object fields:** `id`, `name`, `url`, `events`, `status`, `created_at`

---

## Teams

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/teams` | List all teams (paginated) | Optional |
| POST | `/api/v1/teams` | Create a new team | Optional |

### POST `/api/v1/teams`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Team name |

**Response** `201 Created`:

```json
{
  "id": "uuid",
  "name": "Data Science Team",
  "slug": "data-science-team",
  "plan": "free"
}
```

**Team object fields:** `id`, `name`, `slug`, `plan`, `member_count`, `created_at`

---

## API Keys

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/api-keys` | List API keys (paginated) | Yes |
| POST | `/api/v1/api-keys` | Create new API key | Yes |
| DELETE | `/api/v1/api-keys/{key_id}` | Delete an API key | Yes |

### POST `/api/v1/api-keys`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Human-readable key name |

**Response** `201 Created`:

```json
{
  "id": "uuid",
  "name": "Production API Key",
  "key": "sk-abc123...",
  "key_prefix": "sk-ab",
  "created_at": "2026-07-14T12:00:00"
}
```

> **Note:** The full API key is only shown once at creation time.

---

## Marketplace

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/marketplace` | List marketplace items (paginated) | No |
| POST | `/api/v1/marketplace/{item_id}/install` | Install marketplace item | No |

### GET `/api/v1/marketplace`

**Query parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | string | no | Filter by category |

**Response item fields:** `id`, `name`, `type`, `description`, `category`, `author`, `tags`, `downloads`, `rating`, `featured`

### POST `/api/v1/marketplace/{item_id}/install`

**Response** `200 OK`:

```json
{
  "id": "uuid",
  "name": "XGBoost Integration",
  "downloads": 142
}
```

---

## Monitoring & Health

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/health` | Full health check (DB, disk, counts) | No |
| GET | `/api/v1/health/live` | Liveness probe | No |
| GET | `/api/v1/health/ready` | Readiness probe (includes DB check) | No |
| GET | `/api/v1/monitoring/metrics` | System metrics (CPU, memory, disk) | No |
| GET | `/api/v1/monitoring/stats` | Platform aggregate statistics | No |
| GET | `/metrics` | Prometheus-scrapable metrics (text/plain) | No |

### GET `/api/v1/health`

**Response** `200 OK` (healthy) / `503` (degraded):

```json
{
  "status": "ok",
  "message": "healthy",
  "data": {
    "version": "3.0.0",
    "environment": "production",
    "timestamp": "2026-07-14T12:00:00+00:00",
    "database": "connected",
    "disk_usage_percent": 45.2,
    "disk_free_gb": 120.5,
    "datasets_count": 5,
    "models_count": 12
  }
}
```

### GET `/api/v1/health/live`

Simple liveness check for orchestrators. Always returns `{"status": "alive"}`.

### GET `/api/v1/health/ready`

Returns `{"status": "ready"}` if the database is reachable, otherwise responds with `503`.

### GET `/api/v1/monitoring/metrics`

Returns detailed system metrics including CPU, memory, disk, and network information.

### GET `/api/v1/monitoring/stats`

**Response** `200 OK`:

```json
{
  "modelsTrained": 24,
  "activeDeployments": 5,
  "inferenceRequestsToday": 12,
  "avgLatencyMs": 1250.0
}
```

### GET `/metrics`

Returns Prometheus-formatted metrics in `text/plain`. Available metrics:

- `automl_build_info` (gauge) - Build version and environment
- `automl_cpu_percent` (gauge) - CPU usage percentage
- `automl_memory_percent` (gauge) - Memory usage percentage
- `automl_memory_available_bytes` (gauge) - Available memory in bytes
- `automl_disk_percent` (gauge) - Disk usage percentage
- `automl_disk_free_bytes` (gauge) - Free disk space in bytes

---

## Admin

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/admin/stats` | Platform-wide statistics | No |
| GET | `/api/v1/admin/users` | List all users (paginated) | No |
| PUT | `/api/v1/admin/users/{user_id}/toggle` | Toggle user active/inactive status | No |
| GET | `/api/v1/admin/projects` | List all projects with resource counts (paginated) | No |
| GET | `/api/v1/admin/datasets` | List all dataset records (paginated) | No |
| GET | `/api/v1/admin/logs` | Audit logs (paginated) | No |
| GET | `/api/v1/admin/storage` | Storage usage breakdown | No |

### GET `/api/v1/admin/stats`

**Response** `200 OK`:

```json
{
  "users": 42,
  "projects": 15,
  "experiments": 87,
  "models": 34,
  "datasets": 12,
  "active_users": 38,
  "predictions": 1250,
  "logs_30d": 340,
  "unread_notifications": 5
}
```

### GET `/api/v1/admin/users`

**Response item fields:** `id`, `email`, `name`, `role`, `is_active`, `created_at`

### PUT `/api/v1/admin/users/{user_id}/toggle`

Toggles a user's `is_active` boolean.

**Response** `200 OK`:

```json
{ "status": "ok", "is_active": false }
```

### GET `/api/v1/admin/logs`

**Response item fields:** `id`, `actor`, `action`, `target`, `resource_type`, `resource_id`, `details`, `status`, `ip_address`, `created_at`

### GET `/api/v1/admin/storage`

**Response** `200 OK`:

```json
{
  "models_bytes": 52428800,
  "datasets_bytes": 104857600,
  "database_bytes": 2097152,
  "total_bytes": 159383552,
  "models_mb": 50.0,
  "datasets_mb": 100.0,
  "database_mb": 2.0,
  "total_mb": 152.0,
  "model_count": 34,
  "dataset_count": 12,
  "total_rows": 50000
}
```

---

## SQL & AI

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/query` | Execute read-only SQL query via DuckDB | Optional |
| POST | `/api/v1/ai/chat` | Ask AI assistant about data/models | Optional |
| GET | `/api/v1/ai/suggestions` | Get contextual AI suggestions | No |

### POST `/api/v1/query`

Execute a read-only SQL query against uploaded datasets using DuckDB. Queries are validated and restricted to read operations. Max query length: 10,000 characters.

When a `dataset` is specified, the data is available as the `data` view. Otherwise, each dataset file is available as a view named after the file (e.g. `titanic` for `titanic.csv`).

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | yes | SQL query (max 10,000 chars) |
| `dataset` | string | no | Specific dataset filename to query |

**Example:** `SELECT * FROM data WHERE Age > 30 LIMIT 10`

**Response** `200 OK`:

```json
{
  "columns": ["PassengerId", "Name", "Age"],
  "rows": 10,
  "data": [
    {"PassengerId": 1, "Name": "Braund, Mr. Owen Harris", "Age": 22},
    ...
  ],
  "query": "SELECT * FROM data WHERE Age > 30 LIMIT 10"
}
```

### POST `/api/v1/ai/chat`

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | string | yes | Natural language question about your data or models |

**Response** `200 OK`:

```json
{
  "answer": "Based on the analysis of titanic.csv, the RandomForest model achieved the best CV score of 0.832..."
}
```

### GET `/api/v1/ai/suggestions`

Returns contextual suggestions based on current datasets and experiments.

**Response** `200 OK`:

```json
{
  "suggestions": [
    "Which model should I train on titanic.csv?",
    "How should I clean missing values in titanic.csv?",
    "Suggest features for titanic.csv",
    "Explain the RandomForest results on titanic.csv"
  ]
}
```

---

## OpenAPI Tags

The following tags are used to group endpoints in the auto-generated OpenAPI docs (`/docs`):

| Tag | Description |
|-----|-------------|
| Health | Health check & readiness probes |
| Auth | Authentication, registration, password management |
| Security | CSRF tokens & security utilities |
| Search | Global search across all resources |
| Notifications | User notification management |
| Datasets | Dataset upload, download, preview, profile, cleaning |
| Experiments | Training experiment records |
| Training | Model training, HPO tuning, AutoML engine |
| Models | Model registry, download, metadata |
| Deployments | Model deployment management |
| Predictions | Single & batch predictions, explanation |
| Pipelines | ML pipeline management & execution |
| Webhooks | Webhook integration management |
| Teams | Team management |
| API Keys | API key management |
| Monitoring | System monitoring metrics & stats |
| Projects | Project management |
| Marketplace | Model & template marketplace |
| Activity | Activity timeline & audit logs |
| Analytics | Dashboard analytics & insights |
| Admin | Administration panel |
| SQL | SQL query execution |
| AI Assistant | AI-powered chat & suggestions |
