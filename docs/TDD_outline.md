# Technical Design Document (TDD) Outline

## Architecture

## Data model

The Karigar Gold Ledger relational data model is designed around append-only ledger transaction rows with strict domain integrity constraints. All weights are stored as `BIGINT` milligrams, purities and wastages as `INTEGER` basis points, and monetary values as `BIGINT` paise.

```mermaid
erDiagram
    users {
        int id PK
        string email UK
        string full_name
        string password_hash
        user_role role
        boolean is_active
        timestamptz created_at
    }

    karigars {
        int id PK
        string code UK
        string name
        boolean is_active
        timestamptz created_at
    }

    item_categories {
        int id PK
        string name UK
        timestamptz created_at
    }

    karigar_category_wastages {
        int id PK
        int karigar_id FK
        int category_id FK
        int wastage_bp
        timestamptz created_at
    }

    jobs {
        int id PK
        string job_no UK
        int karigar_id FK
        int category_id FK
        string description
        int wastage_bp
        job_status status
        date opened_on
        date closed_on
        timestamptz created_at
    }

    issues {
        int id PK
        string txn_id UK
        int job_id FK
        int karigar_id FK
        bigint gross_mg
        int purity_bp
        bigint fine_mg
        date entry_date
        int created_by FK
        string note
        timestamptz created_at
    }

    receipts {
        int id PK
        string txn_id UK
        int job_id FK
        int karigar_id FK
        receipt_kind kind
        bigint gross_mg
        int purity_bp
        bigint fine_mg
        string huid
        date entry_date
        int created_by FK
        string note
        timestamptz created_at
    }

    vault_movements {
        int id PK
        vault_movement_kind kind
        bigint fine_mg
        date entry_date
        int created_by FK
        string note
        timestamptz created_at
    }

    old_gold_purchases {
        int id PK
        string bill_no UK
        bigint gross_mg
        int tested_purity_bp
        bigint deduction_mg
        bigint fine_mg
        bigint rate_paise_per_g
        bigint value_paise
        payment_mode payment_mode
        string pan
        date entry_date
        int created_by FK
        timestamptz created_at
    }

    loss_alerts {
        int id PK
        int karigar_id FK
        int job_id FK
        int recent_loss_bp
        int baseline_mean_bp
        int baseline_stddev_bp
        int sample_size
        loss_alert_status status
        string explanation
        explanation_source explanation_source
        int reviewed_by FK
        timestamptz reviewed_at
        timestamptz created_at
    }

    ai_readings {
        int id PK
        ai_reading_kind kind
        string image_path
        string model_name
        string ai_value_text
        string ai_unit
        int ai_confidence
        boolean ai_readable
        string typed_value_text
        string confirmed_value_text
        ai_reading_outcome outcome
        int created_by FK
        timestamptz created_at
    }

    entry_voids {
        int id PK
        int issue_id FK
        int receipt_id FK
        string reason
        int voided_by FK
        timestamptz created_at
    }

    users ||--o{ issues : "issues"
    users ||--o{ receipts : "receipts"
    users ||--o{ vault_movements : "records"
    users ||--o{ old_gold_purchases : "purchases"
    users ||--o{ ai_readings : "captures"
    users ||--o{ loss_alerts : "reviews"

    karigars ||--o{ karigar_category_wastages : "contract_rates"
    item_categories ||--o{ karigar_category_wastages : "applies_to"

    karigars ||--o{ jobs : "assigned"
    item_categories ||--o{ jobs : "category"

    jobs ||--o{ issues : "issues_against"
    karigars ||--o{ issues : "receives_gold"

    jobs ||--o{ receipts : "returns_from"
    karigars ||--o{ receipts : "returns_gold"

    karigars ||--o{ loss_alerts : "flagged_for"
    jobs ||--o{ loss_alerts : "job_reference"

    issues ||--o| entry_voids : "voided_by"
    receipts ||--o| entry_voids : "voided_by"
    users ||--o{ entry_voids : "voids_authorized"
```

### Table Specifications & Constraints
- **`users`**: Role-based access control (`issue_clerk`, `finance_head`).
- **`karigars`**: Artisan master with unique code (`K-001`, `K-002`, etc.).
- **`item_categories`**: Jewellery classification (`Necklace`, `Ring`, `Bangle`, etc.).
- **`karigar_category_wastages`**: Contractual agreed wastage % per artisan and category (`0 <= wastage_bp <= 10000`).
- **`jobs`**: Workshop job orders capturing immutable wastage snapshot at creation. Enforces `closed_on` is null if open, and not null if closed.
- **`issues`**: Gold issued to karigar. Enforces `gross_mg > 0`, `0 < purity_bp <= 10000`, and `0 < fine_mg <= gross_mg`.
- **`receipts`**: Finished jewellery, scrap, and filings. Enforces `(kind = 'finished') OR (huid IS NULL)` to guarantee hallmarks only exist on finished items.
- **`entry_voids`**: Append-only transaction void audit log. Enforces `length(reason) >= 5`, mutually exclusive target references (`(issue_id IS NOT NULL AND receipt_id IS NULL) OR (issue_id IS NULL AND receipt_id IS NOT NULL)`), and unique constraints per issue/receipt ensuring exactly-once voiding.
- **`vault_movements`**: Bullion deposits, refiner despatches, and refiner returns.
- **`old_gold_purchases`**: Customer scrap gold intake with purity testing, deductions, and PAN recording.
- **`loss_alerts`**: Statistical loss-drift records generated prior to month-end.
- **`ai_readings`**: Audit trail of scale and karat meter OCR readings with clerk confirmation status.

## Flows

## AI design

## UI decisions

## Assumptions

## What I cut

## Next steps
