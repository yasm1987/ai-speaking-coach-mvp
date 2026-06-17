from fastapi import UploadFile


async def recognize_audio(file: UploadFile) -> str:
    # MVP mock. Replace this with Whisper or another ASR provider later.
    filename = (file.filename or "").lower()
    if "milk" in filename:
        return "I don't like milk."
    if "banana" in filename or "fruit" in filename:
        return "I like bananas."
    if "apple" in filename:
        return "I like apples."
    return "This is a mock ASR transcript."
