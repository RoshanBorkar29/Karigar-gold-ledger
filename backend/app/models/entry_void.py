"""SQLAlchemy model for recording voided issues and receipts."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EntryVoid(Base):
    """Audit table recording voids of issue or receipt transactions.

    Ledger entries are append-only. When a mistake occurs, the entry is voided
    by inserting a record here with a mandatory reason.
    Exactly one of issue_id or receipt_id must be set, and each entry can only be
    voided once.
    """

    __tablename__ = "entry_voids"
    __table_args__ = (
        CheckConstraint(
            "((issue_id IS NOT NULL AND receipt_id IS NULL) OR (issue_id IS NULL AND receipt_id IS NOT NULL))",
            name="ck_entry_voids_target_exclusive",
        ),
        CheckConstraint(
            "length(reason) >= 5",
            name="ck_entry_voids_reason_length",
        ),
        UniqueConstraint("issue_id", name="uq_entry_voids_issue_id"),
        UniqueConstraint("receipt_id", name="uq_entry_voids_receipt_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    issue_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("issues.id"),
        nullable=True,
    )
    receipt_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("receipts.id"),
        nullable=True,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    voided_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

