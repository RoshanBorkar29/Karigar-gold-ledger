"""Unit tests for exact fine-gold arithmetic and parsing without floats."""

import random
import sys
from pathlib import Path

import pytest

# Ensure backend root is on sys.path so 'app.core.gold' can be imported in any runner setup
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.gold import (
    allowed_wastage_mg,
    fine_weight_mg,
    fmt_g,
    fmt_purity,
    parse_g,
    parse_purity,
)


# ---------------------------------------------------------------------------
# 1. Sample data tests
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "gross_mg, purity_bp, expected_fine_mg",
    [
        (120000, 9160, 109920),
        (112450, 9160, 103004),
        (3300, 9160, 3023),
    ],
)
def test_sample_data_fine_weight(gross_mg, purity_bp, expected_fine_mg):
    """Verify exact sample conversions given in the project brief."""
    assert fine_weight_mg(gross_mg, purity_bp) == expected_fine_mg


# ---------------------------------------------------------------------------
# 2. Running balance from the sample
# ---------------------------------------------------------------------------
def test_running_balance_sample():
    """Verify running fine-gold balance tracking matches the sample calculation:
    109920 - 103004 == 6916; 6916 - 3023 == 3893.
    """
    issued_fine = fine_weight_mg(120000, 9160)
    assert issued_fine == 109920

    received_item_fine = fine_weight_mg(112450, 9160)
    assert received_item_fine == 103004

    balance_after_item = issued_fine - received_item_fine
    assert balance_after_item == 6916

    received_scrap_fine = fine_weight_mg(3300, 9160)
    assert received_scrap_fine == 3023

    final_balance = balance_after_item - received_scrap_fine
    assert final_balance == 3893


# ---------------------------------------------------------------------------
# 3. Allowed wastage calculation
# ---------------------------------------------------------------------------
def test_allowed_wastage_sample():
    """Verify allowed wastage calculation on issued fine gold: 109920 mg @ 300 bp -> 3298."""
    assert allowed_wastage_mg(109920, 300) == 3298


# ---------------------------------------------------------------------------
# 4. Half-up rounding edges
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "weight_mg, bp, expected",
    [
        # Exact .5 cases round UP (+5000 // 10000)
        (5, 1000, 1),  # 5 * 1000 = 5000 -> 0.5000 mg -> rounds to 1
        (1, 5000, 1),  # 1 * 5000 = 5000 -> 0.5000 mg -> rounds to 1
        (15, 1000, 2),  # 15 * 1000 = 15000 -> 1.5000 mg -> rounds to 2
        (3, 5000, 2),  # 3 * 5000 = 15000 -> 1.5000 mg -> rounds to 2
        # Just-below .5 cases round DOWN
        (4, 1000, 0),  # 4 * 1000 = 4000 -> 0.4000 mg -> rounds to 0
        (1, 4999, 0),  # 1 * 4999 = 4999 -> 0.4999 mg -> rounds to 0
        (14, 1000, 1),  # 14 * 1000 = 14000 -> 1.4000 mg -> rounds to 1
        (9, 500, 0),  # 9 * 500 = 4500 -> 0.4500 mg -> rounds to 0
    ],
)
def test_half_up_rounding_edges(weight_mg, bp, expected):
    """Verify half-up rounding edge cases for both fine weight and allowed wastage."""
    assert fine_weight_mg(weight_mg, bp) == expected
    assert allowed_wastage_mg(weight_mg, bp) == expected


# ---------------------------------------------------------------------------
# 5. Boundaries
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "gross_mg, purity_bp, expected",
    [
        (54321, 10000, 54321),  # 100% purity returns gross unchanged
        (0, 9160, 0),  # 0 gross weight returns 0
        (0, 10000, 0),  # 0 gross weight at 100% returns 0
        (50_000_000, 9160, 45_800_000),  # 50 kg stays exact without overflow
        (50_000_000, 10000, 50_000_000),  # 50 kg at 100%
    ],
)
def test_boundaries(gross_mg, purity_bp, expected):
    """Verify behavior at extreme and boundary inputs."""
    assert fine_weight_mg(gross_mg, purity_bp) == expected


# ---------------------------------------------------------------------------
# 6. Invalid inputs
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "gross_mg, purity_bp, exc_type",
    [
        (-1, 9160, ValueError),
        (100, 0, ValueError),
        (100, -1, ValueError),
        (100, 10001, ValueError),
        (100.0, 9160, TypeError),
        (100, 9160.0, TypeError),
        (True, 9160, TypeError),
        (100, False, TypeError),
        ("100", 9160, TypeError),
        (100, "9160", TypeError),
        (None, 9160, TypeError),
    ],
)
def test_invalid_fine_weight_inputs(gross_mg, purity_bp, exc_type):
    """Verify fine_weight_mg raises appropriate exceptions on invalid inputs."""
    with pytest.raises(exc_type):
        fine_weight_mg(gross_mg, purity_bp)


@pytest.mark.parametrize(
    "issued_mg, wastage_bp, exc_type",
    [
        (-1, 300, ValueError),
        (100, -1, ValueError),
        (100, 10001, ValueError),
        (100.0, 300, TypeError),
        (100, 300.0, TypeError),
        (True, 300, TypeError),
        (100, True, TypeError),
        ("100", 300, TypeError),
        (None, 300, TypeError),
    ],
)
def test_invalid_allowed_wastage_inputs(issued_mg, wastage_bp, exc_type):
    """Verify allowed_wastage_mg raises appropriate exceptions on invalid inputs."""
    with pytest.raises(exc_type):
        allowed_wastage_mg(issued_mg, wastage_bp)


# ---------------------------------------------------------------------------
# 7. fmt_g
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "mg, expected_str",
    [
        (103004, "103.004"),
        (5, "0.005"),
        (0, "0.000"),
        (120000, "120.000"),
        (1, "0.001"),
        (12, "0.012"),
        (123, "0.123"),
        (1000, "1.000"),
        (50_000_000, "50000.000"),
    ],
)
def test_fmt_g_valid(mg, expected_str):
    """Verify weight formatting always produces exactly 3 decimal places."""
    assert fmt_g(mg) == expected_str


@pytest.mark.parametrize(
    "invalid_mg, exc_type",
    [
        (-1, ValueError),
        (1.5, TypeError),
        (True, TypeError),
        ("100", TypeError),
        (None, TypeError),
    ],
)
def test_fmt_g_invalid(invalid_mg, exc_type):
    """Verify fmt_g raises on negative or non-integer values."""
    with pytest.raises(exc_type):
        fmt_g(invalid_mg)


# ---------------------------------------------------------------------------
# 8. fmt_purity
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "bp, expected_str",
    [
        (9160, "91.60"),
        (7500, "75.00"),
        (10000, "100.00"),
        (1, "0.01"),
        (50, "0.50"),
        (9999, "99.99"),
    ],
)
def test_fmt_purity_valid(bp, expected_str):
    """Verify purity formatting always produces exactly 2 decimal places."""
    assert fmt_purity(bp) == expected_str


@pytest.mark.parametrize(
    "invalid_bp, exc_type",
    [
        (0, ValueError),
        (-1, ValueError),
        (10001, ValueError),
        (91.6, TypeError),
        (True, TypeError),
        ("9160", TypeError),
        (None, TypeError),
    ],
)
def test_fmt_purity_invalid(invalid_bp, exc_type):
    """Verify fmt_purity raises on out-of-range or non-integer values."""
    with pytest.raises(exc_type):
        fmt_purity(invalid_bp)


# ---------------------------------------------------------------------------
# 9. parse_g / parse_purity
# ---------------------------------------------------------------------------
@pytest.mark.parametrize(
    "text, expected_mg",
    [
        ("112.450", 112450),
        ("112.45", 112450),
        ("112.4", 112400),
        ("112", 112000),
        ("0", 0),
        ("0.005", 5),
        ("0.5", 500),
        ("  112.450  ", 112450),
        ("50000.000", 50000000),
    ],
)
def test_parse_g_valid(text, expected_mg):
    """Verify parse_g accepts valid gram strings and converts them to milligrams."""
    assert parse_g(text) == expected_mg


@pytest.mark.parametrize(
    "invalid_text",
    [
        "112.4501",  # more than 3 decimals
        "-1",  # negative
        "-0.5",  # negative
        "",  # empty
        "   ",  # whitespace only
        "abc",  # non-numeric
        "1e3",  # exponent form
        "1 2",  # space inside number
        "112,450",  # comma
        ".",  # dot only
        "112.",  # missing decimals after dot
        ".450",  # missing integer part
        "1.2.3",  # multiple dots
        None,  # wrong type
        112,  # wrong type
    ],
)
def test_parse_g_invalid(invalid_text):
    """Verify parse_g rejects ill-formed inputs."""
    with pytest.raises((ValueError, TypeError)):
        parse_g(invalid_text)


@pytest.mark.parametrize(
    "text, expected_bp",
    [
        ("91.60", 9160),
        ("91.6", 9160),
        ("91", 9100),
        ("75.00", 7500),
        ("100.00", 10000),
        ("100", 10000),
        ("0.01", 1),
        ("  91.60  ", 9160),
    ],
)
def test_parse_purity_valid(text, expected_bp):
    """Verify parse_purity accepts valid purity strings and converts to basis points."""
    assert parse_purity(text) == expected_bp


@pytest.mark.parametrize(
    "invalid_text",
    [
        "91.605",  # more than 2 decimals
        "0",  # purity must be > 0
        "0.00",  # purity must be > 0
        "100.01",  # purity must be <= 100.00
        "101",  # > 100
        "-1",  # negative
        "",  # empty
        "   ",  # whitespace only
        "abc",  # non-numeric
        "1e2",  # exponent form
        "9 1",  # space inside
        "91,60",  # comma
        ".",  # dot only
        "91.",  # missing decimals
        ".60",  # missing integer part
        None,  # wrong type
        91,  # wrong type
    ],
)
def test_parse_purity_invalid(invalid_text):
    """Verify parse_purity rejects ill-formed or out-of-range inputs."""
    with pytest.raises((ValueError, TypeError)):
        parse_purity(invalid_text)


@pytest.mark.parametrize(
    "x",
    [0, 1, 5, 100, 3300, 103004, 112450, 120000, 50_000_000],
)
def test_parse_g_round_trip(x):
    """Verify round trip parse_g(fmt_g(x)) == x."""
    assert parse_g(fmt_g(x)) == x


@pytest.mark.parametrize(
    "x",
    [1, 50, 7500, 9160, 9999, 10000],
)
def test_parse_purity_round_trip(x):
    """Verify round trip parse_purity(fmt_purity(x)) == x."""
    assert parse_purity(fmt_purity(x)) == x


# ---------------------------------------------------------------------------
# 10. Property-style loop
# ---------------------------------------------------------------------------
def test_fine_weight_property_loop():
    """Verify property invariants for 1,000 deterministic pseudo-random pairs:
    0 <= fine_weight_mg(gross, purity) <= gross.
    """
    rng = random.Random(42)
    for _ in range(1000):
        gross = rng.randint(0, 100_000_000)
        purity = rng.randint(1, 10000)
        fine = fine_weight_mg(gross, purity)
        assert 0 <= fine <= gross
