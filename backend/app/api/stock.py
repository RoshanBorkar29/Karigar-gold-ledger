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
from app.services.errors import InvalidEntryError
from app.services.stock_statement import (
    compute_daily_stock,
    create_vault_movement,
    get_vault_movements,
)

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


@router.post("/movements", response_model=VaultMovementRead, status_code=status.HTTP_201_CREATED)
@router.post("/vault-movements", response_model=VaultMovementRead, status_code=status.HTTP_201_CREATED)
def record_vault_movement(
    data: VaultMovementCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_finance_head)],
) -> VaultMovementRead:
    """Record physical bullion deposit or transfer to/from external refiners."""
    try:
        movement = create_vault_movement(
            session=db,
            kind=data.kind,
            fine_mg=data.fine_mg,
            entry_date=data.entry_date,
            user_id=current_user.id,
            note=data.note,
        )
        db.commit()
        db.refresh(movement)
        return VaultMovementRead.model_validate(movement)
    except InvalidEntryError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/movements", response_model=list[VaultMovementRead])
@router.get("/vault-movements", response_model=list[VaultMovementRead])
def list_vault_movements(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[VaultMovementRead]:
    """Retrieve history of vault bullion movements (Finance Head only)."""
    movements = get_vault_movements(db, limit=limit, offset=offset)
    return [VaultMovementRead.model_validate(m) for m in movements]
