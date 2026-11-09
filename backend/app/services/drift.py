"""Service evaluating historical karigar wastage trends to identify statistical loss drift before month-end.

Strictly zero floating-point arithmetic: uses integer standard deviation via math.isqrt.
"""

from dataclasses import dataclass
import math

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
    """Statistical loss evaluation for a karigar."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    recent_loss_bp: int
    baseline_mean_bp: int
    baseline_stddev_bp: int
    sample_size: int
    is_anomalous: bool
    explanation: str


def calc_job_loss_bp(session: Session, job_id: int) -> int:
    """Calculate loss for a closed job = (issued fine - returned fine) as basis points of issued fine.

    Uses integer arithmetic with half-up rounding.
    """
    st = ledger.job_settlement(session, job_id)
    if st.issued_fine_mg <= 0:
        return 0
    diff_mg = st.issued_fine_mg - st.returned_mg
    if diff_mg >= 0:
        return (diff_mg * 10000 * 2 + st.issued_fine_mg) // (2 * st.issued_fine_mg)
    else:
        return -((-diff_mg * 10000 * 2 + st.issued_fine_mg) // (2 * st.issued_fine_mg))


def evaluate_karigar_drift(session: Session, karigar_id: int) -> KarigarDriftResult:
    """Evaluate statistical loss variance for a single karigar across closed jobs only.

    Requirements:
    - Compute loss ONLY from closed jobs (status == 'closed'). An open job must never contribute
      to recent loss or baseline.
    - Recent loss is the loss of the karigar's most recent 1 to 2 closed jobs.
    - Baseline is the closed jobs before that, with at least 3 baseline jobs, else 'insufficient history'.
    - Anomaly requires BOTH:
      recent_loss_bp > baseline_mean_bp + 2 * baseline_stddev_bp AND
      recent_loss_bp > baseline_mean_bp + 50.
    """
    karigar = session.get(Karigar, karigar_id)
    if not karigar:
        raise ValueError(f"Karigar {karigar_id} not found")

    # Fetch ONLY closed jobs ordered chronologically
    all_closed_jobs = list(
        session.execute(
            select(Job)
            .where(Job.karigar_id == karigar_id, Job.status == "closed")
            .order_by(Job.closed_on.asc(), Job.opened_on.asc(), Job.id.asc())
        )
        .scalars()
        .all()
    )

    n_closed = len(all_closed_jobs)

    # Minimum history check: baseline requires at least 3 completed jobs before recent jobs.
    # If total closed < 4, baseline would have fewer than 3 jobs (e.g. 2 closed -> insufficient).
    if n_closed < 4:
        if n_closed > 0:
            rec_losses = [calc_job_loss_bp(session, j.id) for j in all_closed_jobs]
            recent_loss_bp = sum(rec_losses) // len(rec_losses)
        else:
            recent_loss_bp = 0

        return KarigarDriftResult(
            karigar_id=karigar.id,
            karigar_code=karigar.code,
            karigar_name=karigar.name,
            recent_loss_bp=recent_loss_bp,
            baseline_mean_bp=0,
            baseline_stddev_bp=0,
            sample_size=max(0, n_closed - 1) if n_closed >= 1 else 0,
            is_anomalous=False,
            explanation=(
                f"Karigar {karigar.name} ({karigar.code}) has insufficient history "
                f"(minimum 3 completed jobs required)."
            ),
        )

    # Split into baseline jobs and recent jobs (most recent 1 to 2 closed jobs)
    if n_closed >= 5:
        baseline_jobs = all_closed_jobs[:-2]
        recent_jobs = all_closed_jobs[-2:]
    else:  # n_closed == 4
        baseline_jobs = all_closed_jobs[:-1]
        recent_jobs = all_closed_jobs[-1:]

    sample_size = len(baseline_jobs)
    if sample_size < 3:
        return KarigarDriftResult(
            karigar_id=karigar.id,
            karigar_code=karigar.code,
            karigar_name=karigar.name,
            recent_loss_bp=0,
            baseline_mean_bp=0,
            baseline_stddev_bp=0,
            sample_size=sample_size,
            is_anomalous=False,
            explanation=(
                f"Karigar {karigar.name} ({karigar.code}) has insufficient history "
                f"(minimum 3 completed jobs required)."
            ),
        )

    # Compute baseline losses
    historical_losses = [calc_job_loss_bp(session, j.id) for j in baseline_jobs]
    baseline_mean_bp = sum(historical_losses) // sample_size
    variance = sum((x - baseline_mean_bp) ** 2 for x in historical_losses) // sample_size
    baseline_stddev_bp = math.isqrt(variance)

    # Compute recent losses
    recent_losses = [calc_job_loss_bp(session, j.id) for j in recent_jobs]
    recent_loss_bp = sum(recent_losses) // len(recent_losses)

    # Anomaly condition: BOTH > 2 stddev AND > 50 bp above baseline mean
    is_anomalous = (
        (recent_loss_bp > baseline_mean_bp + 2 * baseline_stddev_bp)
        and (recent_loss_bp > baseline_mean_bp + 50)
    )

    diff_bp = recent_loss_bp - baseline_mean_bp
    if is_anomalous:
        explanation = (
            f"Karigar {karigar.name} ({karigar.code}): recent loss {_fmt_bp(recent_loss_bp)}% is "
            f"{_fmt_bp(diff_bp)} percentage points above their usual {_fmt_bp(baseline_mean_bp)}% "
            f"across {sample_size} closed jobs. Worth reviewing."
        )
    else:
        explanation = (
            f"Karigar {karigar.name} ({karigar.code}) within normal variance: recent loss "
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
    """Scan all active karigars, evaluate loss drift across closed jobs, and record new alerts if anomalous."""
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
