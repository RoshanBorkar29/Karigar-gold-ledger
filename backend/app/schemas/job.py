"""Pydantic schemas for workshop job orders."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class JobCreate(BaseModel):
    """Schema for opening a new workshop job order."""

    job_no: str = Field(..., min_length=2, max_length=100)
    karigar_id: int
    category_id: int
    description: str = Field(..., min_length=2)
    opened_on: date
    wastage_bp: int | None = Field(
        default=None,
        ge=0,
        le=10000,
        description="Optional explicit wastage rate; if omitted, snapshots karigar master rate for category",
    )


class JobCloseRequest(BaseModel):
    """Schema for closing an active job order."""

    closed_on: date


class JobRead(BaseModel):
    """Schema for job order output."""

    id: int
    job_no: str
    karigar_id: int
    karigar_name: str | None = None
    category_id: int
    category_name: str | None = None
    description: str
    wastage_bp: int
    status: str
    opened_on: date
    closed_on: date | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
