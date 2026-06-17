import json

from app.models.schemas import GrammarMistake
from app.services.llm import get_llm


def analyze_errors(text: str) -> list[GrammarMistake]:
    """Analyze learner text by routing through the LLM abstraction layer."""
    llm = get_llm()
    prompt = (
        "You are an English grammar analyzer.\n"
        "The learner is a Chinese child. Return error_type and explanation in Simplified Chinese.\n"
        "Keep original and suggestion as English sentences.\n"
        "Return JSON only with this shape:\n"
        '{"mistakes":[{"original":"","suggestion":"","error_type":"","explanation":""}]}\n'
        f"Text: {text}"
    )
    raw = llm.generate(prompt)
    parsed = _safe_parse_json(raw)
    items = parsed.get("mistakes", [])
    mistakes: list[GrammarMistake] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        mistakes.append(
            GrammarMistake(
                original=str(item.get("original", text)),
                suggestion=str(item.get("suggestion", "")),
                error_type=str(item.get("error_type", "unknown")),
                explanation=str(item.get("explanation", "")),
            )
        )
    return mistakes


def _safe_parse_json(raw: str) -> dict:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"mistakes": []}
