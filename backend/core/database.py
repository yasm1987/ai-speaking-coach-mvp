import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator

from backend.core.config import DB_PATH, ensure_data_dir


def init_db() -> None:
    ensure_data_dir()
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS learning_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                session_type TEXT,
                payload_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    ensure_data_dir()
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def insert_learning_session(user_id: str, session_type: str | None, payload: dict[str, Any]) -> int:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO learning_sessions (user_id, session_type, payload_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, session_type, json.dumps(payload, ensure_ascii=False), created_at),
        )
        return int(cursor.lastrowid)


def list_learning_sessions(user_id: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, user_id, session_type, payload_json, created_at
            FROM learning_sessions
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()

    sessions: list[dict[str, Any]] = []
    for row in rows:
        sessions.append(
            {
                "id": row["id"],
                "user_id": row["user_id"],
                "session_type": row["session_type"],
                "payload": json.loads(row["payload_json"]),
                "created_at": row["created_at"],
            }
        )
    return sessions
