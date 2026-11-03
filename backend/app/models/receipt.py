"""SQLAlchemy model for finished items, scrap, and filings received from karigars."""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
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


class Receipt(Base):
    """Append-only transaction recording finished jewellery, scrap, or filings returned by a karigar."""

    __tablename__ = "receipts"
    __table_args__ = (
        CheckConstraint("gross_mg > 0", name="ck_receipts_gross_mg_positive"),
        CheckConstraint(
            "purity_bp > 0 AND purity_bp <= 10000",
            name="ck_receipts_purity_bp_range",
        ),
        CheckConstraint(
            "fine_mg > 0 AND fine_mg <= gross_mg",
            name="ck_receipts_fine_mg_range",
        ),
        CheckConstraint(
            "(kind = 'finished') OR (huid IS NULL)",
            name="ck_receipts_huid_finished_only",
        ),
        Index("ix_receipts_karigar_id_entry_date", "karigar_id", "entry_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    txn_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False)
    karigar_id: Mapped[int] = mapped_column(Integer, ForeignKey("karigars.id"), nullable=False)
    kind: Mapped[str] = mapped_column(
        Enum("finished", "scrap", "filings", name="receipt_kind"),
        nullable=False,
    )
    gross_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)  # Net weight for finished
    purity_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    fine_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    huid: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
