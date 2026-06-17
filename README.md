# AI Tutor MVP

This repository now contains:

- a Vite frontend prototype for the speaking-coach demo
- a FastAPI backend prepared for mainland-China provider integration

## Quick Start

### Backend

Install dependencies:

```bash
pip install -r requirements.txt
```

Optional: copy environment variables from the template:

```bash
copy .env.example .env
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

Compatibility entry:

```bash
uvicorn main:app --reload
```

Open API docs:

```text
http://127.0.0.1:8000/docs
```

### Frontend

```bash
npm install
npm run dev
```

Frontend default URL:

```text
http://127.0.0.1:5173
```

## Mainland-ready Provider Architecture

The backend now separates product logic from provider implementation:

- `LLM_PROVIDER`
  - `mock`
  - `qwen`
  - `glm`
- `ASR_PROVIDER`
  - `mock`
  - `tencent`
- `TTS_PROVIDER`
  - `mock`
  - `volc`
  - `volc` for Volcengine / Doubao speech synthesis

Current recommendation for a mainland production rollout:

- LLM: Alibaba Bailian / Qwen
- ASR: Tencent Cloud ASR
- TTS: Volcengine TTS

## Backend Structure

```text
app/
  main.py
  core/
    config.py
  api/routes/
  services/
    llm/
    asr_providers/
    tts_providers/
  db/
  models/
```

## Implemented APIs

- `POST /api/v1/asr/recognize`
- `POST /api/v1/tutor/chat`
- `POST /api/v1/speech/score`
- `POST /api/v1/tts/synthesize`
- `POST /api/v1/analyze/error`
- `POST /api/v1/report/generate`
- `POST /api/v1/learning/save`
- `GET /api/v1/system/providers`

All APIs return:

```json
{
  "status": "success",
  "data": {},
  "message": ""
}
```

## Current Delivery State

What is real today:

- FastAPI service is runnable
- SQLite persistence works
- Provider switching works by environment variable
- Frontend already prefers backend APIs when available

What is still mock today:

- speech scoring logic
- Volcengine TTS request flow
- some frontend demo interaction paths

## Tencent ASR Setup

The backend now includes a real Tencent Cloud ASR adapter based on:

- `CreateRecTask`
- `DescribeTaskStatus`

To enable it:

1. Open Tencent Cloud ASR in the console and activate the service
2. Fill these variables in `.env`
3. Set `ASR_PROVIDER=tencent`
4. Restart the backend

Recommended minimum variables:

```env
ASR_PROVIDER=tencent
USE_MOCK_FALLBACK=true
TENCENT_ASR_SECRET_ID=xxx
TENCENT_ASR_SECRET_KEY=xxx
TENCENT_ASR_REGION=ap-beijing
TENCENT_ASR_ENDPOINT=asr.tencentcloudapi.com
TENCENT_ASR_ENGINE_MODEL_TYPE=16k_en
```

## Doubao / Volcengine TTS Setup

The backend includes a Volcengine/Doubao TTS adapter.

To enable it:

1. Open Volcengine speech synthesis in the console and activate the service
2. Create or copy the TTS `AppID`, API Key, and voice type
3. Fill these variables in `.env`
4. Set `TTS_PROVIDER=volc`
5. Restart the backend

Recommended minimum variables:

```env
TTS_PROVIDER=volc
USE_MOCK_FALLBACK=true
VOLC_TTS_APP_ID=xxx
VOLC_TTS_API_KEY=xxx
VOLC_TTS_ACCESS_TOKEN=
VOLC_TTS_VOICE_TYPE=BV001_streaming
VOLC_TTS_CLUSTER=volcano_tts
VOLC_TTS_ENCODING=mp3
VOLC_TTS_SPEED_RATIO=0.92
```

`VOLC_TTS_API_KEY` is used as the `X-Api-Key` request header for the newer Doubao speech API.
`VOLC_TTS_ACCESS_TOKEN` is kept only for older Volcengine TTS credentials.

Test in Swagger:

```text
POST /api/v1/tts/synthesize
```

Example body:

```json
{
  "text": "What food do you like?",
  "voice_type": null,
  "speed_ratio": 0.92
}
```

## Next Recommended Milestones

1. Connect frontend AI teacher speech to `/api/v1/tts/synthesize`
2. Replace mock speech scoring with transcript + rubric scoring
3. Move dialogue pass/fail judgment fully into backend
4. Replace SQLite with PostgreSQL for production
5. Add object storage for audio uploads
