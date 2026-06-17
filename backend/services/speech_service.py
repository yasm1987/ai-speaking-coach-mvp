from backend.models.schemas import SpeechScoreRequest, SpeechScoreResponse


def score_speech(payload: SpeechScoreRequest) -> SpeechScoreResponse:
    # MVP mock scoring. Later this can call a pronunciation model or GPT rubric.
    target = payload.text.lower()
    if "milk" in target or "sandwich" in target:
        return SpeechScoreResponse(
            score=82,
            fluency=80,
            pronunciation=78,
            feedback="发音基本正确，但清晰度和尾音还不够稳定，建议继续复练。",
        )

    return SpeechScoreResponse(
        score=91,
        fluency=90,
        pronunciation=92,
        feedback="整体表现自然清楚，已经达到本题要求。",
    )
