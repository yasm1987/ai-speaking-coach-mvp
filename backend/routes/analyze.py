from fastapi import APIRouter

from backend.core.responses import success_response
from backend.models.schemas import ErrorAnalysisRequest
from backend.services.analysis_service import analyze_text_errors


router = APIRouter(prefix="/analyze", tags=["Analysis"])


@router.post("/error")
def analyze_error(payload: ErrorAnalysisRequest) -> dict:
    """Analyze a learner sentence and return grammar mistakes."""
    mistakes = analyze_text_errors(payload.text)
    return success_response({"mistakes": [item.model_dump() for item in mistakes]}, message="Error analysis completed.")
