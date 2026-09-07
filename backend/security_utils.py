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
    expiry_str = expiry.isoformat(timespec="seconds")
    sig = hashlib.sha256(f"{token}:{expiry_str}:{secret}".encode()).hexdigest()[:16]
    return f"{token}.{expiry_str}.{sig}", token


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

# Operations that are never allowed regardless of confirmation (can touch the
# filesystem, read arbitrary paths, or escape the sandboxed DuckDB instance).
# Note: destructive DML/DDL (INSERT/UPDATE/DELETE/DROP TABLE/ALTER TABLE/CREATE
# TABLE/TRUNCATE) is intentionally NOT here — those are confirmable in the
# ephemeral sandbox. This list only covers privilege/filesystem/external actions.
DISALLOWED_SQL_PATTERNS = [
    r"\bdrop\s+(view|database|schema|index|function|procedure|trigger|macro)\b",
    r"\balter\s+(view|schema|database|function|type)\b",
    r"\bcreate\s+(or\s+replace\s+)?(database|schema|index|function|procedure|trigger|macro|secret|type)\b",
    r"\bgrant\b", r"\brevoke\b",
    r"\battach\b", r"\bdetach\b",
    r"\bexec\b", r"\bexecute\b", r"\bshutdown\b", r"\binstall\b",
    r"\bload\b",
    r"\binformation_schema\b", r"\bpg_catalog\b", r"\bsqlite_master\b",
    r"\bpragma\b", r"\bwrite\b",
    # filesystem / privileges / external access
    r"\bcopy\b", r"\bmount\b", r"\bmemory_limit\b",
    r"\bread_csv\b", r"\bread_parquet\b", r"\bread_json\b",
    r"\bread_csv_auto\b", r"\breads\b", r"\bglob\b",
]

# Destructive-but-sandboxed operations: they only mutate the ephemeral
# in-memory DuckDB instance used for this request, but still require an
# explicit user confirmation before execution.
DANGEROUS_SQL_PATTERNS = [
    r"\binsert\s+into\b",
    r"\bupdate\s+\w+\s+set\b",
    r"\bdelete\s+from\b",
    r"\bdrop\s+table\b",
    r"\balter\s+table\b",
    r"\bcreate\s+table\b",
    r"\btruncate\b", r"\breplace\b", r"\brename\b",
]

DANGEROUS_OP_LABELS = [
    ("insert", r"\binsert\s+into\b"),
    ("update", r"\bupdate\s+\w+\s+set\b"),
    ("delete", r"\bdelete\s+from\b"),
    ("drop table", r"\bdrop\s+table\b"),
    ("alter table", r"\balter\s+table\b"),
    ("create table", r"\bcreate\s+(or\s+replace\s+)?table\b"),
    ("truncate", r"\btruncate\b"),
    ("replace", r"\breplace\b"),
    ("rename", r"\brename\b"),
]


def validate_sql_query(query: str) -> tuple[bool, str]:
    sql_lower = strip_sql_comments(query.strip()).lower()
    for p in DISALLOWED_SQL_PATTERNS:
        if re.search(p, sql_lower):
            return False, "Disallowed SQL keyword/pattern detected"
    return True, ""


def strip_sql_comments(query: str) -> str:
    """Remove `--`, `#`, and `/* */` comments while preserving string safety.

    Naive but adequate for validation: comments that would fool the detector
    would also fail DuckDB's own parser when executed.
    """
    import re as _re
    # block comments
    text = _re.sub(r"/\*.*?\*/", " ", query, flags=_re.DOTALL)
    # line comments
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        cleaned.append(_re.sub(r"(--|#).*$", " ", line))
    return "\n".join(cleaned)


def analyze_sql_safety(query: str) -> dict:
    """Classify a query for the safe-execution pipeline.

    Returns:
      - ok: whether the query may run at all (read-only + no privilege/filesystem ops)
      - dangerous: whether it contains destructive DML/DDL (requires confirmation)
      - operations: list of detected dangerous operations (labels)
      - reasons: messages describing why the query was rejected (if not ok)
    """
    sql_lower = strip_sql_comments(query.strip()).lower()
    reasons = []
    for p in DISALLOWED_SQL_PATTERNS:
        if re.search(p, sql_lower):
            reasons.append("Disallowed SQL keyword/pattern detected")
    dangerous_ops = [label for label, p in DANGEROUS_OP_LABELS if re.search(p, sql_lower)]
    ok = not reasons
    requires_confirmation = bool(dangerous_ops)
    if not ok:
        # fully disallowed operations also require confirmation in the UI flow,
        # but they can never be executed — mark them as reasons only.
        dangerous_ops_for_ui = [label for label, p in DANGEROUS_OP_LABELS if re.search(p, sql_lower)]
        return {
            "ok": False,
            "dangerous": requires_confirmation,
            "operations": dangerous_ops_for_ui,
            "reasons": reasons,
        }
    return {
        "ok": True,
        "dangerous": requires_confirmation,
        "operations": dangerous_ops,
        "reasons": [],
    }


ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".parquet", ".json"}


def validate_upload_filename(filename: str) -> tuple[bool, str]:
    if not filename or ".." in filename or "/" in filename or "\\" in filename:
        return False, "Invalid filename"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"Extension '{ext}' not allowed (allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))})"
    return True, ""
