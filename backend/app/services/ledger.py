"""Ledger service layer implementing core jewellery workshop business rules.

Provides issue/receipt transaction workflows, immutable entry voiding,
job closing, and single-query fine gold balance aggregations.
Strictly zero floats, zero Decimal. All weight maths via app.core.gold.
"""

from dataclasses import dataclass
from datetime import date, datetime
import re
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select, text
from sqlalchemy.orm import Session

from app.core.gold import fine_weight_mg
from app.models.entry_void import EntryVoid
from app.models.issue import Issue
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.receipt import Receipt
from app.services.errors import (
    InvalidEntryError,
    JobClosedError,
    NotFoundError,
    OverReturnError,
)
from app.services.settlement import Settlement, SettlementStatus, settle

HUID_REGEX = re.compile(r"^[A-Z0-9]{6}$")


@dataclass(frozen=True)
class JobSettlementItem:
    """Per-job settlement wrapper linking job identifiers with calculation results."""

    job_id: int
    job_no: str
    settlement: Settlement

    def __getattr__(self, name: str) -> Any:
        return getattr(self.settlement, name)


@dataclass(frozen=True)
class KarigarBalanceResult:
    """Detailed karigar account balance across all jobs."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    jobs: list[JobSettlementItem]
    total_fine_balance_mg: int

    @property
    def balance_mg(self) -> int:
        return self.total_fine_balance_mg


@dataclass(frozen=True)
class KarigarBalanceSummaryRow:
    """Summary row for workshop-wide karigar fine gold balance statement."""

    karigar_id: int
    karigar_code: str
    karigar_name: str
    total_fine_balance_mg: int

    @property
    def balance_mg(self) -> int:
        return self.total_fine_balance_mg


def _today_ist() -> date:
    """Return today's calendar date in Asia/Kolkata timezone."""
    return datetime.now(ZoneInfo("Asia/Kolkata")).date()


def _next_txn_id(session: Session) -> str:
    """Generate next sequential transaction identifier formatted TX-<sequence>."""
    val = session.execute(text("SELECT nextval('txn_seq')")).scalar()
    return f"TX-{val}"


def _get_open_job(session: Session, job_id: int) -> Job:
    """Fetch job and verify it exists and is open."""
    job = session.get(Job, job_id)
    if not job:
        raise NotFoundError(f"Job with id {job_id} not found")
    if job.status != "open":
        raise JobClosedError(f"Job {job.job_no} is {job.status}; operation requires an open job")
    return job


def _validate_entry_date(entry_date: date, opened_on: date) -> None:
    """Validate entry date is neither in the future nor before job opened_on."""
    today = _today_ist()
    if entry_date > today:
        raise InvalidEntryError(f"entry_date {entry_date} cannot be in the future (today is {today})")
    if entry_date < opened_on:
        raise InvalidEntryError(f"entry_date {entry_date} cannot be before job opened_on {opened_on}")


def _get_job_totals(
    session: Session,
    job_id: int,
    as_of: date | None = None,
) -> tuple[int, int, int, int]:
    """Retrieve non-voided fine gold totals for a job: issued, finished, scrap, filings."""
    effective_as_of = as_of or _today_ist()

    issue_q = (
        select(func.coalesce(func.sum(Issue.fine_mg), 0))
        .outerjoin(EntryVoid, EntryVoid.issue_id == Issue.id)
        .where(
            Issue.job_id == job_id,
            EntryVoid.id.is_(None),
            Issue.entry_date <= effective_as_of,
        )
    )
    issued_mg = session.execute(issue_q).scalar_one()

    receipt_q = (
        select(
            func.coalesce(func.sum(case((Receipt.kind == "finished", Receipt.fine_mg), else_=0)), 0),
            func.coalesce(func.sum(case((Receipt.kind == "scrap", Receipt.fine_mg), else_=0)), 0),
            func.coalesce(func.sum(case((Receipt.kind == "filings", Receipt.fine_mg), else_=0)), 0),
        )
        .outerjoin(EntryVoid, EntryVoid.receipt_id == Receipt.id)
        .where(
            Receipt.job_id == job_id,
            EntryVoid.id.is_(None),
            Receipt.entry_date <= effective_as_of,
        )
    )
    finished_mg, scrap_mg, filings_mg = session.execute(receipt_q).one()
    return int(issued_mg), int(finished_mg), int(scrap_mg), int(filings_mg)


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
    job = _get_open_job(session, job_id)
    _validate_entry_date(entry_date, job.opened_on)

    fine_mg = fine_weight_mg(gross_mg, purity_bp)
    txn_id = _next_txn_id(session)

    issue = Issue(
        txn_id=txn_id,
        job_id=job.id,
        karigar_id=job.karigar_id,
        gross_mg=gross_mg,
        purity_bp=purity_bp,
        fine_mg=fine_mg,
        entry_date=entry_date,
        created_by=user_id,
        note=note,
    )
    session.add(issue)
    session.flush()
    return issue


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
    job = _get_open_job(session, job_id)
    _validate_entry_date(entry_date, job.opened_on)

    if kind not in ("finished", "scrap", "filings"):
        raise InvalidEntryError(f"Invalid receipt kind '{kind}'. Expected 'finished', 'scrap', or 'filings'.")

    if kind == "finished":
        if not huid or not HUID_REGEX.match(huid):
            raise InvalidEntryError(
                f"Finished receipt requires an exact 6-character uppercase alphanumeric HUID, got: {huid!r}"
            )
    else:
        if huid is not None:
            raise InvalidEntryError(f"HUID must be None for receipt kind '{kind}', got: {huid!r}")

    fine_mg = fine_weight_mg(gross_mg, purity_bp)

    # Check for over-return: total non-voided receipts + this receipt cannot exceed non-voided issues
    issued_mg, finished_mg, scrap_mg, filings_mg = _get_job_totals(session, job.id)
    current_returned = finished_mg + scrap_mg + filings_mg
    if current_returned + fine_mg > issued_mg:
        raise OverReturnError(
            f"Receipt fine weight ({fine_mg} mg) causes returned total ({current_returned + fine_mg} mg) "
            f"to exceed issued total ({issued_mg} mg) for job {job.job_no}"
        )

    txn_id = _next_txn_id(session)
    receipt = Receipt(
        txn_id=txn_id,
        job_id=job.id,
        karigar_id=job.karigar_id,
        kind=kind,
        gross_mg=gross_mg,
        purity_bp=purity_bp,
        fine_mg=fine_mg,
        huid=huid,
        entry_date=entry_date,
        created_by=user_id,
        note=note,
    )
    session.add(receipt)
    session.flush()
    return receipt


def void_entry(
    session: Session,
    *,
    issue_id: int | None = None,
    receipt_id: int | None = None,
    reason: str,
    user_id: int,
) -> EntryVoid:
    """Void an erroneous issue or receipt with an audit reason."""
    if (issue_id is None and receipt_id is None) or (issue_id is not None and receipt_id is not None):
        raise InvalidEntryError("Exactly one of issue_id or receipt_id must be provided")

    if not reason or len(reason.strip()) < 5:
        raise InvalidEntryError("Void reason must be at least 5 characters")

    clean_reason = reason.strip()

    if issue_id is not None:
        issue = session.get(Issue, issue_id)
        if not issue:
            raise NotFoundError(f"Issue with id {issue_id} not found")

        existing = session.execute(
            select(EntryVoid).where(EntryVoid.issue_id == issue_id)
        ).scalar_one_or_none()
        if existing:
            raise InvalidEntryError(f"Issue {issue_id} has already been voided")

        # Reject if voiding leaves returned > issued
        issued_mg, finished_mg, scrap_mg, filings_mg = _get_job_totals(session, issue.job_id)
        current_returned = finished_mg + scrap_mg + filings_mg
        if (issued_mg - issue.fine_mg) < current_returned:
            raise OverReturnError(
                f"Cannot void issue {issue_id}: remaining issued gold ({issued_mg - issue.fine_mg} mg) "
                f"would be less than returned gold ({current_returned} mg)"
            )

    if receipt_id is not None:
        receipt = session.get(Receipt, receipt_id)
        if not receipt:
            raise NotFoundError(f"Receipt with id {receipt_id} not found")

        existing = session.execute(
            select(EntryVoid).where(EntryVoid.receipt_id == receipt_id)
        ).scalar_one_or_none()
        if existing:
            raise InvalidEntryError(f"Receipt {receipt_id} has already been voided")

    entry_void = EntryVoid(
        issue_id=issue_id,
        receipt_id=receipt_id,
        reason=clean_reason,
        voided_by=user_id,
    )
    session.add(entry_void)
    session.flush()
    return entry_void


def close_job(
    session: Session,
    *,
    job_id: int,
    closed_on: date,
    user_id: int,
) -> Settlement:
    """Close an open job order and calculate its final reconciliation."""
    job = session.get(Job, job_id)
    if not job:
        raise NotFoundError(f"Job with id {job_id} not found")
    if job.status == "closed":
        raise JobClosedError(f"Job {job.job_no} is already closed")

    today = _today_ist()
    if closed_on > today:
        raise InvalidEntryError(f"closed_on {closed_on} cannot be in the future (today is {today})")
    if closed_on < job.opened_on:
        raise InvalidEntryError(f"closed_on {closed_on} cannot be before job opened_on {job.opened_on}")

    # Check last non-voided entry date across issues and receipts
    last_issue_date = session.execute(
        select(func.max(Issue.entry_date))
        .outerjoin(EntryVoid, EntryVoid.issue_id == Issue.id)
        .where(Issue.job_id == job_id, EntryVoid.id.is_(None))
    ).scalar_one_or_none()

    last_receipt_date = session.execute(
        select(func.max(Receipt.entry_date))
        .outerjoin(EntryVoid, EntryVoid.receipt_id == Receipt.id)
        .where(Receipt.job_id == job_id, EntryVoid.id.is_(None))
    ).scalar_one_or_none()

    entry_dates = [d for d in (last_issue_date, last_receipt_date) if d is not None]
    if entry_dates:
        latest_entry_date = max(entry_dates)
        if closed_on < latest_entry_date:
            raise InvalidEntryError(
                f"closed_on {closed_on} cannot be before latest entry date {latest_entry_date}"
            )

    job.status = "closed"
    job.closed_on = closed_on
    session.flush()

    issued_mg, finished_mg, scrap_mg, filings_mg = _get_job_totals(session, job_id)
    return settle(
        issued_fine_mg=issued_mg,
        finished_mg=finished_mg,
        scrap_mg=scrap_mg,
        filings_mg=filings_mg,
        wastage_bp=job.wastage_bp,
        job_open=False,
    )


def job_settlement(
    session: Session,
    job_id: int,
    as_of: date | None = None,
) -> Settlement:
    """Compute gold settlement for a job as of a given date."""
    job = session.get(Job, job_id)
    if not job:
        raise NotFoundError(f"Job with id {job_id} not found")

    issued_mg, finished_mg, scrap_mg, filings_mg = _get_job_totals(session, job_id, as_of)
    is_open = (job.status == "open")

    return settle(
        issued_fine_mg=issued_mg,
        finished_mg=finished_mg,
        scrap_mg=scrap_mg,
        filings_mg=filings_mg,
        wastage_bp=job.wastage_bp,
        job_open=is_open,
    )


def karigar_balance(
    session: Session,
    karigar_id: int,
    as_of: date | None = None,
) -> KarigarBalanceResult:
    """Calculate per-job settlements and total fine gold balance for a karigar in one SQL query."""
    karigar = session.get(Karigar, karigar_id)
    if not karigar:
        raise NotFoundError(f"Karigar with id {karigar_id} not found")

    effective_as_of = as_of or _today_ist()

    # One aggregate query for all jobs of this karigar
    query = text(
        """
        SELECT
            j.id AS job_id,
            j.job_no,
            j.wastage_bp,
            j.status,
            COALESCE(i.issued_mg, 0) AS issued_mg,
            COALESCE(r.finished_mg, 0) AS finished_mg,
            COALESCE(r.scrap_mg, 0) AS scrap_mg,
            COALESCE(r.filings_mg, 0) AS filings_mg,
            COALESCE(r.returned_mg, 0) AS returned_mg
        FROM jobs j
        LEFT JOIN (
            SELECT i.job_id, SUM(i.fine_mg) AS issued_mg
            FROM issues i
            LEFT JOIN entry_voids v ON v.issue_id = i.id
            WHERE v.id IS NULL AND i.entry_date <= :as_of
            GROUP BY i.job_id
        ) i ON i.job_id = j.id
        LEFT JOIN (
            SELECT r.job_id,
                SUM(CASE WHEN r.kind = 'finished' THEN r.fine_mg ELSE 0 END) AS finished_mg,
                SUM(CASE WHEN r.kind = 'scrap' THEN r.fine_mg ELSE 0 END) AS scrap_mg,
                SUM(CASE WHEN r.kind = 'filings' THEN r.fine_mg ELSE 0 END) AS filings_mg,
                SUM(r.fine_mg) AS returned_mg
            FROM receipts r
            LEFT JOIN entry_voids v ON v.receipt_id = r.id
            WHERE v.id IS NULL AND r.entry_date <= :as_of
            GROUP BY r.job_id
        ) r ON r.job_id = j.id
        WHERE j.karigar_id = :karigar_id
        ORDER BY j.id;
        """
    )

    rows = session.execute(
        query,
        {"karigar_id": karigar_id, "as_of": effective_as_of},
    ).mappings().all()

    job_settlements: list[JobSettlementItem] = []
    total_fine_balance_mg = 0

    for row in rows:
        issued_fine = int(row["issued_mg"])
        finished = int(row["finished_mg"])
        scrap = int(row["scrap_mg"])
        filings = int(row["filings_mg"])
        returned = int(row["returned_mg"])
        is_open = (row["status"] == "open")

        st = settle(
            issued_fine_mg=issued_fine,
            finished_mg=finished,
            scrap_mg=scrap,
            filings_mg=filings,
            wastage_bp=int(row["wastage_bp"]),
            job_open=is_open,
        )
        job_settlements.append(
            JobSettlementItem(
                job_id=int(row["job_id"]),
                job_no=str(row["job_no"]),
                settlement=st,
            )
        )
        total_fine_balance_mg += (issued_fine - returned)

    return KarigarBalanceResult(
        karigar_id=karigar.id,
        karigar_code=karigar.code,
        karigar_name=karigar.name,
        jobs=job_settlements,
        total_fine_balance_mg=total_fine_balance_mg,
    )


def all_karigar_balances(
    session: Session,
    as_of: date | None = None,
) -> list[KarigarBalanceSummaryRow]:
    """Calculate aggregate gold balance for all active karigars in one SQL query."""
    effective_as_of = as_of or _today_ist()

    query = text(
        """
        SELECT
            k.id AS karigar_id,
            k.code AS karigar_code,
            k.name AS karigar_name,
            COALESCE(SUM(i.issued_mg), 0) - COALESCE(SUM(r.returned_mg), 0) AS total_fine_balance_mg
        FROM karigars k
        LEFT JOIN jobs j ON j.karigar_id = k.id
        LEFT JOIN (
            SELECT i.job_id, SUM(i.fine_mg) AS issued_mg
            FROM issues i
            LEFT JOIN entry_voids v ON v.issue_id = i.id
            WHERE v.id IS NULL AND i.entry_date <= :as_of
            GROUP BY i.job_id
        ) i ON i.job_id = j.id
        LEFT JOIN (
            SELECT r.job_id, SUM(r.fine_mg) AS returned_mg
            FROM receipts r
            LEFT JOIN entry_voids v ON v.receipt_id = r.id
            WHERE v.id IS NULL AND r.entry_date <= :as_of
            GROUP BY r.job_id
        ) r ON r.job_id = j.id
        WHERE k.is_active = true
        GROUP BY k.id, k.code, k.name
        ORDER BY k.code;
        """
    )

    rows = session.execute(query, {"as_of": effective_as_of}).mappings().all()

    return [
        KarigarBalanceSummaryRow(
            karigar_id=int(row["karigar_id"]),
            karigar_code=str(row["karigar_code"]),
            karigar_name=str(row["karigar_name"]),
            total_fine_balance_mg=int(row["total_fine_balance_mg"]),
        )
        for row in rows
    ]
