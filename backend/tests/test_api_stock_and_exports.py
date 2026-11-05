"""Tests for daily stock statement, vault movements, and Tally CSV exports."""

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


def test_stock_and_export_role_restrictions(client: TestClient, auth_tokens):
    """Clerk is forbidden from stock statements and exports; Finance head is permitted."""
    c_head = auth_tokens["clerk_headers"]
    f_head = auth_tokens["finance_headers"]

    # Stock daily endpoint
    assert client.get("/api/stock/daily", headers=c_head).status_code == 403
    assert client.get("/api/stock/daily", headers=f_head).status_code == 200

    # Tally export endpoint
    assert client.get("/api/exports/tally", headers=c_head).status_code == 403
    assert client.get("/api/exports/tally", headers=f_head).status_code == 200


def test_stock_statement_and_tally_csv_flow(client: TestClient, auth_tokens, session: Session):
    """Test bullion intake, despatch to refiner, karigar issue/receipt, and tally export."""
    f_head = auth_tokens["finance_headers"]
    f_id = auth_tokens["finance_user_id"]

    # 1. Bullion intake: 500,000 mg fine gold into vault
    v1 = client.post(
        "/api/stock/vault-movements",
        json={"kind": "bullion_in", "fine_mg": 500000, "entry_date": "2026-11-01", "note": "Bank bullion bar intake"},
        headers=f_head,
    )
    assert v1.status_code == 201

    # 2. Despatch to refiner: 50,000 mg
    v2 = client.post(
        "/api/stock/vault-movements",
        json={"kind": "to_refiner", "fine_mg": 50000, "entry_date": "2026-11-01", "note": "Sent scrap for refining"},
        headers=f_head,
    )
    assert v2.status_code == 201

    # 3. Seed Karigar, Category, Job and issue gold from vault
    category = ItemCategory(name="Bangle")
    karigar = Karigar(code="K-010", name="Murugan", is_active=True)
    session.add_all([category, karigar])
    session.flush()

    job = Job(
        job_no="JOB-STOCK-001",
        karigar_id=karigar.id,
        category_id=category.id,
        description="Bangles",
        wastage_bp=300,
        status="open",
        opened_on=date(2026, 11, 1),
    )
    session.add(job)
    session.flush()

    # Issue 100,000 mg @ 91.60% -> 91,600 mg fine to karigar
    ledger.create_issue(
        session,
        job_id=job.id,
        gross_mg=100000,
        purity_bp=9160,
        entry_date=date(2026, 11, 1),
        user_id=f_id,
    )
    # Receive 80,000 mg @ 91.60% -> 73,280 mg fine back into vault
    ledger.create_receipt(
        session,
        job_id=job.id,
        kind="finished",
        gross_mg=80000,
        purity_bp=9160,
        entry_date=date(2026, 11, 2),
        user_id=f_id,
        huid="HUID77",
    )
    session.flush()

    # 4. Check Daily Stock Statement
    # Net with karigar = 91,600 - 73,280 = 18,320 mg
    # At refiner = 50,000 mg
    # Vault = 500,000 (in) - 50,000 (to refiner) - 91,600 (issue) + 73,280 (receipt) = 431,680 mg
    # Total = 431,680 + 18,320 + 50,000 = 500,000 mg (exact balance!)
    st_resp = client.get("/api/stock/daily?as_of=2026-11-02", headers=f_head)
    assert st_resp.status_code == 200
    st = st_resp.json()
    assert st["vault_fine_mg"] == 431680
    assert st["karigars_fine_mg"] == 18320
    assert st["refiner_fine_mg"] == 50000
    assert st["total_fine_mg"] == 500000

    # 5. Check Tally CSV Export
    tally_resp = client.get("/api/exports/tally?as_of=2026-11-02", headers=f_head)
    assert tally_resp.status_code == 200
    assert "text/csv" in tally_resp.headers["content-type"]
    csv_text = tally_resp.text
    assert "Workshop Vault" in csv_text
    assert "Refinery In-Transit" in csv_text
    assert "CONSOLIDATED TOTAL" in csv_text
    assert "431.680" in csv_text
    assert "500.000" in csv_text


def test_vault_movements_api_and_balance_check(client: TestClient, auth_tokens):
    """Test POST/GET /api/stock/movements, role permissions, and to_refiner balance checks."""
    c_head = auth_tokens["clerk_headers"]
    f_head = auth_tokens["finance_headers"]

    # 1. Clerk gets 403 Forbidden on POST and GET
    clerk_post = client.post(
        "/api/stock/movements",
        json={"kind": "bullion_in", "fine_mg": 100000, "entry_date": "2026-11-01"},
        headers=c_head,
    )
    assert clerk_post.status_code == 403

    clerk_get = client.get("/api/stock/movements", headers=c_head)
    assert clerk_get.status_code == 403

    # 2. Finance head successfully records bullion_in
    f_post = client.post(
        "/api/stock/movements",
        json={"kind": "bullion_in", "fine_mg": 100000, "entry_date": "2026-11-01", "note": "Primary bullion receipt"},
        headers=f_head,
    )
    assert f_post.status_code == 201
    movement_data = f_post.json()
    assert movement_data["kind"] == "bullion_in"
    assert movement_data["fine_mg"] == 100000

    # 3. GET /api/stock/movements returns the list
    f_get = client.get("/api/stock/movements", headers=f_head)
    assert f_get.status_code == 200
    movements_list = f_get.json()
    assert len(movements_list) >= 1
    assert any(m["id"] == movement_data["id"] for m in movements_list)

    # 4. to_refiner exceeding vault fine gold balance returns 400 Bad Request
    # Current vault balance is at most 100,000 mg; trying to transfer 200,000 mg
    over_transfer = client.post(
        "/api/stock/movements",
        json={"kind": "to_refiner", "fine_mg": 200000, "entry_date": "2026-11-01", "note": "Excess refiner dispatch"},
        headers=f_head,
    )
    assert over_transfer.status_code == 400
    assert "exceeds available vault fine gold balance" in over_transfer.json()["detail"]


