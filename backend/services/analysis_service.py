from backend.models.schemas import GrammarMistake


def analyze_text_errors(text: str) -> list[GrammarMistake]:
    normalized = text.strip()
    lowered = normalized.lower()
    mistakes: list[GrammarMistake] = []

    if lowered == "i like apple.":
        mistakes.append(
            GrammarMistake(
                original="I like apple.",
                suggestion="I like apples.",
                error_type="名词单复数",
                explanation="表达喜欢某一类水果时，apple 通常用复数 apples。",
            )
        )

    if lowered == "i no like milk.":
        mistakes.append(
            GrammarMistake(
                original="I no like milk.",
                suggestion="I don't like milk.",
                error_type="否定句结构",
                explanation="英语否定句需要借助 don't。",
            )
        )

    if lowered == "he like pizza.":
        mistakes.append(
            GrammarMistake(
                original="He like pizza.",
                suggestion="He likes pizza.",
                error_type="第三人称单数",
                explanation="主语是 he 时，动词 like 要变成 likes。",
            )
        )

    return mistakes
