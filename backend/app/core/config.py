"""Application settings loaded from environment variables using Pydantic Settings."""

from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Central configuration for Karigar Gold Ledger."""

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger"
    DATABASE_URL_TEST: str | None = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("postgres://"):
                v = "postgresql+psycopg://" + v[len("postgres://"):]
            elif v.startswith("postgresql://") and not v.startswith("postgresql+psycopg://"):
                v = "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    # Production requirement: JWT_SECRET has NO default and must be >= 32 characters
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 1440

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if not v or len(v.strip()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long for production security.")
        return v.strip()

    GROQ_API_KEY: str = ""
    GROQ_VISION_MODEL: str | None = None
    GROQ_TEXT_MODEL: str | None = None

    # Client policy thresholds (assumptions to be confirmed with client accountant)
    OLD_GOLD_HIGH_VALUE_THRESHOLD_PAISE: int = 20_000_000  # Rs 2,00,000 client policy threshold
    OLD_GOLD_PAN_REQUIRED_THRESHOLD_PAISE: int = 20_000_000  # Rs 2,00,000 client policy threshold

    # Comma-separated allowed CORS origins, wildcard strictly prohibited
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    VITE_API_URL: str = "http://localhost:8000"

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors_origins(cls, v: str) -> str:
        origins = [origin.strip() for origin in v.split(",") if origin.strip()]
        if not origins:
            raise ValueError("CORS_ORIGINS must contain at least one origin, comma-separated.")
        for origin in origins:
            if "*" in origin:
                raise ValueError("Wildcard '*' is forbidden in CORS_ORIGINS for production security.")
        return v

    SEED_CLERK_PASSWORD: str = "Clerk@123"
    SEED_FINANCE_PASSWORD: str = "Finance@123"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", str(_REPO_ROOT / ".env"), str(_REPO_ROOT / "backend" / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
