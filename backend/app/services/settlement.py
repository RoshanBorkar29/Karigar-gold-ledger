"""Pure settlement mathematics for karigar jobs."""

from dataclasses import dataclass
from enum import Enum

from app.core.gold import allowed_wastage_mg


def _validate_int(val: int, name: str) -> None:
    """Ensure value is strictly an int and not a bool, float, or other type."""
    if type(val) is not int:
        raise TypeError(f"{name} must be an integer, got {type(val).__name__}")


def _validate_weight(mg: int, name: str) -> None:
    """Validate weight in milligrams."""
    _validate_int(mg, name)
    if mg < 0:
        raise ValueError(f"{name} cannot be negative: {mg}")


def _validate_wastage(bp: int, name: str) -> None:
    """Validate wastage in basis points (0 to 10000)."""
    _validate_int(bp, name)
    if bp < 0 or bp > 10000:
        raise ValueError(f"{name} must be in range 0..10000, got {bp}")


class SettlementStatus(str, Enum):
    """Lifecycle and audit status of a job's gold balance."""

    OVER_RETURNED = "over_returned"
    WITHIN_ALLOWANCE = "within_allowance"
    OUTSTANDING_BEYOND_ALLOWANCE = "outstanding_beyond_allowance"
    LOSS_BEYOND_ALLOWANCE = "loss_beyond_allowance"


@dataclass(frozen=True)
class Settlement:
    """Immutable calculation snapshot of a karigar job's gold reconciliation."""

    issued_fine_mg: int
    finished_mg: int
    scrap_mg: int
    filings_mg: int
    returned_mg: int
    outstanding_mg: int
    allowed_mg: int
    excess_mg: int
    over_returned_mg: int
    actual_wastage_bp: int
    excess_loss_bp: int
    status: SettlementStatus


def settle(
    issued_fine_mg: int,
    finished_mg: int,
    scrap_mg: int,
    filings_mg: int,
    wastage_bp: int,
    job_open: bool,
) -> Settlement:
    """Calculate fine gold settlement for a job order without any floats.

    All maths uses integer arithmetic and half-up rounding.
    Zero floats, zero Decimal, zero true division.
    """
    _validate_weight(issued_fine_mg, "issued_fine_mg")
    _validate_weight(finished_mg, "finished_mg")
    _validate_weight(scrap_mg, "scrap_mg")
    _validate_weight(filings_mg, "filings_mg")
    _validate_wastage(wastage_bp, "wastage_bp")

    if type(job_open) is not bool:
        raise TypeError(f"job_open must be a bool, got {type(job_open).__name__}")

    returned_mg = finished_mg + scrap_mg + filings_mg
    outstanding_mg = issued_fine_mg - returned_mg
    allowed_mg = allowed_wastage_mg(issued_fine_mg, wastage_bp)
    excess_mg = max(0, outstanding_mg - allowed_mg)
    over_returned_mg = max(0, returned_mg - issued_fine_mg)

    # Half-up basis points calculations: (amount * 10000 + issued // 2) // issued
    if issued_fine_mg > 0 and outstanding_mg > 0:
        actual_wastage_bp = (outstanding_mg * 10000 + (issued_fine_mg // 2)) // issued_fine_mg
    else:
        actual_wastage_bp = 0

    if issued_fine_mg > 0 and excess_mg > 0:
        excess_loss_bp = (excess_mg * 10000 + (issued_fine_mg // 2)) // issued_fine_mg
    else:
        excess_loss_bp = 0

    if returned_mg > issued_fine_mg:
        status = SettlementStatus.OVER_RETURNED
    elif outstanding_mg <= allowed_mg:
        status = SettlementStatus.WITHIN_ALLOWANCE
    elif job_open:
        status = SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE
    else:
        status = SettlementStatus.LOSS_BEYOND_ALLOWANCE

    return Settlement(
        issued_fine_mg=issued_fine_mg,
        finished_mg=finished_mg,
        scrap_mg=scrap_mg,
        filings_mg=filings_mg,
        returned_mg=returned_mg,
        outstanding_mg=outstanding_mg,
        allowed_mg=allowed_mg,
        excess_mg=excess_mg,
        over_returned_mg=over_returned_mg,
        actual_wastage_bp=actual_wastage_bp,
        excess_loss_bp=excess_loss_bp,
        status=status,
    )
