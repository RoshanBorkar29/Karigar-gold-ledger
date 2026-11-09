"""Script to generate the complete Technical Design Document as both Markdown and Word (.docx)."""

import os
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

def generate_docs():
    output_dir = Path("docs")
    output_dir.mkdir(parents=True, exist_ok=True)

    md_content = """# Karigar Gold Ledger — Technical Design Document

**GitHub Repository**: [https://github.com/RoshanBorkar29/Karigar-gold-ledger](https://github.com/RoshanBorkar29/Karigar-gold-ledger)  
**Live Application (Render / Vercel)**: Available upon dashboard deployment as outlined in `deployment.md`  

---

## 1. Architecture & Technology Choices

### System Architecture
Karigar Gold Ledger is an enterprise bullion accounting and artisanal workflow management system designed specifically for Indian jewellery manufacturing workshops. It implements a decoupled client-server architecture:

1. **Frontend**: Single-Page Application (SPA) built with **React 18**, **Vite**, and **Tailwind CSS**, featuring custom styling, Lucide icons, and zero third-party UI component dependencies.
2. **Backend API**: High-performance REST service built on **FastAPI** (Python 3.12) with asynchronous request handling, **Pydantic v2** schema validation, and **SQLAlchemy 2.0** ORM.
3. **Database Engine**: **PostgreSQL 16** utilizing native relational schemas, ACID transactions, check constraints, unique business indexes, and atomic sequence generation.
4. **AI Layer**: **Groq Cloud API** powering vision OCR (via multimodal models e.g. `llama-3.2-11b-vision-preview`) and craft loss audit analysis with strict neutrality filters.

### Why This Architecture Was Chosen

- **Strict Zero Floating-Point Arithmetic**: The brief mandates zero floating-point math across all calculations. While Python's `decimal.Decimal` is widely used, storing weights as native **integer milligrams** (`BIGINT`) and purities as **integer basis points** (`10,000 = 100.00%`) avoids any driver/JSON serialization float-coercion bugs. All rounding uses deterministic half-up integer math: `(value * bp + 5000) // 10000`.
- **Append-Only Ledger Immutability**: Traditional software permits direct row updates or deletions. In physical bullion management, edits without an audit trail invite theft. We adopted an append-only architecture where mistakes are corrected exclusively via an `entry_voids` audit table requiring a mandatory explanatory reason.
- **Dynamic Balance Aggregations**: Karigar liabilities and vault positions are dynamically calculated from ledger rows (`SUM(issues) - SUM(receipts)`) rather than mutable stored balance columns, eliminating cache invalidation and balance drift.
- **FastAPI & Pydantic**: Provides compile-time type validation, auto-generated OpenAPI documentation, and sub-millisecond API response latencies critical for workshop checkouts.

---

## 2. Data Model & Entity Specifications

The data model is engineered around double-entry principles for bullion custody:

### Relational Schema Summary
- **`users`**: Workshop staff with Role-Based Access Control (`issue_clerk`, `finance_head`).
- **`karigars`**: Master goldsmith profiles with unique shop codes (`K-001`, `K-002`).
- **`item_categories`**: Jewellery types (`Necklace`, `Ring`, `Bangle`, `Chain`, `Earring`).
- **`karigar_category_wastages`**: Contractual wastage agreements per artisan and category.
- **`jobs`**: Workshop job orders capturing immutable wastage snapshots at creation. Enforces one active open job per category/artisan.
- **`issues`**: Gold issued to karigar workbench (`gross_mg`, `purity_bp`, `fine_mg`). Check constraints enforce `0 < fine_mg <= gross_mg`.
- **`receipts`**: Gold returned from karigar (finished jewellery, bench scrap, filings). Check constraints enforce that mandatory 6-character HUIDs exist strictly on `finished` pieces.
- **`entry_voids`**: Immutable transaction voiding log. Enforces `length(reason) >= 5` and mutually exclusive references to `issue_id` or `receipt_id`.
- **`vault_movements`**: Workshop vault intake, refiner transfers, and refined bullion returns.
- **`old_gold_purchases`**: Customer scrap gold purchases with melt deductions and PAN verification for purchases $\ge ₹2,00,000$.
- **`loss_alerts`**: Statistical loss-drift records generated before month-end reconciliation.
- **`ai_readings`**: Audit logs for scale LCD and karat meter OCR readings.

---

## 3. Core Business Flows & How AI Works

### Core Business Flows

1. **Issue Gold Flow**:
   - Clerk selects a karigar and open job order (or creates a new job inline).
   - Clerk inputs gross weight and purity (or captures scale LCD photo).
   - Real-time result slip calculates fine gold: `fine_mg = (gross_mg * purity_bp + 5000) // 10000`.
   - On submission, transaction ID is assigned from `txn_seq` (e.g., `TX-30411`), and karigar's running liability increases immediately.

2. **Receipt Gold Flow**:
   - Clerk logs returns against active jobs under three categories: Finished Jewellery, Melting Scrap, or Bench Filings.
   - Finished pieces mandate an official 6-character BIS hallmarking code (HUID).
   - Over-return protection prevents returned fine weight from exceeding issued gold.
   - Job settlement calculates allowed wastage: `allowed_mg = (issued_fine_mg * wastage_bp + 5000) // 10000`.
   - If outstanding gold exceeds allowed wastage, the open job is marked `outstanding_beyond_allowance`.

3. **Daily Stock & Vault Balancing**:
   - Dual-tier reconciliation ensures physical gold balances tally:
     $$\text{Total Workshop Gold} = \text{Vault Bullion} + \text{Karigar Custody (WIP)} + \text{Gold with Refiners}$$
   - Direct export to Tally ERP-compatible CSV format.

### How the AI Component Works

1. **Optical Scale & Karat Meter OCR**:
   - Clerks upload photos of electronic balances or karat meters.
   - System sends image to Groq Vision model (`llama-3.2-11b-vision-preview`) with structured JSON instructions at `temperature=0.0`.
   - Strict Anti-Tampering Check: If a clerk confirms an OCR reading, the API validates that the manually submitted weight exactly matches the OCR reading, preventing clerical manipulation.
   - Graceful Fallback: If `GROQ_API_KEY` is unset or unavailable, the system displays a clear manual-entry notice with zero fake numbers.

2. **Craft Loss Analysis & Statistical Drift**:
   - The drift engine scans historical closed jobs only. An open job never contributes to baseline or recent loss.
   - Baseline requires $\ge 3$ closed jobs. An alert is flagged only when recent loss exceeds **both** $2\sigma$ (standard deviations) and $+50\text{ bp}$ ($0.50\%$).
   - Neutrality Filter: Explanations generated via Groq text models are validated against strict neutrality rules—accusatory words (e.g., "theft", "stealing", "fraud") are rejected, falling back to objective craft descriptions.

---

## 4. UI & Design Decisions

### Visual Direction
- **Palette**: Warm ivory/cream background (`#F5F1E8`), rich dark ink (`#171717`), subdued stone borders (`#D9D1BF`), and workshop bronze/gold accents (`#98701C`).
- **Typography**: Clean sans-serif (`Inter` / `IBM Plex Sans`) paired with monospace numbers (`IBM Plex Mono`) for tabular financial figures.
- **Touch & Workshop Ergonomics**: All inputs, selects, and action buttons maintain $\ge 44\text{px}$ touch targets for easy operation on touch terminals.

### Key Screens
1. **Login Page (`/login`)**:
   - Split-screen layout (55% visual brand cover / 45% form). Features live workshop stats card (`Issued: 109.920 g`, `Returned: 106.027 g`, `Outstanding: 3.893 g`) and one-click demo credentials for Issue Clerk and Finance Head.
2. **Issue & Receipt Entry (`/issues`, `/receipts`)**:
   - 2-column layout pairing form inputs on the left with a sticky real-time preview slip on the right. Large 32px mono hero weight displays pure fine gold before submission.
3. **Karigar Balances (`/balances`)**:
   - Workshop aggregate metrics cards with full-width responsive table. Clicking any karigar opens a comprehensive side audit drawer detailing historical jobs and per-job settlements.
4. **Loss Alerts (`/alerts`)**:
   - Focused review cockpit showing summary counters ("For review", "Reviewed"). Neutral review badge "Above usual" (amber `#9A5B00`) ensures observations remain constructive.
5. **Daily Stock Statement (`/stock`)**:
   - High-level physical stock balance across vault, karigar benches, and refiners with single-click Tally CSV generation.

---

## 5. What Was Cut & What Would Be Done Next

### What Was Cut (Scoping & Constraints)
- **Multi-Tenant Organizations**: Kept scoped to a dedicated single-workshop deployment to preserve schema clarity and audit isolation.
- **Physical Hardware Drivers**: Direct USB/Bluetooth serial integration with balance scales was cut in favour of camera/photo upload OCR, ensuring cross-platform browser compatibility.
- **Complex FIFO Allocation Across Concurrent Jobs**: Restricted karigars to one active open job per category to avoid ambiguous metal allocation across concurrent jobs.

### Next Steps (Future Roadmap)
1. **Direct WebSerial / WebBluetooth Scale Link**: Integrate browser WebSerial APIs to stream live weights directly from digital balances without camera capture.
2. **Automated WhatsApp / SMS Karigar Receipts**: Dispatch digitally signed transaction receipts to karigars via WhatsApp Business API upon issue/receipt authorization.
3. **Multi-Branch Inter-Workshop Transfers**: Support vault transfers between regional branches and automated e-way bill generation for bullion transit.
4. **GST E-Invoicing Integration**: Direct integration with government GSTN portals for old-gold purchase RCM self-invoices.
"""

    md_path = output_dir / "TECHNICAL_DESIGN_DOCUMENT.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    print(f"[+] Saved {md_path}")

    # Generate Word Document (.docx)
    doc = docx.Document()

    # Style definitions
    title_p = doc.add_paragraph()
    title_run = title_p.add_run("Karigar Gold Ledger")
    title_run.font.size = Pt(24)
    title_run.font.bold = True
    title_run.font.color.rgb = RGBColor(152, 112, 28) # Bronze #98701C

    sub_p = doc.add_paragraph()
    sub_run = sub_p.add_run("Technical Design Document (TDD)")
    sub_run.font.size = Pt(16)
    sub_run.font.bold = True
    sub_run.font.color.rgb = RGBColor(23, 23, 23)

    meta_p = doc.add_paragraph()
    meta_p.add_run("GitHub Repository: ").bold = True
    meta_p.add_run("https://github.com/RoshanBorkar29/Karigar-gold-ledger\n")
    meta_p.add_run("Architecture: ").bold = True
    meta_p.add_run("React 18 (Vite) + FastAPI (Python 3.12) + PostgreSQL 16 + Groq Vision OCR\n")
    meta_p.add_run("Date: ").bold = True
    meta_p.add_run("November 2026\n")

    doc.add_heading("1. Architecture & Technology Choices", level=1)
    doc.add_paragraph(
        "Karigar Gold Ledger is an enterprise bullion accounting and artisanal workflow management system "
        "designed specifically for Indian jewellery manufacturing workshops. It implements a decoupled client-server architecture:"
    )
    doc.add_paragraph("• Frontend: Single-Page Application (SPA) built with React 18, Vite, and Tailwind CSS, featuring custom styling and zero third-party UI component bloat.")
    doc.add_paragraph("• Backend API: High-performance REST service built on FastAPI (Python 3.12) with asynchronous request handling, Pydantic v2 schema validation, and SQLAlchemy 2.0 ORM.")
    doc.add_paragraph("• Database Engine: PostgreSQL 16 utilizing native relational schemas, ACID transactions, check constraints, unique business indexes, and atomic sequence generation.")
    doc.add_paragraph("• AI Layer: Groq Cloud API powering vision OCR (via multimodal models e.g. llama-3.2-11b-vision-preview) and craft loss audit analysis with strict neutrality filters.")

    doc.add_heading("Why This Architecture Was Chosen", level=2)
    doc.add_paragraph(
        "• Strict Zero Floating-Point Arithmetic: All weights are stored as native integer milligrams (BIGINT) "
        "and purities as integer basis points (10,000 = 100.00%). All rounding uses deterministic half-up integer math: (val * bp + 5000) // 10000.\n"
        "• Append-Only Ledger Immutability: Mistakes are corrected exclusively via an entry_voids audit table requiring a mandatory explanatory reason, eliminating unrecorded database edits.\n"
        "• Dynamic Balance Aggregations: Karigar liabilities and vault positions are dynamically calculated from ledger rows (SUM(issues) - SUM(receipts)), eliminating cache invalidation and balance drift."
    )

    doc.add_heading("2. Data Model & Entity Specifications", level=1)
    doc.add_paragraph(
        "The relational schema is engineered around double-entry principles for physical gold custody:\n\n"
        "• users: Workshop staff with Role-Based Access Control (issue_clerk, finance_head).\n"
        "• karigars: Master goldsmith profiles with unique shop codes (K-001, K-002).\n"
        "• item_categories: Jewellery types (Necklace, Ring, Bangle, Chain, Earring).\n"
        "• karigar_category_wastages: Contractual wastage agreements per artisan and category.\n"
        "• jobs: Workshop job orders capturing immutable wastage snapshots at creation. Enforces one active open job per category/artisan.\n"
        "• issues: Gold issued to karigar workbench (gross_mg, purity_bp, fine_mg). Check constraints enforce 0 < fine_mg <= gross_mg.\n"
        "• receipts: Gold returned from karigar (finished jewellery, bench scrap, filings). Check constraints enforce that mandatory 6-character HUIDs exist strictly on finished pieces.\n"
        "• entry_voids: Immutable transaction voiding log. Enforces reason length >= 5 and mutually exclusive references to issue_id or receipt_id.\n"
        "• vault_movements: Workshop vault intake, refiner transfers, and refined bullion returns.\n"
        "• old_gold_purchases: Customer scrap gold purchases with melt deductions and PAN verification for purchases >= Rs 2,00,000.\n"
        "• loss_alerts: Statistical loss-drift records generated before month-end reconciliation.\n"
        "• ai_readings: Audit logs for scale LCD and karat meter OCR readings."
    )

    doc.add_heading("3. Core Business Flows & How AI Works", level=1)
    doc.add_heading("Core Business Flows", level=2)
    doc.add_paragraph(
        "1. Issue Gold Flow: Vault bullion is issued against an active job. Fine gold is dynamically computed. Transaction sequence TX-XXXXX is generated atomically.\n"
        "2. Receipt Gold Flow: Completed ornaments, scrap, and bench filings are received. Finished ornaments mandate a valid 6-character BIS HUID code. Over-return is strictly blocked.\n"
        "3. Daily Stock Balancing: Dual-tier reconciliation guarantees: Total Workshop Gold = Vault Bullion + Karigar Custody (WIP) + Gold with Refiners. Supports instant Tally ERP CSV export."
    )

    doc.add_heading("How the AI Component Works", level=2)
    doc.add_paragraph(
        "• Optical Scale & Karat Meter OCR: High-resolution images are processed via Groq Vision at temperature=0.0. A strict anti-tampering guard ensures submitted form weights match confirmed OCR readings.\n"
        "• Graceful Fallback: When GROQ_API_KEY is omitted, the system cleanly displays the manual entry fallback notice with zero fake numbers.\n"
        "• Statistical Loss Drift: The drift engine scans historical closed jobs only. An alert is flagged only when recent loss exceeds BOTH 2 standard deviations and +50 basis points (+0.50%). Explanations pass strict neutrality checks to eliminate accusatory language."
    )

    doc.add_heading("4. UI & Design Decisions", level=1)
    doc.add_paragraph(
        "• Visual Direction: Warm ivory/cream background (#F5F1E8), rich dark ink (#171717), and workshop bronze accents (#98701C) matching traditional Coimbatore goldsmith ateliers.\n"
        "• Key Screens: Dedicated split-screen Login page, 2-column Issue & Receipt entry with sticky real-time preview slips, responsive Karigar Balances table with audit drawers, neutral Loss Alerts review cockpit, and Daily Stock statement.\n"
        "• Workshop Ergonomics: Large 32px mono numbers, high-contrast borders, and touch-friendly >= 44px tap targets."
    )

    doc.add_heading("5. What Was Cut & What Would Be Done Next", level=1)
    doc.add_paragraph(
        "What Was Cut:\n"
        "• Multi-Tenant Organizations: Scoped to a dedicated single-workshop deployment for data clarity.\n"
        "• Direct Hardware Scale Drivers: Used browser photo OCR in place of native serial USB/Bluetooth drivers.\n"
        "• Concurrent Job FIFO Splitting: Enforced single active open job per category/karigar to avoid ambiguous metal allocation.\n\n"
        "Next Steps:\n"
        "• Direct WebSerial Scale Link: Stream weight directly from balance ports.\n"
        "• Automated WhatsApp Receipts: Send digitally signed slips to karigars upon transaction authorization.\n"
        "• GST E-Invoicing: Connect directly to government GSTN portals for old-gold RCM self-invoices."
    )

    docx_path = output_dir / "Technical_Design_Document.docx"
    doc.save(docx_path)
    print(f"[+] Saved {docx_path}")

if __name__ == "__main__":
    generate_docs()
