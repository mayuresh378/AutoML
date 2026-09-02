from typing import Any
from fastapi.responses import JSONResponse
from fastapi import Request, HTTPException, status as http_status


# ── Standard Response Envelope ──────────────────────────────────────

def ok(data: Any = None, message: str = "Success", status_code: int = 200,
       meta: dict = None) -> JSONResponse:
    body = {"status": "ok", "message": message}
    if data is not None:
        body["data"] = data
    if meta:
        body["meta"] = meta
    return JSONResponse(content=body, status_code=status_code)


def error(detail: str, status_code: int = 400, errors: list = None) -> JSONResponse:
    body = {"status": "error", "message": detail}
    if errors:
        body["errors"] = errors
    return JSONResponse(content=body, status_code=status_code)


def created(data: Any = None, message: str = "Created") -> JSONResponse:
    return ok(data, message, status_code=201)


def deleted(message: str = "Deleted") -> JSONResponse:
    return ok(None, message, status_code=200)


# ── Paginated List Envelope ─────────────────────────────────────────

def paginated(items: list, total: int, offset: int, limit: int,
              key: str = "items", meta: dict = None) -> dict:
    result = {
        key: items,
        "total": total,
        "offset": offset,
        "limit": limit,
    }
    if meta:
        result["meta"] = meta
    return result


# ── Centralized Exception Handler ───────────────────────────────────

EXCEPTION_STATUS_MAP = {
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable Entity",
    429: "Too Many Requests",
    500: "Internal Server Error",
}


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        status_code = exc.status_code
        detail = exc.detail
        headers = exc.headers
    else:
        status_code = 500
        detail = "Internal Server Error"
        headers = None

    body = {
        "status": "error",
        "message": detail,
        "error": EXCEPTION_STATUS_MAP.get(status_code, "Unknown"),
        "status_code": status_code,
    }
    resp = JSONResponse(content=body, status_code=status_code)
    if headers:
        for k, v in headers.items():
            resp.headers[k] = v
    return resp


# ── Validation Error Handler (Pydantic) ─────────────────────────────

async def validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    body = {
        "status": "error",
        "message": "Validation failed",
        "error": "Unprocessable Entity",
        "status_code": 422,
        "errors": getattr(exc, "errors", lambda: [])(),
    }
    return JSONResponse(content=body, status_code=422)


# ── OpenAPI Tags ────────────────────────────────────────────────────

TAGS_METADATA = [
    {"name": "Health", "description": "Health check & readiness probes"},
    {"name": "Auth", "description": "Authentication, registration, password management"},
    {"name": "Security", "description": "CSRF tokens & security utilities"},
    {"name": "Search", "description": "Global search across all resources"},
    {"name": "Notifications", "description": "User notification management"},
    {"name": "Datasets", "description": "Dataset upload, download, preview, profile, cleaning"},
    {"name": "Experiments", "description": "Training experiment records"},
    {"name": "Training", "description": "Model training, HPO tuning, AutoML engine"},
    {"name": "Models", "description": "Model registry, download, metadata"},
    {"name": "Deployments", "description": "Model deployment management"},
    {"name": "Predictions", "description": "Single & batch predictions, explanation"},
    {"name": "Pipelines", "description": "ML pipeline management & execution"},
    {"name": "Webhooks", "description": "Webhook integration management"},
    {"name": "Teams", "description": "Team management"},
    {"name": "API Keys", "description": "API key management"},
    {"name": "Monitoring", "description": "System monitoring metrics & stats"},
    {"name": "Projects", "description": "Project management"},
    {"name": "Marketplace", "description": "Model & template marketplace"},
    {"name": "Activity", "description": "Activity timeline & audit logs"},
    {"name": "Analytics", "description": "Dashboard analytics & insights"},
    {"name": "Admin", "description": "Administration panel"},
    {"name": "SQL", "description": "SQL query execution"},
    {"name": "AI Assistant", "description": "AI-powered chat & suggestions"},
]
