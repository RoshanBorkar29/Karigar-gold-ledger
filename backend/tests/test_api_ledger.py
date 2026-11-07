"""Tests for complete ledger API flows: categories, karigars, jobs, issues, receipts, voids, and balances."""

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
    """Create test clerk and finance users and generate auth headers."""
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

    clerk_login = client.post(
        "/api/auth/login",
        json={"email": "clerk@coimbatore-gold.com", "password": "Clerk123"},
    )
    clerk_token = clerk_login.json()["access_token"]

    finance_login = client.post(
        "/api/auth/login",
        json={"email": "finance@coimbatore-gold.com", "password": "Finance123"},
    )
    finance_token = finance_login.json()["access_token"]

    return {
        "clerk": {"Authorization": f"Bearer {clerk_token}"},
        "finance": {"Authorization": f"Bearer {finance_token}"},
    }


def test_full_ledger_workflow_via_api(client: TestClient, auth_headers):
    """Execute end-to-end flow: category -> karigar -> wastage -> job -> issue -> receipts -> settlement -> balances -> close."""
    headers = auth_headers["clerk"]

    # 1. Create Category
    cat_resp = client.post("/api/categories", json={"name": "Bangle"}, headers=headers)
    assert cat_resp.status_code == 201
    category_id = cat_resp.json()["id"]

    # 2. Create Karigar
    k_resp = client.post(
        "/api/karigars",
        json={"code": "K-001", "name": "Murugesan", "is_active": True},
        headers=headers,
    )
    assert k_resp.status_code == 201
    karigar_id = k_resp.json()["id"]

    # 3. Configure Agreed Wastage (3.00% = 300 bp)
    w_resp = client.post(
        f"/api/karigars/{karigar_id}/wastage",
        json={"category_id": category_id, "wastage_bp": 300},
        headers=headers,
    )
    assert w_resp.status_code == 200
    assert w_resp.json()["wastage_bp"] == 300

    # 3b. Verify GET /api/karigars/{karigar_id}/wastage lists agreed wastage
    get_w_resp = client.get(
        f"/api/karigars/{karigar_id}/wastage",
        headers=headers,
    )
    assert get_w_resp.status_code == 200
    assert len(get_w_resp.json()) >= 1
    assert get_w_resp.json()[0]["wastage_bp"] == 300

    # 4. Open Job (snapshots wastage_bp 300)
    job_resp = client.post(
        f"/api/karigars/{karigar_id}/jobs",
        json={
            "job_no": "JOB-2026-001",
            "karigar_id": karigar_id,
            "category_id": category_id,
            "description": "22k Plain Bangle 4pc",
            "opened_on": "2026-11-01",
        },
        headers=headers,
    )
    assert job_resp.status_code == 201
    job_id = job_resp.json()["id"]
    assert job_resp.json()["wastage_bp"] == 300

    # 5. Issue Gold (120,000 mg @ 91.60% -> 109,920 mg fine)
    issue_resp = client.post(
        "/api/issues",
        json={
            "job_id": job_id,
            "gross_mg": 120000,
            "purity_bp": 9160,
            "entry_date": "2026-11-01",
            "note": "Gold bar issue",
        },
        headers=headers,
    )
    assert issue_resp.status_code == 201
    issue_data = issue_resp.json()
    assert issue_data["fine_mg"] == 109920
    assert issue_data["txn_id"].startswith("TX-")
    issue_id = issue_data["id"]

    # 6. Finished Receipt (112,450 mg @ 91.60% -> 103,004 mg fine, HUID 'HUID01')
    r1_resp = client.post(
        "/api/receipts",
        json={
            "job_id": job_id,
            "kind": "finished",
            "gross_mg": 112450,
            "purity_bp": 9160,
            "entry_date": "2026-11-02",
            "huid": "HUID01",
        },
        headers=headers,
    )
    assert r1_resp.status_code == 201
    assert r1_resp.json()["fine_mg"] == 103004

    # 7. Scrap Receipt (3,300 mg @ 91.60% -> 3,023 mg fine)
    r2_resp = client.post(
        "/api/receipts",
        json={
            "job_id": job_id,
            "kind": "scrap",
            "gross_mg": 3300,
            "purity_bp": 9160,
            "entry_date": "2026-11-02",
        },
        headers=headers,
    )
    assert r2_resp.status_code == 201
    r2_id = r2_resp.json()["id"]
    assert r2_resp.json()["fine_mg"] == 3023

    # 8. Check Job Settlement (sample figures)
    st_resp = client.get(f"/api/jobs/{job_id}/settlement", headers=headers)
    assert st_resp.status_code == 200
    st_data = st_resp.json()
    assert st_data["issued_fine_mg"] == 109920
    assert st_data["finished_mg"] == 103004
    assert st_data["scrap_mg"] == 3023
    assert st_data["filings_mg"] == 0
    assert st_data["returned_mg"] == 106027
    assert st_data["outstanding_mg"] == 3893
    assert st_data["allowed_mg"] == 3298
    assert st_data["excess_mg"] == 595
    assert st_data["actual_wastage_bp"] == 354
    assert st_data["excess_loss_bp"] == 54
    assert st_data["status"] == "outstanding_beyond_allowance"

    # 9. Check Karigar Balance
    kb_resp = client.get(f"/api/balances/karigars/{karigar_id}", headers=headers)
    assert kb_resp.status_code == 200
    kb_data = kb_resp.json()
    assert kb_data["total_fine_balance_mg"] == 3893
    assert len(kb_data["jobs"]) == 1

    # 10. Check All Karigars Summary
    all_kb_resp = client.get("/api/balances/karigars", headers=headers)
    assert all_kb_resp.status_code == 200
    all_kb = all_kb_resp.json()
    murugesan_row = next(r for r in all_kb if r["karigar_id"] == karigar_id)
    assert murugesan_row["total_fine_balance_mg"] == 3893

    # 11. Close Job
    close_resp = client.post(
        f"/api/jobs/{job_id}/close",
        json={"closed_on": "2026-11-02"},
        headers=headers,
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "loss_beyond_allowance"

    # 12. Attempt new issue on closed job must return 400
    err_issue = client.post(
        "/api/issues",
        json={
            "job_id": job_id,
            "gross_mg": 10000,
            "purity_bp": 9160,
            "entry_date": "2026-11-02",
        },
        headers=headers,
    )
    assert err_issue.status_code == 400
    assert "closed" in err_issue.json()["detail"].lower()


def test_void_entry_api_flow(client: TestClient, auth_headers):
    """Test voiding an erroneous receipt via API."""
    headers = auth_headers["clerk"]

    cat_resp = client.post("/api/categories", json={"name": "Chain"}, headers=headers)
    cat_id = cat_resp.json()["id"]

    k_resp = client.post(
        "/api/karigars",
        json={"code": "K-002", "name": "Raman", "is_active": True},
        headers=headers,
    )
    k_id = k_resp.json()["id"]

    client.post(
        f"/api/karigars/{k_id}/wastage",
        json={"category_id": cat_id, "wastage_bp": 250},
        headers=headers,
    )

    job_resp = client.post(
        f"/api/karigars/{k_id}/jobs",
        json={
            "job_no": "JOB-2026-002",
            "karigar_id": k_id,
            "category_id": cat_id,
            "description": "Chain 1pc",
            "opened_on": "2026-11-01",
        },
        headers=headers,
    )
    job_id = job_resp.json()["id"]

    # Issue 50000 mg @ 9160 bp -> 45800 fine_mg
    client.post(
        "/api/issues",
        json={
            "job_id": job_id,
            "gross_mg": 50000,
            "purity_bp": 9160,
            "entry_date": "2026-11-01",
        },
        headers=headers,
    )

    # Receipt scrap 5000 mg @ 9160 bp -> 4580 fine_mg
    rcpt_resp = client.post(
        "/api/receipts",
        json={
            "job_id": job_id,
            "kind": "scrap",
            "gross_mg": 5000,
            "purity_bp": 9160,
            "entry_date": "2026-11-02",
        },
        headers=headers,
    )
    rcpt_id = rcpt_resp.json()["id"]

    # Void scrap receipt
    void_resp = client.post(
        f"/api/receipts/{rcpt_id}/void",
        json={"reason": "Entered against incorrect job order"},
        headers=headers,
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["receipt_id"] == rcpt_id

    # Double void must return 422 or 400
    double_void = client.post(
        f"/api/receipts/{rcpt_id}/void",
        json={"reason": "Attempting second void"},
        headers=headers,
    )
    assert double_void.status_code == 422
