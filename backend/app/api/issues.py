"""API endpoints for gold issues and issue voiding."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_clerk_or_finance
from app.core.gold import fmt_g
from app.models.ai_reading import AiReading
from app.models.entry_void import EntryVoid
from app.models.issue import Issue
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.user import User
from app.schemas.issue import IssueCreate, IssueRead
from app.schemas.ledger import VoidCreate, VoidRead
from app.services import ledger

router = APIRouter(prefix="/issues", tags=["issues"])


@router.post("", response_model=IssueRead, status_code=status.HTTP_201_CREATED)
def record_issue(
    data: IssueCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> IssueRead:
    """Record gold issued to a karigar for an open job order."""
    if data.ai_reading_id is not None:
        ai_reading = db.get(AiReading, data.ai_reading_id)
        if not ai_reading:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"AI reading ID {data.ai_reading_id} not found",
            )
        expected_val = (ai_reading.confirmed_value_text or ai_reading.ai_value_text or "").strip()
        typed_val = fmt_g(data.gross_mg)
        if expected_val and typed_val != expected_val:
            ai_reading.outcome = "mismatch_blocked"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Entered gross weight ({typed_val} g) does not match confirmed AI scale reading ({expected_val} g)",
            )

    issue = ledger.create_issue(
        db,
        job_id=data.job_id,
        gross_mg=data.gross_mg,
        purity_bp=data.purity_bp,
        entry_date=data.entry_date,
        user_id=current_user.id,
        note=data.note,
    )
    db.commit()
    db.refresh(issue)

    job = db.get(Job, issue.job_id)
    karigar = db.get(Karigar, issue.karigar_id)

    return IssueRead(
        id=issue.id,
        txn_id=issue.txn_id,
        job_id=issue.job_id,
        job_no=job.job_no if job else None,
        karigar_id=issue.karigar_id,
        karigar_name=karigar.name if karigar else None,
        gross_mg=issue.gross_mg,
        purity_bp=issue.purity_bp,
        fine_mg=issue.fine_mg,
        entry_date=issue.entry_date,
        created_by=issue.created_by,
        note=issue.note,
        is_voided=False,
        void_reason=None,
        created_at=issue.created_at,
    )


@router.get("", response_model=list[IssueRead])
def list_issues(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    job_id: int | None = Query(default=None),
    karigar_id: int | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    include_voided: bool = Query(default=True),
) -> list[IssueRead]:
    """List issues with optional filters for job, karigar, and date range."""
    stmt = (
        select(
            Issue,
            Job.job_no,
            Karigar.name.label("karigar_name"),
            EntryVoid.id.label("void_id"),
            EntryVoid.reason.label("void_reason"),
        )
        .join(Job, Job.id == Issue.job_id)
        .join(Karigar, Karigar.id == Issue.karigar_id)
        .outerjoin(EntryVoid, EntryVoid.issue_id == Issue.id)
    )

    if job_id is not None:
        stmt = stmt.where(Issue.job_id == job_id)
    if karigar_id is not None:
        stmt = stmt.where(Issue.karigar_id == karigar_id)
    if from_date is not None:
        stmt = stmt.where(Issue.entry_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(Issue.entry_date <= to_date)
    if not include_voided:
        stmt = stmt.where(EntryVoid.id.is_(None))

    stmt = stmt.order_by(Issue.entry_date.desc(), Issue.id.desc())
    rows = db.execute(stmt).all()

    return [
        IssueRead(
            id=issue.id,
            txn_id=issue.txn_id,
            job_id=issue.job_id,
            job_no=job_no,
            karigar_id=issue.karigar_id,
            karigar_name=k_name,
            gross_mg=issue.gross_mg,
            purity_bp=issue.purity_bp,
            fine_mg=issue.fine_mg,
            entry_date=issue.entry_date,
            created_by=issue.created_by,
            note=issue.note,
            is_voided=void_id is not None,
            void_reason=void_reason,
            created_at=issue.created_at,
        )
        for issue, job_no, k_name, void_id, void_reason in rows
    ]


@router.post("/{issue_id}/void", response_model=VoidRead)
def void_issue(
    issue_id: int,
    data: VoidCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> VoidRead:
    """Void an issued gold entry with an explanatory reason."""
    entry_void = ledger.void_entry(
        db,
        issue_id=issue_id,
        reason=data.reason,
        user_id=current_user.id,
    )
    db.commit()
    db.refresh(entry_void)

    return VoidRead(
        id=entry_void.id,
        issue_id=entry_void.issue_id,
        receipt_id=entry_void.receipt_id,
        reason=entry_void.reason,
        voided_by=entry_void.voided_by,
        created_at=entry_void.created_at,
    )
