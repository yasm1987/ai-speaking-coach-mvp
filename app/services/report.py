import json

from app.models.schemas import ReportGenerateRequest, StudyReport
from app.services.llm import get_llm
from app.services.record import fetch_learning_records


FALLBACK_SUMMARY = "\u5b66\u751f\u5df2\u5b8c\u6210\u672c\u8f6e\u53e3\u8bed\u7ec3\u4e60\uff0c\u62a5\u544a\u6682\u65f6\u4f7f\u7528\u672c\u5730\u6458\u8981\u3002"
FALLBACK_PARENT_COMMENT = (
    "\u5efa\u8bae\u7ee7\u7eed\u4fdd\u6301\u7a33\u5b9a\u7684\u53e3\u8bed\u7ec3\u4e60\u9891\u7387\uff0c"
    "\u5e76\u91cd\u70b9\u590d\u7ec3\u9519\u53e5\u672c\u4e2d\u7684\u8868\u8fbe\u3002"
)


def generate_report(payload: ReportGenerateRequest) -> StudyReport:
    """Build a specific study report via the LLM abstraction layer."""
    llm = get_llm()
    saved_records = fetch_learning_records(payload.user_id)
    current_session_json = payload.session_data.model_dump_json() if payload.session_data else "null"
    prompt = (
        "Generate a short Simplified Chinese study report for a child English speaking lesson.\n"
        "Use only the facts in session_data. Do not invent accuracy rate or percentages.\n"
        "Mention exact task count, mastered errors, and remaining review errors if present.\n"
        "For strengths and next_steps, cite concrete words/sentences from session_data, not generic advice.\n"
        "English examples stay in English. Return valid JSON only, no markdown:\n"
        '{"summary":"","strengths":[],"next_steps":[],"parent_comment":""}\n'
        f"user_id: {payload.user_id}\n"
        f"records: {len(saved_records)}\n"
        f"session_data: {current_session_json}"
    )
    raw = llm.generate(prompt)
    parsed = _safe_parse_json(raw)
    return StudyReport(
        user_id=payload.user_id,
        summary=str(parsed.get("summary") or FALLBACK_SUMMARY),
        strengths=[str(item) for item in parsed.get("strengths", [])],
        next_steps=[str(item) for item in parsed.get("next_steps", [])],
        parent_comment=str(parsed.get("parent_comment") or FALLBACK_PARENT_COMMENT),
        related_session_count=len(saved_records),
    )


def _safe_parse_json(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start : end + 1])
            except json.JSONDecodeError:
                pass

    return {
        "summary": FALLBACK_SUMMARY,
        "strengths": [],
        "next_steps": [],
        "parent_comment": FALLBACK_PARENT_COMMENT,
    }
