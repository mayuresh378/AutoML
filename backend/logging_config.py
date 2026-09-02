import os
import json
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.getenv("LOG_FORMAT", "json" if os.getenv("ENVIRONMENT") == "production" else "text")


class StructuredFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        if LOG_FORMAT == "json":
            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
            }
            if record.exc_info and record.exc_info[0]:
                log_entry["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_entry)
        return super().format(record)


def setup_logging():
    handler = logging.StreamHandler()
    handler.setFormatter(StructuredFormatter())
    root = logging.getLogger()
    root.setLevel(LOG_LEVEL)
    root.handlers.clear()
    root.addHandler(handler)
    logging.getLogger("sqlalchemy.engine").setLevel(os.getenv("SQL_LOG_LEVEL", "WARN").upper())
    return root


class RequestLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        start = time.time()
        response = await call_next(request)
        elapsed = round((time.time() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logging.getLogger("access").info(
            "%s %s %s %dms",
            request.method, request.url.path, response.status_code, elapsed,
        )
        return response
