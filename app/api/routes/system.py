from fastapi import APIRouter

from app.core import get_settings
from app.models.schemas import ApiEnvelope, ProviderStatusData


router = APIRouter(prefix="/system", tags=["System"])


@router.get("/providers", response_model=ApiEnvelope[ProviderStatusData])
def provider_status() -> ApiEnvelope[ProviderStatusData]:
    """Expose the currently configured provider stack for debugging and deployment checks."""
    settings = get_settings()
    return ApiEnvelope(
        data=ProviderStatusData(
            app_env=settings.app_env,
            llm_provider=settings.llm_provider,
            asr_provider=settings.asr_provider,
            tts_provider=settings.tts_provider,
            speech_score_provider=settings.speech_score_provider,
            use_mock_fallback=settings.use_mock_fallback,
        ),
        message="Provider status loaded.",
    )
