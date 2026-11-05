"""Pydantic schemas for daily stock statements and vault bullion movements."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field

from .ledger import KarigarBalanceSummaryRowRead, KarigarBalancesSummaryRowRead


class VaultMovementCreate(BaseModel):
    """Schema for recording physical bullion movement in/out of workshop vault."""

    kind: str = Field(..., description="Movement kind: bullion_in, to_refiner, or from_refiner")
    fine_mg: int = Field(..., gt=0, description="Fine gold weight in milligrams")
    entry_date: date
    note: str | None = None


class VaultMovementRead(BaseModel):
    """Schema for vault movement record."""

    id: int
    kind: str
    fine_mg: int
    entry_date: date
    created_by: int
    note: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DailyStockStatementRead(BaseModel):
    """Schema for daily stock statement response."""

    as_of_date: date
    vault_fine_mg: int
    karigars_fine_mg: int
    refiner_fine_mg: int
    total_fine_mg: int
    karigars_breakdown: list[KarigarBalanceSummaryRowRead]

