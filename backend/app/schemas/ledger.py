"""Pydantic schemas for void requests, job settlements, and karigar balances."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class VoidCreate(BaseModel):
    """Schema for voiding an issue or receipt entry."""

    reason: str = Field(..., min_length=5, description="Audit reason for voiding transaction")


class VoidRead(BaseModel):
    """Schema for void confirmation record."""

    id: int
    issue_id: int | None = None
    receipt_id: int | None = None
    reason: str
    voided_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SettlementRead(BaseModel):
    """Schema for mathematical job settlement calculation."""

    issued_fine_mg: int
    finished_mg: int
    scrap_mg: int
    filings_mg: int
    returned_mg: int
    outstanding_mg: int
    allowed_mg: int
    excess_mg: int
    over_returned_mg: int
    actual_wastage_bp: int
    excess_loss_bp: int
    status: str

    model_config = ConfigDict(from_attributes=True)


class JobSettlementRead(BaseModel):
    """Schema for a job order along with its settlement numbers."""

    job_id: int
    job_no: str
    settlement: SettlementRead

    model_config = ConfigDict(from_attributes=True)


class KarigarBalanceRead(BaseModel):
    """Schema for detailed per-job karigar balance statement."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    jobs: list[JobSettlementRead]
    total_fine_balance_mg: int

    model_config = ConfigDict(from_attributes=True)


class KarigarBalanceSummaryRowRead(BaseModel):
    """Schema for workshop overview karigar summary balance row."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    total_fine_balance_mg: int

    model_config = ConfigDict(from_attributes=True)
