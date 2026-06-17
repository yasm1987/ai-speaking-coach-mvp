# Backend Deployment

This FastAPI backend is ready for Render or Railway.

The repository also contains a Vite frontend. For Railway backend deployment, `nixpacks.toml` forces Python backend build/start behavior.

## Start command

Use either of these:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

or the included `Procfile`:

```text
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## Health check

```text
/health
```

## Required environment variables

Set these on Render/Railway:

```bash
APP_ENV=production
CORS_ORIGINS=https://your-netlify-site.netlify.app
DATABASE_URL=sqlite:///app_data/ai_tutor_mvp.db
LLM_PROVIDER=qwen
ASR_PROVIDER=tencent
TTS_PROVIDER=volc
SPEECH_SCORE_PROVIDER=tencent_soe
USE_MOCK_FALLBACK=true
```

For persistent production storage, prefer the PostgreSQL URL provided by Render/Railway:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME
```

Then add the provider keys:

```bash
QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
QWEN_MODEL=qwen3.6-flash

TENCENT_ASR_APP_ID=
TENCENT_ASR_SECRET_ID=
TENCENT_ASR_SECRET_KEY=
TENCENT_ASR_REGION=ap-beijing
TENCENT_ASR_ENDPOINT=asr.tencentcloudapi.com
TENCENT_ASR_ENGINE_MODEL_TYPE=16k_en

TENCENT_SOE_ENDPOINT=soe.cloud.tencent.com
TENCENT_SOE_APP_ID=

VOLC_TTS_APP_ID=
VOLC_TTS_API_KEY=
VOLC_TTS_VOICE_TYPE=
VOLC_TTS_CLUSTER=volcano_tts
VOLC_TTS_ENDPOINT=https://openspeech.bytedance.com/api/v1/tts
VOLC_TTS_ENCODING=mp3
```

## Frontend environment variable

In Netlify, set:

```bash
VITE_API_BASE_URL=https://your-render-or-railway-domain/api/v1
```

Then redeploy the frontend.
