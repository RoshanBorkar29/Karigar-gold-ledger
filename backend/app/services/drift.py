"""Service evaluating historical karigar wastage trends to identify statistical loss drift before month-end.

Strictly zero floating-point arithmetic: uses integer standard deviation via math.isqrt.
"""

from dataclasses import dataclass
import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job
from app.models.karigar import Karigar
from app.models.loss_alert import LossAlert
from app.services import ledger


def _fmt_bp(bp: int) -> str:
    """Format basis points to two decimal percentage string (e.g. 350 -> '3.50', 0 -> '0.00')."""
    sign = "-" if bp < 0 else ""
    abs_bp = abs(bp)
    return f"{sign}{abs_bp // 100}.{abs_bp % 100:02d}"


@dataclass(frozen=True)
class KarigarDriftResult:
    """Statistical loss evaluation for an artisan."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    recent_loss_bp: int
    baseline_mean_bp: int
    baseline_stddev_bp: int
    sample_size: int
    is_anomalous: bool
    explanation: str


def evaluate_karigar_drift(session: Session, karigar_id: int) -> KarigarDriftResult:
    """Evaluate statistical loss variance for a single artisan across jobs."""
    karigar = session.get(Karigar, karigar_id)
    if not karigar:
        raise ValueError(f"Karigar {karigar_id} not found")

    # Fetch closed jobs for baseline
    closed_jobs = session.execute(
        select(Job).where(Job.karigar_id == karigar_id, Job.status == "closed").order_by(Job.id.asc())
    ).scalars().all()

    historical_losses: list[int] = []
    for job in closed_jobs:
        st = ledger.job_settlement(session, job.id)
        historical_losses.append(st.excess_loss_bp)

    # Fetch open jobs to inspect recent active loss
    open_jobs = session.execute(
        select(Job).where(Job.karigar_id == karigar_id, Job.status == "open").order_by(Job.id.desc())
    ).scalars().all()

    recent_losses: list[int] = []
    for job in open_jobs:
        st = ledger.job_settlement(session, job.id)
        if st.issued_fine_mg > 0:
            recent_losses.append(st.excess_loss_bp)

    sample_size = len(historical_losses)
    if sample_size > 0:
        baseline_mean_bp = sum(historical_losses) // sample_size
        variance = sum((x - baseline_mean_bp) ** 2 for x in historical_losses) // sample_size
        baseline_stddev_bp = math.isqrt(variance)
    else:
        baseline_mean_bp = 0
        baseline_stddev_bp = 0

    if recent_losses:
        recent_loss_bp = sum(recent_losses) // len(recent_losses)
    elif historical_losses:
        recent_loss_bp = historical_losses[-1]
    else:
        recent_loss_bp = 0

    # Anomalous if recent loss exceeds baseline mean by more than 50 bp or 1 standard deviation
    threshold = baseline_mean_bp + max(baseline_stddev_bp, 50)
    is_anomalous = (recent_loss_bp > threshold) and (recent_loss_bp > 0)

    if is_anomalous:
        explanation = (
            f"Artisan {karigar.name} ({karigar.code}) shows anomalous loss drift of "
            f"{_fmt_bp(recent_loss_bp)}% against baseline average of {_fmt_bp(baseline_mean_bp)}% "
            f"(stddev ±{_fmt_bp(baseline_stddev_bp)}%) across {sample_size} jobs."
        )
    else:
        explanation = (
            f"Artisan {karigar.name} ({karigar.code}) within normal variance: recent loss "
            f"{_fmt_bp(recent_loss_bp)}% vs baseline average {_fmt_bp(baseline_mean_bp)}%."
        )

    return KarigarDriftResult(
        karigar_id=karigar.id,
        karigar_code=karigar.code,
        karigar_name=karigar.name,
        recent_loss_bp=recent_loss_bp,
        baseline_mean_bp=baseline_mean_bp,
        baseline_stddev_bp=baseline_stddev_bp,
        sample_size=sample_size,
        is_anomalous=is_anomalous,
        explanation=explanation,
    )


def scan_and_generate_loss_alerts(session: Session) -> list[LossAlert]:
    """Scan all active artisans, evaluate loss drift, and record new alerts if anomalous."""
    active_karigars = session.execute(
        select(Karigar).where(Karigar.is_active == True).order_by(Karigar.code)  # noqa: E712
    ).scalars().all()

    created_alerts: list[LossAlert] = []

    for karigar in active_karigars:
        drift = evaluate_karigar_drift(session, karigar.id)
        if drift.is_anomalous:
            # Check if active unreviewed alert already exists for this karigar
            existing = session.execute(
                select(LossAlert).where(
                    LossAlert.karigar_id == karigar.id,
                    LossAlert.status == "new",
                )
            ).scalar_one_or_none()

            if not existing:
                alert = LossAlert(
                    karigar_id=karigar.id,
                    job_id=None,
                    recent_loss_bp=drift.recent_loss_bp,
                    baseline_mean_bp=drift.baseline_mean_bp,
                    baseline_stddev_bp=drift.baseline_stddev_bp,
                    sample_size=drift.sample_size,
                    status="new",
                    explanation=drift.explanation,
                    explanation_source="template",
                )
                session.add(alert)
                created_alerts.append(alert)

    session.flush()
    return created_alerts
