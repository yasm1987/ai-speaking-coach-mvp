from fastapi import APIRouter

from backend.core.responses import success_response
from backend.models.schemas import LearningSaveRequest
from backend.services.learning_service import save_learning_session


router = APIRouter(prefix="/learning", tags=["Learning"])


@router.post("/save")
def save(payload: LearningSaveRequest) -> dict:
    """Persist one learning session into the local SQLite database."""
    record_id = save_learning_session(payload)
    return success_response({"success": True, "record_id": record_id}, message="Learning session saved.")
