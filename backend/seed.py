"""Database seeding script with brief sample data and multi-karigar demo history.

Idempotency strategy:
Skip existing records based on unique business keys (email, code, name, job_no, txn_id).
Safe to run multiple times without duplicating data or throwing integrity errors.
Deterministic generation via random.Random(42).
"""

from datetime import date, timedelta
from pathlib import Path
import random
import sys

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.gold import allowed_wastage_mg, fine_weight_mg
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.issue import Issue
from app.models.item_category import ItemCategory
from app.models.job import Job
from app.models.karigar import Karigar
from app.models.karigar_category_wastage import KarigarCategoryWastage
from app.models.receipt import Receipt
from app.models.user import User
from app.models.vault_movement import VaultMovement


def seed_data() -> None:
    """Populate database with users, categories, karigars, vault bullion, and demo history."""
    db = SessionLocal()
    rng = random.Random(42)

    try:
        # -------------------------------------------------------------------
        # 1. Users (1 issue_clerk, 1 finance_head) + workshop aliases
        # -------------------------------------------------------------------
        user_records = {}
        for email, role, full_name, pwd in [
            ("clerk@karigar.local", "issue_clerk", "Meena Rao", settings.SEED_CLERK_PASSWORD),
            ("finance@karigar.local", "finance_head", "Anil Menon", settings.SEED_FINANCE_PASSWORD),
            ("clerk@workshop.local", "issue_clerk", "Meena Rao", "clerk123"),
            ("finance@workshop.local", "finance_head", "Anil Menon", "finance123"),
        ]:
            u = db.query(User).filter(User.email == email).first()
            if not u:
                u = User(
                    email=email,
                    full_name=full_name,
                    password_hash=hash_password(pwd),
                    role=role,
                    is_active=True,
                )
                db.add(u)
                db.flush()
                print(f"Created user: {email}")
            else:
                u.full_name = full_name
                db.flush()
            user_records[email] = u

        clerk = user_records["clerk@karigar.local"]
        finance = user_records["finance@karigar.local"]

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
        # 3. 5 Karigars
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
        # 4. Standard Wastage Configuration (2.50% - 3.50%)
        # -------------------------------------------------------------------
        default_wastage_table = {
            "Necklace": 300,
            "Ring": 250,
            "Bangle": 280,
            "Chain": 200,
            "Earring": 350,
        }
        for k in karigars.values():
            for c_name, cat in categories.items():
                w_bp = default_wastage_table[c_name]
                w = (
                    db.query(KarigarCategoryWastage)
                    .filter(
                        KarigarCategoryWastage.karigar_id == k.id,
                        KarigarCategoryWastage.category_id == cat.id,
                    )
                    .first()
                )
                if not w:
                    w = KarigarCategoryWastage(
                        karigar_id=k.id,
                        category_id=cat.id,
                        wastage_bp=w_bp,
                    )
                    db.add(w)
                    db.flush()

        # -------------------------------------------------------------------
        # 5. Vault Bullion Movements (Ensure positive vault balance)
        # -------------------------------------------------------------------
        # 10 kg total 24K bullion intake over past 4 months
        bullion_movements = [
            ("VM-2026-001", 5_000_000, date(2026, 7, 1), "Q3 Primary MMTC bullion bar intake"),
            ("VM-2026-002", 5_000_000, date(2026, 9, 1), "Q4 Workshop replenishment bullion bars"),
        ]
        for note_id, fine_mg, entry_d, note_text in bullion_movements:
            existing_vm = db.query(VaultMovement).filter(VaultMovement.note == note_text).first()
            if not existing_vm:
                vm = VaultMovement(
                    kind="bullion_in",
                    fine_mg=fine_mg,
                    entry_date=entry_d,
                    created_by=finance.id,
                    note=note_text,
                )
                db.add(vm)
                db.flush()
                print(f"Created vault bullion_in: {fine_mg} mg on {entry_d}")

        # -------------------------------------------------------------------
        # 6. Murugesan S Open Job & Brief Transactions (JOB-2026-001)
        # -------------------------------------------------------------------
        murugesan = karigars["K-001"]
        necklace = categories["Necklace"]

        job = db.query(Job).filter(Job.job_no == "JOB-2026-001").first()
        if not job:
            job = Job(
                job_no="JOB-2026-001",
                karigar_id=murugesan.id,
                category_id=necklace.id,
                description="22K Traditional Bridal Necklace (Agreed 3.00% wastage)",
                wastage_bp=300,
                status="open",
                opened_on=date(2026, 11, 1),
                closed_on=None,
            )
            db.add(job)
            db.flush()
            print("Created job: JOB-2026-001")

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

        # Assert Murugesan's brief numbers are strictly unchanged
        assert tx_issue.fine_mg == 109920, f"Murugesan issue fine_mg changed: {tx_issue.fine_mg}"
        assert tx_necklace.fine_mg == 103004, f"Murugesan finished fine_mg changed: {tx_necklace.fine_mg}"
        assert tx_scrap.fine_mg == 3023, f"Murugesan scrap fine_mg changed: {tx_scrap.fine_mg}"

        # -------------------------------------------------------------------
        # 7. Multi-Karigar Demo History (6-8 CLOSED jobs each over past 4 months)
        # -------------------------------------------------------------------
        # Start ~120 days ago (July 2026) up to late October 2026
        base_start = date(2026, 7, 5)

        # Karigar job count schedule:
        # K-001: 6 closed jobs (+ 1 open brief job)
        # K-002: 7 closed jobs (stable)
        # K-003: 7 closed jobs (Selvam P: last 2 jobs upward drift)
        # K-004: 7 closed jobs (stable)
        # K-005: 6 closed jobs (stable)
        job_counts = {
            "K-001": 6,
            "K-002": 7,
            "K-003": 7,
            "K-004": 7,
            "K-005": 6,
        }

        cat_keys = list(categories.keys())

        for code, num_jobs in job_counts.items():
            k_obj = karigars[code]
            is_drifter = (code == "K-003")

            for j_idx in range(1, num_jobs + 1):
                j_no = f"JOB-{code}-{j_idx:03d}"
                cat_name = cat_keys[(j_idx + int(code[-1])) % len(cat_keys)]
                cat_obj = categories[cat_name]
                agreed_bp = default_wastage_table[cat_name]

                # Distribute dates evenly across ~115 days
                days_offset = (j_idx - 1) * 16 + (int(code[-1]) * 2)
                opened_d = base_start + timedelta(days=days_offset)
                closed_d = opened_d + timedelta(days=rng.randint(3, 7))

                existing_job = db.query(Job).filter(Job.job_no == j_no).first()
                if not existing_job:
                    existing_job = Job(
                        job_no=j_no,
                        karigar_id=k_obj.id,
                        category_id=cat_obj.id,
                        description=f"Completed {cat_name} batch order #{j_idx}",
                        wastage_bp=agreed_bp,
                        status="closed",
                        opened_on=opened_d,
                        closed_on=closed_d,
                    )
                    db.add(existing_job)
                    db.flush()

                # Issue for this historical job
                tx_issue_id = f"TX-I-{code}-{j_idx:03d}"
                existing_issue = db.query(Issue).filter(Issue.txn_id == tx_issue_id).first()
                if not existing_issue:
                    gross_issue = 50000 + (j_idx * 2000)
                    purity_bp = 9160
                    fine_issue_mg = fine_weight_mg(gross_issue, purity_bp)

                    existing_issue = Issue(
                        txn_id=tx_issue_id,
                        job_id=existing_job.id,
                        karigar_id=k_obj.id,
                        gross_mg=gross_issue,
                        purity_bp=purity_bp,
                        fine_mg=fine_issue_mg,
                        entry_date=opened_d,
                        created_by=clerk.id,
                        note=f"Material issued for {j_no}",
                    )
                    db.add(existing_issue)
                    db.flush()

                fine_issued = existing_issue.fine_mg

                # Determine historical return & wastage
                # If drifter on last 2 jobs (jobs 6 and 7): drift upward significantly (+120 bp, +150 bp)
                if is_drifter and j_idx == num_jobs - 1:
                    actual_loss_bp = agreed_bp + 120
                elif is_drifter and j_idx == num_jobs:
                    actual_loss_bp = agreed_bp + 150
                else:
                    # Normal stable fluctuation around agreed % with small noise (-10 to +10 bp)
                    noise = rng.randint(-10, 10)
                    actual_loss_bp = max(0, agreed_bp + noise)

                actual_loss_mg = (fine_issued * actual_loss_bp + 5000) // 10000
                total_return_fine_mg = max(0, fine_issued - actual_loss_mg)

                # Split returned fine gold between finished piece (92%) and scrap (8%)
                fin_fine_mg = (total_return_fine_mg * 92) // 100
                scrap_fine_mg = total_return_fine_mg - fin_fine_mg

                fin_gross_mg = (fin_fine_mg * 10000 + 4580) // 9160
                scrap_gross_mg = (scrap_fine_mg * 10000 + 4580) // 9160

                # 1. Finished receipt
                tx_rec_fin_id = f"TX-RF-{code}-{j_idx:03d}"
                if not db.query(Receipt).filter(Receipt.txn_id == tx_rec_fin_id).first():
                    rec_fin = Receipt(
                        txn_id=tx_rec_fin_id,
                        job_id=existing_job.id,
                        karigar_id=k_obj.id,
                        kind="finished",
                        gross_mg=fin_gross_mg,
                        purity_bp=9160,
                        fine_mg=fine_weight_mg(fin_gross_mg, 9160),
                        huid=f"HUID-{code[-3:]}-{j_idx:04d}",
                        entry_date=closed_d,
                        created_by=clerk.id,
                        note="Finished article delivery",
                    )
                    db.add(rec_fin)
                    db.flush()

                # 2. Scrap receipt
                tx_rec_scr_id = f"TX-RS-{code}-{j_idx:03d}"
                if not db.query(Receipt).filter(Receipt.txn_id == tx_rec_scr_id).first():
                    rec_scr = Receipt(
                        txn_id=tx_rec_scr_id,
                        job_id=existing_job.id,
                        karigar_id=k_obj.id,
                        kind="scrap",
                        gross_mg=scrap_gross_mg,
                        purity_bp=9160,
                        fine_mg=fine_weight_mg(scrap_gross_mg, 9160),
                        huid=None,
                        entry_date=closed_d,
                        created_by=clerk.id,
                        note="Production melting scrap",
                    )
                    db.add(rec_scr)
                    db.flush()

        db.commit()
        print("Database multi-karigar seeding completed successfully.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
