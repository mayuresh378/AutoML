import os
import re
import secrets
import hashlib
import html
from datetime import datetime, timedelta, timezone

# ── CSRF ────────────────────────────────────────────────────────────

CSRF_EXPIRE_MINUTES = 60


def generate_csrf_token(secret: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    expiry = datetime.now(timezone.utc) + timedelta(minutes=CSRF_EXPIRE_MINUTES)
    sig = hashlib.sha256(f"{token}:{expiry.isoformat()}:{secret}".encode()).hexdigest()[:16]
    return f"{token}.{expiry.isoformat()}.{sig}", token


def validate_csrf_token(csrf: str, secret: str) -> bool:
    try:
        parts = csrf.split(".")
        if len(parts) != 3:
            return False
        token, expiry_str, sig = parts
        expiry = datetime.fromisoformat(expiry_str)
        if expiry < datetime.now(timezone.utc):
            return False
        expected = hashlib.sha256(f"{token}:{expiry_str}:{secret}".encode()).hexdigest()[:16]
        return sig == expected
    except Exception:
        return False


# ── XSS / Input Sanitization ────────────────────────────────────────

HTML_TAG_RE = re.compile(r"<[^>]*>")


def sanitize_text(value: str, max_length: int = 2000) -> str:
    if not isinstance(value, str):
        return ""
    value = HTML_TAG_RE.sub("", value)
    value = html.escape(value, quote=True)
    return value[:max_length]


def sanitize_name(value: str) -> str:
    return re.sub(r"[^\w\s\-'.@]", "", value.strip())[:100]


def sanitize_filename(value: str) -> str:
    return re.sub(r"[^\w\.\-]", "_", value.strip())[:255]


# ── SQL Injection Protection ────────────────────────────────────────

DISALLOWED_SQL_PATTERNS = [
    r"\binsert\s+into\b", r"\bupdate\s+\w+\s+set\b", r"\bdelete\s+from\b",
    r"\bdrop\s+(table|view|database|schema|index)\b",
    r"\balter\s+(table|view|schema|database)\b",
    r"\bcreate\s+(table|view|database|schema|index|function|procedure|trigger)\b",
    r"\bgrant\b", r"\brevoke\b", r"\battach\b", r"\bdetach\b",
    r"\bexec\b", r"\bexecute\b", r"\bshutdown\b", r"\binstall\b",
    r"\bload\b", r"\breplace\b", r"\btruncate\b", r"\brename\b",
    r"\binformation_schema\b", r"\bpg_catalog\b", r"\bsqlite_master\b",
    r"\bpragma\b", r"\bwrite\b",
]


def validate_sql_query(query: str) -> tuple[bool, str]:
    sql_lower = query.strip().lower()
    for p in DISALLOWED_SQL_PATTERNS:
        if re.search(p, sql_lower):
            return False, "Disallowed SQL keyword/pattern detected"
    return True, ""


ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".parquet", ".json"}


def validate_upload_filename(filename: str) -> tuple[bool, str]:
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return False, "Invalid filename"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Extension '{ext}' not allowed (allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))})"
    return True, ""
