import json

from app.services.llm.base import BaseLLM


class MockLLM(BaseLLM):
    """Default runnable LLM implementation for local MVP use."""

    def generate(self, prompt: str) -> str:
        lowered = prompt.lower()

        if "grammar analyzer" in lowered:
            if "i like apple." in lowered:
                return json.dumps(
                    {
                        "mistakes": [
                            {
                                "original": "I like apple.",
                                "suggestion": "I like apples.",
                                "error_type": "名词单复数",
                                "explanation": "表达喜欢某类水果时，apple 通常要用复数 apples。",
                            }
                        ]
                    },
                    ensure_ascii=False,
                )
            if "i no like milk." in lowered:
                return json.dumps(
                    {
                        "mistakes": [
                            {
                                "original": "I no like milk.",
                                "suggestion": "I don't like milk.",
                                "error_type": "否定句结构",
                                "explanation": "英语否定句需要借助 don't。",
                            }
                        ]
                    },
                    ensure_ascii=False,
                )
            return json.dumps({"mistakes": []}, ensure_ascii=False)

        if "study report" in lowered:
            return json.dumps(
                {
                    "summary": "学生已完成本轮口语练习，能够围绕 Food 主题进行基础表达。",
                    "strengths": ["能理解食物主题问题", "能完成基础口语问答", "愿意重复修正表达"],
                    "next_steps": ["继续加强 milk 和 sandwich 的发音稳定性", "复练复数与否定句结构"],
                    "parent_comment": "建议继续保持每天 5 到 8 分钟的口语练习频率。",
                },
                ensure_ascii=False,
            )

        if "children" in lowered and "english teacher" in lowered:
            if "milk" in lowered:
                return "Good try. You can say: I don't like milk. Can you say it again?"
            if "fruit" in lowered or "banana" in lowered or "apple" in lowered:
                return "Nice answer. Tell me one more fruit you like."
            return "Great. Let's keep talking about food. What food do you like?"

        return "This is a mock LLM reply."
