"""SQLAlchemy model for karigar category-specific agreed wastage percentages."""

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KarigarCategoryWastage(Base):
    """Agreed contractual wastage in basis points per karigar and item category."""

    __tablename__ = "karigar_category_wastages"
    __table_args__ = (
        UniqueConstraint("karigar_id", "category_id", name="uq_karigar_category_wastage"),
        CheckConstraint(
            "wastage_bp >= 0 AND wastage_bp <= 10000",
            name="ck_karigar_category_wastage_bp_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    karigar_id: Mapped[int] = mapped_column(Integer, ForeignKey("karigars.id"), nullable=False)
    category_id: Mapped[int] = mapped_column(Integer, ForeignKey("item_categories.id"), nullable=False)
    wastage_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
