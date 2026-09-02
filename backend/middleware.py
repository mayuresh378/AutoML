import time
import hashlib
import secrets
from collections import defaultdict
from typing import Callable

from fastapi import Request, HTTPException, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


# ── Security Headers (Helmet equivalent) ────────────────────────────

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; "
        "img-src 'self' data: blob:; "
        "font-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com; "
        "connect-src 'self' http://localhost:* ws://localhost:* https://cdn.jsdelivr.net https://unpkg.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers[header] = value
        return response


# ── Rate Limiting (in-memory sliding window) ────────────────────────

class RateLimiter:
    def __init__(self):
        self._windows: dict[str, list[float]] = defaultdict(list)

    def check(self, key: str, max_requests: int = 60, window_sec: int = 60) -> tuple[bool, int, int]:
        now = time.time()
        window = self._windows[key]
        cutoff = now - window_sec
        while window and window[0] < cutoff:
            window.pop(0)
        if len(window) >= max_requests:
            retry_after = int(window[0] + window_sec - now) if window else window_sec
            return False, len(window), max(retry_after, 1)
        window.append(now)
        return True, len(window), 0

    def key_for_request(self, request: Request) -> str:
        ip = request.client.host if request.client else "unknown"
        token = request.headers.get("authorization", "")
        prefix = hashlib.sha256(token.encode()).hexdigest()[:8] if token else "anon"
        return f"{prefix}:{ip}"


rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, max_requests: int = 60, window_sec: int = 60):
        super().__init__(app)
        self.max_requests = max_requests
        self.window_sec = window_sec

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in ("OPTIONS", "HEAD"):
            return await call_next(request)
        key = rate_limiter.key_for_request(request)
        ok, count, retry_after = rate_limiter.check(key, self.max_requests, self.window_sec)
        if not ok:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Retry after {retry_after}s",
                headers={"Retry-After": str(retry_after), "X-RateLimit-Limit": str(self.max_requests)},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(self.max_requests - count)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + retry_after)
        return response


# ── CSRF Protection ─────────────────────────────────────────────────

CSRF_SKIP_PATHS = {"/api/v1/auth/login", "/api/v1/auth/register",
                   "/api/v1/auth/refresh", "/api/v1/auth/google",
                   "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password",
                   "/api/v1/auth/verify-email"}

# API paths that are exempt from CSRF (uses JWT Bearer token which is CSRF-safe)
CSRF_SKIP_PREFIXES = {"/api/v1/datasets", "/api/v1/query", "/api/v1/cleaning",
                      "/api/v1/feature-engineering", "/api/v1/models",
                      "/api/v1/explain", "/api/v1/deployments", "/api/v1/projects",
                      "/api/v1/experiments", "/api/v1/pipelines", "/api/v1/marketplace",
                      "/api/v1/monitoring", "/api/v1/admin", "/api/v1/profile",
                      "/api/v1/notifications", "/api/v1/automations", "/api/v1/search",
                      "/api/v1/ai", "/api/v1/training", "/api/v1/hpo", "/api/v1/engine"}

CSRF_SKIP_METHODS = {"GET", "HEAD", "OPTIONS"}


class CSRFMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, secret: str):
        super().__init__(app)
        self.secret = secret

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method in CSRF_SKIP_METHODS:
            return await call_next(request)
        path = request.url.path.rstrip("/")
        if path in CSRF_SKIP_PATHS:
            return await call_next(request)
        if any(path.startswith(p) for p in CSRF_SKIP_PREFIXES):
            return await call_next(request)
        csrf_token = request.headers.get("x-csrf-token") or request.headers.get("x-xsrf-token")
        if not csrf_token:
            raise HTTPException(status_code=403, detail="CSRF token missing")
        from security_utils import validate_csrf_token
        if not validate_csrf_token(csrf_token, self.secret):
            raise HTTPException(status_code=403, detail="CSRF token invalid or expired")
        return await call_next(request)
