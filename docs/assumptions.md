# Assumptions

- **ASSUMPTION**: Half-up rounding to the milligram `(val * bp + 5000) // 10000` is applied for all fine gold and allowed wastage calculations to prevent systemic loss/gain drift.
- **ASSUMPTION**: Allowed wastage is applied to ISSUED FINE weight, not gross weight, ensuring wastage allowances strictly account for pure gold content.
- **ASSUMPTION**: Gold rate of Rs 12,500 per gram is the brief's assumed valuation rate for old-gold calculations.
- **ASSUMPTION**: Scale and karat photos will be synthetic (generated via Pillow) because the brief provides no physical photo samples.
- **ASSUMPTION**: Purity is accepted and stored to exactly 2 decimal places (basis points: 91.60% = 9160 bp) and weight to exactly 3 decimal places (milligrams: 112.450 g = 112450 mg), as specified in the project brief.
