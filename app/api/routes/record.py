from fastapi import APIRouter

from app.models.schemas import ApiEnvelope, LearningSaveData, LearningSaveRequest
from app.services.record import save_learning_record


router = APIRouter(prefix="/learning", tags=["Learning"])


@router.post("/save", response_model=ApiEnvelope[LearningSaveData])
def learning_save(payload: LearningSaveRequest) -> ApiEnvelope[LearningSaveData]:
    """Persist one learner study session into SQLite."""
    record_id = save_learning_record(payload)
    return ApiEnvelope(
        data=LearningSaveData(success=True, record_id=record_id),
        message="Learning session saved.",
    )
