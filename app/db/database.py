from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core import get_settings


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "app_data"
DATABASE_FILE = DATA_DIR / "ai_tutor_mvp.db"
settings = get_settings()
DATABASE_URL = settings.database_url or f"sqlite:///{DATABASE_FILE.as_posix()}"


class Base(DeclarativeBase):
    pass


connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    from app.db.models import LearningRecord

    if DATABASE_URL.startswith("sqlite"):
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
