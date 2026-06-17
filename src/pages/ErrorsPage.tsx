import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, PageHeader, ProgressBar, StatusBadge } from "../components/UI";
import { useLearning } from "../state/LearningContext";
import type { ErrorStatus } from "../types";

type Filter = "all" | ErrorStatus;

const filters: Array<{ label: string; value: Filter }> = [
  { label: "全部", value: "all" },
  { label: "待复练", value: "pending" },
  { label: "练习中", value: "practicing" },
  { label: "已掌握", value: "mastered" },
];

export default function ErrorsPage() {
  const { errors, errorStats } = useLearning();
  const [filter, setFilter] = useState<Filter>("all");
  const visibleErrors = useMemo(() => (filter === "all" ? errors : errors.filter((error) => error.status === filter)), [errors, filter]);
  const masteredPercent = Math.round((errorStats.mastered / Math.max(errorStats.total, 1)) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="错句本"
        title="把说错的句子变成下一次更准的练习"
        description="这里保存 AI 对话、跟读和复练中发现的错误句子。两轮复练后，仍未掌握的内容会保留在报告里。"
      />

      <Card>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="全部错句" value={errorStats.total} color="text-slate-950" />
          <Stat label="待复练" value={errorStats.pending} color="text-amber-600" />
          <Stat label="已掌握" value={errorStats.mastered} color="text-emerald-600" />
        </div>
        <div className="mt-5 flex items-center justify-between text-sm font-semibold">
          <span>掌握进度</span>
          <span className="text-emerald-600">{masteredPercent}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={masteredPercent} color="bg-emerald-600" />
        </div>
      </Card>

      {errors.length ? (
        <>
          <div className="flex flex-wrap gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  filter === item.value ? "bg-indigo-600 text-white" : "bg-white text-slate-600 shadow-sm"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <section className="grid gap-4">
            {visibleErrors.map((error) => (
              <Card key={error.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={error.status} />
                  <p className="text-sm font-semibold text-slate-500">{error.errorType}</p>
                </div>
                <p className="mt-4 text-xs font-semibold text-slate-400">学生原句</p>
                <p className="mt-1 text-xl font-bold text-amber-700">{error.originalSentence}</p>
                <p className="mt-4 text-xs font-semibold text-slate-400">正确表达</p>
                <p className="mt-1 text-xl font-bold">{error.correctedSentence}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{error.explanation}</p>
                <p className="mt-2 text-xs text-slate-400">
                  来源：{sourceLabel(error.source)} · {new Date(error.createdAt).toLocaleDateString()}
                </p>
                <Link
                  to={`/review/${error.id}`}
                  onClick={resetReviewSession}
                  className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
                >
                  开始复练
                </Link>
              </Card>
            ))}
          </section>
        </>
      ) : (
        <Card className="border-indigo-100 bg-indigo-50">
          <h2 className="text-xl font-bold text-indigo-950">当前还没有错句</h2>
          <p className="mt-2 text-sm leading-7 text-indigo-800">
            从今日任务或 AI 对话开始练习后，AI 发现的典型表达问题会自动进入这里。
          </p>
          <Link to="/tasks" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">
            去今日任务
          </Link>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function sourceLabel(source: "dialogue" | "reading" | "review") {
  return { dialogue: "AI 对话", reading: "AI 跟读", review: "错句复练" }[source];
}

function resetReviewSession() {
  window.sessionStorage.removeItem("ai-speaking-review-round");
  window.sessionStorage.removeItem("ai-speaking-review-skipped");
}
