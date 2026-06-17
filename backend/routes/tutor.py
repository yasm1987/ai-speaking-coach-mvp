from fastapi import APIRouter

from backend.core.responses import success_response
from backend.models.schemas import TutorChatRequest
from backend.services.tutor_service import generate_tutor_reply


router = APIRouter(prefix="/tutor", tags=["Tutor"])


@router.post("/chat")
def chat(payload: TutorChatRequest) -> dict:
    """Return the AI teacher's next reply based on the learner message and history."""
    reply = generate_tutor_reply(payload)
    return success_response({"reply": reply}, message="Tutor reply generated.")
