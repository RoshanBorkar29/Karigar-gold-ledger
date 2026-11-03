"""SQLAlchemy model for AI scale and karat meter reading audit records."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AiReading(Base):
    """Vision OCR extraction record for weighing scales and karat meter readings."""

    __tablename__ = "ai_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(
        Enum("scale", "karat", name="ai_reading_kind"),
        nullable=False,
    )
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    ai_value_text: Mapped[str] = mapped_column(String(50), nullable=False)
    ai_unit: Mapped[str] = mapped_column(String(20), nullable=False)
    ai_confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_readable: Mapped[bool] = mapped_column(Boolean, nullable=False)
    typed_value_text: Mapped[str | None] = mapped_column(String(50), nullable=True)
    confirmed_value_text: Mapped[str | None] = mapped_column(String(50), nullable=True)
    outcome: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "confirmed",
            "mismatch_blocked",
            "rejected",
            "fallback_manual",
            name="ai_reading_outcome",
        ),
        default="pending",
        nullable=False,
    )
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
