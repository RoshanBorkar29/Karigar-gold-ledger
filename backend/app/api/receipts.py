"""API endpoints for receipts of finished jewellery, scrap, and filings."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_clerk_or_finance
from app.models.entry_void import EntryVoid
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.ledger import VoidCreate, VoidRead
from app.schemas.receipt import ReceiptCreate, ReceiptRead
from app.services import ledger

router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post("", response_model=ReceiptRead, status_code=status.HTTP_201_CREATED)
def record_receipt(
    data: ReceiptCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> ReceiptRead:
    """Record finished jewellery, scrap, or filings returned from a karigar."""
    receipt = ledger.create_receipt(
        db,
        job_id=data.job_id,
        kind=data.kind,
        gross_mg=data.gross_mg,
        purity_bp=data.purity_bp,
        entry_date=data.entry_date,
        user_id=current_user.id,
        huid=data.huid,
        note=data.note,
    )
    db.commit()
    db.refresh(receipt)

    job = db.get(Job, receipt.job_id)
    karigar = db.get(Karigar, receipt.karigar_id)

    return ReceiptRead(
        id=receipt.id,
        txn_id=receipt.txn_id,
        job_id=receipt.job_id,
        job_no=job.job_no if job else None,
        karigar_id=receipt.karigar_id,
        karigar_name=karigar.name if karigar else None,
        kind=receipt.kind,
        gross_mg=receipt.gross_mg,
        purity_bp=receipt.purity_bp,
        fine_mg=receipt.fine_mg,
        huid=receipt.huid,
        entry_date=receipt.entry_date,
        created_by=receipt.created_by,
        note=receipt.note,
        is_voided=False,
        void_reason=None,
        created_at=receipt.created_at,
    )


@router.get("", response_model=list[ReceiptRead])
def list_receipts(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    job_id: int | None = Query(default=None),
    karigar_id: int | None = Query(default=None),
    kind: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    include_voided: bool = Query(default=True),
) -> list[ReceiptRead]:
    """List receipts with optional filtering by job, karigar, kind, and date range."""
    stmt = (
        select(
            Receipt,
            Job.job_no,
            Karigar.name.label("karigar_name"),
            EntryVoid.id.label("void_id"),
            EntryVoid.reason.label("void_reason"),
        )
        .join(Job, Job.id == Receipt.job_id)
        .join(Karigar, Karigar.id == Receipt.karigar_id)
        .outerjoin(EntryVoid, EntryVoid.receipt_id == Receipt.id)
    )

    if job_id is not None:
        stmt = stmt.where(Receipt.job_id == job_id)
    if karigar_id is not None:
        stmt = stmt.where(Receipt.karigar_id == karigar_id)
    if kind is not None:
        stmt = stmt.where(Receipt.kind == kind)
    if from_date is not None:
        stmt = stmt.where(Receipt.entry_date >= from_date)
    if to_date is not None:
        stmt = stmt.where(Receipt.entry_date <= to_date)
    if not include_voided:
        stmt = stmt.where(EntryVoid.id.is_(None))

    stmt = stmt.order_by(Receipt.entry_date.desc(), Receipt.id.desc())
    rows = db.execute(stmt).all()

    return [
        ReceiptRead(
            id=receipt.id,
            txn_id=receipt.txn_id,
            job_id=receipt.job_id,
            job_no=job_no,
            karigar_id=receipt.karigar_id,
            karigar_name=k_name,
            kind=receipt.kind,
            gross_mg=receipt.gross_mg,
            purity_bp=receipt.purity_bp,
            fine_mg=receipt.fine_mg,
            huid=receipt.huid,
            entry_date=receipt.entry_date,
            created_by=receipt.created_by,
            note=receipt.note,
            is_voided=void_id is not None,
            void_reason=void_reason,
            created_at=receipt.created_at,
        )
        for receipt, job_no, k_name, void_id, void_reason in rows
    ]


@router.post("/{receipt_id}/void", response_model=VoidRead)
def void_receipt(
    receipt_id: int,
    data: VoidCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> VoidRead:
    """Void a returned receipt entry with an explanatory audit reason."""
    entry_void = ledger.void_entry(
        db,
        receipt_id=receipt_id,
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
