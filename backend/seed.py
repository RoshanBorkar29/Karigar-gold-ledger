"""Database seeding script with brief sample data.

Idempotency strategy:
Skip existing records based on unique business keys (email, code, name, job_no, txn_id).
Safe to run multiple times without duplicating data or throwing integrity errors.
"""

from datetime import date
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.gold import fine_weight_mg
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.issue import Issue
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.karigar_category_wastage import KarigarCategoryWastage
from app.models.receipt import Receipt
from app.models.user import User


def seed_data() -> None:
    """Populate database with baseline users, categories, karigars, and sample transactions."""
    db = SessionLocal()
    try:
        # -------------------------------------------------------------------
        # 1. Users (1 issue_clerk, 1 finance_head)
        # -------------------------------------------------------------------
        clerk = db.query(User).filter(User.email == "clerk@karigar.local").first()
        if not clerk:
            clerk = User(
                email="clerk@karigar.local",
                full_name="Issue Clerk",
                password_hash=hash_password(settings.SEED_CLERK_PASSWORD),
                role="issue_clerk",
                is_active=True,
            )
            db.add(clerk)
            db.flush()
            print("Created user: clerk@karigar.local")

        finance = db.query(User).filter(User.email == "finance@karigar.local").first()
        if not finance:
            finance = User(
                email="finance@karigar.local",
                full_name="Finance Head",
                password_hash=hash_password(settings.SEED_FINANCE_PASSWORD),
                role="finance_head",
                is_active=True,
            )
            db.add(finance)
            db.flush()
            print("Created user: finance@karigar.local")

        # -------------------------------------------------------------------
        # 2. 5 Item Categories
        # -------------------------------------------------------------------
        category_names = ["Necklace", "Ring", "Bangle", "Chain", "Earring"]
        categories = {}
        for cat_name in category_names:
            cat = db.query(ItemCategory).filter(ItemCategory.name == cat_name).first()
            if not cat:
                cat = ItemCategory(name=cat_name)
                db.add(cat)
                db.flush()
                print(f"Created category: {cat_name}")
            categories[cat_name] = cat

        # -------------------------------------------------------------------
        # 3. 5 Karigars including Murugesan S
        # -------------------------------------------------------------------
        karigar_specs = [
            ("K-001", "Murugesan S"),
            ("K-002", "Ramasamy K"),
            ("K-003", "Selvam P"),
            ("K-004", "Sundaram M"),
            ("K-005", "Kuppusamy R"),
        ]
        karigars = {}
        for code, name in karigar_specs:
            k = db.query(Karigar).filter(Karigar.code == code).first()
            if not k:
                k = Karigar(code=code, name=name, is_active=True)
                db.add(k)
                db.flush()
                print(f"Created karigar: {code} - {name}")
            karigars[code] = k

        # -------------------------------------------------------------------
        # 4. Wastage rows including Murugesan S at 300 bp for Necklace
        # -------------------------------------------------------------------
        murugesan = karigars["K-001"]
        necklace = categories["Necklace"]

        wastage_specs = [
            (murugesan.id, necklace.id, 300),  # Murugesan S @ 3.00% for Necklace
            (murugesan.id, categories["Ring"].id, 250),
            (murugesan.id, categories["Bangle"].id, 280),
            (karigars["K-002"].id, categories["Chain"].id, 200),
            (karigars["K-003"].id, categories["Earring"].id, 350),
        ]

        for k_id, c_id, w_bp in wastage_specs:
            wastage = (
                db.query(KarigarCategoryWastage)
                .filter(
                    KarigarCategoryWastage.karigar_id == k_id,
                    KarigarCategoryWastage.category_id == c_id,
                )
                .first()
            )
            if not wastage:
                wastage = KarigarCategoryWastage(
                    karigar_id=k_id,
                    category_id=c_id,
                    wastage_bp=w_bp,
                )
                db.add(wastage)
                db.flush()
                print(f"Set wastage for karigar {k_id}, category {c_id}: {w_bp} bp")

        # -------------------------------------------------------------------
        # 5. One Job for Murugesan S (Necklace) with wastage snapshot 300
        # -------------------------------------------------------------------
        job = db.query(Job).filter(Job.job_no == "JOB-2026-001").first()
        if not job:
            job = Job(
                job_no="JOB-2026-001",
                karigar_id=murugesan.id,
                category_id=necklace.id,
                description="22K Traditional Bridal Necklace (Agreed 3.00% wastage)",
                wastage_bp=300,  # Snapshot at creation
                status="open",
                opened_on=date(2026, 11, 1),
                closed_on=None,
            )
            db.add(job)
            db.flush()
            print("Created job: JOB-2026-001")

        # -------------------------------------------------------------------
        # 6. Sample transactions with fine_mg computed by gold.py & asserted
        # -------------------------------------------------------------------
        # TX-30411 Issue: 120000 mg @ 9160 bp -> 109920 mg fine
        fine_issue = fine_weight_mg(120000, 9160)
        assert fine_issue == 109920, f"Expected 109920, got {fine_issue}"

        tx_issue = db.query(Issue).filter(Issue.txn_id == "TX-30411").first()
        if not tx_issue:
            tx_issue = Issue(
                txn_id="TX-30411",
                job_id=job.id,
                karigar_id=murugesan.id,
                gross_mg=120000,
                purity_bp=9160,
                fine_mg=fine_issue,
                entry_date=date(2026, 11, 1),
                created_by=clerk.id,
                note="Gold bar issued for bridal necklace",
            )
            db.add(tx_issue)
            db.flush()
            print(f"Created issue TX-30411 (fine_mg={fine_issue})")

        # TX-30437 Necklace Receipt (finished): 112450 mg @ 9160 bp -> 103004 mg fine
        fine_item = fine_weight_mg(112450, 9160)
        assert fine_item == 103004, f"Expected 103004, got {fine_item}"

        tx_necklace = db.query(Receipt).filter(Receipt.txn_id == "TX-30437").first()
        if not tx_necklace:
            tx_necklace = Receipt(
                txn_id="TX-30437",
                job_id=job.id,
                karigar_id=murugesan.id,
                kind="finished",
                gross_mg=112450,
                purity_bp=9160,
                fine_mg=fine_item,
                huid="HUID-916-8842",
                entry_date=date(2026, 11, 2),
                created_by=clerk.id,
                note="Completed necklace returned with hallmarking",
            )
            db.add(tx_necklace)
            db.flush()
            print(f"Created finished receipt TX-30437 (fine_mg={fine_item})")

        # TX-30438 Scrap Receipt: 3300 mg @ 9160 bp -> 3023 mg fine
        fine_scrap = fine_weight_mg(3300, 9160)
        assert fine_scrap == 3023, f"Expected 3023, got {fine_scrap}"

        tx_scrap = db.query(Receipt).filter(Receipt.txn_id == "TX-30438").first()
        if not tx_scrap:
            tx_scrap = Receipt(
                txn_id="TX-30438",
                job_id=job.id,
                karigar_id=murugesan.id,
                kind="scrap",
                gross_mg=3300,
                purity_bp=9160,
                fine_mg=fine_scrap,
                huid=None,
                entry_date=date(2026, 11, 2),
                created_by=clerk.id,
                note="Workshop melting scrap return",
            )
            db.add(tx_scrap)
            db.flush()
            print(f"Created scrap receipt TX-30438 (fine_mg={fine_scrap})")

        db.commit()
        print("Database seeding completed successfully.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
