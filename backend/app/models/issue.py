"""SQLAlchemy model for gold issued to karigars."""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Issue(Base):
    """Append-only transaction recording gold issued to a karigar for a specific job."""

    __tablename__ = "issues"
    __table_args__ = (
        CheckConstraint("gross_mg > 0", name="ck_issues_gross_mg_positive"),
        CheckConstraint(
            "purity_bp > 0 AND purity_bp <= 10000",
            name="ck_issues_purity_bp_range",
        ),
        CheckConstraint(
            "fine_mg > 0 AND fine_mg <= gross_mg",
            name="ck_issues_fine_mg_range",
        ),
        Index("ix_issues_karigar_id_entry_date", "karigar_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    txn_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False)
    karigar_id: Mapped[int] = mapped_column(Integer, ForeignKey("karigars.id"), nullable=False)
    gross_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    purity_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    fine_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
