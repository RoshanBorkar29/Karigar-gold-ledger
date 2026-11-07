"""Pydantic schemas for receipts returned from karigars."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class ReceiptCreate(BaseModel):
    """Schema for recording a return of finished jewellery, scrap, or filings."""

    job_id: int
    kind: str = Field(..., description="Receipt kind: finished, scrap, or filings")
    gross_mg: int = Field(..., gt=0, description="Gross metal weight in milligrams")
    purity_bp: int = Field(..., gt=0, le=10000, description="Purity in basis points (e.g. 9160 = 91.60%)")
    huid: str | None = Field(default=None, description="Hallmark identification code (required for finished pieces)")
    entry_date: date
    note: str | None = None
    ai_reading_id: int | None = Field(default=None, description="Optional audit reference to an AI scale reading")


class ReceiptRead(BaseModel):
    """Schema for receipt output."""

    id: int
    txn_id: str
    job_id: int
    job_no: str | None = None
    karigar_id: int
    karigar_name: str | None = None
    kind: str
    gross_mg: int
    purity_bp: int
    fine_mg: int
    huid: str | None = None
    entry_date: date
    created_by: int
    note: str | None = None
    is_voided: bool = False
    void_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
