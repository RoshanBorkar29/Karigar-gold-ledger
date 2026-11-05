"""Tests for pure settlement mathematics in backend/app/services/settlement.py."""

import pytest
from app.services.settlement import Settlement, SettlementStatus, settle


def test_settle_sample_data_job_open():
    """Sample calculation from brief with open job."""
    res = settle(
        issued_fine_mg=109920,
        finished_mg=103004,
        scrap_mg=3023,
        filings_mg=0,
        wastage_bp=300,
        job_open=True,
    )
    assert res.issued_fine_mg == 109920
    assert res.finished_mg == 103004
    assert res.scrap_mg == 3023
    assert res.filings_mg == 0
    assert res.returned_mg == 106027
    assert res.outstanding_mg == 3893
    assert res.allowed_mg == 3298
    assert res.excess_mg == 595
    assert res.over_returned_mg == 0
    assert res.actual_wastage_bp == 354
    assert res.excess_loss_bp == 54
    assert res.status == SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE
    assert res.status == "outstanding_beyond_allowance"


def test_settle_sample_data_job_closed():
    """Sample calculation from brief with closed job flips status to loss."""
    res = settle(
        issued_fine_mg=109920,
        finished_mg=103004,
        scrap_mg=3023,
        filings_mg=0,
        wastage_bp=300,
        job_open=False,
    )
    assert res.issued_fine_mg == 109920
    assert res.finished_mg == 103004
    assert res.scrap_mg == 3023
    assert res.filings_mg == 0
    assert res.returned_mg == 106027
    assert res.outstanding_mg == 3893
    assert res.allowed_mg == 3298
    assert res.excess_mg == 595
    assert res.over_returned_mg == 0
    assert res.actual_wastage_bp == 354
    assert res.excess_loss_bp == 54
    assert res.status == SettlementStatus.LOSS_BEYOND_ALLOWANCE
    assert res.status == "loss_beyond_allowance"


def test_settle_boundary_exact_allowance():
    """Boundary: outstanding exactly equal to allowed is within_allowance."""
    # issued 100000 @ 300 bp -> allowed 3000 mg.
    # returned 97000 mg -> outstanding 3000 mg == allowed 3000 mg.
    res_open = settle(100000, 97000, 0, 0, 300, job_open=True)
    assert res_open.returned_mg == 97000
    assert res_open.outstanding_mg == 3000
    assert res_open.allowed_mg == 3000
    assert res_open.excess_mg == 0
    assert res_open.status == SettlementStatus.WITHIN_ALLOWANCE

    res_closed = settle(100000, 97000, 0, 0, 300, job_open=False)
    assert res_closed.status == SettlementStatus.WITHIN_ALLOWANCE


def test_settle_boundary_one_mg_over_allowance():
    """Boundary: 1 mg more outstanding flips status beyond allowance."""
    # issued 100000 @ 300 bp -> allowed 3000 mg.
    # returned 96999 mg -> outstanding 3001 mg > allowed 3000 mg (excess 1 mg).
    res_open = settle(100000, 96999, 0, 0, 300, job_open=True)
    assert res_open.outstanding_mg == 3001
    assert res_open.allowed_mg == 3000
    assert res_open.excess_mg == 1
    assert res_open.status == SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE

    res_closed = settle(100000, 96999, 0, 0, 300, job_open=False)
    assert res_closed.status == SettlementStatus.LOSS_BEYOND_ALLOWANCE


def test_settle_everything_returned():
    """Everything returned: outstanding 0, excess 0, status within_allowance."""
    res = settle(100000, 100000, 0, 0, 300, job_open=True)
    assert res.returned_mg == 100000
    assert res.outstanding_mg == 0
    assert res.allowed_mg == 3000
    assert res.excess_mg == 0
    assert res.over_returned_mg == 0
    assert res.actual_wastage_bp == 0
    assert res.excess_loss_bp == 0
    assert res.status == SettlementStatus.WITHIN_ALLOWANCE


def test_settle_nothing_returned_yet():
    """Nothing returned yet: outstanding == issued, excess == issued - allowed."""
    res = settle(100000, 0, 0, 0, 300, job_open=True)
    assert res.returned_mg == 0
    assert res.outstanding_mg == 100000
    assert res.allowed_mg == 3000
    assert res.excess_mg == 97000
    assert res.over_returned_mg == 0
    assert res.actual_wastage_bp == 10000
    assert res.excess_loss_bp == 9700
    assert res.status == SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE


def test_settle_zero_issued():
    """Zero issued fine gold handles division by zero safely."""
    res = settle(0, 0, 0, 0, 300, job_open=True)
    assert res.returned_mg == 0
    assert res.outstanding_mg == 0
    assert res.allowed_mg == 0
    assert res.excess_mg == 0
    assert res.over_returned_mg == 0
    assert res.actual_wastage_bp == 0
    assert res.excess_loss_bp == 0
    assert res.status == SettlementStatus.WITHIN_ALLOWANCE


def test_settle_over_returned():
    """Returned exceeds issued fine gold."""
    res = settle(100000, 105000, 0, 0, 300, job_open=True)
    assert res.returned_mg == 105000
    assert res.outstanding_mg == -5000
    assert res.allowed_mg == 3000
    assert res.excess_mg == 0
    assert res.over_returned_mg == 5000
    assert res.actual_wastage_bp == 0
    assert res.excess_loss_bp == 0
    assert res.status == SettlementStatus.OVER_RETURNED


def test_settle_wastage_bp_extremes():
    """Test 0 bp and 10000 bp (100%) wastage rates."""
    # 0 bp wastage -> allowed 0 mg
    res_zero = settle(100000, 99000, 0, 0, 0, job_open=True)
    assert res_zero.allowed_mg == 0
    assert res_zero.excess_mg == 1000
    assert res_zero.status == SettlementStatus.OUTSTANDING_BEYOND_ALLOWANCE

    # 10000 bp wastage -> allowed 100000 mg
    res_full = settle(100000, 0, 0, 0, 10000, job_open=True)
    assert res_full.allowed_mg == 100000
    assert res_full.excess_mg == 0
    assert res_full.status == SettlementStatus.WITHIN_ALLOWANCE


@pytest.mark.parametrize("bad_val", [-1, -100])
def test_settle_rejects_negative_weights(bad_val):
    with pytest.raises(ValueError):
        settle(bad_val, 0, 0, 0, 300, True)
    with pytest.raises(ValueError):
        settle(100, bad_val, 0, 0, 300, True)
    with pytest.raises(ValueError):
        settle(100, 0, bad_val, 0, 300, True)
    with pytest.raises(ValueError):
        settle(100, 0, 0, bad_val, 300, True)


@pytest.mark.parametrize("bad_bp", [-1, 10001])
def test_settle_rejects_out_of_range_wastage(bad_bp):
    with pytest.raises(ValueError):
        settle(100, 0, 0, 0, bad_bp, True)


@pytest.mark.parametrize("wrong_type", [1.5, "100", None, True, False])
def test_settle_rejects_wrong_type_numbers(wrong_type):
    with pytest.raises(TypeError):
        settle(wrong_type, 0, 0, 0, 300, True)
    with pytest.raises(TypeError):
        settle(100, wrong_type, 0, 0, 300, True)
    with pytest.raises(TypeError):
        settle(100, 0, wrong_type, 0, 300, True)
    with pytest.raises(TypeError):
        settle(100, 0, 0, wrong_type, 300, True)
    with pytest.raises(TypeError):
        settle(100, 0, 0, 0, wrong_type, True)


@pytest.mark.parametrize("wrong_bool", [1, 0, "true", None, 1.0])
def test_settle_rejects_non_bool_job_open(wrong_bool):
    with pytest.raises(TypeError):
        settle(100, 0, 0, 0, 300, wrong_bool)

