"""API endpoints for artisan (karigar) masters, wastage contracts, and assigned job orders."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_clerk_or_finance, require_finance_head
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.karigar_category_wastage import KarigarCategoryWastage
from app.models.user import User
from app.schemas.job import JobCreate, JobRead
from app.schemas.karigar import (
    KarigarCategoryWastageCreate,
    KarigarCategoryWastageRead,
    KarigarCreate,
    KarigarRead,
    KarigarUpdate,
)

router = APIRouter(prefix="/karigars", tags=["karigars"])


def _load_karigar_wastages(session: Session, karigar_id: int) -> list[KarigarCategoryWastageRead]:
    """Helper loading agreed wastage rates with category names."""
    stmt = (
        select(KarigarCategoryWastage, ItemCategory.name.label("category_name"))
        .join(ItemCategory, ItemCategory.id == KarigarCategoryWastage.category_id)
        .where(KarigarCategoryWastage.karigar_id == karigar_id)
        .order_by(ItemCategory.name)
    )
    rows = session.execute(stmt).all()
    results = []
    for wastage, cat_name in rows:
        results.append(
            KarigarCategoryWastageRead(
                id=wastage.id,
                karigar_id=wastage.karigar_id,
                category_id=wastage.category_id,
                category_name=cat_name,
                wastage_bp=wastage.wastage_bp,
                created_at=wastage.created_at,
            )
        )
    return results


@router.get("", response_model=list[KarigarRead])
def list_karigars(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    active_only: bool = Query(default=True, description="Filter for active artisans only"),
) -> list[KarigarRead]:
    """List all artisans and their agreed wastage rates per item category."""
    stmt = select(Karigar)
    if active_only:
        stmt = stmt.where(Karigar.is_active == True)  # noqa: E712
    stmt = stmt.order_by(Karigar.code)
    karigars = db.execute(stmt).scalars().all()

    output = []
    for k in karigars:
        wastages = _load_karigar_wastages(db, k.id)
        output.append(
            KarigarRead(
                id=k.id,
                code=k.code,
                name=k.name,
                is_active=k.is_active,
                created_at=k.created_at,
                wastages=wastages,
            )
        )
    return output


@router.post("", response_model=KarigarRead, status_code=status.HTTP_201_CREATED)
def create_karigar(
    data: KarigarCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> KarigarRead:
    """Register a new artisan in the master registry."""
    code_clean = data.code.strip().upper()
    existing = db.execute(select(Karigar).where(Karigar.code == code_clean)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Karigar with code '{code_clean}' already exists",
        )

    karigar = Karigar(
        code=code_clean,
        name=data.name.strip(),
        is_active=data.is_active,
    )
    db.add(karigar)
    db.commit()
    db.refresh(karigar)

    return KarigarRead(
        id=karigar.id,
        code=karigar.code,
        name=karigar.name,
        is_active=karigar.is_active,
        created_at=karigar.created_at,
        wastages=[],
    )


@router.get("/{karigar_id}", response_model=KarigarRead)
def get_karigar(
    karigar_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> KarigarRead:
    """Retrieve an artisan's details and agreed wastage rates."""
    karigar = db.get(Karigar, karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    wastages = _load_karigar_wastages(db, karigar.id)
    return KarigarRead(
        id=karigar.id,
        code=karigar.code,
        name=karigar.name,
        is_active=karigar.is_active,
        created_at=karigar.created_at,
        wastages=wastages,
    )


@router.put("/{karigar_id}", response_model=KarigarRead)
def update_karigar(
    karigar_id: int,
    data: KarigarUpdate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> KarigarRead:
    """Update artisan name or active status."""
    karigar = db.get(Karigar, karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    if data.name is not None:
        karigar.name = data.name.strip()
    if data.is_active is not None:
        karigar.is_active = data.is_active

    db.commit()
    db.refresh(karigar)
    wastages = _load_karigar_wastages(db, karigar.id)
    return KarigarRead(
        id=karigar.id,
        code=karigar.code,
        name=karigar.name,
        is_active=karigar.is_active,
        created_at=karigar.created_at,
        wastages=wastages,
    )


@router.post("/{karigar_id}/wastage", response_model=KarigarCategoryWastageRead)
def set_karigar_wastage(
    karigar_id: int,
    data: KarigarCategoryWastageCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> KarigarCategoryWastageRead:
    """Assign or update agreed wastage percentage for an item category."""
    karigar = db.get(Karigar, karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    category = db.get(ItemCategory, data.category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item category not found")

    stmt = select(KarigarCategoryWastage).where(
        KarigarCategoryWastage.karigar_id == karigar_id,
        KarigarCategoryWastage.category_id == data.category_id,
    )
    existing = db.execute(stmt).scalar_one_or_none()

    if existing:
        existing.wastage_bp = data.wastage_bp
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        new_wastage = KarigarCategoryWastage(
            karigar_id=karigar_id,
            category_id=data.category_id,
            wastage_bp=data.wastage_bp,
        )
        db.add(new_wastage)
        db.commit()
        db.refresh(new_wastage)
        target = new_wastage

    return KarigarCategoryWastageRead(
        id=target.id,
        karigar_id=target.karigar_id,
        category_id=target.category_id,
        category_name=category.name,
        wastage_bp=target.wastage_bp,
        created_at=target.created_at,
    )


@router.get("/{karigar_id}/jobs", response_model=list[JobRead])
def list_karigar_jobs(
    karigar_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[JobRead]:
    """List job orders assigned to this artisan."""
    karigar = db.get(Karigar, karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    stmt = (
        select(Job, Karigar.name.label("karigar_name"), ItemCategory.name.label("category_name"))
        .join(Karigar, Karigar.id == Job.karigar_id)
        .join(ItemCategory, ItemCategory.id == Job.category_id)
        .where(Job.karigar_id == karigar_id)
    )
    if status_filter:
        stmt = stmt.where(Job.status == status_filter.lower())
    stmt = stmt.order_by(Job.id.desc())

    rows = db.execute(stmt).all()
    return [
        JobRead(
            id=job.id,
            job_no=job.job_no,
            karigar_id=job.karigar_id,
            karigar_name=k_name,
            category_id=job.category_id,
            category_name=c_name,
            description=job.description,
            wastage_bp=job.wastage_bp,
            status=job.status,
            opened_on=job.opened_on,
            closed_on=job.closed_on,
            created_at=job.created_at,
        )
        for job, k_name, c_name in rows
    ]


@router.post("/{karigar_id}/jobs", response_model=JobRead, status_code=status.HTTP_201_CREATED)
def create_karigar_job(
    karigar_id: int,
    data: JobCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> JobRead:
    """Open a new workshop job order for an artisan, snapshotting agreed wastage."""
    karigar = db.get(Karigar, karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    category = db.get(ItemCategory, data.category_id)
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item category not found")

    job_no_clean = data.job_no.strip().upper()
    existing_job = db.execute(select(Job).where(Job.job_no == job_no_clean)).scalar_one_or_none()
    if existing_job:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Job '{job_no_clean}' already exists")

    wastage_bp = data.wastage_bp
    if wastage_bp is None:
        # Snapshot agreed wastage from master
        agreed = db.execute(
            select(KarigarCategoryWastage).where(
                KarigarCategoryWastage.karigar_id == karigar_id,
                KarigarCategoryWastage.category_id == data.category_id,
            )
        ).scalar_one_or_none()
        if not agreed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No agreed wastage rate configured for karigar '{karigar.name}' and category '{category.name}'. Provide wastage_bp explicitly or configure master rate.",
            )
        wastage_bp = agreed.wastage_bp

    job = Job(
        job_no=job_no_clean,
        karigar_id=karigar_id,
        category_id=data.category_id,
        description=data.description.strip(),
        wastage_bp=wastage_bp,
        status="open",
        opened_on=data.opened_on,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobRead(
        id=job.id,
        job_no=job.job_no,
        karigar_id=job.karigar_id,
        karigar_name=karigar.name,
        category_id=job.category_id,
        category_name=category.name,
        description=job.description,
        wastage_bp=job.wastage_bp,
        status=job.status,
        opened_on=job.opened_on,
        closed_on=job.closed_on,
        created_at=job.created_at,
    )
