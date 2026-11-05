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
    """Evaluate statistical loss variance for a single artisan across jobs.

    Requirements:
    - Minimum 3 completed jobs required for baseline history (sample_size >= 3).
      Otherwise returns is_anomalous=False with 'insufficient history (minimum 3 completed jobs required)'.
    - Anomaly requires BOTH:
      recent_loss_bp > baseline_mean_bp + 2 * baseline_stddev_bp AND
      recent_loss_bp > baseline_mean_bp + 50.
    """
    karigar = session.get(Karigar, karigar_id)
    if not karigar:
        raise ValueError(f"Karigar {karigar_id} not found")

    # Fetch closed jobs ordered chronologically
    all_closed_jobs = list(
        session.execute(
            select(Job)
            .where(Job.karigar_id == karigar_id, Job.status == "closed")
            .order_by(Job.opened_on.asc(), Job.id.asc())
        )
        .scalars()
        .all()
    )

    # Fetch open jobs to inspect recent active loss
    open_jobs = list(
        session.execute(
            select(Job)
            .where(Job.karigar_id == karigar_id, Job.status == "open")
            .order_by(Job.opened_on.desc(), Job.id.desc())
        )
        .scalars()
        .all()
    )

    recent_losses: list[int] = []
    for job in open_jobs:
        st = ledger.job_settlement(session, job.id)
        if st.issued_fine_mg > 0:
            recent_losses.append(st.excess_loss_bp)

    # Determine baseline jobs vs recent jobs
    if recent_losses:
        baseline_jobs = all_closed_jobs
        recent_loss_bp = sum(recent_losses) // len(recent_losses)
    else:
        # All jobs closed: evaluate most recent completed jobs against historical baseline
        if len(all_closed_jobs) >= 5:
            baseline_jobs = all_closed_jobs[:-2]
            recent_jobs = all_closed_jobs[-2:]
        elif len(all_closed_jobs) >= 4:
            baseline_jobs = all_closed_jobs[:-1]
            recent_jobs = all_closed_jobs[-1:]
        else:
            baseline_jobs = all_closed_jobs
            recent_jobs = all_closed_jobs[-1:] if all_closed_jobs else []

        recent_losses_from_closed: list[int] = []
        for r_job in recent_jobs:
            st = ledger.job_settlement(session, r_job.id)
            recent_losses_from_closed.append(st.excess_loss_bp)

        recent_loss_bp = (
            sum(recent_losses_from_closed) // len(recent_losses_from_closed)
            if recent_losses_from_closed
            else 0
        )

    sample_size = len(baseline_jobs)

    # Minimum history check: require at least 3 completed jobs for baseline
    if sample_size < 3:
        return KarigarDriftResult(
            karigar_id=karigar.id,
            karigar_code=karigar.code,
            karigar_name=karigar.name,
            recent_loss_bp=recent_loss_bp,
            baseline_mean_bp=0,
            baseline_stddev_bp=0,
            sample_size=sample_size,
            is_anomalous=False,
            explanation=(
                f"Artisan {karigar.name} ({karigar.code}) has insufficient history "
                f"(minimum 3 completed jobs required)."
            ),
        )

    historical_losses: list[int] = []
    for job in baseline_jobs:
        st = ledger.job_settlement(session, job.id)
        historical_losses.append(st.excess_loss_bp)

    baseline_mean_bp = sum(historical_losses) // sample_size
    variance = sum((x - baseline_mean_bp) ** 2 for x in historical_losses) // sample_size
    baseline_stddev_bp = math.isqrt(variance)

    # Anomaly condition: BOTH 2 stddev AND 50 bp above baseline mean
    is_anomalous = (
        (recent_loss_bp > baseline_mean_bp + 2 * baseline_stddev_bp)
        and (recent_loss_bp > baseline_mean_bp + 50)
    )

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
    active_karigars = list(
        session.execute(
            select(Karigar).where(Karigar.is_active == True).order_by(Karigar.code)  # noqa: E712
        )
        .scalars()
        .all()
    )

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
