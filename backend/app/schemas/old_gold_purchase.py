"""Pydantic schemas for customer old-gold purchases and testing desk."""

from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, Field


class OldGoldPurchaseCreate(BaseModel):
    """Schema for recording a customer old-gold purchase."""

    bill_no: str = Field(..., min_length=2, max_length=100)
    gross_mg: int = Field(..., gt=0, description="Gross weight in milligrams")
    tested_purity_bp: int = Field(..., gt=0, le=10000, description="Tested purity in basis points")
    deduction_mg: int = Field(default=0, ge=0, description="Dirt/stone deduction in milligrams")
    rate_paise_per_g: int = Field(..., gt=0, description="Purchase rate in paise per gram (e.g. 1250000 = Rs 12,500/g)")
    payment_mode: str = Field(..., description="Payment mode: cash, upi, bank_transfer, cheque")
    pan: str | None = Field(default=None, description="Permanent Account Number (mandatory for >= Rs 2,00,000)")
    entry_date: date


class OldGoldPurchaseRead(BaseModel):
    """Schema for old-gold purchase output."""

    id: int
    bill_no: str
    gross_mg: int
    tested_purity_bp: int
    deduction_mg: int
    fine_mg: int
    rate_paise_per_g: int
    value_paise: int
    payment_mode: str
    pan: str | None = None
    entry_date: date
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
