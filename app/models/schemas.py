from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field


T = TypeVar("T")


class ApiEnvelope(BaseModel, Generic[T]):
    status: str = "success"
    data: T
    message: str = ""


class RecognizeData(BaseModel):
    text: str


class HistoryItem(BaseModel):
    role: str
    content: str


class TutorChatRequest(BaseModel):
    message: str
    history: list[HistoryItem] = Field(default_factory=list)
    level: str = "beginner"


class TutorChatData(BaseModel):
    reply: str


class SpeechScoreRequest(BaseModel):
    audio_url: str = ""
    text: str
    audio_base64: str | None = None
    audio_format: str | None = None


class SpeechScoreData(BaseModel):
    score: int
    fluency: int
    pronunciation: int
    feedback: str
    completeness: int | None = None
    provider: str = "mock"


class TTSSynthesizeRequest(BaseModel):
    text: str
    voice_type: str | None = None
    speed_ratio: float | None = None


class TTSSynthesizeData(BaseModel):
    audio_base64: str
    audio_format: str
    provider: str
    voice_type: str
    text: str


class GrammarMistake(BaseModel):
    original: str
    suggestion: str
    error_type: str
    explanation: str


class ErrorAnalysisRequest(BaseModel):
    text: str


class ErrorAnalysisData(BaseModel):
    mistakes: list[GrammarMistake]


class SessionEvent(BaseModel):
    event_type: str
    content: dict[str, Any] = Field(default_factory=dict)


class SessionData(BaseModel):
    session_type: str
    unit_id: str | None = None
    summary: str | None = None
    score: int | None = None
    events: list[SessionEvent] = Field(default_factory=list)


class ReportGenerateRequest(BaseModel):
    user_id: str
    session_data: SessionData | None = None


class StudyReport(BaseModel):
    user_id: str
    summary: str
    strengths: list[str]
    next_steps: list[str]
    parent_comment: str
    related_session_count: int


class ReportGenerateData(BaseModel):
    report: StudyReport


class LearningSaveRequest(BaseModel):
    user_id: str
    session_data: SessionData


class LearningSaveData(BaseModel):
    success: bool
    record_id: int


class ProviderStatusData(BaseModel):
    app_env: str
    llm_provider: str
    asr_provider: str
    tts_provider: str
    speech_score_provider: str
    use_mock_fallback: bool
