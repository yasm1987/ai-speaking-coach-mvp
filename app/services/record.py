from app.db.database import SessionLocal
from app.db.models import LearningRecord
from app.models.schemas import LearningSaveRequest


def save_learning_record(payload: LearningSaveRequest) -> int:
    """Persist a learning record to SQLite via SQLAlchemy."""
    with SessionLocal() as session:
        record = LearningRecord(
            user_id=payload.user_id,
            session_type=payload.session_data.session_type,
            session_payload=payload.session_data.model_dump(),
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return int(record.id)


def fetch_learning_records(user_id: str) -> list[LearningRecord]:
    """Load all saved learning records for report generation."""
    with SessionLocal() as session:
        return (
            session.query(LearningRecord)
            .filter(LearningRecord.user_id == user_id)
            .order_by(LearningRecord.id.desc())
            .all()
        )
