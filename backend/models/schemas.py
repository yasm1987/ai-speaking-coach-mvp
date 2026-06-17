from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    status: str = "success"
    data: T
    message: str = ""


class RecognizeResponse(BaseModel):
    text: str


class SpeechScoreRequest(BaseModel):
    audio_url: str = Field(..., description="Audio file URL or storage key.")
    text: str = Field(..., description="Target text that the learner was expected to read.")


class SpeechScoreResponse(BaseModel):
    score: int
    fluency: int
    pronunciation: int
    feedback: str


class ChatHistoryItem(BaseModel):
    role: str = Field(..., description="Either 'user', 'assistant', or 'system'.")
    content: str


class TutorChatRequest(BaseModel):
    message: str
    history: list[ChatHistoryItem] = Field(default_factory=list)


class TutorChatResponse(BaseModel):
    reply: str


class GrammarMistake(BaseModel):
    original: str
    suggestion: str
    error_type: str
    explanation: str


class ErrorAnalysisRequest(BaseModel):
    text: str


class ErrorAnalysisResponse(BaseModel):
    mistakes: list[GrammarMistake]


class SessionEvent(BaseModel):
    event_type: str
    content: dict[str, Any] = Field(default_factory=dict)


class SessionData(BaseModel):
    session_type: str = Field(..., description="word, sentence, dialogue, review, or report")
    unit_id: str | None = None
    events: list[SessionEvent] = Field(default_factory=list)
    summary: str | None = None
    score: int | None = None


class LearningSaveRequest(BaseModel):
    user_id: str
    session_data: SessionData


class LearningSaveResponse(BaseModel):
    success: bool
    record_id: int


class ReportGenerateRequest(BaseModel):
    user_id: str
    session_data: SessionData | None = None


class ReportGenerateResponse(BaseModel):
    report: dict[str, Any]
