"""Tests for Groq AI vision reader, reading audit records, and explanation drafts."""

import io
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
    """Create test clerk and finance users and retrieve their auth tokens."""
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
    }


def test_ai_scale_reader_and_clerk_confirmation(client: TestClient, auth_tokens):
    """Upload scale photo, extract reading, and confirm."""
    headers = auth_tokens["clerk_headers"]

    # Fake JPEG bytes
    fake_img = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
    files = {"file": ("scale_112_450.jpg", io.BytesIO(fake_img), "image/jpeg")}

    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "reading_id" in data
    assert data["value_text"] == "112.450"
    assert data["unit"] == "g"
    reading_id = data["reading_id"]

    # Clerk confirms the reading
    confirm_resp = client.post(
        f"/api/ai/readings/{reading_id}/confirm",
        json={"confirmed_value": "112.450", "override": False},
        headers=headers,
    )
    assert confirm_resp.status_code == 200
    assert confirm_resp.json()["outcome"] == "confirmed"
    assert confirm_resp.json()["confirmed_value_text"] == "112.450"


def test_ai_karat_reader(client: TestClient, auth_tokens):
    """Upload karat meter photo and extract purity reading."""
    headers = auth_tokens["clerk_headers"]

    fake_img = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50
    files = {"file": ("karat_91_60.jpg", io.BytesIO(fake_img), "image/jpeg")}

    resp = client.post("/api/ai/read-karat", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["purity_text"] == "91.60"
    assert data["unit"] == "%"


def test_ai_loss_explanation_finance_head(client: TestClient, auth_tokens, session: Session):
    """Finance head requests AI loss explanation draft for a karigar."""
    f_headers = auth_tokens["finance_headers"]
    c_headers = auth_tokens["clerk_headers"]

    # Seed karigar
    karigar = Karigar(code="K-099", name="Selvam", is_active=True)
    session.add(karigar)
    session.flush()

    # Clerk cannot request explanation (finance_head only)
    assert client.post("/api/ai/explain-loss", json={"karigar_id": karigar.id}, headers=c_headers).status_code == 403

    # Finance head can request
    resp = client.post(
        "/api/ai/explain-loss",
        json={"karigar_id": karigar.id, "additional_context": "Crucible cracked mid-melt."},
        headers=f_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["karigar_id"] == karigar.id
    assert "Selvam" in data["explanation"]
    assert "source" in data
