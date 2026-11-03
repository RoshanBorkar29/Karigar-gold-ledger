"""Exact fine-gold arithmetic using integer milligrams and purity basis points.

No floats, no true division (/), no round(), and no Decimal.
All operations use integer arithmetic and string parsing.

Units:
- Weight: integer milligrams (112.450 g = 112450)
- Purity: integer basis points (91.60 % = 9160)
- Wastage: integer basis points (3.00 % = 300)

Error conventions:
- Non-integer input types (including bool, float, str, None) raise TypeError.
- Out-of-bounds or invalid values (e.g. negative weights, out-of-range basis points,
  ill-formed text strings) raise ValueError.
"""


def fine_weight_mg(gross_mg: int, purity_bp: int) -> int:
    """Calculate fine gold weight in milligrams from gross weight and purity basis points.

    Formula: (gross_mg * purity_bp + 5000) // 10000 (half-up rounding to nearest milligram).
    """
    raise NotImplementedError


def allowed_wastage_mg(issued_fine_mg: int, wastage_bp: int) -> int:
    """Calculate allowed wastage in milligrams from issued fine gold and wastage basis points.

    Formula: (issued_fine_mg * wastage_bp + 5000) // 10000 (half-up rounding to nearest milligram).
    """
    raise NotImplementedError


def fmt_g(mg: int) -> str:
    """Format milligram weight as a string with exactly 3 decimal places (grams).

    Example: 103004 -> '103.004', 5 -> '0.005', 0 -> '0.000'.
    """
    raise NotImplementedError


def fmt_purity(bp: int) -> str:
    """Format purity basis points as a percentage string with exactly 2 decimal places.

    Example: 9160 -> '91.60', 10000 -> '100.00'.
    """
    raise NotImplementedError


def parse_g(text: str) -> int:
    """Parse a gram text representation into integer milligrams.

    Accepts up to 3 decimal places (e.g. '112.450', '112.45', '112').
    Rejects negatives, empty strings, non-numeric strings, exponent formats, and internal spaces.
    """
    raise NotImplementedError


def parse_purity(text: str) -> int:
    """Parse a purity percentage text representation into integer basis points.

    Accepts up to 2 decimal places (e.g. '91.60', '91.6', '91', '100.00').
    Must be strictly > 0 and <= 100.00 (1 to 10000 basis points).
    """
    raise NotImplementedError
