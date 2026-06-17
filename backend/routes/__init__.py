from fastapi import APIRouter

from backend.routes.analyze import router as analyze_router
from backend.routes.asr import router as asr_router
from backend.routes.learning import router as learning_router
from backend.routes.report import router as report_router
from backend.routes.speech import router as speech_router
from backend.routes.tutor import router as tutor_router


api_router = APIRouter()
api_router.include_router(asr_router)
api_router.include_router(speech_router)
api_router.include_router(tutor_router)
api_router.include_router(analyze_router)
api_router.include_router(report_router)
api_router.include_router(learning_router)
