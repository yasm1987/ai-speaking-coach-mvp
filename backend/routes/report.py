from fastapi import APIRouter

from backend.core.responses import success_response
from backend.models.schemas import ReportGenerateRequest
from backend.services.report_service import generate_learning_report


router = APIRouter(prefix="/report", tags=["Report"])


@router.post("/generate")
def generate(payload: ReportGenerateRequest) -> dict:
    """Generate a learner-facing study report from saved sessions and current session data."""
    report = generate_learning_report(payload)
    return success_response({"report": report}, message="Study report generated.")
