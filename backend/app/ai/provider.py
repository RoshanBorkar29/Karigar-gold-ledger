"""Unified Groq client provider wrapper managing API communication, retries, and model routing."""

from groq import Groq

from app.core.config import settings

_client: Groq | None = None


def has_groq_key() -> bool:
    """Check if a valid non-empty Groq API key is configured."""
    return bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip())


def has_groq_vision_model() -> bool:
    """Check if vision model is configured."""
    return bool(settings.GROQ_VISION_MODEL and settings.GROQ_VISION_MODEL.strip())


def has_groq_text_model() -> bool:
    """Check if text model is configured."""
    return bool(settings.GROQ_TEXT_MODEL and settings.GROQ_TEXT_MODEL.strip())


def get_groq_client() -> Groq | None:
    """Retrieve or initialize singleton Groq API client."""
    global _client
    if not has_groq_key():
        return None
    if _client is None:
        _client = Groq(api_key=settings.GROQ_API_KEY.strip())
    return _client
