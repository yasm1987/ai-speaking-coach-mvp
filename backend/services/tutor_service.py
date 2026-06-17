from backend.models.schemas import TutorChatRequest


def generate_tutor_reply(payload: TutorChatRequest) -> str:
    # MVP mock reply. Later this can call OpenAI chat completion APIs.
    message = payload.message.strip().lower()
    if "milk" in message:
        return "Good try. You can say: I don't like milk. Can you say it again?"
    if "fruit" in message or "banana" in message or "apple" in message:
        return "Nice answer. Tell me one more fruit you like."
    return "Great. Let's keep talking about food. What food do you like?"
