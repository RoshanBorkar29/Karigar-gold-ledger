"""API endpoints for daily stock statement and vault bullion movements (Finance Head only)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_finance_head
from app.models.user import User
from app.models.vault_movement import VaultMovement
from app.schemas.ledger import KarigarBalanceSummaryRowRead
from app.schemas.stock import DailyStockStatementRead, VaultMovementCreate, VaultMovementRead
from app.services.stock_statement import compute_daily_stock

router = APIRouter(prefix="/stock", tags=["stock statement (finance only)"])


@router.get("/daily", response_model=DailyStockStatementRead)
def get_daily_stock_statement(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
    as_of: date | None = Query(default=None, description="Optional boundary date (inclusive)"),
) -> DailyStockStatementRead:
    """Retrieve consolidated stock position across vault, karigars, and refiners."""
    st = compute_daily_stock(db, as_of=as_of)
    return DailyStockStatementRead(
        as_of_date=st.as_of_date,
        vault_fine_mg=st.vault_fine_mg,
        karigars_fine_mg=st.karigars_fine_mg,
        refiner_fine_mg=st.refiner_fine_mg,
        total_fine_mg=st.total_fine_mg,
        karigars_breakdown=[
            KarigarBalanceSummaryRowRead(
                karigar_id=k.karigar_id,
                karigar_code=k.karigar_code,
                karigar_name=k.karigar_name,
                total_fine_balance_mg=k.total_fine_balance_mg,
            )
            for k in st.karigars_breakdown
        ],
    )


@router.post("/vault-movements", response_model=VaultMovementRead, status_code=status.HTTP_201_CREATED)
def record_vault_movement(
    data: VaultMovementCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_finance_head)],
) -> VaultMovementRead:
    """Record physical bullion deposit or transfer to/from external refiners."""
    if data.kind not in ("bullion_in", "to_refiner", "from_refiner"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid vault movement kind '{data.kind}'. Expected 'bullion_in', 'to_refiner', or 'from_refiner'.",
        )

    movement = VaultMovement(
        kind=data.kind,
        fine_mg=data.fine_mg,
        entry_date=data.entry_date,
        created_by=current_user.id,
        note=data.note,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return VaultMovementRead.model_validate(movement)
