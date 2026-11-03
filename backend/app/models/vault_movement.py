"""SQLAlchemy model for workshop gold vault movements."""

from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VaultMovement(Base):
    """Append-only record of bullion movement in/out of vault or to/from refiners."""

    __tablename__ = "vault_movements"
    __table_args__ = (
        CheckConstraint("fine_mg > 0", name="ck_vault_movements_fine_mg_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(
        Enum("bullion_in", "to_refiner", "from_refiner", name="vault_movement_kind"),
        nullable=False,
    )
    fine_mg: Mapped[int] = mapped_column(BigInteger, nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
