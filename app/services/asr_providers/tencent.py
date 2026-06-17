from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import re
import time
from datetime import UTC, datetime

import httpx

from app.core import get_settings
from app.services.asr_providers.base import BaseASRProvider


class TencentASRProvider(BaseASRProvider):
    """
    Tencent Cloud recording recognition adapter.

    This implementation uses:
    - `CreateRecTask` to submit short audio as base64
    - `DescribeTaskStatus` to poll until the transcript is ready
    """

    service = "asr"
    version = "2019-06-14"
    algorithm = "TC3-HMAC-SHA256"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.endpoint = self.settings.tencent_asr_endpoint
        self.region = self.settings.tencent_asr_region

    async def recognize(self, filename: str, audio_bytes: bytes, content_type: str | None = None) -> str:
        self._validate_settings()

        payload = {
            "EngineModelType": self.settings.tencent_asr_engine_model_type,
            "ChannelNum": 1,
            "ResTextFormat": 0,
            "SourceType": 1,
            "Data": base64.b64encode(audio_bytes).decode("utf-8"),
            "DataLen": len(audio_bytes),
            "FilterPunc": 0,
        }

        create_result = await self._request("CreateRecTask", payload)
        create_data = _extract_data(create_result)
        task_id_value = create_data.get("TaskId") or create_data.get("task_id")
        if task_id_value is None:
            raise RuntimeError(f"Tencent ASR create task response did not contain TaskId: {create_result}")
        task_id = int(task_id_value)
        transcript = await self._poll_task(task_id)
        if not transcript:
            raise RuntimeError("Tencent ASR completed but returned an empty transcript.")
        return transcript

    def _validate_settings(self) -> None:
        if not self.settings.tencent_asr_secret_id or not self.settings.tencent_asr_secret_key:
            raise RuntimeError("Tencent ASR credentials are not configured.")

    async def _poll_task(self, task_id: int) -> str:
        started_at = time.time()
        while time.time() - started_at < self.settings.tencent_asr_timeout_seconds:
            result = await self._request("DescribeTaskStatus", {"TaskId": task_id})
            data = _extract_data(result)
            status = str(data.get("StatusStr") or data.get("Status") or "").lower()

            if status in {"success", "done", "completed", "8"}:
                transcript = _extract_transcript(data)
                if transcript:
                    return transcript
                raise RuntimeError("Tencent ASR task succeeded but no transcript text was returned.")

            if status in {"failed", "fail", "error", "9"}:
                error_message = data.get("ErrorMsg") or result.get("Response", {}).get("Error", {}).get("Message")
                raise RuntimeError(f"Tencent ASR task failed: {error_message or 'unknown error'}")

            await _sleep_ms(self.settings.tencent_asr_poll_interval_ms)

        raise TimeoutError("Tencent ASR timed out while waiting for task completion.")

    async def _request(self, action: str, payload: dict) -> dict:
        request_body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        timestamp = int(time.time())
        date = datetime.fromtimestamp(timestamp, UTC).strftime("%Y-%m-%d")
        authorization = self._build_authorization(action, request_body, timestamp, date)

        headers = {
            "Authorization": authorization,
            "Content-Type": "application/json; charset=utf-8",
            "Host": self.endpoint,
            "X-TC-Action": action,
            "X-TC-Region": self.region,
            "X-TC-Timestamp": str(timestamp),
            "X-TC-Version": self.version,
        }

        async with httpx.AsyncClient(timeout=self.settings.tencent_asr_timeout_seconds) as client:
            response = await client.post(f"https://{self.endpoint}", content=request_body.encode("utf-8"), headers=headers)
            response.raise_for_status()
            payload = response.json()

        if "Response" in payload and "Error" in payload["Response"]:
            error = payload["Response"]["Error"]
            raise RuntimeError(f"Tencent ASR API error {error.get('Code')}: {error.get('Message')}")

        return payload

    def _build_authorization(self, action: str, request_body: str, timestamp: int, date: str) -> str:
        canonical_headers = (
            "content-type:application/json; charset=utf-8\n"
            f"host:{self.endpoint}\n"
            f"x-tc-action:{action.lower()}\n"
        )
        signed_headers = "content-type;host;x-tc-action"
        hashed_payload = hashlib.sha256(request_body.encode("utf-8")).hexdigest()
        canonical_request = "\n".join(
            [
                "POST",
                "/",
                "",
                canonical_headers,
                signed_headers,
                hashed_payload,
            ]
        )
        credential_scope = f"{date}/{self.service}/tc3_request"
        string_to_sign = "\n".join(
            [
                self.algorithm,
                str(timestamp),
                credential_scope,
                hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
            ]
        )
        signature = _tc3_signature(
            secret_key=self.settings.tencent_asr_secret_key,
            date=date,
            service=self.service,
            string_to_sign=string_to_sign,
        )
        return (
            f"{self.algorithm} Credential={self.settings.tencent_asr_secret_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )


def _tc3_signature(secret_key: str, date: str, service: str, string_to_sign: str) -> str:
    secret_date = hmac.new(f"TC3{secret_key}".encode("utf-8"), date.encode("utf-8"), hashlib.sha256).digest()
    secret_service = hmac.new(secret_date, service.encode("utf-8"), hashlib.sha256).digest()
    secret_signing = hmac.new(secret_service, b"tc3_request", hashlib.sha256).digest()
    return hmac.new(secret_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()


def _extract_transcript(data: dict) -> str:
    if isinstance(data.get("Result"), str) and data["Result"].strip():
        return _clean_transcript_text(data["Result"])

    details = data.get("ResultDetail")
    if isinstance(details, list):
        parts: list[str] = []
        for item in details:
            if not isinstance(item, dict):
                continue
            text = item.get("FinalSentence") or item.get("SliceSentence") or item.get("Sentence")
            if isinstance(text, str) and text.strip():
                parts.append(_clean_transcript_text(text))
        if parts:
            return " ".join(part for part in parts if part).strip()

    return ""


def _extract_data(payload: dict) -> dict:
    if isinstance(payload.get("Data"), dict):
        return payload["Data"]

    response = payload.get("Response")
    if isinstance(response, dict):
        if isinstance(response.get("Data"), dict):
            return response["Data"]
        return response

    return payload


async def _sleep_ms(delay_ms: int) -> None:
    await asyncio.sleep(delay_ms / 1000)


def _clean_transcript_text(text: str) -> str:
    cleaned = re.sub(r"\[\d+:\d+(?:\.\d+)?,\d+:\d+(?:\.\d+)?\]\s*", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()
