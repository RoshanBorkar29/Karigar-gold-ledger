"""Unit tests for statistical loss-drift detection identifying karigars exceeding personal historical benchmarks."""

import os
from datetime import date, timedelta
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.base import Base
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.user import User
from app.services import ledger
from app.services.drift import evaluate_karigar_drift

TEST_DB_URL = os.environ.get("DATABASE_URL_TEST") or settings.DATABASE_URL_TEST
pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="DATABASE_URL_TEST is not set in environment or settings",
)


@pytest.fixture(scope="session")
def db_engine():
    """Create test engine and initialize tables."""
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


def _create_job_with_loss(
    session: Session,
    karigar_id: int,
    category_id: int,
    user_id: int,
    job_no: str,
    opened_on: date,
    closed_on: date | None,
    issued_fine_mg: int,
    loss_bp: int,
    is_closed: bool = True,
) -> Job:
    """Helper to create an issue, receipt, and optionally close the job with an exact loss in basis points."""
    job = Job(
        job_no=job_no,
        karigar_id=karigar_id,
        category_id=category_id,
        description=f"Job {job_no}",
        wastage_bp=300,
        status="open",
        opened_on=opened_on,
        closed_on=None,
    )
    session.add(job)
    session.flush()

    # Issue 91.60% gold
    gross_issue_mg = (issued_fine_mg * 10000 + 4580) // 9160
    ledger.create_issue(
        session,
        job_id=job.id,
        gross_mg=gross_issue_mg,
        purity_bp=9160,
        entry_date=opened_on,
        user_id=user_id,
    )

    # Actual fine issued in ledger
    st_issue = ledger.job_settlement(session, job.id)
    actual_issued_fine = st_issue.issued_fine_mg

    # Loss in milligrams: (actual_issued_fine * loss_bp + 5000) // 10000
    loss_mg = (actual_issued_fine * loss_bp + 5000) // 10000
    return_fine_mg = max(0, actual_issued_fine - loss_mg)

    gross_rec_mg = (return_fine_mg * 10000 + 4580) // 9160
    if return_fine_mg > 0:
        ledger.create_receipt(
            session,
            job_id=job.id,
            kind="finished",
            gross_mg=gross_rec_mg,
            purity_bp=9160,
            entry_date=closed_on or opened_on,
            user_id=user_id,
            huid="HUID01",
        )

    if is_closed and closed_on:
        ledger.close_job(
            session,
            job_id=job.id,
            closed_on=closed_on,
            user_id=user_id,
        )

    session.flush()
    return job


def test_open_job_with_large_outstanding_does_not_create_alert(session: Session):
    """An open job with large outstanding gold must NEVER create an alert or affect recent loss."""
    cat = ItemCategory(name="Bangle")
    karigar = Karigar(code="K-TEST-OPEN", name="Test Artisan Open", is_active=True)
    user = User(email="test_clerk@test.com", full_name="Test Clerk", password_hash="hash", role="issue_clerk", is_active=True)
    session.add_all([cat, karigar, user])
    session.flush()

    # 4 closed baseline jobs with normal 2.00% (200 bp) loss
    for i in range(1, 5):
        _create_job_with_loss(
            session,
            karigar_id=karigar.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-BASE-{i}",
            opened_on=date(2026, 8, i),
            closed_on=date(2026, 8, i + 2),
            issued_fine_mg=50000,
            loss_bp=200,
            is_closed=True,
        )

    # 1 open job with 100g issued and 0g returned (100% outstanding!)
    _create_job_with_loss(
        session,
        karigar_id=karigar.id,
        category_id=cat.id,
        user_id=user.id,
        job_no="JOB-ACTIVE-OPEN",
        opened_on=date(2026, 9, 1),
        closed_on=None,
        issued_fine_mg=100000,
        loss_bp=10000,
        is_closed=False,
    )

    drift = evaluate_karigar_drift(session, karigar.id)
    # The open job must be completely ignored; recent loss is from the closed job (~200 bp)
    assert drift.is_anomalous is False
    assert drift.sample_size == 3  # 3 baseline closed jobs before the 1 recent closed job
    assert abs(drift.recent_loss_bp - 200) <= 5


def test_karigar_with_two_closed_jobs_returns_insufficient_history(session: Session):
    """A karigar with only 2 closed jobs returns insufficient history (minimum 3 baseline required)."""
    cat = ItemCategory(name="Chain")
    karigar = Karigar(code="K-TEST-TWO", name="Two Jobs Karigar", is_active=True)
    user = User(email="test2@test.com", full_name="Test Clerk 2", password_hash="hash", role="issue_clerk", is_active=True)
    session.add_all([cat, karigar, user])
    session.flush()

    for i in range(1, 3):
        _create_job_with_loss(
            session,
            karigar_id=karigar.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-TWO-{i}",
            opened_on=date(2026, 8, i * 3),
            closed_on=date(2026, 8, i * 3 + 1),
            issued_fine_mg=50000,
            loss_bp=250,
            is_closed=True,
        )

    drift = evaluate_karigar_drift(session, karigar.id)
    assert drift.is_anomalous is False
    assert "insufficient history" in drift.explanation


def test_stable_karigar_does_not_alert(session: Session):
    """A karigar with stable loss across baseline and recent closed jobs does not alert."""
    cat = ItemCategory(name="Ring")
    karigar = Karigar(code="K-TEST-STABLE", name="Stable Karigar", is_active=True)
    user = User(email="test3@test.com", full_name="Test Clerk 3", password_hash="hash", role="issue_clerk", is_active=True)
    session.add_all([cat, karigar, user])
    session.flush()

    # 6 closed jobs with stable 2.50% loss
    for i in range(1, 7):
        _create_job_with_loss(
            session,
            karigar_id=karigar.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-STABLE-{i}",
            opened_on=date(2026, 8, i * 3),
            closed_on=date(2026, 8, i * 3 + 1),
            issued_fine_mg=50000,
            loss_bp=250,
            is_closed=True,
        )

    drift = evaluate_karigar_drift(session, karigar.id)
    assert drift.is_anomalous is False
    assert drift.sample_size == 4
    assert abs(drift.recent_loss_bp - 250) <= 2


def test_drifting_karigar_alerts(session: Session):
    """A karigar with recent loss drifting > 50 bp and > 2 stddev above baseline alerts."""
    cat = ItemCategory(name="Earring")
    karigar = Karigar(code="K-TEST-DRIFT", name="Drifting Karigar", is_active=True)
    user = User(email="test4@test.com", full_name="Test Clerk 4", password_hash="hash", role="issue_clerk", is_active=True)
    session.add_all([cat, karigar, user])
    session.flush()

    # 4 baseline closed jobs with stable 2.00% (200 bp) loss
    for i in range(1, 5):
        _create_job_with_loss(
            session,
            karigar_id=karigar.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-DRIFT-BASE-{i}",
            opened_on=date(2026, 8, i * 3),
            closed_on=date(2026, 8, i * 3 + 1),
            issued_fine_mg=50000,
            loss_bp=200,
            is_closed=True,
        )

    # 2 recent closed jobs with high 3.50% (350 bp) loss (+150 bp above baseline)
    for i in range(5, 7):
        _create_job_with_loss(
            session,
            karigar_id=karigar.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-DRIFT-REC-{i}",
            opened_on=date(2026, 9, i * 3),
            closed_on=date(2026, 9, i * 3 + 1),
            issued_fine_mg=50000,
            loss_bp=350,
            is_closed=True,
        )

    drift = evaluate_karigar_drift(session, karigar.id)
    assert drift.is_anomalous is True
    assert drift.sample_size == 4
    assert drift.recent_loss_bp > drift.baseline_mean_bp + 50
    assert "Worth reviewing" in drift.explanation


def test_boundary_values_at_50bp_and_2_stddev(session: Session):
    """Verify strict boundary conditions: exactly +50 bp or exactly 2 stddev do NOT trigger anomaly."""
    cat = ItemCategory(name="Necklace")
    user = User(email="test5@test.com", full_name="Test Clerk 5", password_hash="hash", role="issue_clerk", is_active=True)
    session.add_all([cat, user])
    session.flush()

    # Case 1: Testing exact +50 bp boundary.
    # 3 baseline jobs with identical loss: 200, 200, 200 (mean=200, stddev=0).
    # Here 2 * stddev = 0.
    # Condition: recent > mean + 2*stddev (200) AND recent > mean + 50 (250).
    # - At recent = 250 (exact +50 bp): 250 > 250 is False -> NOT anomalous.
    # - At recent = 251 (+51 bp): 251 > 250 is True -> IS anomalous.

    k_boundary_50 = Karigar(code="K-BOUND-50", name="Boundary 50 Karigar", is_active=True)
    session.add(k_boundary_50)
    session.flush()

    for i in range(1, 4):
        _create_job_with_loss(
            session,
            karigar_id=k_boundary_50.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-B50-BASE-{i}",
            opened_on=date(2026, 8, i),
            closed_on=date(2026, 8, i + 1),
            issued_fine_mg=100000,
            loss_bp=200,
            is_closed=True,
        )

    # 1 recent job at exactly +50 bp (250 bp)
    j_50 = _create_job_with_loss(
        session,
        karigar_id=k_boundary_50.id,
        category_id=cat.id,
        user_id=user.id,
        job_no="JOB-B50-REC",
        opened_on=date(2026, 8, 10),
        closed_on=date(2026, 8, 11),
        issued_fine_mg=100000,
        loss_bp=250,
        is_closed=True,
    )
    drift_50 = evaluate_karigar_drift(session, k_boundary_50.id)
    assert drift_50.baseline_mean_bp == 200
    assert drift_50.recent_loss_bp == 250
    assert drift_50.is_anomalous is False, "Exact +50 bp must not trigger anomaly (requires > 50 bp)"

    # Now create another karigar where recent loss is +51 bp (251 bp)
    k_boundary_51 = Karigar(code="K-BOUND-51", name="Boundary 51 Karigar", is_active=True)
    session.add(k_boundary_51)
    session.flush()

    for i in range(1, 4):
        _create_job_with_loss(
            session,
            karigar_id=k_boundary_51.id,
            category_id=cat.id,
            user_id=user.id,
            job_no=f"JOB-B51-BASE-{i}",
            opened_on=date(2026, 8, i),
            closed_on=date(2026, 8, i + 1),
            issued_fine_mg=100000,
            loss_bp=200,
            is_closed=True,
        )

    _create_job_with_loss(
        session,
        karigar_id=k_boundary_51.id,
        category_id=cat.id,
        user_id=user.id,
        job_no="JOB-B51-REC",
        opened_on=date(2026, 8, 10),
        closed_on=date(2026, 8, 11),
        issued_fine_mg=100000,
        loss_bp=251,
        is_closed=True,
    )
    drift_51 = evaluate_karigar_drift(session, k_boundary_51.id)
    assert drift_51.baseline_mean_bp == 200
    assert drift_51.recent_loss_bp == 251
    assert drift_51.is_anomalous is True, "+51 bp (> 50 bp and > 2 stddev) must trigger anomaly"
