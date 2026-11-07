"""Vision OCR extraction services for digital scales and karat meter displays."""

import base64
import json
import re
from typing import Any

from app.ai.provider import get_groq_client, has_groq_key, has_groq_vision_model
from app.ai.validators import validate_karat_reading, validate_scale_reading
from app.core.config import settings


def _call_groq_vision(image_bytes: bytes, prompt: str) -> dict[str, Any] | None:
    """Call Groq vision model with base64 encoded image."""
    client = get_groq_client()
    if not (client and has_groq_vision_model()):
        return None

    b64_image = base64.b64encode(image_bytes).decode("utf-8")
    data_uri = f"data:image/jpeg;base64,{b64_image}"

    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_VISION_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": data_uri}},
                    ],
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
            timeout=15.0,
        )
        content = completion.choices[0].message.content
        if content:
            return json.loads(content)
    except Exception:
        return None
    return None


def extract_scale_reading(image_bytes: bytes, filename: str = "scale.jpg") -> dict[str, Any]:
    """Extract weight, unit, confidence, and readability from scale display.

    Strictly calls the vision model. When Groq is unavailable, missing a key,
    times out, or returns bad data, returns {readable: False, fallback: 'manual'}.
    Never produces fake or synthetic readings.
    """
    model_name = settings.GROQ_VISION_MODEL or "none"
    if not (has_groq_key() and has_groq_vision_model()):
        return {
            "value": None,
            "unit": None,
            "confidence": 0,
            "readable": False,
            "fallback": "manual",
            "model_name": model_name,
        }

    prompt = (
        "You are an expert OCR system for precision jewellery scales. "
        "Extract the displayed numeric weight reading and unit. "
        "Preserve all 3 decimal places exactly as a string (e.g. '112.450'). "
        "Respond ONLY with a JSON object containing:\n"
        "- 'value': string with the number with 3 decimals (e.g. '112.450' or '42.120')\n"
        "- 'unit': string ('g')\n"
        "- 'confidence': integer between 0 and 100\n"
        "- 'readable': boolean true if the digits are clearly legible, false otherwise"
    )

    res = _call_groq_vision(image_bytes, prompt)
    if res and isinstance(res, dict) and res.get("readable") is True and "value" in res:
        try:
            val_raw = res.get("value")
            if val_raw is not None:
                val_str = str(val_raw).strip()
                if re.match(r"^\d+\.\d{1,2}$", val_str):
                    val_str = f"{float(val_str):.3f}"
                elif re.match(r"^\d+$", val_str):
                    val_str = f"{int(val_str)}.000"
            else:
                val_str = ""
            unit_str = str(res.get("unit", "g")).strip().lower()
            validate_scale_reading(val_str, unit_str, readable=True)
            conf_raw = res.get("confidence", 90)
            if isinstance(conf_raw, (int, float)) and 0 < conf_raw <= 1.0:
                conf = int(conf_raw * 100)
            else:
                conf = int(conf_raw) if conf_raw else 90
            return {
                "value": val_str,
                "unit": unit_str,
                "confidence": conf,
                "readable": True,
                "fallback": None,
                "model_name": model_name,
            }
        except Exception:
            pass

    return {
        "value": None,
        "unit": None,
        "confidence": 0,
        "readable": False,
        "fallback": "manual",
        "model_name": model_name,
    }


def extract_karat_reading(image_bytes: bytes, filename: str = "karat.jpg") -> dict[str, Any]:
    """Extract gold purity percentage, confidence, and readability from karat meter screen.

    Strictly calls the vision model. When Groq is unavailable, missing a key,
    times out, or returns bad data, returns {readable: False, fallback: 'manual'}.
    Never produces fake or synthetic readings.
    """
    model_name = settings.GROQ_VISION_MODEL or "none"
    if not (has_groq_key() and has_groq_vision_model()):
        return {
            "purity": None,
            "unit": None,
            "confidence": 0,
            "readable": False,
            "fallback": "manual",
            "model_name": model_name,
        }

    prompt = (
        "You are an OCR system for gold karat meters and XRF instruments. "
        "Extract the detected gold purity percentage. "
        "Preserve 2 decimal places as a string (e.g. '91.60' or '75.00'). "
        "Respond ONLY with a JSON object containing:\n"
        "- 'purity': string with percentage (e.g. '91.60' or '75.00')\n"
        "- 'unit': string ('%')\n"
        "- 'confidence': integer between 0 and 100\n"
        "- 'readable': boolean true if legible, false otherwise"
    )

    res = _call_groq_vision(image_bytes, prompt)
    if res and isinstance(res, dict) and res.get("readable") is True and "purity" in res:
        try:
            val_raw = res.get("purity")
            if val_raw is not None:
                purity_str = str(val_raw).strip()
                if re.match(r"^\d+\.\d{1}$", purity_str):
                    purity_str = f"{float(purity_str):.2f}"
                elif re.match(r"^\d+$", purity_str):
                    purity_str = f"{int(purity_str)}.00"
            else:
                purity_str = ""
            unit_str = str(res.get("unit", "%")).strip()
            validate_karat_reading(purity_str, unit_str, readable=True)
            conf_raw = res.get("confidence", 90)
            if isinstance(conf_raw, (int, float)) and 0 < conf_raw <= 1.0:
                conf = int(conf_raw * 100)
            else:
                conf = int(conf_raw) if conf_raw else 90
            return {
                "purity": purity_str,
                "unit": unit_str,
                "confidence": conf,
                "readable": True,
                "fallback": None,
                "model_name": model_name,
            }
        except Exception:
            pass

    return {
        "purity": None,
        "unit": None,
        "confidence": 0,
        "readable": False,
        "fallback": "manual",
        "model_name": model_name,
    }
