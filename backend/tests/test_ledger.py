"""Tests for the ledger service layer."""

import os
from datetime import date, timedelta
from zoneinfo import ZoneInfo
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import Base
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.user import User
from app.services.errors import (
    InvalidEntryError,
    JobClosedError,
    NotFoundError,
    OverReturnError,
)
from app.services.ledger import (
    all_karigar_balances,
    close_job,
    create_issue,
    create_receipt,
    job_settlement,
    karigar_balance,
    void_entry,
)
from app.services.settlement import SettlementStatus

TEST_DB_URL = os.environ.get("DATABASE_URL_TEST") or settings.DATABASE_URL_TEST
pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="DATABASE_URL_TEST is not set in environment or settings",
)


@pytest.fixture(scope="session")
def db_engine():
    """Create test engine and ensure tables and sequences exist."""
    engine = create_engine(TEST_DB_URL)
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text("CREATE SEQUENCE IF NOT EXISTS txn_seq START WITH 30500;"))
        conn.commit()
    yield engine
    engine.dispose()


@pytest.fixture
def session(db_engine):
    """Provide a transactional session per test rolled back on teardown."""
    connection = db_engine.connect()
    transaction = connection.begin()
    sess = Session(bind=connection, expire_on_commit=False)

    yield sess

    sess.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture
def seed_entities(session: Session):
    """Seed prerequisite user, category, karigar, and job."""
    user = User(
        email="test_clerk@example.com",
        full_name="Test Clerk",
        password_hash="fakehash",
        role="issue_clerk",
        is_active=True,
    )
    category = ItemCategory(name="Bangle")
    karigar = Karigar(code="K-001", name="Murugesan", is_active=True)
    session.add_all([user, category, karigar])
    session.flush()

    job = Job(
        job_no="JOB-2026-001",
        karigar_id=karigar.id,
        category_id=category.id,
        description="22k Plain Bangle 4pc",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    session.add(job)
    session.flush()

    return {"user": user, "category": category, "karigar": karigar, "job": job}


def test_reproduce_sample_data_workflow(session: Session, seed_entities):
    """Reproduce sample data: issue 109920, finished 103004, scrap 3023 -> outstanding 3893."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    issue = create_issue(
        session,
        job_id=job.id,
        gross_mg=120000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
        note="Gold bar issue",
    )
    assert issue.fine_mg == 109920
    assert issue.txn_id.startswith("TX-")

    rcpt_finished = create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=112450,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
        huid="HUID01",
        note="Finished bangles",
    )
    assert rcpt_finished.fine_mg == 103004

    rcpt_scrap = create_receipt(
        session,
        job_id=job.id,
        kind="scrap",
        gross_mg=3300,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
        note="Workshop scrap",
    )
    assert rcpt_scrap.fine_mg == 3023

    st = job_settlement(session, job.id)
    assert st.issued_fine_mg == 109920
    assert st.finished_mg == 103004
    assert st.scrap_mg == 3023
    assert st.filings_mg == 0
    assert st.returned_mg == 106027
    assert st.outstanding_mg == 3893
    assert st.allowed_mg == 3298
    assert st.excess_mg == 595
    assert st.actual_wastage_bp == 354
    assert st.excess_loss_bp == 54
    assert st.status == SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE


def test_as_of_date_filtering(session: Session, seed_entities):
    """Settlement as_of filters out entries recorded after that date."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    create_issue(
        session,
        job_id=job.id,
        gross_mg=120000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )
    create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=112450,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
        huid="HUID01",
    )
    create_receipt(
        session,
        job_id=job.id,
        kind="scrap",
        gross_mg=3300,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
    )

    st_day1 = job_settlement(session, job.id, as_of=date(2026, 11, 1))
    assert st_day1.issued_fine_mg == 109920
    assert st_day1.returned_mg == 0
    assert st_day1.outstanding_mg == 109920

    st_day2 = job_settlement(session, job.id, as_of=date(2026, 11, 2))
    assert st_day2.returned_mg == 106027
    assert st_day2.outstanding_mg == 3893


def test_voiding_mechanics(session: Session, seed_entities):
    """Voided entries are excluded from settlement; double voids and breaking voids are rejected."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    issue = create_issue(
        session,
        job_id=job.id,
        gross_mg=120000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )
    rcpt_finished = create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=112450,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
        huid="HUID01",
    )
    rcpt_scrap = create_receipt(
        session,
        job_id=job.id,
        kind="scrap",
        gross_mg=3300,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
    )

    # Void scrap entry
    void = void_entry(
        session,
        receipt_id=rcpt_scrap.id,
        reason="Entered against wrong job order",
        user_id=user.id,
    )
    assert void.id is not None

    # Settlement now excludes scrap
    st = job_settlement(session, job.id)
    assert st.scrap_mg == 0
    assert st.returned_mg == 103004
    assert st.outstanding_mg == 6916

    # Double void must fail
    with pytest.raises(InvalidEntryError):
        void_entry(
            session,
            receipt_id=rcpt_scrap.id,
            reason="Voiding second time",
            user_id=user.id,
        )

    # Voiding issue that would cause returned > issued must fail
    with pytest.raises(OverReturnError):
        void_entry(
            session,
            issue_id=issue.id,
            reason="Void issue with existing active receipts",
            user_id=user.id,
        )


def test_close_job_workflow(session: Session, seed_entities):
    """Closing flips status to loss_beyond_allowance and rejects new entries."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    create_issue(
        session,
        job_id=job.id,
        gross_mg=120000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )
    create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=112450,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
        huid="HUID01",
    )
    create_receipt(
        session,
        job_id=job.id,
        kind="scrap",
        gross_mg=3300,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=user.id,
    )

    final_st = close_job(
        session,
        job_id=job.id,
        closed_on=date(2026, 11, 2),
        user_id=user.id,
    )
    assert final_st.status == SettlementStatus.LOSS_BEYOND_ALLOWANCE
    assert final_st.outstanding_mg == 3893
    assert final_st.excess_mg == 595

    # Closed job rejects new issues
    with pytest.raises(JobClosedError):
        create_issue(
            session,
            job_id=job.id,
            gross_mg=10000,
            purity_bp=9160,
            entry_date=date(2026, 11, 2),
            user_id=user.id,
        )

    # Closed job rejects new receipts
    with pytest.raises(JobClosedError):
        create_receipt(
            session,
            job_id=job.id,
            kind="filings",
            gross_mg=500,
            purity_bp=9160,
            entry_date=date(2026, 11, 2),
            user_id=user.id,
        )


def test_validation_rejections(session: Session, seed_entities):
    """Validation rejections: future date, date before opened_on, bad HUID, over-return."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    today = date.today()

    # Future date rejected
    with pytest.raises(InvalidEntryError):
        create_issue(
            session,
            job_id=job.id,
            gross_mg=10000,
            purity_bp=9160,
            entry_date=today + timedelta(days=5),
            user_id=user.id,
        )

    # Date before job opened_on rejected
    with pytest.raises(InvalidEntryError):
        create_issue(
            session,
            job_id=job.id,
            gross_mg=10000,
            purity_bp=9160,
            entry_date=date(2026, 10, 31),
            user_id=user.id,
        )

    # Issue 50000 gross @ 9160 -> 45800 fine_mg
    create_issue(
        session,
        job_id=job.id,
        gross_mg=50000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )

    # Wrong HUID format rejected
    for bad_huid in ["short", "TOOLONG1", "huid01", "HUI-01", ""]:
        with pytest.raises(InvalidEntryError):
            create_receipt(
                session,
                job_id=job.id,
                kind="finished",
                gross_mg=10000,
                purity_bp=9160,
                entry_date=date(2026, 11, 2),
                user_id=user.id,
                huid=bad_huid,
            )

    # HUID on scrap rejected
    with pytest.raises(InvalidEntryError):
        create_receipt(
            session,
            job_id=job.id,
            kind="scrap",
            gross_mg=1000,
            purity_bp=9160,
            entry_date=date(2026, 11, 2),
            user_id=user.id,
            huid="HUID01",
        )

    # Over-return rejected: job only has 45800 fine_mg issued; receipt of 60000 gross @ 9160 -> 54960 fine_mg must fail
    with pytest.raises(OverReturnError):
        create_receipt(
            session,
            job_id=job.id,
            kind="finished",
            gross_mg=60000,
            purity_bp=9160,
            entry_date=date(2026, 11, 2),
            user_id=user.id,
            huid="HUID01",
        )


def test_txn_id_strictly_increasing(session: Session, seed_entities):
    """Two issues in a row get different, increasing txn ids."""
    user = seed_entities["user"]
    job = seed_entities["job"]

    issue1 = create_issue(
        session,
        job_id=job.id,
        gross_mg=10000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )
    issue2 = create_issue(
        session,
        job_id=job.id,
        gross_mg=10000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=user.id,
    )

    assert issue1.txn_id != issue2.txn_id
    num1 = int(issue1.txn_id.split("-")[1])
    num2 = int(issue2.txn_id.split("-")[1])
    assert num2 > num1


def test_karigar_balance_and_all_karigar_balances(session: Session, seed_entities):
    """karigar_balance totals across two jobs; all_karigar_balances includes karigar with no jobs (0 balance)."""
    user = seed_entities["user"]
    category = seed_entities["category"]
    karigar1 = seed_entities["karigar"]
    job1 = seed_entities["job"]

    # Job 2 for Karigar 1
    job2 = Job(
        job_no="JOB-2026-002",
        karigar_id=karigar1.id,
        category_id=category.id,
        description="Ring 2pc",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    # Karigar 2 with no jobs
    karigar2 = Karigar(code="K-002", name="Raman", is_active=True)
    session.add_all([job2, karigar2])
    session.flush()

    # Job 1: Issue 50000 @ 9160 -> 45800 fine; Return finished 40000 @ 9160 -> 36640 fine -> balance 9160
    create_issue(session, job_id=job1.id, gross_mg=50000, purity_bp=9160, entry_date=date(2026, 11, 1), user_id=user.id)
    create_receipt(session, job_id=job1.id, kind="finished", gross_mg=40000, purity_bp=9160, entry_date=date(2026, 11, 2), user_id=user.id, huid="HUID01")

    # Job 2: Issue 30000 @ 9160 -> 27480 fine; Return scrap 10000 @ 9160 -> 9160 fine -> balance 18320
    create_issue(session, job_id=job2.id, gross_mg=30000, purity_bp=9160, entry_date=date(2026, 11, 1), user_id=user.id)
    create_receipt(session, job_id=job2.id, kind="scrap", gross_mg=10000, purity_bp=9160, entry_date=date(2026, 11, 2), user_id=user.id)

    # Karigar 1 balance across 2 jobs
    kb = karigar_balance(session, karigar1.id)
    assert kb.karigar_id == karigar1.id
    assert len(kb.jobs) == 2
    # Total fine balance: 9160 + 18320 = 27480
    assert kb.total_fine_balance_mg == 27480

    # All karigars balances in one query
    all_kb = all_karigar_balances(session)
    kb_map = {row.karigar_id: row for row in all_kb}

    assert karigar1.id in kb_map
    assert kb_map[karigar1.id].total_fine_balance_mg == 27480

    # Karigar 2 with no jobs must be included with balance 0
    assert karigar2.id in kb_map
    assert kb_map[karigar2.id].total_fine_balance_mg == 0
