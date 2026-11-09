"""AI service for drafting monthly karigar loss explanations."""

import re
from app.ai.provider import get_groq_client, has_groq_key
from app.core.config import settings

# Cause words and banned words that must NOT appear in output
CAUSE_WORDS = {"crucible", "porosity", "setting"}
BANNED_WORDS = {"theft", "stole", "suspicious", "fraud", "blame"}

_FORBIDDEN_PATTERN = re.compile(
    r"\b("
    r"crucible[s]?|"
    r"porosit(?:y|ies)|"
    r"setting[s]?|"
    r"theft[s]?|"
    r"stole[n]?|"
    r"suspicious|"
    r"fraud\w*|"
    r"blame\w*"
    r")\b",
    re.IGNORECASE,
)


def contains_forbidden_words(text: str) -> bool:
    """Check if the text contains cause words or banned words."""
    return bool(_FORBIDDEN_PATTERN.search(text))


def _fmt_bp(bp: int) -> str:
    """Format basis points to two decimal percentage string (e.g. 350 -> '3.50', 0 -> '0.00')."""
    sign = "-" if bp < 0 else ""
    abs_bp = abs(bp)
    return f"{sign}{abs_bp // 100}.{abs_bp % 100:02d}"


def build_explanation_prompt(
    karigar_name: str,
    karigar_code: str,
    recent_pct: str,
    baseline_pct: str,
    sample_size: int,
    diff_pct: str | None = None,
) -> str:
    """Build neutral audit explanation prompt containing only computed figures."""
    if diff_pct is None:
        try:
            diff_bp = int(round(float(recent_pct) * 100)) - int(round(float(baseline_pct) * 100))
            diff_pct = _fmt_bp(diff_bp)
        except Exception:
            diff_pct = "0.00"

    return (
        f"Write a concise, professional audit explanation (1-2 sentences) for jewellery workshop finance records. "
        f"Karigar: {karigar_name} ({karigar_code}). "
        f"Recent loss: {recent_pct}%. "
        f"Historical usual loss: {baseline_pct}%. "
        f"Difference: {diff_pct} percentage points. "
        f"Sample size: {sample_size} jobs. "
        f"State only the computed statistical figures comparing the recent loss to the baseline average. "
        f"Do not suggest or speculate on any causes (such as crucible, porosity, setting, theft, or any physical factors). "
        f"Do not use words assigning blame or making accusations."
    )


def render_explanation_template(
    karigar_name: str,
    karigar_code: str,
    recent_pct: str,
    baseline_pct: str,
    sample_size: int,
    diff_pct: str | None = None,
) -> str:
    """Render neutral fallback template using only computed figures.

    Format:
    Karigar {name} ({code}): recent loss {recent}% is {diff} percentage points above their usual {baseline}% across {n} closed jobs. Worth reviewing.
    """
    if diff_pct is None:
        try:
            diff_bp = int(round(float(recent_pct) * 100)) - int(round(float(baseline_pct) * 100))
            diff_pct = _fmt_bp(diff_bp)
        except Exception:
            diff_pct = "0.00"

    return (
        f"Karigar {karigar_name} ({karigar_code}): recent loss {recent_pct}% is "
        f"{diff_pct} percentage points above their usual {baseline_pct}% across {sample_size} closed jobs. "
        f"Worth reviewing."
    )


def generate_loss_explanation(
    karigar_name: str,
    karigar_code: str,
    recent_loss_bp: int,
    baseline_mean_bp: int,
    sample_size: int,
    additional_context: str | None = None,
) -> tuple[str, str]:
    """Generate professional audit explanation note citing exact loss metrics.

    The prompt receives only computed figures and does not suggest causes.
    If the LLM output contains any cause words or banned words, the neutral template is returned.
    Returns tuple of (explanation_text, source) where source is 'llm' or 'template'.
    """
    recent_pct = _fmt_bp(recent_loss_bp)
    baseline_pct = _fmt_bp(baseline_mean_bp)
    diff_pct = _fmt_bp(recent_loss_bp - baseline_mean_bp)

    client = get_groq_client()
    if client and has_groq_key() and settings.GROQ_TEXT_MODEL:
        prompt = build_explanation_prompt(
            karigar_name=karigar_name,
            karigar_code=karigar_code,
            recent_pct=recent_pct,
            baseline_pct=baseline_pct,
            diff_pct=diff_pct,
            sample_size=sample_size,
        )
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_TEXT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You write concise, objective jewellery workshop audit notes "
                            "stating only computed statistical figures without speculating on causes."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=200,
            )
            content = response.choices[0].message.content
            if content and content.strip():
                cleaned = content.strip()
                if not contains_forbidden_words(cleaned):
                    return cleaned, "llm"
        except Exception:
            pass

    # Neutral template fallback using only computed figures
    template = render_explanation_template(
        karigar_name=karigar_name,
        karigar_code=karigar_code,
        recent_pct=recent_pct,
        baseline_pct=baseline_pct,
        sample_size=sample_size,
        diff_pct=diff_pct,
    )
    return template, "template"
