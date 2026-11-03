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
