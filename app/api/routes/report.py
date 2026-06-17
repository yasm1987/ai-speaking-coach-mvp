from fastapi import APIRouter

from app.models.schemas import ApiEnvelope, ReportGenerateData, ReportGenerateRequest
from app.services.report import generate_report


router = APIRouter(prefix="/report", tags=["Report"])


@router.post("/generate", response_model=ApiEnvelope[ReportGenerateData])
def report_generate(payload: ReportGenerateRequest) -> ApiEnvelope[ReportGenerateData]:
    """Generate a study report using saved records plus optional session context."""
    report = generate_report(payload)
    return ApiEnvelope(data=ReportGenerateData(report=report), message="Study report generated.")
