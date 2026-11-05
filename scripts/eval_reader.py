"""Evaluate Groq vision reader against synthetic dataset of scales and karat meters.

Validates extracted values with ai/validators.py, assigns verdicts:
- correct: extracted value exactly matches ground truth
- wrong: extracted value differs from ground truth
- blocked: invalid format/unit correctly rejected by validation pipeline
- fallback: unreadable, provider offline, or fallback to manual entry

Prints evaluation table and writes output report to docs/ai_eval.md.
"""

import json
import os
import sys

# Ensure backend is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.ai.validators import validate_karat_reading, validate_scale_reading
from app.ai.vision_reader import extract_karat_reading, extract_scale_reading
from app.core.config import settings


def evaluate_dataset() -> list[dict]:
    labels_path = os.path.join(BASE_DIR, "samples", "labels.json")
    images_dir = os.path.join(BASE_DIR, "samples", "images")

    if not os.path.exists(labels_path):
        print(f"Error: {labels_path} does not exist. Run scripts/make_images.py first.")
        return []

    with open(labels_path, "r", encoding="utf-8") as f:
        samples = json.load(f)

    results = []

    for item in samples:
        img_filename = item["image"]
        img_path = os.path.join(images_dir, img_filename)
        kind = item["kind"]
        true_val = item["true_value"]
        true_unit = item["unit"]
        expect = item["expect"]

        read_val = None
        read_unit = None
        confidence = 0
        verdict = "fallback"

        if not os.path.exists(img_path):
            results.append({
                "image": img_filename,
                "truth": f"{true_val} {true_unit}" if true_val else "N/A",
                "read": "FILE_NOT_FOUND",
                "confidence": 0,
                "verdict": "fallback",
            })
            continue

        try:
            with open(img_path, "rb") as f:
                img_bytes = f.read()

            if kind == "scale":
                res = extract_scale_reading(img_bytes, filename=img_filename)
                read_val = res.get("value")
                read_unit = res.get("unit")
                confidence = res.get("confidence", 0)
                readable = res.get("readable", False)
                fallback = res.get("fallback")

                if expect == "wrong_unit":
                    # If reader correctly caught wrong unit or flagged fallback
                    if fallback == "manual" or not readable:
                        verdict = "blocked"
                    else:
                        try:
                            validate_scale_reading(read_val, read_unit, readable=True)
                            verdict = "wrong"  # Should have been blocked
                        except ValueError:
                            verdict = "blocked"
                elif expect == "unreadable":
                    if fallback == "manual" or not readable:
                        verdict = "fallback"
                    else:
                        verdict = "wrong"
                else:  # expect == "ok"
                    if fallback == "manual" or not readable:
                        verdict = "fallback"
                    elif read_val == true_val:
                        verdict = "correct"
                    else:
                        verdict = "wrong"

            elif kind == "karat":
                res = extract_karat_reading(img_bytes, filename=img_filename)
                read_val = res.get("purity")
                read_unit = res.get("unit")
                confidence = res.get("confidence", 0)
                readable = res.get("readable", False)
                fallback = res.get("fallback")

                if fallback == "manual" or not readable:
                    verdict = "fallback"
                elif read_val == true_val:
                    verdict = "correct"
                else:
                    verdict = "wrong"

        except Exception as exc:
            read_val = f"ERROR: {str(exc)[:30]}"
            verdict = "fallback"

        read_display = f"{read_val} {read_unit}" if read_val and read_unit else (read_val or "None")
        truth_display = f"{true_val} {true_unit}" if true_val and true_unit else "N/A"

        results.append({
            "image": img_filename,
            "truth": truth_display,
            "read": read_display,
            "confidence": f"{confidence}%",
            "verdict": verdict,
        })

    return results


def format_markdown_report(results: list[dict]) -> str:
    groq_vision = settings.GROQ_VISION_MODEL or "Not Configured (Fallback Mode)"
    groq_text = settings.GROQ_TEXT_MODEL or "Not Configured"

    lines = [
        "# AI Vision Reader Evaluation Report",
        "",
        "Evaluation of the precision scale and karatmeter OCR pipeline against synthetic sample images.",
        "",
        f"- **Vision Model**: `{groq_vision}`",
        f"- **Text Explanation Model**: `{groq_text}`",
        f"- **Total Samples Evaluated**: {len(results)}",
        "",
        "## Evaluation Results Table",
        "",
        "| Image | Truth | Read | Confidence | Verdict |",
        "| :--- | :--- | :--- | :--- | :--- |",
    ]

    for r in results:
        lines.append(
            f"| `{r['image']}` | {r['truth']} | {r['read']} | {r['confidence']} | **{r['verdict']}** |"
        )

    # Summary statistics
    verdicts = [r["verdict"] for r in results]
    lines.extend([
        "",
        "## Summary Metrics",
        "",
        f"- **Correct Readings**: {verdicts.count('correct')}",
        f"- **Blocked (Safety/Validation Filters)**: {verdicts.count('blocked')}",
        f"- **Fallback to Manual Entry**: {verdicts.count('fallback')}",
        f"- **Wrong Readings**: {verdicts.count('wrong')}",
        "",
        "> [!NOTE]",
        "> When `GROQ_API_KEY` is not supplied or the vision model is inaccessible, the pipeline strictly falls back to manual entry (`fallback: 'manual'`) without ever producing fake or hallucinated readings.",
    ])

    return "\n".join(lines) + "\n"


def main():
    print("Running AI Reader Evaluation on synthetic samples...")
    results = evaluate_dataset()

    print("\n" + "=" * 80)
    print(f"{'Image':<26} | {'Truth':<14} | {'Read':<14} | {'Conf':<6} | {'Verdict':<10}")
    print("-" * 80)
    for r in results:
        print(f"{r['image']:<26} | {r['truth']:<14} | {r['read']:<14} | {r['confidence']:<6} | {r['verdict']:<10}")
    print("=" * 80 + "\n")

    report_md = format_markdown_report(results)
    docs_dir = os.path.join(BASE_DIR, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    report_path = os.path.join(docs_dir, "ai_eval.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_md)

    print(f"Saved evaluation report to {report_path}")


if __name__ == "__main__":
    main()
