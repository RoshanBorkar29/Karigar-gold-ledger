"""API endpoints for loss alerts and statistical drift inspection (Finance Head role only)."""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_finance_head
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.loss_alert import LossAlert
from app.models.user import User
from app.schemas.loss_alert import (
    LossAlertRead,
    LossAlertReviewRequest,
    LossDriftEvaluation,
)
from app.services.drift import evaluate_karigar_drift, scan_and_generate_loss_alerts

router = APIRouter(prefix="/alerts", tags=["loss alerts (finance only)"])


@router.get("", response_model=list[LossAlertRead])
def list_loss_alerts(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[LossAlertRead]:
    """List loss-drift alerts. Restricted to finance head."""
    stmt = (
        select(LossAlert, Karigar.name.label("karigar_name"), Karigar.code.label("karigar_code"), Job.job_no)
        .join(Karigar, Karigar.id == LossAlert.karigar_id)
        .outerjoin(Job, Job.id == LossAlert.job_id)
    )
    if status_filter:
        s = status_filter.lower().strip()
        if s == "open":
            s = "new"
        stmt = stmt.where(LossAlert.status == s)
    stmt = stmt.order_by(LossAlert.created_at.desc())

    rows = db.execute(stmt).all()
    return [
        LossAlertRead(
            id=alert.id,
            karigar_id=alert.karigar_id,
            karigar_name=k_name,
            karigar_code=k_code,
            job_id=alert.job_id,
            job_no=job_no,
            recent_loss_bp=alert.recent_loss_bp,
            baseline_mean_bp=alert.baseline_mean_bp,
            baseline_stddev_bp=alert.baseline_stddev_bp,
            sample_size=alert.sample_size,
            status=alert.status,
            explanation=alert.explanation,
            explanation_source=alert.explanation_source,
            reviewed_by=alert.reviewed_by,
            reviewed_at=alert.reviewed_at,
            created_at=alert.created_at,
        )
        for alert, k_name, k_code, job_no in rows
    ]


@router.post("/scan", response_model=list[LossAlertRead])
def trigger_drift_scan(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
) -> list[LossAlertRead]:
    """Scan all active karigars and generate new loss alerts where anomalous drift is detected."""
    alerts = scan_and_generate_loss_alerts(db)
    db.commit()

    output = []
    for alert in alerts:
        db.refresh(alert)
        karigar = db.get(Karigar, alert.karigar_id)
        output.append(
            LossAlertRead(
                id=alert.id,
                karigar_id=alert.karigar_id,
                karigar_name=karigar.name if karigar else None,
                karigar_code=karigar.code if karigar else None,
                job_id=alert.job_id,
                job_no=None,
                recent_loss_bp=alert.recent_loss_bp,
                baseline_mean_bp=alert.baseline_mean_bp,
                baseline_stddev_bp=alert.baseline_stddev_bp,
                sample_size=alert.sample_size,
                status=alert.status,
                explanation=alert.explanation,
                explanation_source=alert.explanation_source,
                reviewed_by=alert.reviewed_by,
                reviewed_at=alert.reviewed_at,
                created_at=alert.created_at,
            )
        )
    return output


@router.get("/karigars/{karigar_id}/drift", response_model=LossDriftEvaluation)
def get_karigar_drift_metrics(
    karigar_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
) -> LossDriftEvaluation:
    """Inspect statistical drift metrics and baseline history for an artisan."""
    try:
        res = evaluate_karigar_drift(db, karigar_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return LossDriftEvaluation(
        karigar_id=res.karigar_id,
        karigar_code=res.karigar_code,
        karigar_name=res.karigar_name,
        recent_loss_bp=res.recent_loss_bp,
        baseline_mean_bp=res.baseline_mean_bp,
        baseline_stddev_bp=res.baseline_stddev_bp,
        sample_size=res.sample_size,
        is_anomalous=res.is_anomalous,
        explanation=res.explanation,
        suggested_explanation=res.explanation,
    )


@router.patch("/{alert_id}", response_model=LossAlertRead)
def review_loss_alert(
    alert_id: int,
    data: LossAlertReviewRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_finance_head)],
) -> LossAlertRead:
    """Mark an alert reviewed or dismissed with optional reviewer notes."""
    alert = db.get(LossAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Loss alert not found")

    if data.status not in ("reviewed", "dismissed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be 'reviewed' or 'dismissed'",
        )

    alert.status = data.status
    alert.reviewed_by = current_user.id
    alert.reviewed_at = datetime.now(timezone.utc)
    if data.explanation:
        alert.explanation = f"{alert.explanation}\n[Review Note]: {data.explanation.strip()}"

    db.commit()
    db.refresh(alert)

    karigar = db.get(Karigar, alert.karigar_id)
    job = db.get(Job, alert.job_id) if alert.job_id else None

    return LossAlertRead(
        id=alert.id,
        karigar_id=alert.karigar_id,
        karigar_name=karigar.name if karigar else None,
        karigar_code=karigar.code if karigar else None,
        job_id=alert.job_id,
        job_no=job.job_no if job else None,
        recent_loss_bp=alert.recent_loss_bp,
        baseline_mean_bp=alert.baseline_mean_bp,
        baseline_stddev_bp=alert.baseline_stddev_bp,
        sample_size=alert.sample_size,
        status=alert.status,
        explanation=alert.explanation,
        explanation_source=alert.explanation_source,
        reviewed_by=alert.reviewed_by,
        reviewed_at=alert.reviewed_at,
        created_at=alert.created_at,
    )
