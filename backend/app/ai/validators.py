"""Validation engine ensuring AI-extracted readings and uploads satisfy strict unit, range, and format constraints."""

import re

ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_upload_file(content: bytes, content_type: str | None = None) -> None:
    """Validate image upload size, content type, and magic bytes.

    Raises ValueError with specific message if invalid.
    """
    if not content:
        raise ValueError("Uploaded file is empty")

    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("Uploaded file exceeds 5 MB limit")

    if content_type:
        normalized_ct = content_type.lower().split(";")[0].strip()
        if normalized_ct not in ALLOWED_CONTENT_TYPES:
            raise ValueError(
                f"Unsupported content type: '{content_type}'. Only PNG, JPEG, and WebP are allowed."
            )

    # Magic bytes verification
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_webp = (
        content.startswith(b"RIFF")
        and len(content) >= 12
        and content[8:12] == b"WEBP"
    )

    if not (is_png or is_jpeg or is_webp):
        raise ValueError(
            "Invalid file signature: file does not match PNG, JPEG, or WebP magic bytes"
        )


def validate_scale_reading(
    value_text: str | None,
    unit: str | None,
    readable: bool,
) -> int:
    """Validate weighing scale reading and return weight in integer milligrams.

    Requirements:
    - readable must be True
    - unit must be 'g'
    - value_text must have exactly 3 decimals
    - 0 < weight <= 50000 g (0 < mg <= 50,000,000)

    Raises ValueError on validation failure.
    """
    if not readable:
        raise ValueError("Scale reading marked unreadable")

    if unit != "g":
        raise ValueError(
            f"Invalid unit: '{unit}'. Scale readings must be in grams ('g')"
        )

    if not value_text or not isinstance(value_text, str):
        raise ValueError("Missing or invalid scale reading value")

    s = value_text.strip()
    match = re.fullmatch(r"^(\d+)\.(\d{3})$", s)
    if not match:
        if "." in s and len(s.split(".")[1]) != 3:
            raise ValueError(
                f"Scale weight must have exactly 3 decimal places, got '{s}'"
            )
        raise ValueError(
            f"Invalid scale weight format: '{s}'. Expected digits with exactly 3 decimal places (e.g. '112.450')"
        )

    whole, frac = match.groups()
    mg = int(whole) * 1000 + int(frac)

    if mg <= 0:
        raise ValueError(f"Scale weight must be greater than 0 g, got '{s}'")
    if mg > 50_000_000:
        raise ValueError(
            f"Scale weight exceeds maximum capacity of 50000 g (50 kg), got '{s}'"
        )

    return mg


def validate_karat_reading(
    purity_text: str | None,
    unit: str | None,
    readable: bool,
) -> int:
    """Validate karat meter / XRF reading and return purity in integer basis points.

    Requirements:
    - readable must be True
    - unit must be '%' (or empty string/None)
    - purity_text must have exactly 2 decimals
    - 1.00 <= purity <= 100.00 (100 <= bp <= 10000)

    Raises ValueError on validation failure.
    """
    if not readable:
        raise ValueError("Karat reading marked unreadable")

    if unit not in ("%", None, ""):
        raise ValueError(
            f"Invalid unit: '{unit}'. Karat meter readings must be in percentage ('%')"
        )

    if not purity_text or not isinstance(purity_text, str):
        raise ValueError("Missing or invalid purity reading value")

    s = purity_text.strip()
    match = re.fullmatch(r"^(\d+)\.(\d{2})$", s)
    if not match:
        if "." in s and len(s.split(".")[1]) != 2:
            raise ValueError(
                f"Purity must have exactly 2 decimal places, got '{s}'"
            )
        raise ValueError(
            f"Invalid purity format: '{s}'. Expected digits with exactly 2 decimal places (e.g. '91.60')"
        )

    whole, frac = match.groups()
    bp = int(whole) * 100 + int(frac)

    if bp < 100 or bp > 10000:
        raise ValueError(
            f"Purity must be within 1.00% to 100.00% (got '{s}%')"
        )

    return bp
