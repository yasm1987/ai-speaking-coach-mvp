from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


load_dotenv()


def _split_csv(value: str | None, default: list[str]) -> list[str]:
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_version: str
    app_env: str
    host: str
    port: int
    database_url: str
    cors_origins: list[str]
    llm_provider: str
    asr_provider: str
    tts_provider: str
    speech_score_provider: str
    use_mock_fallback: bool
    qwen_api_key: str
    qwen_base_url: str
    qwen_model: str
    glm_api_key: str
    glm_base_url: str
    glm_model: str
    tencent_asr_app_id: str
    tencent_asr_secret_id: str
    tencent_asr_secret_key: str
    tencent_asr_region: str
    tencent_asr_endpoint: str
    tencent_asr_engine_model_type: str
    tencent_asr_poll_interval_ms: int
    tencent_asr_timeout_seconds: int
    tencent_soe_region: str
    tencent_soe_endpoint: str
    tencent_soe_app_id: str
    tencent_soe_score_coeff: float
    volc_tts_app_id: str
    volc_tts_api_key: str
    volc_tts_access_token: str
    volc_tts_voice_type: str
    volc_tts_cluster: str
    volc_tts_endpoint: str
    volc_tts_encoding: str
    volc_tts_speed_ratio: float
    volc_tts_volume_ratio: float
    volc_tts_pitch_ratio: float


def get_settings() -> Settings:
    default_db_path = Path(__file__).resolve().parents[2] / "app_data" / "learning.db"
    return Settings(
        app_name=os.getenv("APP_NAME", "AI Tutor MVP Backend"),
        app_version=os.getenv("APP_VERSION", "1.1.0"),
        app_env=os.getenv("APP_ENV", "development"),
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        database_url=os.getenv("DATABASE_URL", f"sqlite:///{default_db_path.as_posix()}"),
        cors_origins=_split_csv(
            os.getenv("CORS_ORIGINS"),
            ["*"],
        ),
        llm_provider=os.getenv("LLM_PROVIDER", "mock"),
        asr_provider=os.getenv("ASR_PROVIDER", "mock"),
        tts_provider=os.getenv("TTS_PROVIDER", "mock"),
        speech_score_provider=os.getenv("SPEECH_SCORE_PROVIDER", "mock"),
        use_mock_fallback=os.getenv("USE_MOCK_FALLBACK", "true").lower() == "true",
        qwen_api_key=os.getenv("QWEN_API_KEY", ""),
        qwen_base_url=os.getenv(
            "QWEN_BASE_URL",
            "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
        ),
        qwen_model=os.getenv("QWEN_MODEL", "qwen3.6-flash"),
        glm_api_key=os.getenv("GLM_API_KEY", ""),
        glm_base_url=os.getenv(
            "GLM_BASE_URL",
            "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        ),
        glm_model=os.getenv("GLM_MODEL", "glm-4-flash"),
        tencent_asr_app_id=os.getenv("TENCENT_ASR_APP_ID", ""),
        tencent_asr_secret_id=os.getenv("TENCENT_ASR_SECRET_ID", ""),
        tencent_asr_secret_key=os.getenv("TENCENT_ASR_SECRET_KEY", ""),
        tencent_asr_region=os.getenv("TENCENT_ASR_REGION", "ap-beijing"),
        tencent_asr_endpoint=os.getenv("TENCENT_ASR_ENDPOINT", "asr.tencentcloudapi.com"),
        tencent_asr_engine_model_type=os.getenv("TENCENT_ASR_ENGINE_MODEL_TYPE", "16k_en"),
        tencent_asr_poll_interval_ms=int(os.getenv("TENCENT_ASR_POLL_INTERVAL_MS", "600")),
        tencent_asr_timeout_seconds=int(os.getenv("TENCENT_ASR_TIMEOUT_SECONDS", "45")),
        tencent_soe_region=os.getenv("TENCENT_SOE_REGION", ""),
        tencent_soe_endpoint=os.getenv("TENCENT_SOE_ENDPOINT", "soe.cloud.tencent.com"),
        tencent_soe_app_id=os.getenv("TENCENT_SOE_APP_ID", os.getenv("TENCENT_ASR_APP_ID", "")),
        tencent_soe_score_coeff=float(os.getenv("TENCENT_SOE_SCORE_COEFF", "1.0")),
        volc_tts_app_id=os.getenv("VOLC_TTS_APP_ID", ""),
        volc_tts_api_key=os.getenv("VOLC_TTS_API_KEY", ""),
        volc_tts_access_token=os.getenv("VOLC_TTS_ACCESS_TOKEN", ""),
        volc_tts_voice_type=os.getenv("VOLC_TTS_VOICE_TYPE", "BV001_streaming"),
        volc_tts_cluster=os.getenv("VOLC_TTS_CLUSTER", "volcano_tts"),
        volc_tts_endpoint=os.getenv("VOLC_TTS_ENDPOINT", "https://openspeech.bytedance.com/api/v1/tts"),
        volc_tts_encoding=os.getenv("VOLC_TTS_ENCODING", "mp3"),
        volc_tts_speed_ratio=float(os.getenv("VOLC_TTS_SPEED_RATIO", "0.92")),
        volc_tts_volume_ratio=float(os.getenv("VOLC_TTS_VOLUME_RATIO", "1.0")),
        volc_tts_pitch_ratio=float(os.getenv("VOLC_TTS_PITCH_RATIO", "1.0")),
    )
