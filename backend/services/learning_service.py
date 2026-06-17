from backend.core.database import insert_learning_session, list_learning_sessions
from backend.models.schemas import LearningSaveRequest


def save_learning_session(payload: LearningSaveRequest) -> int:
    return insert_learning_session(
        user_id=payload.user_id,
        session_type=payload.session_data.session_type,
        payload=payload.session_data.model_dump(),
    )


def get_user_sessions(user_id: str) -> list[dict]:
    return list_learning_sessions(user_id)
