from fastapi import APIRouter, File, UploadFile

from backend.core.responses import success_response
from backend.services.asr_service import recognize_audio


router = APIRouter(prefix="/asr", tags=["ASR"])


@router.post("/recognize")
async def recognize(file: UploadFile = File(...)) -> dict:
    """Recognize learner speech from an uploaded audio file."""
    text = await recognize_audio(file)
    return success_response({"text": text}, message="ASR recognition completed.")
