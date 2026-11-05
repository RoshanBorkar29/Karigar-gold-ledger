"""Service aggregating gold balances across workshop vault, active karigars, and refiners for daily stock reports.

Strictly zero floating-point arithmetic. All calculations performed in integer milligrams.
"""

import csv
from dataclasses import dataclass
from datetime import date, datetime
import io
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.gold import fmt_g
from app.models.entry_void import EntryVoid
from app.models.issue import Issue
from app.models.old_gold_purchase import OldGoldPurchase
from app.models.receipt import Receipt
from app.models.vault_movement import VaultMovement
from app.services import ledger
from app.services.errors import InvalidEntryError
from app.services.ledger import KarigarBalanceSummaryRow


@dataclass(frozen=True)
class DailyStockStatement:
    """Consolidated bullion position across vault, artisan workbenches, and refiners."""

    as_of_date: date
    vault_fine_mg: int
    karigars_fine_mg: int
    refiner_fine_mg: int
    total_fine_mg: int
    karigars_breakdown: list[KarigarBalanceSummaryRow]


def compute_daily_stock(
    session: Session,
    as_of: date | None = None,
) -> DailyStockStatement:
    """Calculate consolidated gold stock position as of a given date."""
    effective_as_of = as_of or datetime.now(ZoneInfo("Asia/Kolkata")).date()

    # 1. Vault movements aggregation
    vm_stmt = (
        select(
            func.coalesce(func.sum(case((VaultMovement.kind == "bullion_in", VaultMovement.fine_mg), else_=0)), 0),
            func.coalesce(func.sum(case((VaultMovement.kind == "to_refiner", VaultMovement.fine_mg), else_=0)), 0),
            func.coalesce(func.sum(case((VaultMovement.kind == "from_refiner", VaultMovement.fine_mg), else_=0)), 0),
        )
        .where(VaultMovement.entry_date <= effective_as_of)
    )
    bullion_in, to_refiner, from_refiner = session.execute(vm_stmt).one()

    # 2. Old-gold purchases aggregation
    og_stmt = select(func.coalesce(func.sum(OldGoldPurchase.fine_mg), 0)).where(
        OldGoldPurchase.entry_date <= effective_as_of
    )
    old_gold_in = session.execute(og_stmt).scalar_one()

    # 3. Non-voided issues aggregation (vault -> karigars)
    issues_stmt = (
        select(func.coalesce(func.sum(Issue.fine_mg), 0))
        .outerjoin(EntryVoid, EntryVoid.issue_id == Issue.id)
        .where(EntryVoid.id.is_(None), Issue.entry_date <= effective_as_of)
    )
    issues_out = session.execute(issues_stmt).scalar_one()

    # 4. Non-voided receipts aggregation (karigars -> vault)
    receipts_stmt = (
        select(func.coalesce(func.sum(Receipt.fine_mg), 0))
        .outerjoin(EntryVoid, EntryVoid.receipt_id == Receipt.id)
        .where(EntryVoid.id.is_(None), Receipt.entry_date <= effective_as_of)
    )
    receipts_in = session.execute(receipts_stmt).scalar_one()

    # Calculate exact stock positions in integer milligrams
    vault_fine_mg = int(bullion_in) + int(from_refiner) + int(old_gold_in) + int(receipts_in) - int(issues_out) - int(to_refiner)
    karigars_fine_mg = int(issues_out) - int(receipts_in)
    refiner_fine_mg = int(to_refiner) - int(from_refiner)
    total_fine_mg = vault_fine_mg + karigars_fine_mg + refiner_fine_mg

    # Karigar breakdown
    karigars_breakdown = ledger.all_karigar_balances(session, as_of=effective_as_of)

    return DailyStockStatement(
        as_of_date=effective_as_of,
        vault_fine_mg=vault_fine_mg,
        karigars_fine_mg=karigars_fine_mg,
        refiner_fine_mg=refiner_fine_mg,
        total_fine_mg=total_fine_mg,
        karigars_breakdown=karigars_breakdown,
    )


def generate_tally_csv(statement: DailyStockStatement) -> str:
    """Format daily stock statement as a standard Tally ERP compatible CSV."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Write CSV Header
    writer.writerow([
        "Date",
        "Stock Category",
        "Account / Particulars",
        "Fine Weight (Grams)",
        "Fine Weight (Milligrams)",
    ])

    date_str = statement.as_of_date.isoformat()

    # Vault Stock
    writer.writerow([
        date_str,
        "Workshop Vault",
        "Main Bullion & Scrap Vault",
        fmt_g(statement.vault_fine_mg),
        str(statement.vault_fine_mg),
    ])

    # Refiner Stock
    writer.writerow([
        date_str,
        "Refinery In-Transit",
        "External Refiner Account",
        fmt_g(statement.refiner_fine_mg),
        str(statement.refiner_fine_mg),
    ])

    # Per-Karigar Balances
    for k in statement.karigars_breakdown:
        writer.writerow([
            date_str,
            "Karigar Ledger",
            f"{k.karigar_name} ({k.karigar_code})",
            fmt_g(k.total_fine_balance_mg),
            str(k.total_fine_balance_mg),
        ])

    # Consolidated Total
    writer.writerow([
        date_str,
        "CONSOLIDATED TOTAL",
        "Total Workshop Stock",
        fmt_g(statement.total_fine_mg),
        str(statement.total_fine_mg),
    ])

    return output.getvalue()


def create_vault_movement(
    session: Session,
    kind: str,
    fine_mg: int,
    entry_date: date,
    user_id: int,
    note: str | None = None,
) -> VaultMovement:
    """Record a vault bullion movement with balance check for to_refiner transfers."""
    if kind not in ("bullion_in", "to_refiner", "from_refiner"):
        raise InvalidEntryError(f"Invalid vault movement kind '{kind}'. Expected 'bullion_in', 'to_refiner', or 'from_refiner'.")
    if fine_mg <= 0:
        raise InvalidEntryError("Fine gold weight must be strictly positive")

    if kind == "to_refiner":
        stock = compute_daily_stock(session, as_of=entry_date)
        if fine_mg > stock.vault_fine_mg:
            raise InvalidEntryError("Transfer to refiner exceeds available vault fine gold balance")

    vm = VaultMovement(
        kind=kind,
        fine_mg=fine_mg,
        entry_date=entry_date,
        created_by=user_id,
        note=note,
    )
    session.add(vm)
    session.flush()
    return vm


def get_vault_movements(
    session: Session,
    limit: int = 50,
    offset: int = 0,
) -> list[VaultMovement]:
    """Retrieve list of vault movements ordered by entry_date descending."""
    return list(
        session.execute(
            select(VaultMovement)
            .order_by(VaultMovement.entry_date.desc(), VaultMovement.id.desc())
            .limit(limit)
            .offset(offset)
        )
        .scalars()
        .all()
    )

