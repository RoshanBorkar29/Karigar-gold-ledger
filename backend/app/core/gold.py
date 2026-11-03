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


def _validate_int(val: int, name: str) -> None:
    """Ensure value is strictly an int and not a bool, float, or other type."""
    if type(val) is not int:
        raise TypeError(f"{name} must be an integer, got {type(val).__name__}")


def _validate_weight(mg: int, name: str = "Weight") -> None:
    """Validate weight in milligrams."""
    _validate_int(mg, name)
    if mg < 0:
        raise ValueError(f"{name} cannot be negative: {mg}")


def _validate_purity(bp: int, name: str = "Purity basis points") -> None:
    """Validate purity in basis points (1 to 10000)."""
    _validate_int(bp, name)
    if bp <= 0 or bp > 10000:
        raise ValueError(f"{name} must be in range 1..10000 (0.01% - 100.00%), got {bp}")


def _validate_wastage(bp: int, name: str = "Wastage basis points") -> None:
    """Validate wastage in basis points (0 to 10000)."""
    _validate_int(bp, name)
    if bp < 0 or bp > 10000:
        raise ValueError(f"{name} must be in range 0..10000 (0.00% - 100.00%), got {bp}")


def fine_weight_mg(gross_mg: int, purity_bp: int) -> int:
    """Calculate fine gold weight in milligrams from gross weight and purity basis points.

    Formula: (gross_mg * purity_bp + 5000) // 10000 (half-up rounding to nearest milligram).
    """
    _validate_weight(gross_mg, "Gross weight")
    _validate_purity(purity_bp, "Purity basis points")
    return (gross_mg * purity_bp + 5000) // 10000


def allowed_wastage_mg(issued_fine_mg: int, wastage_bp: int) -> int:
    """Calculate allowed wastage in milligrams from issued fine gold and wastage basis points.

    Formula: (issued_fine_mg * wastage_bp + 5000) // 10000 (half-up rounding to nearest milligram).
    """
    _validate_weight(issued_fine_mg, "Issued fine weight")
    _validate_wastage(wastage_bp, "Wastage basis points")
    return (issued_fine_mg * wastage_bp + 5000) // 10000


def fmt_g(mg: int) -> str:
    """Format milligram weight as a string with exactly 3 decimal places (grams).

    Example: 103004 -> '103.004', 5 -> '0.005', 0 -> '0.000'.
    """
    _validate_weight(mg, "Weight")
    return f"{mg // 1000}.{mg % 1000:03d}"


def fmt_purity(bp: int) -> str:
    """Format purity basis points as a percentage string with exactly 2 decimal places.

    Example: 9160 -> '91.60', 10000 -> '100.00'.
    """
    _validate_purity(bp, "Purity basis points")
    return f"{bp // 100}.{bp % 100:02d}"


def parse_g(text: str) -> int:
    """Parse a gram text representation into integer milligrams.

    Accepts up to 3 decimal places (e.g. '112.450', '112.45', '112').
    Rejects negatives, empty strings, non-numeric strings, exponent formats, and internal spaces.
    """
    if type(text) is not str:
        raise TypeError(f"Input must be a string, got {type(text).__name__}")
    s = text.strip()
    if not s:
        raise ValueError("Input string is empty")
    if " " in s:
        raise ValueError("Input contains whitespace inside number")
    if "-" in s or "+" in s or "," in s:
        raise ValueError("Invalid characters in weight input")
    if s.count(".") > 1:
        raise ValueError("Multiple decimal points in weight input")

    if "." in s:
        int_str, frac_str = s.split(".")
        if not int_str or not frac_str:
            raise ValueError("Decimal number must have digits before and after the decimal point")
        if not int_str.isdigit() or not frac_str.isdigit():
            raise ValueError("Weight contains non-digit characters")
        if len(frac_str) > 3:
            raise ValueError(f"Weight cannot have more than 3 decimal places: '{frac_str}'")
        frac_mg = int(frac_str.ljust(3, "0"))
        return int(int_str) * 1000 + frac_mg

    if not s.isdigit():
        raise ValueError("Weight contains non-digit characters")
    return int(s) * 1000


def parse_purity(text: str) -> int:
    """Parse a purity percentage text representation into integer basis points.

    Accepts up to 2 decimal places (e.g. '91.60', '91.6', '91', '100.00').
    Must be strictly > 0 and <= 100.00 (1 to 10000 basis points).
    """
    if type(text) is not str:
        raise TypeError(f"Input must be a string, got {type(text).__name__}")
    s = text.strip()
    if not s:
        raise ValueError("Input string is empty")
    if " " in s:
        raise ValueError("Input contains whitespace inside number")
    if "-" in s or "+" in s or "," in s:
        raise ValueError("Invalid characters in purity input")
    if s.count(".") > 1:
        raise ValueError("Multiple decimal points in purity input")

    if "." in s:
        int_str, frac_str = s.split(".")
        if not int_str or not frac_str:
            raise ValueError("Decimal number must have digits before and after the decimal point")
        if not int_str.isdigit() or not frac_str.isdigit():
            raise ValueError("Purity contains non-digit characters")
        if len(frac_str) > 2:
            raise ValueError(f"Purity cannot have more than 2 decimal places: '{frac_str}'")
        bp = int(int_str) * 100 + int(frac_str.ljust(2, "0"))
    else:
        if not s.isdigit():
            raise ValueError("Purity contains non-digit characters")
        bp = int(s) * 100

    if bp <= 0 or bp > 10000:
        raise ValueError(f"Purity must be in range 1..10000 basis points (0.01% - 100.00%), got {bp}")
    return bp
