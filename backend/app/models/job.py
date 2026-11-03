"""SQLAlchemy model for workshop jobs linking gold issues to receipts."""

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Job(Base):
    """Workshop job order snapshotting category wastage agreement upon creation."""

    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint(
            "(status = 'open' AND closed_on IS NULL) OR (status = 'closed' AND closed_on IS NOT NULL)",
            name="ck_jobs_closed_on_status",
        ),
        CheckConstraint(
            "wastage_bp >= 0 AND wastage_bp <= 10000",
            name="ck_jobs_wastage_bp_range",
        ),
        Index("ix_jobs_karigar_id_status", "karigar_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_no: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    karigar_id: Mapped[int] = mapped_column(Integer, ForeignKey("karigars.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("item_categories.id"), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    wastage_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("open", "closed", name="job_status"),
        default="open",
        nullable=False,
    )
    opened_on: Mapped[date] = mapped_column(Date, nullable=False)
    closed_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
