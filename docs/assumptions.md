# Assumptions

- **ASSUMPTION**: Half-up rounding to the milligram `(val * bp + 5000) // 10000` is applied for all fine gold and allowed wastage calculations to prevent systemic loss/gain drift.
- **ASSUMPTION**: Allowed wastage is applied to ISSUED FINE weight, not gross weight, ensuring wastage allowances strictly account for pure gold content.
- **ASSUMPTION**: Gold rate of Rs 12,500 per gram is the brief's assumed valuation rate for old-gold calculations.
- **ASSUMPTION**: Scale and karat photos will be synthetic (generated via Pillow) because the brief provides no physical photo samples.
- **ASSUMPTION**: Purity is accepted and stored to exactly 2 decimal places (basis points: 91.60% = 9160 bp) and weight to exactly 3 decimal places (milligrams: 112.450 g = 112450 mg), as specified in the project brief.
- **ASSUMPTION**: Wastage percentage is agreed specifically per karigar and item category pair, recognizing that different artisans have distinct craftsmanship tolerances across jewellery categories (e.g., necklaces vs rings).
- **ASSUMPTION**: When a workshop job order is opened, it snapshots the agreed wastage basis points at that moment, protecting active jobs from retroactively changing should master agreed rates be revised later.
- **ASSUMPTION**: Karigar running fine-gold balances and vault stocks are dynamically computed from append-only ledger transaction rows (`SUM(issues.fine_mg) - SUM(receipts.fine_mg)`), ensuring a single source of truth without stored balance drift.
- **ASSUMPTION**: Vault movements track bulk gold movements in and out of the workshop vault (bullion intake, transfers to refiners for refining, and refined bullion returns) using append-only fine milligram records.
- **ASSUMPTION**: The business transaction date (`entry_date`) represents the operational calendar date in India (`Asia/Kolkata` time zone), independent of the server UTC `created_at` audit timestamp.
- **ASSUMPTION**: Transaction IDs follow the brief's sample format `TX-XXXXX` (e.g., `TX-30411`, `TX-30437`) and serve as human-readable slips referenced on paper records and physical tags.
