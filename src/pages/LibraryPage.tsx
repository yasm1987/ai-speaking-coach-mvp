import { Card, PageHeader } from "../components/UI";
import { useLearning } from "../state/LearningContext";

export default function LibraryPage() {
  const { currentUnit } = useLearning();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="学习内容库"
        title={currentUnit.title}
        description={`${currentUnit.topic} 主题内容库：${currentUnit.description}`}
      />

      <Card>
        <h2 className="text-lg font-bold">核心词汇</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {currentUnit.words.map((word) => (
            <div key={word.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xl font-bold">{word.text}</p>
              <p className="mt-1 text-sm text-slate-500">{word.meaning}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-bold">重点句型</h2>
        <div className="mt-4 grid gap-3">
          {currentUnit.sentences.map((sentence) => (
            <div key={sentence.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xl font-bold">{sentence.text}</p>
              <p className="mt-1 text-sm text-slate-500">{sentence.meaning}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">AI 问题</h2>
          <div className="mt-4 space-y-3">
            {currentUnit.aiQuestions.map((question) => (
              <div key={question} className="rounded-2xl bg-indigo-50 p-4 font-semibold text-indigo-900">
                {question}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">常见错句</h2>
          <div className="mt-4 space-y-4">
            {currentUnit.commonErrors.map((error) => (
              <div key={error.id} className="rounded-2xl bg-amber-50 p-4">
                <p className="font-bold text-amber-800">
                  {error.originalSentence} → {error.correctedSentence}
                </p>
                <p className="mt-2 text-sm text-amber-700">错误类型：{error.errorType}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{error.explanation}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
