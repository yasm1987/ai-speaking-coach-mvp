from __future__ import annotations

import uuid

import httpx

from app.core import get_settings
from app.services.tts_providers.base import BaseTTSProvider


class VolcTTSProvider(BaseTTSProvider):
    """Volcengine/Doubao TTS adapter.

    The provider returns base64 audio so the frontend can play it without
    exposing cloud credentials or managing temporary files.
    """

    def __init__(self) -> None:
        self.settings = get_settings()

    async def synthesize(
        self,
        text: str,
        voice_type: str | None = None,
        speed_ratio: float | None = None,
    ) -> dict[str, str]:
        if not self.settings.volc_tts_app_id or not (self.settings.volc_tts_api_key or self.settings.volc_tts_access_token):
            raise RuntimeError("Volcengine TTS credentials are not configured.")

        selected_voice = voice_type or self.settings.volc_tts_voice_type
        selected_speed = speed_ratio or self.settings.volc_tts_speed_ratio
        app_payload = {
            "appid": self.settings.volc_tts_app_id,
            "cluster": self.settings.volc_tts_cluster,
        }
        if self.settings.volc_tts_access_token:
            app_payload["token"] = self.settings.volc_tts_access_token

        payload = {
            "app": app_payload,
            "user": {
                "uid": "demo-student",
            },
            "audio": {
                "voice_type": selected_voice,
                "encoding": self.settings.volc_tts_encoding,
                "speed_ratio": selected_speed,
                "volume_ratio": self.settings.volc_tts_volume_ratio,
                "pitch_ratio": self.settings.volc_tts_pitch_ratio,
            },
            "request": {
                "reqid": str(uuid.uuid4()),
                "text": text,
                "text_type": "plain",
                "operation": "query",
            },
        }

        headers = {"Content-Type": "application/json"}
        if self.settings.volc_tts_api_key:
            headers["X-Api-Key"] = self.settings.volc_tts_api_key
        else:
            headers["Authorization"] = f"Bearer;{self.settings.volc_tts_access_token}"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(self.settings.volc_tts_endpoint, json=payload, headers=headers)

        if response.status_code >= 400:
            raise RuntimeError(f"Volcengine TTS HTTP {response.status_code}: {response.text}")

        data = response.json()
        code = data.get("code", 0)
        if code not in (0, "0", 3000, "3000", None):
            raise RuntimeError(f"Volcengine TTS API error {code}: {data.get('message', 'unknown error')}")

        audio_base64 = data.get("data")
        if not audio_base64:
            raise RuntimeError(f"Volcengine TTS response did not contain audio data: {data}")

        return {
            "audio_base64": audio_base64,
            "audio_format": self.settings.volc_tts_encoding,
            "provider": "volc",
            "voice_type": selected_voice,
            "text": text,
        }
