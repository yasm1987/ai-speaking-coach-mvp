from typing import Any


def success_response(data: Any, message: str = "") -> dict[str, Any]:
    return {
        "status": "success",
        "data": data,
        "message": message,
    }
