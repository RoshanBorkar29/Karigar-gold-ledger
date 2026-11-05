"""Pydantic schemas for user accounts, authentication requests, and token responses."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


class UserBase(BaseModel):
    """Base fields shared by user schemas."""

    email: EmailStr
    full_name: str
    role: str
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a new user account."""

    password: str


class UserRead(UserBase):
    """Schema for public user profile responses."""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    """Schema for user credentials submitted at login."""

    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Schema for successful authentication response containing JWT access token."""

    access_token: str
    token_type: str = "bearer"
    user: UserRead
