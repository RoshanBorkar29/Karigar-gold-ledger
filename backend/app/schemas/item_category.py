"""Pydantic schemas for jewellery item categories."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ItemCategoryBase(BaseModel):
    """Base fields for item categories."""

    name: str = Field(..., min_length=2, max_length=100)


class ItemCategoryCreate(ItemCategoryBase):
    """Schema for creating a new item category."""


class ItemCategoryRead(ItemCategoryBase):
    """Schema for item category output."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
