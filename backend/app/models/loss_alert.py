"""SQLAlchemy model for karigar loss-drift alerts and audit status."""

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LossAlert(Base):
    """Karigar loss-drift alert recording anomalous variance against baseline history."""

    __tablename__ = "loss_alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    karigar_id: Mapped[int] = mapped_column(Integer, ForeignKey("karigars.id"), nullable=False)
    job_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=True)
    recent_loss_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_mean_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    baseline_stddev_bp: Mapped[int] = mapped_column(Integer, nullable=False)
    sample_size: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("new", "reviewed", "dismissed", name="loss_alert_status"),
        default="new",
        nullable=False,
    )
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    explanation_source: Mapped[str] = mapped_column(
        Enum("llm", "template", name="explanation_source"),
        nullable=False,
    )
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
