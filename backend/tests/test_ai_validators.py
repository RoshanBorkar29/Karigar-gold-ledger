"""Unit tests for AI photo upload limits and scale/karatmeter reading validators."""

import pytest
from app.ai.validators import (
    validate_karat_reading,
    validate_scale_reading,
    validate_upload_file,
)


def test_validate_upload_file_empty():
    with pytest.raises(ValueError, match="Uploaded file is empty"):
        validate_upload_file(b"", "image/jpeg")


def test_validate_upload_file_exceeds_5mb():
    big_data = b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024 + 1)
    with pytest.raises(ValueError, match="exceeds 5 MB limit"):
        validate_upload_file(big_data, "image/jpeg")


def test_validate_upload_file_invalid_content_type():
    with pytest.raises(ValueError, match="Unsupported content type"):
        validate_upload_file(b"some content", "application/pdf")


def test_validate_upload_file_invalid_magic_bytes():
    # Content-type says jpeg, but bytes are plain text
    with pytest.raises(ValueError, match="Invalid file signature"):
        validate_upload_file(b"This is not an image", "image/jpeg")


def test_validate_upload_file_valid_png():
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 20
    validate_upload_file(png_bytes, "image/png")


def test_validate_upload_file_valid_jpeg():
    jpeg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"\x00" * 20
    validate_upload_file(jpeg_bytes, "image/jpeg")


def test_validate_upload_file_valid_webp():
    webp_bytes = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 20
    validate_upload_file(webp_bytes, "image/webp")


def test_validate_scale_reading_unreadable():
    with pytest.raises(ValueError, match="unreadable"):
        validate_scale_reading("112.450", "g", readable=False)


def test_validate_scale_reading_invalid_unit_ct():
    with pytest.raises(ValueError, match="must be in grams"):
        validate_scale_reading("112.450", "ct", readable=True)


def test_validate_scale_reading_four_decimals():
    with pytest.raises(ValueError, match="exactly 3 decimal places"):
        validate_scale_reading("112.4500", "g", readable=True)


def test_validate_scale_reading_two_decimals():
    with pytest.raises(ValueError, match="exactly 3 decimal places"):
        validate_scale_reading("112.45", "g", readable=True)


def test_validate_scale_reading_zero_weight():
    with pytest.raises(ValueError, match="greater than 0 g"):
        validate_scale_reading("0.000", "g", readable=True)


def test_validate_scale_reading_exceeds_max_50000():
    with pytest.raises(ValueError, match="exceeds maximum capacity of 50000 g"):
        validate_scale_reading("50000.001", "g", readable=True)


def test_validate_scale_reading_valid():
    mg = validate_scale_reading("112.450", "g", readable=True)
    assert mg == 112450

    mg_small = validate_scale_reading("0.005", "g", readable=True)
    assert mg_small == 5


def test_validate_karat_reading_unreadable():
    with pytest.raises(ValueError, match="unreadable"):
        validate_karat_reading("91.60", "%", readable=False)


def test_validate_karat_reading_invalid_unit():
    with pytest.raises(ValueError, match="must be in percentage"):
        validate_karat_reading("91.60", "ct", readable=True)


def test_validate_karat_reading_three_decimals():
    with pytest.raises(ValueError, match="exactly 2 decimal places"):
        validate_karat_reading("91.600", "%", readable=True)


def test_validate_karat_reading_below_minimum():
    with pytest.raises(ValueError, match="within 1.00% to 100.00%"):
        validate_karat_reading("0.90", "%", readable=True)


def test_validate_karat_reading_above_100():
    with pytest.raises(ValueError, match="within 1.00% to 100.00%"):
        validate_karat_reading("100.01", "%", readable=True)


def test_validate_karat_reading_valid():
    bp = validate_karat_reading("91.60", "%", readable=True)
    assert bp == 9160

    bp_pure = validate_karat_reading("100.00", "%", readable=True)
    assert bp_pure == 10000
