# Architecture & Technical Decision Log

This document records the architectural, mathematical, and implementation decisions made in the Karigar Gold Ledger project.

---

### Decision 1: Integer Milligrams vs Decimal vs Float for Weight
- **Decision**: Represent all weights as integer milligrams (e.g., $112.450\text{ g} = 112,450\text{ mg}$).
- **Options Considered**:
  1. IEEE-754 binary floating-point (`float`).
  2. Fixed-point / arbitrary-precision decimal (`decimal.Decimal`).
  3. Native integer milligrams (`int`).
- **Why Chosen**: Binary floats suffer from binary representation errors (e.g. `0.1 + 0.2 != 0.3`) which can compound across daily ledger entries for 40 karigars, leading to irreconcilable month-end balances. While Python's `Decimal` avoids binary drift, it introduces overhead, context management complexities (precision/rounding modes), and serialization inconsistencies across DB drivers and JSON APIs. Python native integers have arbitrary precision, zero precision loss, zero drift, and map 1:1 to SQL `BIGINT` columns.
- **Trade-off**: Requires explicit formatting (`fmt_g`) and parsing (`parse_g`) functions to convert between UI display grams (3 decimal places) and storage milligrams.

---

### Decision 2: Basis Points for Purity and Wastage
- **Decision**: Represent purity and wastage as integer basis points ($1\text{ bp} = 0.01\%$, where $91.60\% = 9,160\text{ bp}$ and $3.00\% = 300\text{ bp}$).
- **Options Considered**:
  1. Percentage as float or Decimal (`91.60`).
  2. Fractional multipliers (`0.9160`).
  3. Basis points as integer (`9160`).
- **Why Chosen**: Gold purity in India is standardized to 2 decimal places (e.g., 91.60% for 22K hallmarked gold, 75.00% for 18K). Using integer basis points keeps all math strictly within integer domain arithmetic, avoiding any fractional conversion or float conversions.
- **Trade-off**: Requires developers and domain services to treat the denominator as a constant $10,000$ ($100 \times 100$).

---

### Decision 3: Half-Up Integer Rounding Formula
- **Decision**: Use the formula `(val * bp + 5000) // 10000` for all fine weight and allowed wastage calculations.
- **Options Considered**:
  1. Floor truncation (`// 10000`).
  2. Round half-to-even (`round()` / banker's rounding).
  3. Standard commercial half-up rounding implemented via integer arithmetic (`+ 5000 // 10000`).
- **Why Chosen**: Jewellery workshops and commercial gold accounting in India follow strict half-up rounding (0.5 mg rounds up to 1 mg). Banker's rounding can produce non-intuitive alternating adjustments for artisans. Adding half the denominator (`5000`) before integer floor division (`// 10000`) achieves exact half-up rounding without invoking any floating-point or Decimal libraries.
- **Trade-off**: Half-up rounding introduces a minor positive bias over infinite distributions, but aligns with jewellery trade conventions and the project specification.

---

### Decision 4: Test-First Development Order (TDD)
- **Decision**: Author the comprehensive test suite (`test_gold.py`) and verify failures against a stub before implementing `gold.py`.
- **Options Considered**:
  1. Code implementation first, write unit tests afterward.
  2. Write tests first, verify RED (130 failures), then implement to GREEN.
- **Why Chosen**: Testing first guarantees the specifications (sample values, boundary conditions, edge cases, round-trips, and invalid inputs) are verified independently of the implementation. It prevents subconscious bias where tests are written to mirror quirks of the implementation.
- **Trade-off**: Requires an extra initial step to write stubs and commit failing tests before delivering working features.

---

### Decision 5: Explicit Exceptions (ValueError / TypeError) vs Silent Clamping
- **Decision**: Strictly validate inputs and raise explicit exceptions (`TypeError` for non-int/invalid types, `ValueError` for out-of-range values or negatives) rather than silently clamping or coercing values.
- **Options Considered**:
  1. Silent coercion (`int(float_val)`) and clamping (`max(0, min(10000, bp))`).
  2. Returning `None` or error tuples `(result, err)`.
  3. Raising explicit `TypeError` and `ValueError`.
- **Why Chosen**: In financial and physical bullion accounting, silent clamping or type coercion can mask severe bugs (such as negative gold weights, corrupted scale OCR readings, or purity $> 100\%$). An immediate exception blocks invalid database writes and forces the calling layer to handle or reject the transaction.
- **Trade-off**: Callers (API request handlers, form validators) must handle validation exceptions explicitly.

---

### Decision 6: Strict String Parsing vs Permissive Rounding
- **Decision**: Reject extra decimal places (e.g. `112.4501` or `91.605`), internal spaces, exponent notation, and commas during string parsing (`parse_g`, `parse_purity`).
- **Options Considered**:
  1. Permissive parsing: round extra decimals automatically.
  2. Strict parsing: reject any input exceeding 3 decimals for weight or 2 decimals for purity.
- **Why Chosen**: Scales measure to the milligram ($0.001\text{ g}$); readings with 4 or more decimals indicate either an invalid scale configuration, erroneous OCR extraction, or malformed manual entry. Silently rounding or truncating user input could obscure scale errors or clerk typos.
- **Trade-off**: Users must enter clean decimal numbers without unit suffixes or thousands commas.

---

### Decision 7: Zero External, Database, or Framework Imports in `gold.py`
- **Decision**: Keep `backend/app/core/gold.py` completely independent of FastAPI, Pydantic, SQLAlchemy, or third-party dependencies.
- **Options Considered**:
  1. Use Pydantic custom types or validator classes inside `gold.py`.
  2. Write pure Python standard library functions with native types.
- **Why Chosen**: The core arithmetic of the domain represents the enterprise business rules. Keeping it decoupled from frameworks and database ORMs ensures it can be tested in sub-millisecond isolation, reused across services, workers, scripts, CLI tools, or migrated across frameworks without touching the core math.
- **Trade-off**: Pydantic schemas and database models must wrap or call these functions rather than embedding the domain logic directly within ORM hooks.

---

### Decision 8: Append-Only Ledger Tables vs In-Place Mutation
- **Decision**: Design ledger tables (`issues`, `receipts`, `vault_movements`) as strictly append-only; disallow `UPDATE` or `DELETE` operations at both the application and ORM levels.
- **Options Considered**:
  1. Editable transactions with updating balances.
  2. Soft deletes (`is_deleted` column) and in-place row edits.
  3. Immutable, append-only journal entries (with reversals or adjusting entries for corrections).
- **Why Chosen**: Gold ledger auditing requires absolute immutability. If an issue or receipt record could be updated in place, historical balance reconstruction across dates becomes unreliable, and accountability for physical metal slips is broken. Adjustments must always be recorded as compensatory append entries.
- **Trade-off**: Corrections require creating new reversal transactions rather than quick row edits.

---

### Decision 9: Dynamically Computed vs Persisted Stored Balance
- **Decision**: Compute running balances dynamically from ledger records using SQL aggregation (`SUM(issues.fine_mg) - SUM(receipts.fine_mg)`) rather than storing a mutable `current_balance_mg` on the karigar row.
- **Options Considered**:
  1. Mutable cached balance column on `karigars` updated via triggers or application code.
  2. Dynamically computed balance on read via SQL sum over immutable transactions.
- **Why Chosen**: Storing a running balance creates double-entry synchronization bugs, deadlocks under concurrent issues/receipts, and drift if any query bypasses the update lock. PostgreSQL can aggregate tens of thousands of rows with `(karigar_id, entry_date)` indexes in sub-millisecond time.
- **Trade-off**: Read queries aggregate transaction rows; mitigable by day-level materialized snapshotting if transaction volume reaches millions.

---

### Decision 10: Wastage Percentage Snapshot on Job Creation vs Dynamic Lookups
- **Decision**: Persist an immutable `wastage_bp` snapshot on the `jobs` row at the moment the job order is opened, rather than joining against the `karigar_category_wastages` master table dynamically.
- **Options Considered**:
  1. Dynamic join to `karigar_category_wastages` on every receipt reconciliation.
  2. Snapshot agreed `wastage_bp` directly on the `Job` record upon creation.
- **Why Chosen**: Karigar contractual wastage agreements may be renegotiated over time (e.g., from 3.00% to 2.80%). If historical receipts joined dynamically to the master rate, past jobs would retroactively recalculate allowed wastage and produce false loss drift alerts.
- **Trade-off**: Minor data denormalization on the `jobs` table.

---

### Decision 11: Database-Level Named CHECK Constraints vs API-Only Validation
- **Decision**: Enforce physical domain constraints directly in PostgreSQL schemas using named `CheckConstraint` clauses (`gross_mg > 0`, `fine_mg <= gross_mg`, `0 < purity_bp <= 10000`, `(kind = 'finished') OR (huid IS NULL)`).
- **Options Considered**:
  1. Rely solely on Pydantic and FastAPI validation layers.
  2. Enforce constraints at both the application layer and relational database schema layer with explicit constraint names.
- **Why Chosen**: Application-level validation can be bypassed by direct database queries, script migrations, seeders, or background workers. In financial and bullion software, the database must act as the ultimate fortress preventing invalid physical states.
- **Trade-off**: Requires database migrations when range rules or business criteria expand.

---

### Decision 12: Integer Paise for Monetary Valuation
- **Decision**: Store monetary amounts (`value_paise`, `rate_paise_per_g`) as `BIGINT` paise ($1\text{ INR} = 100\text{ paise}$).
- **Options Considered**:
  1. `NUMERIC(12, 2)` or `DECIMAL` columns.
  2. Floating-point rupees.
  3. 64-bit integer paise (`BIGINT`).
- **Why Chosen**: Aligns with the core project principle of zero floating-point arithmetic. High-value old-gold desk purchases (tens of lakhs of rupees) calculated in paise avoid fractional round-off errors and stay within native 64-bit integer operations.
- **Trade-off**: UI layers must format rupees with 2 decimal places by dividing by 100 on display.

---

### Decision 13: Unified Receipts Table with Kind Discriminator vs Multi-Table Polymorphism
- **Decision**: Store finished jewellery, scrap, and filings in a single unified `receipts` table discriminated by `kind` (`finished`, `scrap`, `filings`), with a conditional constraint for `huid`.
- **Options Considered**:
  1. Three distinct tables (`finished_receipts`, `scrap_receipts`, `filing_receipts`).
  2. Single `receipts` table with an enum `kind` and check constraint `(kind = 'finished') OR (huid IS NULL)`.
- **Why Chosen**: From an accounting standpoint, finished pieces, scrap, and filings all serve the exact same financial ledger role: returning issued gold from the karigar to workshop custody. A unified table simplifies balance aggregation (`SUM(receipts.fine_mg)`) and receipt numbering (`txn_id`) while conditional constraints safeguard hallmark HUID fields.
- **Trade-off**: Finished-specific columns (`huid`) are nullable on scrap and filing records.

---

### Decision 14: PostgreSQL Native ENUM Types vs Plain VARCHAR
- **Decision**: Use native PostgreSQL ENUM types (`user_role`, `job_status`, `receipt_kind`, `payment_mode`, `vault_movement_kind`, `loss_alert_status`, `explanation_source`, `ai_reading_kind`, `ai_reading_outcome`).
- **Options Considered**:
  1. Unconstrained `VARCHAR` strings with application-level validation.
  2. Foreign key lookup tables for status types.
  3. Native PostgreSQL ENUM types mapped through SQLAlchemy.
- **Why Chosen**: Postgres ENUMs provide storage efficiency (4 bytes per value instead of variable strings) and strict database-level domain safety against invalid state mutations or typos.
- **Trade-off**: Adding new enum values in Postgres requires an `ALTER TYPE ... ADD VALUE` migration.

---

### Decision 15: Docker Compose with Environment Variable Interpolation for Local Development
- **Decision**: Provide a clean `docker-compose.yml` for local Postgres orchestration that reads credentials via environment variable defaults (`${POSTGRES_USER:-postgres}`, `${POSTGRES_PASSWORD:-postgres}`) without hardcoded credentials.
- **Options Considered**:
  1. Hardcoding default database credentials in `docker-compose.yml`.
  2. Requiring manual local PostgreSQL installation.
  3. Environment-driven `docker-compose.yml` service.
- **Why Chosen**: Guarantees zero secret leakage into version control while enabling one-command local developer onboarding (`docker compose up -d`) across macOS, Linux, and Windows environments.
- **Trade-off**: Developers without Docker Desktop must run a local PostgreSQL service directly.

---

### Decision 16: Void Table vs Negative Entries vs Editable Rows
- **Decision**: Implement an explicit audit table `entry_voids` to mark transactions invalid rather than allowing row edits or inserting synthetic negative transactions.
- **Options Considered**:
  1. Mutable rows with `UPDATE` / `DELETE` operations.
  2. Inserting compensatory negative issues/receipts (e.g. `-100,000 mg`).
  3. Dedicated `entry_voids` table referencing the original transaction with unique foreign keys and a mandatory audit reason.
- **Why Chosen**: In-place edits destroy the audit trail, violating physical slip reconciliation. Negative entries complicate domain rules and database range check constraints (which enforce `fine_mg > 0` and `gross_mg > 0`). The dedicated `entry_voids` table maintains 100% append-only immutability, enforces exactly-once voiding via unique constraints (`uq_entry_voids_issue_id`, `uq_entry_voids_receipt_id`), requires a human-readable explanation ($\ge 5$ characters), and enables simple `LEFT JOIN entry_voids ... WHERE entry_voids.id IS NULL` filtering.
- **Trade-off**: Requires an additional join table in balance and settlement queries.

---

### Decision 17: Database Sequence vs MAX()+1 for Transaction IDs
- **Decision**: Use a dedicated PostgreSQL sequence `txn_seq` (starting at 30500) to generate sequential transaction identifiers (`TX-<number>`).
- **Options Considered**:
  1. `SELECT MAX(id) + 1` or parsing the highest `TX-XXXXX` string.
  2. UUID / GUID strings (e.g. `TX-550e8400...`).
  3. PostgreSQL sequence `txn_seq` via `nextval('txn_seq')`.
- **Why Chosen**: `MAX() + 1` queries suffer from race conditions, table lock contention, and duplicate key collisions under concurrent clerk submissions. Random UUIDs are unreadable on physical workshop gold slips and jewellery tags. A database sequence guarantees atomic, crash-safe, strictly monotonic identifier generation without locking the tables.
- **Trade-off**: Failed or rolled-back transactions consume sequence numbers, creating harmless gaps in sequence numbering.

---

### Decision 18: Pure Settlement Function Decoupled from Database Code
- **Decision**: Keep `settle()` in `app/services/settlement.py` as a pure, stateless function with zero database or framework dependencies, accepting plain integers and returning a frozen `Settlement` dataclass.
- **Options Considered**:
  1. Embedding settlement math directly inside ORM models or database query methods.
  2. A pure calculation function separate from persistence and I/O concerns.
- **Why Chosen**: Decoupling mathematical domain rules from database sessions enables instantaneous, comprehensive unit testing without needing a database connection. It ensures exact mathematical consistency whether invoked during a single job settlement, in batch reconciliations, or by future background worker jobs.
- **Trade-off**: Service callers must first load aggregated weights from the database before calling `settle()`.

---

### Decision 19: Domain Exceptions vs HTTP Exceptions in Service Layer
- **Decision**: Raise domain-specific Python exceptions (`LedgerError`, `JobClosedError`, `InvalidEntryError`, `OverReturnError`, `NotFoundError`) within the service layer instead of FastAPI `HTTPException`.
- **Options Considered**:
  1. Raising `fastapi.HTTPException(status_code=400, detail=...)` directly in services.
  2. Returning status codes or error response tuples.
  3. Raising typed domain exceptions and translating them to HTTP responses at the API route layer.
- **Why Chosen**: Coupling service methods to HTTP abstractions violates separation of concerns and prevents reusing service functions in CLI commands, seed scripts, background automations, or message consumers. Typed domain exceptions make unit and integration tests clear and expressive.
- **Trade-off**: API route handlers must catch domain exceptions and map them to appropriate HTTP status codes (e.g., `404` for `NotFoundError`, `422` for `InvalidEntryError`).

---

### Decision 20: Single Aggregate SQL Queries vs In-Memory Python Loops
- **Decision**: Calculate karigar running balances and workshop-wide statements using a single SQL query with `GROUP BY` and conditional aggregations (`CASE WHEN`), avoiding row-by-row Python iteration.
- **Options Considered**:
  1. Fetching all issues and receipts into Python memory and aggregating in application loops.
  2. Executing `N+1` database queries (one query per karigar and one per job).
  3. Single SQL aggregate query joining jobs, non-voided issues, and non-voided receipts.
- **Why Chosen**: In a jewellery workshop with ~40 karigars and thousands of daily issue/receipt transactions, Python loops incur massive memory overhead, high network latency, and $O(N)$ database round-trips. PostgreSQL computes aggregate sums over indexed columns in microseconds, returning ready-to-consume balance totals in one network round-trip.
- **Trade-off**: SQL queries require careful construct with subqueries or CTEs to prevent Cartesian product duplication between issues and receipts.

---

### Decision 21: Reject vs Warn on Over-Return
- **Decision**: Strictly reject any receipt or issue void that would cause returned gold to exceed issued fine gold for a job order (`OverReturnError`).
- **Options Considered**:
  1. Allowing over-returns with a warning banner or alert flag.
  2. Rejecting over-returns at the service boundary.
- **Why Chosen**: Gold cannot materialize out of thin air. In jewellery manufacturing, if an artisan returns more gold than was issued for a specific job order, scrap from a different job or personal metal is being cross-contaminated. Allowing over-returns obscures individual job wastage tracking and corrupts loss alerts. Surplus scrap must be handled as a separate intake or re-issued under a dedicated job.
- **Trade-off**: Workshop managers cannot dump leftover scrap from multiple jobs into a single job's receipt without an explicit transfer entry.

---

### Decision 22: Preserving Migration History vs Editing Initial Migration
- **Decision**: Create a new, forward-only Alembic migration (`e4a71b29df31`) for `entry_voids` and `txn_seq` instead of modifying the initial schema migration (`c726705440a6`).
- **Options Considered**:
  1. Editing migration 1 and recreating the database schema from scratch.
  2. Adding a new migration script with explicit upgrade and downgrade operations.
- **Why Chosen**: Production database evolution requires strictly immutable, forward-only migration chains. Altering historical migrations breaks deployed environments, corrupts Alembic version history across developer machines, and destroys schema provenance.
- **Trade-off**: Requires maintaining multiple migration files in the repository.

---

### Decision 23: Domain Exception Translation at FastAPI Application Layer
- **Decision**: Register global exception handlers in `app/main.py` mapping pure domain errors (`NotFoundError` -> 404, `JobClosedError`/`OverReturnError`/`LedgerError` -> 400, `InvalidEntryError` -> 422) rather than letting internal exceptions leak as 500 errors.
- **Options Considered**:
  1. Catching domain exceptions individually within every API route handler.
  2. Registering centralized FastAPI exception handlers for domain exception classes.
  3. Raising `HTTPException` directly within core service layers.
- **Why Chosen**: Service layers remain pure and decoupled from web frameworks (can be called from CLI scripts, worker queues, or automated tests without HTTP dependencies). Centralized exception mapping guarantees consistent JSON `{ "detail": "..." }` responses and accurate HTTP status codes.
- **Trade-off**: Requires explicit registration of all custom domain exception types on the FastAPI application instance.

---

### Decision 24: Server-Side Role-Based Access Control (RBAC)
- **Decision**: Enforce role checks (`issue_clerk` vs `finance_head`) on server endpoints via FastAPI dependency injection (`require_finance_head`, `require_clerk_or_finance`).
- **Options Considered**:
  1. Enforcing role restrictions solely in the frontend UI via hidden navigation elements.
  2. Server-side token claims verification using FastAPI `Depends(require_role)`.
- **Why Chosen**: UI-only route guards can be trivially bypassed via direct cURL or API calls. Confidential workshop stock statements, Tally ERP CSV exports, and loss drift alerts are strictly owner-only controls and must be safeguarded by HTTP 403 Forbidden responses on the backend.
- **Trade-off**: Requires JWT tokens to encode user role and endpoints to declare role dependencies.

---

### Decision 25: Integer Standard Deviation for Statistical Loss Drift
- **Decision**: Calculate artisan baseline wastage standard deviation using integer square root (`math.isqrt`) and integer basis points without floating-point math.
- **Options Considered**:
  1. Using `numpy.std` or Python `statistics.stdev` with IEEE 754 floats.
  2. Pure integer standard deviation via `math.isqrt((sum(sq_diff)) // N)`.
- **Why Chosen**: Preserves the project's zero-float invariant across statistical drift calculations. Flags anomalous loss drift if recent loss exceeds baseline average by >50 basis points (0.50%) or 1 integer standard deviation.
- **Trade-off**: Minor sub-basis point precision loss in standard deviation calculation, which is insignificant for workshop tolerance thresholds.

---

### Decision 26: Section 269ST and Section 139A Statutory Enforcement on Old-Gold Desk
- **Decision**: Reject old-gold purchases $\ge$ ₹2,00,000 (20,000,000 paise) with missing PAN (HTTP 422) or cash payment mode (HTTP 400) on both backend and frontend.
- **Options Considered**:
  1. Non-blocking UI warning banner allowing the clerk to proceed.
  2. Hard database and service rejection enforcing Indian Income Tax regulations.
- **Why Chosen**: Under Section 269ST, accepting cash of ₹2 Lakh or more incurs a 100% statutory penalty on the jeweller. Enforcing validation at the API boundary ensures strict legal compliance before gold enters the vault.
- **Trade-off**: Prevents offline or emergency cash processing above the statutory threshold without PAN verification.

---

### Decision 27: AI Scale Vision and Craft Loss Explanations with Offline Resilience
- **Decision**: Integrate Groq Vision (`llama-3.2-11b-vision-preview` / `meta/llama-3.2-11b-vision-instruct`) and text (`llama-3.3-70b-versatile`) with robust local fallback for synthetic/test environments and offline resiliency.
- **Options Considered**:
  1. Direct hard dependency on Groq API without fallback (failing if API key missing or rate-limited).
  2. Pluggable provider architecture with heuristic OCR fallback and structured audit template generator.
- **Why Chosen**: Guarantees tests pass cleanly in air-gapped CI environments and ensures continuous workshop operations if internet connectivity is interrupted.
- **Trade-off**: Template fallback produces standardized phrasing rather than dynamic contextual craftsmanship explanations.

---

### Decision 28: Tabular Monospace Precision in React UI
- **Decision**: Render all gold figures with `font-variant-numeric: tabular-nums` and JetBrains Mono monospace fonts, pairing gross weight inputs with live mathematical half-up fine gold previews and printable physical voucher slips (`TX-XXXXX`).
- **Options Considered**:
  1. Standard proportional sans-serif font styling.
  2. Tabular monospace layout with color-coded liability alerts and printable physical vouchers.
- **Why Chosen**: Proportional fonts make decimal-aligned gold weight comparisons error-prone on busy workshop floors. Tabular alignment ensures milligrams and purities line up cleanly, preventing visual misreads.
- **Trade-off**: Requires including a dedicated monospace font family in the frontend bundle.
