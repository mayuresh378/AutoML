import os
import re
import json
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserSession
from security_utils import sanitize_name, sanitize_text

from config import settings

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.JWT_ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer(auto_error=False)

EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
PASSWORD_MIN = 6


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def validate_email(email: str) -> bool:
    return bool(EMAIL_RE.match(email))


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < PASSWORD_MIN:
        return False, f"Password must be at least {PASSWORD_MIN} characters"
    return True, ""


def sanitize_filename(name: str) -> str:
    return re.sub(r"[^\w\.\-]", "_", name)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def _create_session(db: Session, user_id: str, token: str, refresh_token: str | None = None,
                    device_info: str | None = None, ip_address: str | None = None):
    sess = UserSession(
        id=f"sess_{secrets.token_hex(12)}",
        user_id=user_id,
        token_hash=hashlib.sha256(token.encode()).hexdigest(),
        refresh_token_hash=hashlib.sha256(refresh_token.encode()).hexdigest() if refresh_token else None,
        device_info=device_info,
        ip_address=ip_address,
        is_active=True,
        last_used_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(sess)
    db.commit()


def _revoke_session(db: Session, token: str):
    th = hashlib.sha256(token.encode()).hexdigest()
    sess = db.query(UserSession).filter(UserSession.token_hash == th, UserSession.is_active == True).first()
    if sess:
        sess.is_active = False
        db.commit()


def register_user(db: Session, email: str, password: str, name: str, device_info: str = None, ip_address: str = None) -> dict:
    name = sanitize_name(name)
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    email = email.strip().lower()

    if not validate_email(email):
        raise HTTPException(status_code=400, detail="Invalid email format")
    valid, msg = validate_password(password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    verification_token = secrets.token_urlsafe(32)
    user = User(
        id=f"usr_{secrets.token_hex(12)}",
        email=email,
        name=name,
        password_hash=hash_password(password),
        role="member",
        is_active=True,
        email_verified=False,
        verification_token=verification_token,
        created_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "email": email})
    refresh_token = create_refresh_token({"sub": user.id})
    _create_session(db, user.id, token, refresh_token, device_info, ip_address)

    from email_utils import send_verification_email
    send_verification_email(email, verification_token)

    return {
        "token": token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "email": email, "name": name, "role": user.role, "email_verified": False},
    }


def login_user(db: Session, email: str, password: str, device_info: str = None, ip_address: str = None) -> dict:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token({"sub": user.id, "email": email})
    refresh_token = create_refresh_token({"sub": user.id})
    _create_session(db, user.id, token, refresh_token, device_info, ip_address)

    return {
        "token": token,
        "refresh_token": refresh_token,
        "user": {"id": user.id, "email": email, "name": user.name, "role": user.role, "email_verified": user.email_verified},
    }


def refresh_token(token: str, db: Session) -> dict:
    payload = decode_token(token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    new_token = create_access_token({"sub": user.id, "email": user.email})
    new_refresh = create_refresh_token({"sub": user.id})
    _create_session(db, user.id, new_token, new_refresh)
    return {"token": new_token, "refresh_token": new_refresh}


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = decode_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == payload.get("sub")).first()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return {
        "id": user.id, "email": user.email, "name": user.name, "role": user.role,
        "avatar_url": user.avatar_url, "email_verified": user.email_verified,
        "preferences": user.preferences, "created_at": user.created_at.isoformat() if user.created_at else None,
    }


def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> dict:
    if credentials is None:
        return {"id": "anonymous", "email": "guest@automl.local", "name": "Guest", "role": "guest"}
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return {"id": "anonymous", "email": "guest@automl.local", "name": "Guest", "role": "guest"}


def update_user_profile(db: Session, user_id: str, name: str = None, preferences: dict = None) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if name is not None:
        user.name = sanitize_name(name)
    if preferences is not None:
        user.preferences = {**(user.preferences or {}), **preferences}
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role,
            "avatar_url": user.avatar_url, "email_verified": user.email_verified,
            "preferences": user.preferences}


def change_password(db: Session, user_id: str, current_password: str, new_password: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    valid, msg = validate_password(new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Password changed successfully"}


def send_verification(db: Session, user_id: str) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.email_verified:
        return {"message": "Email already verified"}
    token = secrets.token_urlsafe(32)
    user.verification_token = token
    db.commit()
    from email_utils import send_verification_email
    send_verification_email(user.email, token)
    return {"message": "Verification email sent"}


def verify_email(db: Session, token: str) -> dict:
    user = db.query(User).filter(User.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    user.email_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}


def forgot_password(db: Session, email: str) -> dict:
    email = email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return {"message": "If that email exists, a reset link has been sent"}
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expiry = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    from email_utils import send_password_reset_email
    send_password_reset_email(email, token)
    return {"message": "If that email exists, a reset link has been sent"}


def reset_password(db: Session, token: str, new_password: str) -> dict:
    user = db.query(User).filter(
        User.reset_token == token,
        User.reset_token_expiry > datetime.now(timezone.utc),
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    valid, msg = validate_password(new_password)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)
    user.password_hash = hash_password(new_password)
    user.reset_token = None
    user.reset_token_expiry = None
    db.commit()
    return {"message": "Password reset successfully"}


def google_login(db: Session, id_token: str, device_info: str = None, ip_address: str = None) -> dict:
    payload = None
    if isinstance(id_token, str):
        token_str = id_token.strip()
        if token_str.startswith("{") and token_str.endswith("}"):
            try:
                payload = json.loads(token_str)
            except Exception:
                pass
        if not payload:
            try:
                payload = jwt.decode(token_str, options={"verify_signature": False})
            except Exception:
                pass
        if not payload:
            payload = decode_token(token_str)

    if not payload or not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid Google token")

    google_id = str(payload.get("sub") or payload.get("google_id") or payload.get("id") or "")
    email = str(payload.get("email", "")).strip().lower()
    name = str(payload.get("name") or payload.get("given_name") or (email.split("@")[0] if email else "Google User"))
    avatar_url = payload.get("picture") or payload.get("avatar_url")

    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")

    user = db.query(User).filter((User.email == email) | (User.google_id == google_id)).first()
    if user:
        if google_id and not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        user.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
    else:
        user = User(
            id=f"usr_{secrets.token_hex(12)}",
            email=email,
            name=name,
            password_hash=hash_password(secrets.token_hex(16)),
            role="member",
            is_active=True,
            email_verified=True,
            google_id=google_id if google_id else None,
            avatar_url=avatar_url,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": user.id, "email": email})
    refresh_token = create_refresh_token({"sub": user.id})
    _create_session(db, user.id, token, refresh_token, device_info, ip_address)

    return {
        "token": token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "email": email,
            "name": user.name,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "google_id": user.google_id,
            "email_verified": user.email_verified,
        },
    }


def list_sessions(db: Session, user_id: str) -> list:
    sessions = db.query(UserSession).filter(
        UserSession.user_id == user_id
    ).order_by(UserSession.last_used_at.desc()).all()
    return [{
        "id": s.id,
        "device_info": s.device_info,
        "ip_address": s.ip_address,
        "is_active": s.is_active,
        "last_used_at": s.last_used_at.isoformat() if s.last_used_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    } for s in sessions]


def revoke_session(db: Session, user_id: str, session_id: str) -> dict:
    sess = db.query(UserSession).filter(
        UserSession.id == session_id, UserSession.user_id == user_id
    ).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.is_active = False
    db.commit()
    return {"message": "Session revoked"}


def logout(db: Session, credentials: HTTPAuthorizationCredentials) -> dict:
    _revoke_session(db, credentials.credentials)
    return {"message": "Logged out successfully"}


def revoke_all_sessions(db: Session, user_id: str, exclude_token: str = None) -> dict:
    q = db.query(UserSession).filter(
        UserSession.user_id == user_id, UserSession.is_active == True
    )
    if exclude_token:
        th = hashlib.sha256(exclude_token.encode()).hexdigest()
        q = q.filter(UserSession.token_hash != th)
    count = q.update({"is_active": False}, synchronize_session=False)
    db.commit()
    return {"message": f"Revoked {count} sessions"}
