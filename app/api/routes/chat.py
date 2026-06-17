from fastapi import APIRouter

from app.models.schemas import ApiEnvelope, TutorChatData, TutorChatRequest
from app.services.llm import get_llm


router = APIRouter(prefix="/tutor", tags=["Tutor"])


@router.post("/chat", response_model=ApiEnvelope[TutorChatData])
def tutor_chat(payload: TutorChatRequest) -> ApiEnvelope[TutorChatData]:
    """Generate an AI teacher reply using the configured LLM abstraction."""
    llm = get_llm()
    prompt = build_chat_prompt(payload)
    reply = llm.generate(prompt)
    return ApiEnvelope(data=TutorChatData(reply=reply), message="Tutor reply generated.")


def build_chat_prompt(payload: TutorChatRequest) -> str:
    history_lines = [f"{item.role}: {item.content}" for item in payload.history]
    history_text = "\n".join(history_lines) if history_lines else "No prior history."
    return (
        "You are an AI English speaking tutor for Chinese children.\n"
        f"Student level: {payload.level}\n"
        "Conversation history:\n"
        f"{history_text}\n"
        "Student message:\n"
        f"{payload.message}\n"
        "This is a live speaking-practice dialogue. Reply in simple English only.\n"
        "Keep the reply warm, short, and suitable for a young learner.\n"
        "If the answer is good, briefly praise it and ask one short follow-up question.\n"
        "If there is an error, give a very short model sentence in English and ask the student to try again."
    )
