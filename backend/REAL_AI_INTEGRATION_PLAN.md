# AI Tutor MVP Backend Integration Plan

## Goal

This backend is an MVP that keeps API contracts stable while using mock logic first.
Later, each mock service can be swapped for a real AI provider without changing route shapes.

## Current Route Contracts

### `POST /api/v1/asr/recognize`

Input:
- multipart file field: `file`

Output:
- `text`

Real replacement:
- OpenAI Whisper
- Azure Speech
- Tencent Cloud ASR

Suggested real flow:
1. Upload audio to object storage or pass file bytes directly.
2. Send bytes to ASR provider.
3. Normalize transcript text.
4. Return `text`.

### `POST /api/v1/speech/score`

Input:
- `audio_url`
- `text`

Output:
- `score`
- `fluency`
- `pronunciation`
- `feedback`

Real replacement:
- Speech scoring model
- GPT-based rubric scoring with transcript + target text

Suggested real flow:
1. Use ASR to get transcript.
2. Compare transcript with target text.
3. Extract pronunciation/fluency signals from model or scoring service.
4. Return unified score fields.

### `POST /api/v1/tutor/chat`

Input:
- `message`
- `history`

Output:
- `reply`

Real replacement:
- OpenAI Responses API or Chat Completions API

Suggested real flow:
1. Add system prompt for "AI English speaking tutor".
2. Pass conversation history.
3. Constrain reply style for learner age and unit topic.
4. Return `reply`.

### `POST /api/v1/analyze/error`

Input:
- `text`

Output:
- `mistakes`

Real replacement:
- GPT grammar analysis

Suggested real flow:
1. Prompt model to return structured JSON.
2. Parse output into:
   - `original`
   - `suggestion`
   - `error_type`
   - `explanation`
3. Return validated list.

### `POST /api/v1/report/generate`

Input:
- `user_id`
- `session_data`

Output:
- `report`

Real replacement:
- GPT summary/report generation

Suggested real flow:
1. Load saved sessions from SQLite or future DB.
2. Build compact summary payload.
3. Ask model for:
   - learning summary
   - strengths
   - next steps
   - parent comment
4. Return structured `report`.

### `POST /api/v1/learning/save`

Input:
- `user_id`
- `session_data`

Output:
- `success`
- `record_id`

Real replacement:
- Keep SQLite for MVP
- Later swap to PostgreSQL if needed

## Service Swap Points

Current mock files:
- `backend/services/asr_service.py`
- `backend/services/speech_service.py`
- `backend/services/tutor_service.py`
- `backend/services/analysis_service.py`
- `backend/services/report_service.py`

Recommended upgrade pattern:
1. Keep route files unchanged.
2. Replace service internals only.
3. Add provider-specific clients under `backend/services/providers/`.
4. Keep response schemas stable.

## Suggested Next Real Integrations

### Phase 1
- Real `tutor/chat` with OpenAI
- Real `analyze/error` with OpenAI
- Real `report/generate` with OpenAI

Reason:
- These are text-only and easiest to land first.

### Phase 2
- Real `asr/recognize` with Whisper
- Real `speech/score` with scoring logic built on ASR + GPT rubric

Reason:
- Audio handling adds more infra and testing complexity.

## Environment Variables To Add Later

Example:

```env
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4.1-mini
WHISPER_MODEL=whisper-1
DATABASE_URL=sqlite:///backend_data/learning_records.db
```

## Frontend Integration Notes

Frontend should assume all APIs return:

```json
{
  "status": "success",
  "data": {},
  "message": ""
}
```

That means frontends can always:
1. Check `status`
2. Read `data`
3. Show `message` if needed

## MVP Boundary

This MVP backend is intentionally simple:
- SQLite only
- no auth
- no object storage
- no background jobs
- no provider SDK yet

That keeps it easy to run, demo, and evolve.
