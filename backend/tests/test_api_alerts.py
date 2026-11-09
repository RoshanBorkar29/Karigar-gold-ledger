"""Tests for loss alert and statistical drift endpoints."""

from datetime import date
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.user import User
from app.services import ledger

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


@pytest.fixture
def client(session: Session):
    """Provide TestClient wired to the transactional session."""
    def _override_get_db():
        yield session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_tokens(client: TestClient, session: Session):
    """Create clerk and finance users and retrieve their auth tokens."""
    clerk = User(
        email="clerk@coimbatore-gold.com",
        full_name="Clerk",
        password_hash=hash_password("Clerk123"),
        role="issue_clerk",
        is_active=True,
    )
    finance = User(
        email="finance@coimbatore-gold.com",
        full_name="Finance",
        password_hash=hash_password("Finance123"),
        role="finance_head",
        is_active=True,
    )
    session.add_all([clerk, finance])
    session.flush()

    c_resp = client.post("/api/auth/login", json={"email": "clerk@coimbatore-gold.com", "password": "Clerk123"})
    f_resp = client.post("/api/auth/login", json={"email": "finance@coimbatore-gold.com", "password": "Finance123"})

    return {
        "clerk_headers": {"Authorization": f"Bearer {c_resp.json()['access_token']}"},
        "finance_headers": {"Authorization": f"Bearer {f_resp.json()['access_token']}"},
        "finance_user_id": finance.id,
    }


def test_loss_alerts_role_authorization(client: TestClient, auth_tokens):
    """Issue clerk is forbidden (403) from alerts endpoint; Finance head is permitted."""
    # Clerk gets 403
    clerk_resp = client.get("/api/alerts", headers=auth_tokens["clerk_headers"])
    assert clerk_resp.status_code == 403

    # Finance head gets 200
    finance_resp = client.get("/api/alerts", headers=auth_tokens["finance_headers"])
    assert finance_resp.status_code == 200
    assert isinstance(finance_resp.json(), list)


def test_loss_alert_scan_and_review_workflow(client: TestClient, auth_tokens, session: Session):
    """Test drift minimum history requirement, 2 stddev + 50 bp threshold, scan and review workflow."""
    f_headers = auth_tokens["finance_headers"]
    f_id = auth_tokens["finance_user_id"]

    # Seed karigar and category
    category = ItemCategory(name="Necklace")
    karigar = Karigar(code="K-003", name="Kumar", is_active=True)
    session.add_all([category, karigar])
    session.flush()

    # Step A: Karigar has 0 closed jobs -> insufficient history (< 3 closed jobs)
    init_drift = client.get(f"/api/alerts/karigars/{karigar.id}/drift", headers=f_headers)
    assert init_drift.status_code == 200
    init_data = init_drift.json()
    assert init_data["is_anomalous"] is False
    assert init_data["sample_size"] == 0
    assert "insufficient history (minimum 3 completed jobs required)" in init_data["explanation"]

    # Step B: Seed 3 baseline closed jobs with normal agreed wastage (0 excess loss)
    for i in range(1, 4):
        c_job = Job(
            job_no=f"JOB-BASELINE-{i}",
            karigar_id=karigar.id,
            category_id=category.id,
            description=f"Baseline order {i}",
            wastage_bp=300,
            status="open",
            opened_on=date(2026, 10, i * 5),
            closed_on=None,
        )
        session.add(c_job)
        session.flush()

        # Issue 50,000 mg @ 91.60% -> 45,800 mg fine
        ledger.create_issue(
            session,
            job_id=c_job.id,
            gross_mg=50000,
            purity_bp=9160,
            entry_date=date(2026, 10, i * 5),
            user_id=f_id,
        )
        # Return finished piece (48,500 mg @ 91.60% -> 44,426 mg fine; allowed wastage is 1,374 mg -> 0 excess loss)
        ledger.create_receipt(
            session,
            job_id=c_job.id,
            kind="finished",
            gross_mg=48500,
            purity_bp=9160,
            entry_date=date(2026, 10, i * 5 + 3),
            user_id=f_id,
            huid=f"ABC10{i}",
        )
        ledger.close_job(
            session,
            job_id=c_job.id,
            closed_on=date(2026, 10, i * 5 + 3),
            user_id=f_id,
        )
        session.flush()

    # Step C: Create active open job with excess loss
    job = Job(
        job_no="JOB-ALERT-001",
        karigar_id=karigar.id,
        category_id=category.id,
        description="Heavy Necklace",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    session.add(job)
    session.flush()

    # Issue 100,000 mg @ 91.60% -> 91,600 mg fine
    ledger.create_issue(
        session,
        job_id=job.id,
        gross_mg=100000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=f_id,
    )
    # Return finished piece with huge shortage (only 87,336 mg returned -> fine 80,000 mg -> 8,852 mg excess loss)
    ledger.create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=87336,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=f_id,
        huid="HUID99",
    )
    ledger.close_job(
        session,
        job_id=job.id,
        closed_on=date(2026, 11, 2),
        user_id=f_id,
    )
    session.flush()

    # 1. Inspect drift endpoint: now has sample_size=3 and triggers anomaly (> 2 stddev AND > 50 bp)
    drift_resp = client.get(f"/api/alerts/karigars/{karigar.id}/drift", headers=f_headers)
    assert drift_resp.status_code == 200
    drift_data = drift_resp.json()
    assert drift_data["sample_size"] == 3
    assert drift_data["is_anomalous"] is True
    assert drift_data["recent_loss_bp"] > 50

    # 2. Trigger scan
    scan_resp = client.post("/api/alerts/scan", headers=f_headers)
    assert scan_resp.status_code == 200
    alerts = scan_resp.json()
    assert len(alerts) >= 1
    alert_id = alerts[0]["id"]
    assert alerts[0]["status"] == "new"

    # 3. Review alert
    review_resp = client.patch(
        f"/api/alerts/{alert_id}",
        json={"status": "reviewed", "explanation": "Investigated with workshop foreman; crucible crack noted."},
        headers=f_headers,
    )
    assert review_resp.status_code == 200
    reviewed_alert = review_resp.json()
    assert reviewed_alert["status"] == "reviewed"
    assert "crucible crack" in reviewed_alert["explanation"]

