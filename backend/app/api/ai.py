"""API endpoints for Groq vision OCR scale/karat readings and AI loss explanation drafts."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.explain import generate_loss_explanation
from app.ai.validators import (
    validate_karat_reading,
    validate_scale_reading,
    validate_upload_file,
)
from app.ai.vision_reader import extract_karat_reading, extract_scale_reading
from app.api.deps import get_db, require_clerk_or_finance, require_finance_head
from app.core.limiter import limiter
from app.models.ai_reading import AiReading
from app.models.karigar import Karigar
from app.models.user import User
from app.schemas.ai_reading import (
    AiReadingRead,
    KaratMeterReadingResponse,
    LossExplanationRequest,
    LossExplanationResponse,
    ReadingConfirmRequest,
    ScaleReadingResponse,
)
from app.services.drift import evaluate_karigar_drift

router = APIRouter(prefix="/ai", tags=["ai vision & explanations"])


@router.post("/read-scale", response_model=ScaleReadingResponse)
@limiter.limit("20/minute")
async def read_scale_photo(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> ScaleReadingResponse:
    """Upload weighing scale LCD photo, extract digital reading, and record audit log."""
    content = await file.read()
    try:
        validate_upload_file(content, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    res = extract_scale_reading(content, filename=file.filename or "scale.jpg")

    is_fallback = res.get("fallback") == "manual" or not res.get("readable")
    outcome = "fallback_manual" if is_fallback else "pending"

    reading = AiReading(
        kind="scale",
        image_path=file.filename or "scale_upload.jpg",
        model_name=res["model_name"],
        ai_value_text=res["value"] or "",
        ai_unit=res["unit"] or "g",
        ai_confidence=res["confidence"],
        ai_readable=res["readable"],
        outcome=outcome,
        created_by=current_user.id,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    val_mg = None
    if res.get("readable") and res.get("value"):
        try:
            val_mg = validate_scale_reading(res["value"], res.get("unit") or "g", True)
        except Exception:
            pass

    return ScaleReadingResponse(
        reading_id=reading.id,
        value_text=res["value"],
        value_mg=val_mg,
        unit=res["unit"],
        confidence=res["confidence"],
        readable=res["readable"],
        fallback=res.get("fallback"),
        model_name=res["model_name"],
    )


@router.post("/read-karat", response_model=KaratMeterReadingResponse)
@limiter.limit("20/minute")
async def read_karat_meter_photo(
    request: Request,
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> KaratMeterReadingResponse:
    """Upload karat meter display photo, extract purity percentage, and record audit log."""
    content = await file.read()
    try:
        validate_upload_file(content, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    res = extract_karat_reading(content, filename=file.filename or "karat.jpg")

    is_fallback = res.get("fallback") == "manual" or not res.get("readable")
    outcome = "fallback_manual" if is_fallback else "pending"

    reading = AiReading(
        kind="karat",
        image_path=file.filename or "karat_upload.jpg",
        model_name=res["model_name"],
        ai_value_text=res["purity"] or "",
        ai_unit=res["unit"] or "%",
        ai_confidence=res["confidence"],
        ai_readable=res["readable"],
        outcome=outcome,
        created_by=current_user.id,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    pur_bp = None
    if res.get("readable") and res.get("purity"):
        try:
            pur_bp = validate_karat_reading(res["purity"], res.get("unit") or "%", True)
        except Exception:
            pass

    return KaratMeterReadingResponse(
        reading_id=reading.id,
        purity_text=res["purity"],
        purity_bp=pur_bp,
        unit=res["unit"],
        confidence=res["confidence"],
        readable=res["readable"],
        fallback=res.get("fallback"),
        model_name=res["model_name"],
    )


@router.post("/readings/{reading_id}/confirm", response_model=AiReadingRead)
def confirm_or_override_reading(
    reading_id: int,
    data: ReadingConfirmRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_clerk_or_finance)],
) -> AiReadingRead:
    """Allow issue clerk to confirm or override an AI reading prior to ledger entry."""
    reading = db.get(AiReading, reading_id)
    if not reading:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI reading record not found")

    reading.confirmed_value_text = data.confirmed_value.strip()
    if data.override:
        reading.outcome = "fallback_manual"
    else:
        reading.outcome = "confirmed"

    db.commit()
    db.refresh(reading)
    return AiReadingRead.model_validate(reading)


@router.post("/explain-loss", response_model=LossExplanationResponse)
@limiter.limit("15/minute")
def explain_karigar_loss(
    request: Request,
    data: LossExplanationRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
) -> LossExplanationResponse:
    """Generate an AI audit explanation draft for an artisan flagged by loss-drift rules (Finance Head only)."""
    karigar = db.get(Karigar, data.karigar_id)
    if not karigar:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Karigar not found")

    drift = evaluate_karigar_drift(db, karigar.id)

    explanation, source = generate_loss_explanation(
        karigar_name=karigar.name,
        karigar_code=karigar.code,
        recent_loss_bp=drift.recent_loss_bp,
        baseline_mean_bp=drift.baseline_mean_bp,
        sample_size=drift.sample_size,
        additional_context=data.additional_context,
    )

    return LossExplanationResponse(
        karigar_id=karigar.id,
        karigar_code=karigar.code,
        karigar_name=karigar.name,
        explanation=explanation,
        source=source,
    )
