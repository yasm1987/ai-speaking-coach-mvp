from fastapi import APIRouter

from app.api.routes.analyze import router as analyze_router
from app.api.routes.asr import router as asr_router
from app.api.routes.chat import router as chat_router
from app.api.routes.record import router as record_router
from app.api.routes.report import router as report_router
from app.api.routes.score import router as score_router
from app.api.routes.system import router as system_router
from app.api.routes.tts import router as tts_router


api_router = APIRouter()
api_router.include_router(asr_router)
api_router.include_router(chat_router)
api_router.include_router(score_router)
api_router.include_router(tts_router)
api_router.include_router(analyze_router)
api_router.include_router(report_router)
api_router.include_router(record_router)
api_router.include_router(system_router)
