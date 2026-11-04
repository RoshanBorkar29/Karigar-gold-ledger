"""Ledger service layer implementing core jewellery workshop business rules."""

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.models.entry_void import EntryVoid
from app.models.issue import Issue
from app.models.receipt import Receipt
from app.services.settlement import Settlement


def create_issue(
    session: Session,
    *,
    job_id: int,
    gross_mg: int,
    purity_bp: int,
    entry_date: date,
    user_id: int,
    note: str | None = None,
) -> Issue:
    """Record gold issued to a karigar for an open job."""
    raise NotImplementedError("Stub for TDD")


def create_receipt(
    session: Session,
    *,
    job_id: int,
    kind: str,
    gross_mg: int,
    purity_bp: int,
    entry_date: date,
    user_id: int,
    huid: str | None = None,
    note: str | None = None,
) -> Receipt:
    """Record finished jewellery, scrap, or filings received from a karigar."""
    raise NotImplementedError("Stub for TDD")


def void_entry(
    session: Session,
    *,
    issue_id: int | None = None,
    receipt_id: int | None = None,
    reason: str,
    user_id: int,
) -> EntryVoid:
    """Void an erroneous issue or receipt with an audit reason."""
    raise NotImplementedError("Stub for TDD")


def close_job(
    session: Session,
    *,
    job_id: int,
    closed_on: date,
    user_id: int,
) -> Settlement:
    """Close an open job order and calculate its final reconciliation."""
    raise NotImplementedError("Stub for TDD")


def job_settlement(
    session: Session,
    job_id: int,
    as_of: date | None = None,
) -> Settlement:
    """Compute gold settlement for a job as of a given date."""
    raise NotImplementedError("Stub for TDD")


def karigar_balance(
    session: Session,
    karigar_id: int,
    as_of: date | None = None,
) -> Any:
    """Calculate per-job settlements and total fine gold balance for a karigar."""
    raise NotImplementedError("Stub for TDD")


def all_karigar_balances(
    session: Session,
    as_of: date | None = None,
) -> list[Any]:
    """Calculate aggregate gold balance for all active karigars in one query."""
    raise NotImplementedError("Stub for TDD")
