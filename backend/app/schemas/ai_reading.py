"""Pydantic schemas for vision reader responses, confidence scores, and clerk confirmation requests."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ScaleReadingResponse(BaseModel):
    """Schema for weighing scale OCR extraction response."""

    reading_id: int
    value_text: str = Field(..., description="Detected weight value string (e.g. '112.450')")
    unit: str = Field(default="g", description="Detected scale unit")
    confidence: int = Field(..., ge=0, le=100, description="Model extraction confidence score (0-100)")
    readable: bool = Field(..., description="Whether the scale digits were clearly legible")
    model_name: str


class KaratMeterReadingResponse(BaseModel):
    """Schema for XRF / karat meter purity OCR extraction response."""

    reading_id: int
    purity_text: str = Field(..., description="Detected purity percentage string (e.g. '91.60')")
    unit: str = Field(default="%", description="Detected unit")
    confidence: int = Field(..., ge=0, le=100)
    readable: bool
    model_name: str


class ReadingConfirmRequest(BaseModel):
    """Schema for clerk confirming or overriding an AI photo reading."""

    confirmed_value: str = Field(..., description="Final confirmed reading value to commit")
    override: bool = Field(default=False, description="Whether the clerk manually corrected the AI output")


class AiReadingRead(BaseModel):
    """Schema for reading audit record representation."""

    id: int
    kind: str
    image_path: str
    model_name: str
    ai_value_text: str
    ai_unit: str
    ai_confidence: int | None = None
    ai_readable: bool
    typed_value_text: str | None = None
    confirmed_value_text: str | None = None
    outcome: str
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LossExplanationRequest(BaseModel):
    """Schema for requesting an AI draft explanation for an artisan's loss drift."""

    karigar_id: int
    additional_context: str | None = None


class LossExplanationResponse(BaseModel):
    """Schema for generated loss drift explanation note."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    explanation: str
    source: str  # 'llm' or 'template'
