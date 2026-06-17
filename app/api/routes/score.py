from fastapi import APIRouter

from app.models.schemas import ApiEnvelope, SpeechScoreData, SpeechScoreRequest
from app.services.scoring import score_speech_async


router = APIRouter(prefix="/speech", tags=["Speech"])


@router.post("/score", response_model=ApiEnvelope[SpeechScoreData])
async def speech_score(payload: SpeechScoreRequest) -> ApiEnvelope[SpeechScoreData]:
    """Score pronunciation and fluency for a learner speaking attempt."""
    result = await score_speech_async(payload)
    return ApiEnvelope(data=result, message="Speech scoring completed.")
