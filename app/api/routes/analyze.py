from fastapi import APIRouter

from app.models.schemas import ApiEnvelope, ErrorAnalysisData, ErrorAnalysisRequest
from app.services.analyzer import analyze_errors


router = APIRouter(prefix="/analyze", tags=["Analysis"])


@router.post("/error", response_model=ApiEnvelope[ErrorAnalysisData])
def analyze_error(payload: ErrorAnalysisRequest) -> ApiEnvelope[ErrorAnalysisData]:
    """Analyze learner text and return grammar mistake candidates."""
    mistakes = analyze_errors(payload.text)
    return ApiEnvelope(data=ErrorAnalysisData(mistakes=mistakes), message="Error analysis completed.")
