"""Tests for customer old-gold purchase desk and statutory compliance."""

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
from app.models.user import User

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
def auth_headers(client: TestClient, session: Session):
    """Create test clerk user and retrieve auth headers."""
    clerk = User(
        email="clerk@coimbatore-gold.com",
        full_name="Clerk",
        password_hash=hash_password("Clerk123"),
        role="issue_clerk",
        is_active=True,
    )
    session.add(clerk)
    session.flush()

    resp = client.post("/api/auth/login", json={"email": "clerk@coimbatore-gold.com", "password": "Clerk123"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_old_gold_standard_purchase(client: TestClient, auth_headers):
    """Record standard old-gold intake under Rs 2,00,000."""
    # 10.000 g gross (10000 mg), 500 mg deduction -> 9500 mg net @ 75.00% (7500 bp) -> 7125 mg fine
    # Rate: Rs 10,000 / g = 1,000,000 paise/g
    # Value: (7125 * 1000000 + 500) // 1000 = 7,125,000 paise = Rs 71,250
    resp = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-2026-001",
            "gross_mg": 10000,
            "tested_purity_bp": 7500,
            "deduction_mg": 500,
            "rate_paise_per_g": 1000000,
            "payment_mode": "upi",
            "entry_date": "2026-11-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["bill_no"] == "OG-2026-001"
    assert data["fine_mg"] == 7125
    assert data["value_paise"] == 7125000


def test_old_gold_high_value_mandates_pan(client: TestClient, auth_headers):
    """Purchases >= Rs 2 Lakh reject if PAN is missing."""
    # 30.000 g gross @ 91.60% (9160 bp) -> 27480 mg fine
    # Rate: Rs 10,000 / g = 1,000,000 paise/g
    # Value: 27,480,000 paise = Rs 2,74,800 (>= Rs 2 Lakh)
    resp = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-HIGH-001",
            "gross_mg": 30000,
            "tested_purity_bp": 9160,
            "deduction_mg": 0,
            "rate_paise_per_g": 1000000,
            "payment_mode": "bank_transfer",
            "entry_date": "2026-11-01",
        },
        headers=auth_headers,
    )
    # Must reject with 422 because PAN is missing
    assert resp.status_code == 422
    assert "pan" in resp.json()["detail"].lower()


def test_old_gold_high_value_prohibits_cash(client: TestClient, auth_headers):
    """Purchases >= Rs 2 Lakh reject cash payment under Section 269ST."""
    resp = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-HIGH-002",
            "gross_mg": 30000,
            "tested_purity_bp": 9160,
            "deduction_mg": 0,
            "rate_paise_per_g": 1000000,
            "payment_mode": "cash",
            "pan": "ABCDE1234F",
            "entry_date": "2026-11-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "cash" in resp.json()["detail"].lower()


def test_old_gold_high_value_valid_with_pan_and_bank(client: TestClient, auth_headers):
    """High value purchase succeeds when PAN and digital payment mode are supplied."""
    resp = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-HIGH-003",
            "gross_mg": 30000,
            "tested_purity_bp": 9160,
            "deduction_mg": 0,
            "rate_paise_per_g": 1000000,
            "payment_mode": "bank_transfer",
            "pan": "ABCDE1234F",
            "entry_date": "2026-11-01",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["pan"] == "ABCDE1234F"
    assert resp.json()["value_paise"] == 27480000
