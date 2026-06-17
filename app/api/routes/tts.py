from fastapi import APIRouter, HTTPException

from app.models.schemas import ApiEnvelope, TTSSynthesizeData, TTSSynthesizeRequest
from app.services.tts import synthesize_speech


router = APIRouter(prefix="/tts", tags=["TTS"])


@router.post("/synthesize", response_model=ApiEnvelope[TTSSynthesizeData])
async def synthesize(request: TTSSynthesizeRequest) -> ApiEnvelope[TTSSynthesizeData]:
    """Convert AI teacher text into speech through the configured TTS provider."""
    try:
        result = await synthesize_speech(
            text=request.text,
            voice_type=request.voice_type,
            speed_ratio=request.speed_ratio,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS unexpected error: {exc}") from exc

    return ApiEnvelope(data=TTSSynthesizeData(**result), message="TTS synthesis completed.")
