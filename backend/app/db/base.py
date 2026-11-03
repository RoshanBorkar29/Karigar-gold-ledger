"""SQLAlchemy declarative base class and central registry for all ORM models."""

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Explicit naming conventions for constraints to ensure Alembic and Postgres naming consistency
naming_convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=naming_convention)


class Base(DeclarativeBase):
    """Base declarative class for all application models."""

    metadata = metadata
