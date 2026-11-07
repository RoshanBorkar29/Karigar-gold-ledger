"""API endpoints for karigar balance statements, job settlements, and job closing."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_clerk_or_finance
from app.models.user import User
from app.schemas.job import JobCloseRequest
from app.schemas.ledger import (
    JobSettlementRead,
    KarigarBalanceRead,
    KarigarBalanceSummaryRowRead,
    SettlementRead,
)
from app.services import ledger

router = APIRouter(tags=["balances & settlements"])


@router.get("/balances/karigars", response_model=list[KarigarBalanceSummaryRowRead])
def get_all_karigar_balances(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    as_of: date | None = Query(default=None, description="Optional date boundary (inclusive)"),
) -> list[KarigarBalanceSummaryRowRead]:
    """Retrieve fine gold balance for all active artisans calculated in one aggregate SQL query."""
    rows = ledger.all_karigar_balances(db, as_of=as_of)
    return [
        KarigarBalanceSummaryRowRead(
            karigar_id=r.karigar_id,
            karigar_code=r.karigar_code,
            karigar_name=r.karigar_name,
            total_fine_balance_mg=r.total_fine_balance_mg,
            total_issued_fine_mg=getattr(r, "total_issued_fine_mg", 0),
            total_returned_fine_mg=getattr(r, "total_returned_fine_mg", 0),
            net_outstanding_fine_mg=r.total_fine_balance_mg,
            open_jobs_count=getattr(r, "open_jobs_count", 0),
        )
        for r in rows
    ]


@router.get("/balances/karigars/{karigar_id}", response_model=KarigarBalanceRead)
def get_karigar_balance(
    karigar_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    as_of: date | None = Query(default=None, description="Optional date boundary (inclusive)"),
) -> KarigarBalanceRead:
    """Retrieve detailed per-job settlement calculations and total running balance for an artisan."""
    res = ledger.karigar_balance(db, karigar_id=karigar_id, as_of=as_of)
    job_items = [
        JobSettlementRead(
            job_id=j.job_id,
            job_no=j.job_no,
            settlement=SettlementRead(
                issued_fine_mg=j.settlement.issued_fine_mg,
                finished_mg=j.settlement.finished_mg,
                scrap_mg=j.settlement.scrap_mg,
                filings_mg=j.settlement.filings_mg,
                returned_mg=j.settlement.returned_mg,
                outstanding_mg=j.settlement.outstanding_mg,
                allowed_mg=j.settlement.allowed_mg,
                excess_mg=j.settlement.excess_mg,
                over_returned_mg=j.settlement.over_returned_mg,
                actual_wastage_bp=j.settlement.actual_wastage_bp,
                excess_loss_bp=j.settlement.excess_loss_bp,
                status=j.settlement.status.value if hasattr(j.settlement.status, "value") else str(j.settlement.status),
            ),
        )
        for j in res.jobs
    ]

    return KarigarBalanceRead(
        karigar_id=res.karigar_id,
        karigar_code=res.karigar_code,
        karigar_name=res.karigar_name,
        jobs=job_items,
        total_fine_balance_mg=res.total_fine_balance_mg,
    )


@router.get("/jobs/{job_id}/settlement", response_model=SettlementRead)
def get_job_settlement(
    job_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    as_of: date | None = Query(default=None),
) -> SettlementRead:
    """Calculate fine gold settlement figures for a specific job order."""
    st = ledger.job_settlement(db, job_id=job_id, as_of=as_of)
    return SettlementRead(
        issued_fine_mg=st.issued_fine_mg,
        finished_mg=st.finished_mg,
        scrap_mg=st.scrap_mg,
        filings_mg=st.filings_mg,
        returned_mg=st.returned_mg,
        outstanding_mg=st.outstanding_mg,
        allowed_mg=st.allowed_mg,
        excess_mg=st.excess_mg,
        over_returned_mg=st.over_returned_mg,
        actual_wastage_bp=st.actual_wastage_bp,
        excess_loss_bp=st.excess_loss_bp,
        status=st.status.value if hasattr(st.status, "value") else str(st.status),
    )


@router.post("/jobs/{job_id}/close", response_model=SettlementRead)
def close_job(
    job_id: int,
    data: JobCloseRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> SettlementRead:
    """Close an active workshop job order and finalize reconciliation figures."""
    st = ledger.close_job(
        db,
        job_id=job_id,
        closed_on=data.closed_on,
        user_id=current_user.id,
    )
    db.commit()

    return SettlementRead(
        issued_fine_mg=st.issued_fine_mg,
        finished_mg=st.finished_mg,
        scrap_mg=st.scrap_mg,
        filings_mg=st.filings_mg,
        returned_mg=st.returned_mg,
        outstanding_mg=st.outstanding_mg,
        allowed_mg=st.allowed_mg,
        excess_mg=st.excess_mg,
        over_returned_mg=st.over_returned_mg,
        actual_wastage_bp=st.actual_wastage_bp,
        excess_loss_bp=st.excess_loss_bp,
        status=st.status.value if hasattr(st.status, "value") else str(st.status),
    )
