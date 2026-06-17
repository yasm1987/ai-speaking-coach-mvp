from __future__ import annotations

import base64
import hmac
import json
import random
import time
import uuid
from hashlib import sha1
from urllib.parse import quote, urlencode

import websockets

from app.core import get_settings
from app.models.schemas import SpeechScoreData, SpeechScoreRequest


def score_speech(payload: SpeechScoreRequest) -> SpeechScoreData:
    """Sync wrapper kept for older call sites."""
    return score_speech_mock(payload)


async def score_speech_async(payload: SpeechScoreRequest) -> SpeechScoreData:
    settings = get_settings()
    provider = settings.speech_score_provider.lower()

    if provider in {"tencent_soe", "soe", "tencent"}:
        try:
            return await TencentSOEScorer().score(payload)
        except Exception as exc:
            if not settings.use_mock_fallback:
                raise
            return score_speech_mock(payload, fallback_reason=str(exc))

    return score_speech_mock(payload)


def score_speech_mock(payload: SpeechScoreRequest, fallback_reason: str | None = None) -> SpeechScoreData:
    target = payload.text.lower()
    seed = sum(ord(char) for char in target)
    rng = random.Random(seed)

    if "milk" in target or "sandwich" in target:
        score = 80 + rng.randint(0, 4)
        fluency = 78 + rng.randint(0, 5)
        pronunciation = 76 + rng.randint(0, 5)
        feedback = "发音基本正确，但清晰度和节奏还不够稳定，建议继续复练。"
    else:
        score = 88 + rng.randint(0, 7)
        fluency = 86 + rng.randint(0, 8)
        pronunciation = 87 + rng.randint(0, 8)
        feedback = "整体表现自然清晰，已经达到本题要求。"

    if fallback_reason:
        feedback = f"腾讯智聆评分暂未成功，当前已回退演示评分。原因：{fallback_reason}"

    return SpeechScoreData(
        score=min(score, 100),
        fluency=min(fluency, 100),
        pronunciation=min(pronunciation, 100),
        completeness=min(score + 1, 100),
        feedback=feedback,
        provider="mock",
    )


class TencentSOEScorer:
    """Tencent SOE new-version WebSocket scorer."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.endpoint = self.settings.tencent_soe_endpoint

    async def score(self, payload: SpeechScoreRequest) -> SpeechScoreData:
        if not payload.audio_base64:
            raise RuntimeError("Tencent SOE scoring requires audio_base64.")
        if not self.settings.tencent_soe_app_id:
            raise RuntimeError("Tencent SOE app id is not configured.")
        if not self.settings.tencent_asr_secret_id or not self.settings.tencent_asr_secret_key:
            raise RuntimeError("Tencent credentials are not configured.")

        audio_bytes = base64.b64decode(clean_audio_base64(payload.audio_base64))
        url = self._build_wss_url(payload)

        final_message: dict | None = None
        async with websockets.connect(url, max_size=8 * 1024 * 1024, open_timeout=12, close_timeout=6) as websocket:
            first_message = json.loads(await websocket.recv())
            if first_message.get("code") not in (0, "0"):
                raise RuntimeError(f"Tencent SOE handshake error: {first_message}")

            await websocket.send(audio_bytes)
            await websocket.send(json.dumps({"type": "end"}))

            while True:
                message = json.loads(await websocket.recv())
                if message.get("code") not in (0, "0"):
                    raise RuntimeError(f"Tencent SOE API error: {message}")
                final_message = message
                if message.get("type") == "final" or message.get("final") == 1 or message.get("is_final") == 1:
                    break

        if not final_message:
            raise RuntimeError("Tencent SOE returned no scoring result.")

        return _map_soe_response(final_message)

    def _build_wss_url(self, payload: SpeechScoreRequest) -> str:
        timestamp = int(time.time())
        params = {
            "secretid": self.settings.tencent_asr_secret_id,
            "timestamp": timestamp,
            "expired": timestamp + 120,
            "nonce": random.randint(100000, 999999),
            "voice_id": str(uuid.uuid4()),
            "server_engine_type": "16k_en",
            "voice_format": _voice_file_type(payload.audio_format),
            "text_mode": 0,
            "ref_text": payload.text,
            "keyword": payload.text,
            "eval_mode": _eval_mode(payload.text),
            "score_coeff": self.settings.tencent_soe_score_coeff,
            "sentence_info_enabled": 1,
            "rec_mode": 1,
        }
        path = f"/soe/api/{self.settings.tencent_soe_app_id}"
        sorted_query = "&".join(f"{key}={params[key]}" for key in sorted(params))
        sign_content = f"{self.endpoint}{path}?{sorted_query}"
        signature = base64.b64encode(
            hmac.new(self.settings.tencent_asr_secret_key.encode("utf-8"), sign_content.encode("utf-8"), sha1).digest()
        ).decode("utf-8")
        query = urlencode({**params, "signature": signature}, quote_via=quote)
        return f"wss://{self.endpoint}{path}?{query}"


def _map_soe_response(response: dict) -> SpeechScoreData:
    result = _extract_result(response)
    pronunciation = _score_value(result.get("pron_accuracy") or result.get("PronAccuracy"))
    fluency = _score_value(result.get("pron_fluency") or result.get("PronFluency"))
    completeness = _score_value(result.get("pron_completion") or result.get("PronCompletion"))
    suggested = _score_value(result.get("suggested_score") or result.get("SuggestedScore"))
    score = suggested or round((pronunciation * 0.45) + (fluency * 0.25) + (completeness * 0.30))

    return SpeechScoreData(
        score=score,
        fluency=fluency,
        pronunciation=pronunciation,
        completeness=completeness,
        feedback=_feedback(score, pronunciation, fluency, completeness),
        provider="tencent_soe",
    )


def _extract_result(response: dict) -> dict:
    result = response.get("result") or response.get("Result") or response
    if isinstance(result, str):
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return _parse_result_string(result)
    if isinstance(result, dict):
        return result
    return {}


def _parse_result_string(value: str) -> dict:
    parsed: dict[str, float] = {}
    for key in ("pron_accuracy", "pron_fluency", "pron_completion", "suggested_score"):
        marker = f"{key}:"
        if marker not in value:
            continue
        tail = value.split(marker, 1)[1].strip()
        number = tail.split()[0].strip('"')
        try:
            parsed[key] = float(number)
        except ValueError:
            continue
    return parsed


def _score_value(value: object) -> int:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0
    if score <= 10:
        score *= 10
    return max(0, min(100, round(score)))


def _feedback(score: int, pronunciation: int, fluency: int, completeness: int) -> str:
    if score >= 85:
        return "本次跟读达到通过线，发音、完整度和流利度整体表现稳定。"
    weak_parts: list[str] = []
    if pronunciation < 85:
        weak_parts.append("发音清晰度")
    if fluency < 85:
        weak_parts.append("流利度")
    if completeness < 85:
        weak_parts.append("完整度")
    if not weak_parts:
        weak_parts.append("整体稳定性")
    return f"本次跟读低于通过线，需要继续复练：{', '.join(weak_parts)}。"


def _eval_mode(text: str) -> int:
    words = text.strip().split()
    if len(words) <= 1:
        return 0
    if len(words) <= 12:
        return 1
    return 2


def _voice_file_type(audio_format: str | None) -> int:
    value = (audio_format or "").lower()
    if "wav" in value:
        return 1
    if "mp3" in value:
        return 2
    return 1


def clean_audio_base64(data_url_or_base64: str) -> str:
    if "," in data_url_or_base64 and data_url_or_base64.startswith("data:"):
        return data_url_or_base64.split(",", 1)[1]
    try:
        base64.b64decode(data_url_or_base64, validate=True)
    except Exception as exc:
        raise RuntimeError("Invalid audio_base64 payload.") from exc
    return data_url_or_base64
