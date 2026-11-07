"""Tests for Groq AI vision reader, reading audit records, upload limits, rate limits, and mismatch block."""

from datetime import date
import io
import json
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.limiter import limiter
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.ai_reading import AiReading
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.user import User

TEST_DB_URL = os.environ.get("DATABASE_URL_TEST") or settings.DATABASE_URL_TEST
pytestmark = pytest.mark.skipif(
    not TEST_DB_URL,
    reason="DATABASE_URL_TEST is not set in environment or settings",
)


class FakeChoice:
    def __init__(self, content: str):
        self.message = type("Msg", (), {"content": content})()


class FakeCompletion:
    def __init__(self, content: str):
        self.choices = [FakeChoice(content)]


class FakeCompletions:
    def __init__(self, response_dict: dict | None = None, content_str: str | None = None, should_fail: bool = False):
        self.response_dict = response_dict
        self.content_str = content_str
        self.should_fail = should_fail
        self.last_kwargs = None

    def create(self, *args, **kwargs):
        self.last_kwargs = kwargs
        if self.should_fail:
            raise RuntimeError("Simulated Groq API connection failure or timeout")
        if self.content_str is not None:
            return FakeCompletion(self.content_str)
        content = json.dumps(self.response_dict) if self.response_dict is not None else ""
        return FakeCompletion(content)


class FakeChat:
    def __init__(self, response_dict: dict | None = None, content_str: str | None = None, should_fail: bool = False):
        self.completions = FakeCompletions(response_dict=response_dict, content_str=content_str, should_fail=should_fail)


class FakeProvider:
    """Mock Groq client provider for testing AI vision and completion endpoints."""

    def __init__(self, response_dict: dict | None = None, content_str: str | None = None, should_fail: bool = False):
        self.chat = FakeChat(response_dict=response_dict, content_str=content_str, should_fail=should_fail)


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


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset rate limiter state between tests."""
    yield
    try:
        limiter.reset()
    except Exception:
        pass


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
        "clerk_id": clerk.id,
        "finance_id": finance.id,
        "clerk_headers": {"Authorization": f"Bearer {c_resp.json()['access_token']}"},
        "finance_headers": {"Authorization": f"Bearer {f_resp.json()['access_token']}"},
    }


def _valid_jpeg() -> bytes:
    return b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 50


def test_ai_scale_reader_with_fake_provider(client: TestClient, auth_tokens, monkeypatch):
    """Upload scale photo with FakeProvider, verify extraction, and confirm reading."""
    headers = auth_tokens["clerk_headers"]
    fake_client = FakeProvider(response_dict={"value": "112.450", "unit": "g", "confidence": 95, "readable": True})

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: fake_client)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: True)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_vision_model", lambda: True)
    monkeypatch.setattr(settings, "GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["value_text"] == "112.450"
    assert data["unit"] == "g"
    assert data["confidence"] == 95
    assert data["readable"] is True
    assert data["fallback"] is None
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


def test_ai_karat_reader_with_fake_provider(client: TestClient, auth_tokens, monkeypatch):
    """Upload karatmeter photo with FakeProvider and extract purity percentage."""
    headers = auth_tokens["clerk_headers"]
    fake_client = FakeProvider(response_dict={"purity": "91.60", "unit": "%", "confidence": 98, "readable": True})

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: fake_client)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: True)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_vision_model", lambda: True)
    monkeypatch.setattr(settings, "GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

    files = {"file": ("karat.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-karat", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["purity_text"] == "91.60"
    assert data["unit"] == "%"
    assert data["readable"] is True
    assert data["fallback"] is None


def test_ai_fallback_on_provider_error(client: TestClient, auth_tokens, monkeypatch):
    """When Groq fails or times out, return fallback: manual and store outcome fallback_manual."""
    headers = auth_tokens["clerk_headers"]
    fake_client = FakeProvider(should_fail=True)

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: fake_client)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: True)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_vision_model", lambda: True)
    monkeypatch.setattr(settings, "GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["readable"] is False
    assert data["fallback"] == "manual"
    assert data["value_text"] is None


def test_ai_fallback_on_missing_key(client: TestClient, auth_tokens, monkeypatch):
    """When Groq key or model is missing, return fallback: manual."""
    headers = auth_tokens["clerk_headers"]

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: None)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: False)

    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["readable"] is False
    assert data["fallback"] == "manual"


def test_ai_rejection_of_ct_unit_triggers_fallback(client: TestClient, auth_tokens, monkeypatch):
    """When model returns unit 'ct' instead of 'g', validator rejects and triggers manual fallback."""
    headers = auth_tokens["clerk_headers"]
    fake_client = FakeProvider(response_dict={"value": "112.450", "unit": "ct", "confidence": 90, "readable": True})

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: fake_client)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: True)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_vision_model", lambda: True)
    monkeypatch.setattr(settings, "GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["readable"] is False
    assert data["fallback"] == "manual"


def test_ai_rejection_of_four_decimals_triggers_fallback(client: TestClient, auth_tokens, monkeypatch):
    """When model returns 4 decimals instead of 3, validator rejects and triggers manual fallback."""
    headers = auth_tokens["clerk_headers"]
    fake_client = FakeProvider(response_dict={"value": "112.4500", "unit": "g", "confidence": 90, "readable": True})

    monkeypatch.setattr("app.ai.vision_reader.get_groq_client", lambda: fake_client)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_key", lambda: True)
    monkeypatch.setattr("app.ai.vision_reader.has_groq_vision_model", lambda: True)
    monkeypatch.setattr(settings, "GROQ_VISION_MODEL", "llama-3.2-11b-vision-preview")

    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["readable"] is False
    assert data["fallback"] == "manual"


def test_ai_upload_file_rejections(client: TestClient, auth_tokens):
    """Verify upload limits: invalid magic bytes, unsupported content-type, >5MB."""
    headers = auth_tokens["clerk_headers"]

    # 1. Invalid magic bytes (plain text file pretending to be image/jpeg)
    files = {"file": ("test.jpg", io.BytesIO(b"Not an actual image binary"), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Invalid file signature" in resp.json()["detail"]

    # 2. Unsupported content-type (e.g. application/pdf)
    files = {"file": ("test.pdf", io.BytesIO(b"%PDF-1.4"), "application/pdf")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 400
    assert "Unsupported content type" in resp.json()["detail"]

    # 3. Exceeds 5MB
    large_payload = _valid_jpeg() + b"\x00" * (5 * 1024 * 1024 + 10)
    files = {"file": ("large.jpg", io.BytesIO(large_payload), "image/jpeg")}
    resp = client.post("/api/ai/read-scale", files=files, headers=headers)
    assert resp.status_code == 400
    assert "exceeds 5 MB limit" in resp.json()["detail"]


def test_ai_rate_limiting(client: TestClient, auth_tokens):
    """Verify rate limiter blocks requests exceeding 20/minute on /api/ai endpoints."""
    headers = auth_tokens["clerk_headers"]
    files = {"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}

    limiter.reset()

    # Issue 20 requests within rate limit
    for _ in range(20):
        resp = client.post("/api/ai/read-scale", files={"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}, headers=headers)
        assert resp.status_code == 200

    # 21st request should trigger 429
    resp_limit = client.post("/api/ai/read-scale", files={"file": ("scale.jpg", io.BytesIO(_valid_jpeg()), "image/jpeg")}, headers=headers)
    assert resp_limit.status_code == 429


def test_issue_creation_server_side_mismatch_block(client: TestClient, auth_tokens, session: Session):
    """Issue creation rejects with 422 if typed gross weight != confirmed AI scale reading."""
    headers = auth_tokens["clerk_headers"]

    # Seed Category, Karigar, Job
    cat = ItemCategory(name="Bangle")
    session.add(cat)
    session.flush()

    karigar = Karigar(code="K-MISMATCH-1", name="Testing Karigar", is_active=True)
    session.add(karigar)
    session.flush()

    job = Job(
        job_no="JOB-MISMATCH-1",
        karigar_id=karigar.id,
        category_id=cat.id,
        description="Plain gold bangle order",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    session.add(job)
    session.flush()

    # Create confirmed AI reading for 112.450 g
    reading = AiReading(
        kind="scale",
        image_path="scale.jpg",
        model_name="llama-3.2-11b-vision-preview",
        ai_value_text="112.450",
        ai_unit="g",
        ai_confidence=95,
        ai_readable=True,
        confirmed_value_text="112.450",
        outcome="confirmed",
        created_by=auth_tokens["clerk_id"],
    )
    session.add(reading)
    session.flush()

    # Case 1: Non-existent reading ID returns 422
    resp_missing = client.post(
        "/api/issues",
        json={
            "job_id": job.id,
            "gross_mg": 112450,
            "purity_bp": 9160,
            "entry_date": "2026-11-01",
            "ai_reading_id": 999999,
        },
        headers=headers,
    )
    assert resp_missing.status_code == 422
    assert "not found" in resp_missing.json()["detail"]

    # Case 2: Mismatched gross weight (110.000 g != 112.450 g) returns 422
    resp_mismatch = client.post(
        "/api/issues",
        json={
            "job_id": job.id,
            "gross_mg": 110000,
            "purity_bp": 9160,
            "entry_date": "2026-11-01",
            "ai_reading_id": reading.id,
        },
        headers=headers,
    )
    assert resp_mismatch.status_code == 422
    assert "does not match confirmed AI scale reading" in resp_mismatch.json()["detail"]

    session.refresh(reading)
    assert reading.outcome == "mismatch_blocked"

    # Reset reading outcome
    reading.outcome = "confirmed"
    session.flush()

    # Case 3: Matching gross weight (112.450 g == 112.450 g) succeeds
    resp_match = client.post(
        "/api/issues",
        json={
            "job_id": job.id,
            "gross_mg": 112450,
            "purity_bp": 9160,
            "entry_date": "2026-11-01",
            "ai_reading_id": reading.id,
        },
        headers=headers,
    )
    assert resp_match.status_code == 201


def test_old_gold_creation_server_side_mismatch_block(client: TestClient, auth_tokens, session: Session):
    """Old-gold creation rejects with 422 if typed value != confirmed AI reading."""
    headers = auth_tokens["clerk_headers"]

    # Create confirmed AI scale reading for 10.000 g
    scale_reading = AiReading(
        kind="scale",
        image_path="scale.jpg",
        model_name="llama-3.2-11b-vision-preview",
        ai_value_text="10.000",
        ai_unit="g",
        ai_confidence=95,
        ai_readable=True,
        confirmed_value_text="10.000",
        outcome="confirmed",
        created_by=auth_tokens["clerk_id"],
    )
    session.add(scale_reading)
    session.flush()

    # Case 1: Mismatched gross weight (15.000 g != 10.000 g) returns 422
    resp_mismatch = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-MISMATCH-1",
            "gross_mg": 15000,
            "tested_purity_bp": 9160,
            "deduction_mg": 0,
            "rate_paise_per_g": 1000000,
            "payment_mode": "upi",
            "entry_date": "2026-11-01",
            "ai_reading_id": scale_reading.id,
        },
        headers=headers,
    )
    assert resp_mismatch.status_code == 422
    assert "does not match confirmed AI scale reading" in resp_mismatch.json()["detail"]

    session.refresh(scale_reading)
    assert scale_reading.outcome == "mismatch_blocked"

    # Reset reading outcome
    scale_reading.outcome = "confirmed"
    session.flush()

    # Case 2: Matching gross weight succeeds
    resp_match = client.post(
        "/api/old-gold",
        json={
            "bill_no": "OG-MISMATCH-2",
            "gross_mg": 10000,
            "tested_purity_bp": 9160,
            "deduction_mg": 0,
            "rate_paise_per_g": 1000000,
            "payment_mode": "upi",
            "entry_date": "2026-11-01",
            "ai_reading_id": scale_reading.id,
        },
        headers=headers,
    )
    assert resp_match.status_code == 201


def test_ai_loss_explanation_finance_head(client: TestClient, auth_tokens, session: Session):
    """Finance head requests AI loss explanation draft for a karigar."""
    f_headers = auth_tokens["finance_headers"]
    c_headers = auth_tokens["clerk_headers"]

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
    assert data["source"] == "template"


def test_ai_loss_explanation_with_groq_clean_output(client: TestClient, auth_tokens, session: Session, monkeypatch):
    """When Groq returns clean computed figures without cause words, it is accepted with source 'llm'."""
    clean_llm_text = "Artisan Selvam (K-099) recorded 3.50% loss versus 1.20% historical baseline across 10 jobs."
    fake_provider = FakeProvider(content_str=clean_llm_text)
    monkeypatch.setattr("app.ai.explain.get_groq_client", lambda: fake_provider)
    monkeypatch.setattr("app.ai.explain.has_groq_key", lambda: True)
    monkeypatch.setattr(settings, "GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

    karigar = Karigar(code="K-099", name="Selvam", is_active=True)
    session.add(karigar)
    session.flush()

    resp = client.post(
        "/api/ai/explain-loss",
        json={"karigar_id": karigar.id},
        headers=auth_tokens["finance_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "llm"
    assert data["explanation"] == clean_llm_text

    # Verify the prompt sent to Groq contains only computed figures and does NOT suggest causes
    prompt_sent = fake_provider.chat.completions.last_kwargs["messages"][1]["content"]
    assert "Selvam" in prompt_sent
    assert "Do not suggest or speculate on any causes" in prompt_sent
    assert "crucible wear" not in prompt_sent


def test_ai_loss_explanation_rejects_cause_words(client: TestClient, auth_tokens, session: Session, monkeypatch):
    """When Groq returns cause words (crucible, porosity, setting), it falls back to template."""
    bad_llm_text = "Excess loss occurred due to crucible wear and porosity during melting."
    fake_provider = FakeProvider(content_str=bad_llm_text)
    monkeypatch.setattr("app.ai.explain.get_groq_client", lambda: fake_provider)
    monkeypatch.setattr("app.ai.explain.has_groq_key", lambda: True)
    monkeypatch.setattr(settings, "GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

    karigar = Karigar(code="K-099", name="Selvam", is_active=True)
    session.add(karigar)
    session.flush()

    resp = client.post(
        "/api/ai/explain-loss",
        json={"karigar_id": karigar.id},
        headers=auth_tokens["finance_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "template"
    assert "crucible" not in data["explanation"]
    assert "porosity" not in data["explanation"]
    assert "Selvam" in data["explanation"]


def test_ai_loss_explanation_rejects_banned_words(client: TestClient, auth_tokens, session: Session, monkeypatch):
    """When Groq returns banned words (theft, stole, suspicious, fraud, blame), it falls back to template."""
    bad_llm_text = "High variance indicates suspicious activity and possible fraud or theft."
    fake_provider = FakeProvider(content_str=bad_llm_text)
    monkeypatch.setattr("app.ai.explain.get_groq_client", lambda: fake_provider)
    monkeypatch.setattr("app.ai.explain.has_groq_key", lambda: True)
    monkeypatch.setattr(settings, "GROQ_TEXT_MODEL", "llama-3.3-70b-versatile")

    karigar = Karigar(code="K-099", name="Selvam", is_active=True)
    session.add(karigar)
    session.flush()

    resp = client.post(
        "/api/ai/explain-loss",
        json={"karigar_id": karigar.id},
        headers=auth_tokens["finance_headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["source"] == "template"
    assert "suspicious" not in data["explanation"]
    assert "fraud" not in data["explanation"]
    assert "theft" not in data["explanation"]
    assert "Selvam" in data["explanation"]

