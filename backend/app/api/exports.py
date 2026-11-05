"""API endpoints for financial and ledger exports (Tally ERP CSV format)."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_finance_head
from app.models.user import User
from app.services.stock_statement import compute_daily_stock, generate_tally_csv

router = APIRouter(prefix="/exports", tags=["exports (finance only)"])


@router.get("/tally")
def export_tally_csv(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(require_finance_head)],
    as_of: date | None = Query(default=None, description="Optional boundary date (inclusive)"),
) -> Response:
    """Export daily stock statement as a downloadable CSV formatted for Tally ERP."""
    statement = compute_daily_stock(db, as_of=as_of)
    csv_content = generate_tally_csv(statement)
    filename = f"tally_stock_{statement.as_of_date.isoformat()}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
