"""API endpoints for Groq vision OCR scale/karat readings and AI loss explanation drafts."""

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.explain import generate_loss_explanation
from app.ai.vision_reader import extract_karat_reading, extract_scale_reading
from app.api.deps import get_db, require_clerk_or_finance, require_finance_head
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
async def read_scale_photo(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> ScaleReadingResponse:
    """Upload weighing scale LCD photo, extract digital reading, and record audit log."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    res = extract_scale_reading(content, filename=file.filename or "scale.jpg")

    reading = AiReading(
        kind="scale",
        image_path=file.filename or "scale_upload.jpg",
        model_name=res["model_name"],
        ai_value_text=res["value"],
        ai_unit=res["unit"],
        ai_confidence=res["confidence"],
        ai_readable=res["readable"],
        outcome="pending",
        created_by=current_user.id,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    return ScaleReadingResponse(
        reading_id=reading.id,
        value_text=res["value"],
        unit=res["unit"],
        confidence=res["confidence"],
        readable=res["readable"],
        model_name=res["model_name"],
    )


@router.post("/read-karat", response_model=KaratMeterReadingResponse)
async def read_karat_meter_photo(
    file: Annotated[UploadFile, File(...)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_clerk_or_finance)],
) -> KaratMeterReadingResponse:
    """Upload karat meter display photo, extract purity percentage, and record audit log."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    res = extract_karat_reading(content, filename=file.filename or "karat.jpg")

    reading = AiReading(
        kind="karat",
        image_path=file.filename or "karat_upload.jpg",
        model_name=res["model_name"],
        ai_value_text=res["purity"],
        ai_unit=res["unit"],
        ai_confidence=res["confidence"],
        ai_readable=res["readable"],
        outcome="pending",
        created_by=current_user.id,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    return KaratMeterReadingResponse(
        reading_id=reading.id,
        purity_text=res["purity"],
        unit=res["unit"],
        confidence=res["confidence"],
        readable=res["readable"],
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
def explain_karigar_loss(
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
