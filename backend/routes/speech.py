from fastapi import APIRouter

from backend.core.responses import success_response
from backend.models.schemas import SpeechScoreRequest
from backend.services.speech_service import score_speech


router = APIRouter(prefix="/speech", tags=["Speech"])


@router.post("/score")
def score(payload: SpeechScoreRequest) -> dict:
    """Score learner pronunciation, fluency, and overall speaking quality."""
    result = score_speech(payload)
    return success_response(result.model_dump(), message="Speech scoring completed.")
