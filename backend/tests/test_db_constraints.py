"""Database constraint and ledger balance integration tests.

Requires DATABASE_URL_TEST pointing to an active PostgreSQL test instance.
Skips entirely if DATABASE_URL_TEST is not set.
"""

from datetime import date
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.base import Base
from app.models.issue import Issue
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.karigar_category_wastage import KarigarCategoryWastage
from app.models.receipt import Receipt
from app.models.user import User

DATABASE_URL_TEST = os.getenv("DATABASE_URL_TEST")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL_TEST,
    reason="DATABASE_URL_TEST not set. Provide a PostgreSQL connection string to run constraint tests.",
)


@pytest.fixture(scope="module")
def db_engine():
    """Create test engine and initialize database schema."""
    engine = create_engine(DATABASE_URL_TEST, pool_pre_ping=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def db_session(db_engine):
    """Provide a scoped session per test, rolling back upon completion."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, expire_on_commit=False, class_=Session)()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def base_fixtures(db_session):
    """Create baseline user, karigar, category, and job for constraint tests."""
    user = User(
        email="test_clerk@karigar.local",
        full_name="Test Clerk",
        password_hash="fakehash",
        role="issue_clerk",
    )
    karigar = Karigar(code="K-TEST", name="Test Karigar")
    category = ItemCategory(name="Test Category")
    db_session.add_all([user, karigar, category])
    db_session.flush()

    job = Job(
        job_no="JOB-TEST-001",
        karigar_id=karigar.id,
        category_id=category.id,
        description="Test Job",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    db_session.add(job)
    db_session.flush()

    return {"user": user, "karigar": karigar, "category": category, "job": job}


def test_reject_fine_mg_greater_than_gross_mg(db_session, base_fixtures):
    """Verify database check constraint rejects fine_mg > gross_mg."""
    invalid_issue = Issue(
        txn_id="TX-INVALID-1",
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        gross_mg=10000,
        purity_bp=9160,
        fine_mg=10001,  # Exceeds gross_mg
        entry_date=date(2026, 11, 1),
        created_by=base_fixtures["user"].id,
    )
    db_session.add(invalid_issue)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_purity_zero(db_session, base_fixtures):
    """Verify database check constraint rejects purity_bp <= 0."""
    invalid_issue = Issue(
        txn_id="TX-INVALID-2",
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        gross_mg=10000,
        purity_bp=0,  # Invalid zero purity
        fine_mg=0,
        entry_date=date(2026, 11, 1),
        created_by=base_fixtures["user"].id,
    )
    db_session.add(invalid_issue)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_purity_10001(db_session, base_fixtures):
    """Verify database check constraint rejects purity_bp > 10000 (100.00%)."""
    invalid_issue = Issue(
        txn_id="TX-INVALID-3",
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        gross_mg=10000,
        purity_bp=10001,  # Exceeds 100.00%
        fine_mg=10000,
        entry_date=date(2026, 11, 1),
        created_by=base_fixtures["user"].id,
    )
    db_session.add(invalid_issue)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_negative_wastage(db_session, base_fixtures):
    """Verify database check constraint rejects negative wastage_bp."""
    invalid_wastage = KarigarCategoryWastage(
        karigar_id=base_fixtures["karigar"].id,
        category_id=base_fixtures["category"].id,
        wastage_bp=-1,  # Negative wastage
    )
    db_session.add(invalid_wastage)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_huid_on_scrap_receipt(db_session, base_fixtures):
    """Verify database check constraint rejects non-null HUID on scrap receipts."""
    invalid_receipt = Receipt(
        txn_id="TX-INVALID-4",
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        kind="scrap",
        gross_mg=3000,
        purity_bp=9160,
        fine_mg=2748,
        huid="HUID-ILLEGAL",  # HUID only allowed on finished pieces
        entry_date=date(2026, 11, 2),
        created_by=base_fixtures["user"].id,
    )
    db_session.add(invalid_receipt)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_duplicate_txn_id(db_session, base_fixtures):
    """Verify unique constraint on txn_id."""
    issue1 = Issue(
        txn_id="TX-DUP-1",
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        gross_mg=10000,
        purity_bp=9160,
        fine_mg=9160,
        entry_date=date(2026, 11, 1),
        created_by=base_fixtures["user"].id,
    )
    issue2 = Issue(
        txn_id="TX-DUP-1",  # Duplicate txn_id
        job_id=base_fixtures["job"].id,
        karigar_id=base_fixtures["karigar"].id,
        gross_mg=20000,
        purity_bp=9160,
        fine_mg=18320,
        entry_date=date(2026, 11, 1),
        created_by=base_fixtures["user"].id,
    )
    db_session.add(issue1)
    db_session.flush()

    db_session.add(issue2)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_duplicate_karigar_category_wastage(db_session, base_fixtures):
    """Verify unique constraint on (karigar_id, category_id)."""
    w1 = KarigarCategoryWastage(
        karigar_id=base_fixtures["karigar"].id,
        category_id=base_fixtures["category"].id,
        wastage_bp=300,
    )
    w2 = KarigarCategoryWastage(
        karigar_id=base_fixtures["karigar"].id,
        category_id=base_fixtures["category"].id,  # Duplicate pair
        wastage_bp=350,
    )
    db_session.add(w1)
    db_session.flush()

    db_session.add(w2)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_reject_closed_job_with_no_closed_on(db_session, base_fixtures):
    """Verify check constraint requires closed_on date when status is closed."""
    invalid_job = Job(
        job_no="JOB-CLOSED-INVALID",
        karigar_id=base_fixtures["karigar"].id,
        category_id=base_fixtures["category"].id,
        description="Closed without closed_on date",
        wastage_bp=300,
        status="closed",
        opened_on=date(2026, 11, 1),
        closed_on=None,  # Forbidden when status is closed
    )
    db_session.add(invalid_job)
    with pytest.raises(IntegrityError):
        db_session.flush()


def test_seed_computed_balance_for_murugesan(db_engine):
    """Verify that seed data calculates Murugesan's fine gold balance to 3893 mg using plain SQL."""
    # Ensure fresh schema
    Base.metadata.drop_all(bind=db_engine)
    Base.metadata.create_all(bind=db_engine)

    # Run seed script on the test database engine
    from seed import seed_data
    from app.db.session import SessionLocal

    # Temporarily bind SessionLocal to test engine for seed execution
    old_bind = SessionLocal.kw.get("bind")
    SessionLocal.configure(bind=db_engine)
    try:
        seed_data()
    finally:
        SessionLocal.configure(bind=old_bind)

    with Session(db_engine) as session:
        # Fetch Murugesan S
        murugesan = session.query(Karigar).filter(Karigar.code == "K-001").one()

        # Plain SQL balance calculation: (SUM issues.fine_mg) - (SUM receipts.fine_mg)
        balance_sql = text("""
            SELECT
                (SELECT COALESCE(SUM(fine_mg), 0) FROM issues WHERE karigar_id = :k_id) -
                (SELECT COALESCE(SUM(fine_mg), 0) FROM receipts WHERE karigar_id = :k_id)
            AS balance
        """)
        balance = session.execute(balance_sql, {"k_id": murugesan.id}).scalar()

        # Exact fine gold assertion from sample calculations
        assert balance == 3893, f"Expected 3893 mg running balance, got {balance}"
