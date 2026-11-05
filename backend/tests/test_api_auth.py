"""Tests for API authentication and profile endpoints."""

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
def seeded_users(session: Session):
    """Create test clerk and finance users with known passwords."""
    clerk = User(
        email="clerk@coimbatore-gold.com",
        full_name="Issue Clerk",
        password_hash=hash_password("ClerkSecret123"),
        role="issue_clerk",
        is_active=True,
    )
    finance = User(
        email="finance@coimbatore-gold.com",
        full_name="Finance Head",
        password_hash=hash_password("FinanceSecret123"),
        role="finance_head",
        is_active=True,
    )
    inactive = User(
        email="inactive@coimbatore-gold.com",
        full_name="Inactive User",
        password_hash=hash_password("InactiveSecret123"),
        role="issue_clerk",
        is_active=False,
    )
    session.add_all([clerk, finance, inactive])
    session.flush()
    return {"clerk": clerk, "finance": finance, "inactive": inactive}


def test_login_success_clerk(client: TestClient, seeded_users):
    """Clerk logs in with valid credentials and receives JWT token."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "clerk@coimbatore-gold.com", "password": "ClerkSecret123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "clerk@coimbatore-gold.com"
    assert data["user"]["role"] == "issue_clerk"


def test_login_success_finance_head(client: TestClient, seeded_users):
    """Finance head logs in and receives token with finance_head role."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "finance@coimbatore-gold.com", "password": "FinanceSecret123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role"] == "finance_head"


def test_login_invalid_password(client: TestClient, seeded_users):
    """Login with wrong password returns 401."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "clerk@coimbatore-gold.com", "password": "WrongPassword"},
    )
    assert resp.status_code == 401
    assert "Invalid email or password" in resp.json()["detail"]


def test_login_nonexistent_email(client: TestClient, seeded_users):
    """Login with unseeded email returns 401."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "nonexistent@coimbatore-gold.com", "password": "AnyPassword"},
    )
    assert resp.status_code == 401


def test_login_deactivated_account(client: TestClient, seeded_users):
    """Deactivated account cannot log in and returns 403."""
    resp = client.post(
        "/api/auth/login",
        json={"email": "inactive@coimbatore-gold.com", "password": "InactiveSecret123"},
    )
    assert resp.status_code == 403
    assert "deactivated" in resp.json()["detail"].lower()


def test_get_current_user_me(client: TestClient, seeded_users):
    """Authenticated user accesses /auth/me with Bearer token."""
    login_resp = client.post(
        "/api/auth/login",
        json={"email": "clerk@coimbatore-gold.com", "password": "ClerkSecret123"},
    )
    token = login_resp.json()["access_token"]

    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "clerk@coimbatore-gold.com"


def test_get_current_user_unauthorized(client: TestClient):
    """Requesting /auth/me without token returns 401."""
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_get_current_user_malformed_token(client: TestClient):
    """Requesting with invalid token returns 401."""
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-valid-jwt-token"},
    )
    assert resp.status_code == 401
