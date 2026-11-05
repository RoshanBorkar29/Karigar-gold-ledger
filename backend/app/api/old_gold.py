"""API endpoints for old-gold intake desk, purity testing, and high-value compliance."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_clerk_or_finance
from app.core.gold import fine_weight_mg
from app.models.old_gold_purchase import OldGoldPurchase
from app.models.user import User
from app.schemas.old_gold_purchase import OldGoldPurchaseCreate, OldGoldPurchaseRead

router = APIRouter(prefix="/old-gold", tags=["old gold desk"])

PAN_THRESHOLD_PAISE = 20_000_000  # Rs 2,00,000 (200,000 * 100 paise)


@router.post("", response_model=OldGoldPurchaseRead, status_code=status.HTTP_201_CREATED)
def record_old_gold_purchase(
    data: OldGoldPurchaseCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> OldGoldPurchaseRead:
    """Record customer old-gold purchase with purity testing, deductions, and statutory compliance checks."""
    if data.deduction_mg >= data.gross_mg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deduction ({data.deduction_mg} mg) must be less than gross weight ({data.gross_mg} mg)",
        )

    if data.payment_mode not in ("cash", "upi", "bank_transfer", "cheque"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid payment mode '{data.payment_mode}'",
        )

    bill_no_clean = data.bill_no.strip().upper()
    existing = db.execute(select(OldGoldPurchase).where(OldGoldPurchase.bill_no == bill_no_clean)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Old-gold bill '{bill_no_clean}' already exists",
        )

    net_mg = data.gross_mg - data.deduction_mg
    fine_mg = fine_weight_mg(net_mg, data.tested_purity_bp)

    # Calculate valuation in paise using half-up integer math: (fine_mg * rate_paise_per_g + 500) // 1000
    value_paise = (fine_mg * data.rate_paise_per_g + 500) // 1000

    # Statutory compliance: high-value purchases >= Rs 2 Lakh require PAN and cannot be paid in cash
    pan_clean = data.pan.strip().upper() if data.pan else None
    if value_paise >= PAN_THRESHOLD_PAISE:
        if not pan_clean:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PAN is legally required for gold purchases of Rs 2,00,000 or above (Current value: Rs {value_paise // 100})",
            )
        if data.payment_mode == "cash":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cash payment is prohibited under Section 269ST for transactions >= Rs 2,00,000. Use UPI, bank transfer, or cheque.",
            )

    purchase = OldGoldPurchase(
        bill_no=bill_no_clean,
        gross_mg=data.gross_mg,
        tested_purity_bp=data.tested_purity_bp,
        deduction_mg=data.deduction_mg,
        fine_mg=fine_mg,
        rate_paise_per_g=data.rate_paise_per_g,
        value_paise=value_paise,
        payment_mode=data.payment_mode,
        pan=pan_clean,
        entry_date=data.entry_date,
        created_by=current_user.id,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)

    return OldGoldPurchaseRead.model_validate(purchase)


@router.get("", response_model=list[OldGoldPurchaseRead])
def list_old_gold_purchases(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
) -> list[OldGoldPurchaseRead]:
    """List customer old-gold purchases ordered by date."""
    stmt = select(OldGoldPurchase)
    if from_date:
        stmt = stmt.where(OldGoldPurchase.entry_date >= from_date)
    if to_date:
        stmt = stmt.where(OldGoldPurchase.entry_date <= to_date)
    stmt = stmt.order_by(OldGoldPurchase.entry_date.desc(), OldGoldPurchase.id.desc())

    purchases = db.execute(stmt).scalars().all()
    return [OldGoldPurchaseRead.model_validate(p) for p in purchases]


@router.get("/{purchase_id}", response_model=OldGoldPurchaseRead)
def get_old_gold_purchase(
    purchase_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> OldGoldPurchaseRead:
    """Retrieve details for a specific old-gold purchase transaction."""
    purchase = db.get(OldGoldPurchase, purchase_id)
    if not purchase:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Old-gold purchase not found")
    return OldGoldPurchaseRead.model_validate(purchase)
