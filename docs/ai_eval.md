# AI Vision Reader Evaluation Report

Evaluation of the precision scale and karatmeter OCR pipeline against synthetic sample images.

- **Vision Model**: `llama-3.2-11b-vision-preview`
- **Text Explanation Model**: `llama-3.3-70b-versatile`
- **Total Samples Evaluated**: 15

## Evaluation Results Table

| Image | Truth | Read | Confidence | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `scale_clear_1.jpg` | 112.450 g | None | 0% | **fallback** |
| `scale_clear_2.jpg` | 103.004 g | None | 0% | **fallback** |
| `scale_clear_3.jpg` | 3.023 g | None | 0% | **fallback** |
| `scale_clear_4.jpg` | 50.000 g | None | 0% | **fallback** |
| `scale_glare.jpg` | 112.450 g | None | 0% | **fallback** |
| `scale_dim.jpg` | 25.500 g | None | 0% | **fallback** |
| `scale_tilted.jpg` | 15.750 g | None | 0% | **fallback** |
| `scale_blurry.jpg` | 42.120 g | None | 0% | **fallback** |
| `scale_hard_decimal.jpg` | 10.005 g | None | 0% | **fallback** |
| `scale_partly_covered.jpg` | 112.450 g | None | 0% | **fallback** |
| `scale_wrong_unit.jpg` | 112.450 ct | None | 0% | **blocked** |
| `scale_unreadable.jpg` | N/A | None | 0% | **fallback** |
| `karat_9160.jpg` | 91.60 % | None | 0% | **fallback** |
| `karat_7500.jpg` | 75.00 % | None | 0% | **fallback** |
| `karat_9990.jpg` | 99.90 % | None | 0% | **fallback** |

## Summary Metrics

- **Correct Readings**: 0
- **Blocked (Safety/Validation Filters)**: 1
- **Fallback to Manual Entry**: 14
- **Wrong Readings**: 0

> [!NOTE]
> When `GROQ_API_KEY` is not supplied or the vision model is inaccessible, the pipeline strictly falls back to manual entry (`fallback: 'manual'`) without ever producing fake or hallucinated readings.
