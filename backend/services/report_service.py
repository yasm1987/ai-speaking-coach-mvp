from backend.models.schemas import ReportGenerateRequest
from backend.services.learning_service import get_user_sessions


def generate_learning_report(payload: ReportGenerateRequest) -> dict:
    # MVP mock report builder. Later this can call GPT with richer session context.
    sessions = get_user_sessions(payload.user_id)
    latest_session_type = payload.session_data.session_type if payload.session_data else None
    completed_count = len(sessions) + (1 if payload.session_data else 0)

    return {
        "user_id": payload.user_id,
        "latest_session_type": latest_session_type,
        "completed_sessions": completed_count,
        "summary": "学生已完成本轮口语练习，能够围绕 Food 主题进行基本表达。",
        "strengths": ["能理解常见食物话题", "能完成基础问答", "愿意重复修正表达"],
        "next_steps": ["继续加强 milk 和 sandwich 的发音稳定性", "复练复数和否定句结构"],
        "parent_comment": "建议继续保持每天 5-8 分钟的口语练习频率。",
    }
