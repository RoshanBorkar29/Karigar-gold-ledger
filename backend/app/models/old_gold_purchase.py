"""SQLAlchemy model for customer old-gold purchases and testing records."""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OldGoldPurchase(Base):
    """Customer old-gold intake with purity testing, deductions, and payment details under client policy thresholds."""

    __tablename__ = "old_gold_purchases"
    __table_args__ = (
        CheckConstraint("gross_mg > 0", name="ck_old_gold_gross_mg_positive"),
        CheckConstraint(
            "deduction_mg >= 0 AND deduction_mg < gross_mg",
            name="ck_old_gold_deduction_range",
        ),
        CheckConstraint(
            "tested_purity_bp > 0 AND tested_purity_bp <= 10000",
            name="ck_old_gold_purity_range",
        ),
        CheckConstraint(
            "fine_mg > 0 AND fine_mg <= gross_mg",
            name="ck_old_gold_fine_mg_range",
        ),
        CheckConstraint("rate_paise_per_g > 0", name="ck_old_gold_rate_positive"),
        CheckConstraint("value_paise >= 0", name="ck_old_gold_value_paise_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bill_no: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    gross_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tested_purity_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    deduction_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    fine_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rate_paise_per_g: Mapped[int] = mapped_column(BigInteger, nullable=False)
    value_paise: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_mode: Mapped[str] = mapped_column(
        Enum("cash", "upi", "bank_transfer", "cheque", name="payment_mode"),
        nullable=False,
    )
    pan: Mapped[str | None] = mapped_column(String(20), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
