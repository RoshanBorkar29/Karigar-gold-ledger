"""Pydantic schemas for loss alert representations, drift metrics, and audit resolution updates."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class LossAlertReviewRequest(BaseModel):
    """Schema for updating alert audit status."""

    status: str = Field(..., description="New alert status: reviewed or dismissed")
    explanation: str | None = Field(default=None, description="Optional override or note added by reviewer")


class LossAlertRead(BaseModel):
    """Schema for loss alert representation."""

    id: int
    karigar_id: int
    karigar_name: str | None = None
    karigar_code: str | None = None
    job_id: int | None = None
    job_no: str | None = None
    recent_loss_bp: int
    baseline_mean_bp: int
    baseline_stddev_bp: int
    sample_size: int
    status: str
    explanation: str
    explanation_source: str
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LossDriftEvaluation(BaseModel):
    """Schema for statistical drift calculation results per karigar."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    recent_loss_bp: int
    baseline_mean_bp: int
    baseline_stddev_bp: int
    sample_size: int
    is_anomalous: bool
    explanation: str
    suggested_explanation: str
