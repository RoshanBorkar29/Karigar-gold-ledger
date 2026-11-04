"""Pure settlement mathematics for karigar jobs."""

from dataclasses import dataclass
from enum import Enum


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
    """Calculate fine gold settlement for a job order without any floats."""
    raise NotImplementedError("Stub for TDD")
