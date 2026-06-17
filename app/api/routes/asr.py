from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models.schemas import ApiEnvelope, RecognizeData
from app.services.asr import recognize_audio_file


router = APIRouter(prefix="/asr", tags=["ASR"])


@router.post("/recognize", response_model=ApiEnvelope[RecognizeData])
async def recognize(file: UploadFile = File(...)) -> ApiEnvelope[RecognizeData]:
    """Recognize learner speech from an uploaded audio file."""
    try:
        text = await recognize_audio_file(file)
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"ASR unexpected error: {exc}") from exc
    return ApiEnvelope(data=RecognizeData(text=text), message="ASR recognition completed.")
