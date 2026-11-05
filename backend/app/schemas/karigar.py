"""Pydantic schemas for karigars and karigar agreed wastage configurations."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class KarigarCategoryWastageBase(BaseModel):
    """Base fields for agreed wastage between a karigar and category."""

    category_id: int
    wastage_bp: int = Field(..., ge=0, le=10000, description="Agreed wastage percentage in basis points (e.g. 300 = 3.00%)")


class KarigarCategoryWastageCreate(KarigarCategoryWastageBase):
    """Schema for assigning or updating agreed wastage."""


class KarigarCategoryWastageRead(KarigarCategoryWastageBase):
    """Schema for agreed wastage response."""

    id: int
    karigar_id: int
    category_name: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class KarigarBase(BaseModel):
    """Base fields for karigars."""

    code: str = Field(..., min_length=2, max_length=50, description="Unique artisan identifier (e.g. K-001)")
    name: str = Field(..., min_length=2, max_length=255)
    is_active: bool = True


class KarigarCreate(KarigarBase):
    """Schema for onboarding a new karigar."""


class KarigarUpdate(BaseModel):
    """Schema for updating karigar details."""

    name: str | None = None
    is_active: bool | None = None


class KarigarRead(KarigarBase):
    """Schema for karigar detail representation."""

    id: int
    created_at: datetime
    wastages: list[KarigarCategoryWastageRead] = []

    model_config = ConfigDict(from_attributes=True)
