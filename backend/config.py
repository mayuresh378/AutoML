import os
import warnings
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_NAME: str = "AutoML Platform API"
    APP_VERSION: str = "3.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Security — single canonical SECRET_KEY
    SECRET_KEY: str = os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET", "change-me")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    CSRF_SECRET: str = os.getenv("CSRF_SECRET", "change-me-too")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    REDIS_URL: str = os.getenv("REDIS_URL", "")

    # Server
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    CORS_ORIGINS: list = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",") if o.strip()]
    TRUSTED_HOSTS: list = [h.strip() for h in os.getenv("TRUSTED_HOSTS", "localhost,127.0.0.1,0.0.0.0").split(",") if h.strip()]

    # Rate Limiting
    RATE_LIMIT_MAX: int = int(os.getenv("RATE_LIMIT_MAX", "60"))
    RATE_LIMIT_WINDOW_SEC: int = int(os.getenv("RATE_LIMIT_WINDOW_SEC", "60"))

    # File Uploads
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "500"))
    DATASET_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset")
    MODELS_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models")

    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@automl.local")

    # Feature flags
    ENABLE_TELEMETRY: bool = os.getenv("ENABLE_TELEMETRY", "false").lower() == "true"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()

if settings.SECRET_KEY in ("change-me", ""):
    warnings.warn(
        "SECRET_KEY is using the insecure default value. "
        "Set the SECRET_KEY environment variable in production.",
        stacklevel=2,
    )
