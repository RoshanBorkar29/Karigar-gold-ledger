"""Application settings loaded from environment variables using Pydantic Settings."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Karigar Gold Ledger."""

    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/karigar_ledger"
    DATABASE_URL_TEST: str | None = None

    JWT_SECRET: str = "insecure-change-in-production"
    JWT_EXPIRE_MINUTES: int = 1440

    GROQ_API_KEY: str = ""
    GROQ_VISION_MODEL: str = "llama-3.2-11b-vision-preview"
    GROQ_TEXT_MODEL: str = "llama-3.3-70b-versatile"

    CORS_ORIGINS: str = "http://localhost:5173"
    VITE_API_URL: str = "http://localhost:8000"

    SEED_CLERK_PASSWORD: str = "Clerk@123"
    SEED_FINANCE_PASSWORD: str = "Finance@123"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
