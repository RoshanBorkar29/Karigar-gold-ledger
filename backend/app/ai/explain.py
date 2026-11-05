"""AI service for drafting monthly karigar loss explanations."""

from app.ai.provider import get_groq_client, has_groq_key
from app.core.config import settings


def _fmt_bp(bp: int) -> str:
    """Format basis points to two decimal percentage string (e.g. 350 -> '3.50', 0 -> '0.00')."""
    sign = "-" if bp < 0 else ""
    abs_bp = abs(bp)
    return f"{sign}{abs_bp // 100}.{abs_bp % 100:02d}"


def generate_loss_explanation(
    karigar_name: str,
    karigar_code: str,
    recent_loss_bp: int,
    baseline_mean_bp: int,
    sample_size: int,
    additional_context: str | None = None,
) -> tuple[str, str]:
    """Generate professional audit explanation note citing exact loss metrics.

    Returns tuple of (explanation_text, source) where source is 'llm' or 'template'.
    """
    recent_pct = _fmt_bp(recent_loss_bp)
    baseline_pct = _fmt_bp(baseline_mean_bp)

    client = get_groq_client()
    if client and has_groq_key():
        prompt = (
            f"You are a master goldsmith and jewellery workshop auditor in Coimbatore, India. "
            f"Write a concise, professional audit explanation (2-3 sentences) for finance records. "
            f"Artisan {karigar_name} ({karigar_code}) has incurred a recent excess loss of {recent_pct}% "
            f"against a historical baseline average of {baseline_pct}% over {sample_size} jobs. "
            f"Cite the numbers accurately ({recent_pct}% vs {baseline_pct}%). "
            f"Mention plausible workshop craftsmanship causes (such as crucible wear, filigree setting difficulty, "
            f"or fine filing recovery in progress). "
            f"Additional context: {additional_context or 'None provided.'}"
        )
        try:
            response = client.chat.completions.create(
                model=settings.GROQ_TEXT_MODEL,
                messages=[
                    {"role": "system", "content": "You write concise, analytical jewellery workshop audit notes."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.3,
                max_tokens=250,
            )
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip(), "llm"
        except Exception:
            pass

    # Template fallback
    template = (
        f"Artisan {karigar_name} ({karigar_code}) recorded recent excess loss of {recent_pct}% "
        f"exceeding baseline historical average of {baseline_pct}% over {sample_size} jobs. "
        f"Workshop inspection recommended to verify crucible wear, filing collection trays, "
        f"and item structural intricacy."
    )
    if additional_context:
        template += f" Note: {additional_context.strip()}"

    return template, "template"
