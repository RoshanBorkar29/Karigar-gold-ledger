"""API endpoints for jewellery item categories."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_clerk_or_finance
from app.models.item_category import ItemCategory
from app.models.user import User
from app.schemas.item_category import ItemCategoryCreate, ItemCategoryRead

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[ItemCategoryRead])
def list_categories(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> list[ItemCategoryRead]:
    """List all jewellery item categories ordered by name."""
    categories = db.execute(select(ItemCategory).order_by(ItemCategory.name)).scalars().all()
    return [ItemCategoryRead.model_validate(c) for c in categories]


@router.post("", response_model=ItemCategoryRead, status_code=status.HTTP_201_CREATED)
def create_category(
    data: ItemCategoryCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> ItemCategoryRead:
    """Create a new jewellery item category."""
    name_clean = data.name.strip()
    existing = db.execute(
        select(ItemCategory).where(ItemCategory.name.ilike(name_clean))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Item category '{name_clean}' already exists",
        )

    category = ItemCategory(name=name_clean)
    db.add(category)
    db.commit()
    db.refresh(category)
    return ItemCategoryRead.model_validate(category)
