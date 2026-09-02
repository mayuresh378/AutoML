import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "noreply@automl.local")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")


def send_email(to: str, subject: str, html: str) -> bool:
    if not SMTP_HOST:
        logger.info(f"[EMAIL] To: {to} | Subject: {subject}\n{html}")
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, [to], msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


def send_verification_email(to: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/verify-email?token={token}"
    html = f"""<h2>Verify your email</h2><p>Click the link below to verify your account:</p>
<a href="{link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px">Verify Email</a>
<p>Or copy: {link}</p><p>This link expires in 24 hours.</p>"""
    return send_email(to, "Verify your email — AutoML Platform", html)


def send_password_reset_email(to: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    html = f"""<h2>Reset your password</h2><p>Click the link below to reset your password:</p>
<a href="{link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px">Reset Password</a>
<p>Or copy: {link}</p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>"""
    return send_email(to, "Reset your password — AutoML Platform", html)
