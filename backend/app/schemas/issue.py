"""Pydantic schemas for gold issues to karigars."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class IssueCreate(BaseModel):
    """Schema for recording a gold issue."""

    job_id: int
    gross_mg: int = Field(..., gt=0, description="Gross metal weight in milligrams (e.g. 120000 = 120.000g)")
    purity_bp: int = Field(..., gt=0, le=10000, description="Purity in basis points (e.g. 9160 = 91.60%)")
    entry_date: date
    note: str | None = None
    ai_reading_id: int | None = None


class IssueRead(BaseModel):
    """Schema for gold issue output."""

    id: int
    txn_id: str
    job_id: int
    job_no: str | None = None
    karigar_id: int
    karigar_name: str | None = None
    gross_mg: int
    purity_bp: int
    fine_mg: int
    entry_date: date
    created_by: int
    note: str | None = None
    is_voided: bool = False
    void_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
