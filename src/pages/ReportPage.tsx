import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, PageHeader, ProgressBar, ShieldRating } from "../components/UI";
import { generateStudyReport } from "../services/aiService";
import { useLearning } from "../state/LearningContext";
import type { PracticeTask, StudyReport } from "../types";

const learningTaskTypes: PracticeTask["type"][] = ["word", "sentence", "dialogue", "review"];
const requiredBeforeReport: PracticeTask["type"][] = ["word", "sentence", "dialogue"];

export default function ReportPage() {
  const { tasks, errors, taskProgress, updateTaskStatus } = useLearning();
  const [report, setReport] = useState<StudyReport | null>(null);
  const hasLearningRecord = tasks.some((task) => learningTaskTypes.includes(task.type) && task.status !== "not_started") || errors.length > 0;
  const reportTaskCompleted = tasks.find((task) => task.type === "report")?.status === "completed";
  const reviewTaskCompleted = tasks.find((task) => task.type === "review")?.status === "completed";
  const hasPendingReview = errors.some((error) => error.status !== "mastered");
  const missingTasks = tasks
    .filter((task) => requiredBeforeReport.includes(task.type) && task.status !== "completed")
    .map((task) => task.title);
  if (hasPendingReview && !reviewTaskCompleted) missingTasks.push("错句复练");
  const canGenerateReport = hasLearningRecord && missingTasks.length === 0;

  useEffect(() => {
    if (!hasLearningRecord || !canGenerateReport) {
      setReport(null);
      return;
    }

    if (!hasPendingReview && !reviewTaskCompleted) {
      updateTaskStatus("review", "completed");
      return;
    }

    const reportReadyTasks = tasks.map((task) => (task.type === "report" ? { ...task, status: "completed" as const } : task));
    generateStudyReport({ tasks: reportReadyTasks, errors }).then(setReport);
    if (!reportTaskCompleted) updateTaskStatus("report", "completed");
  }, [tasks, errors, hasLearningRecord, canGenerateReport, hasPendingReview, reviewTaskCompleted, reportTaskCompleted, updateTaskStatus]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="学习报告"
        title="剑桥少儿英语口语盾牌报告"
        description="当日完成练习后，这里会汇总任务、错句、复练结果和少儿口语盾牌表现。"
      />

      <Card className="border-indigo-100 bg-indigo-50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-indigo-700">完成情况</p>
            <h2 className="mt-1 text-3xl font-bold">
              {taskProgress.completed} / {taskProgress.total} 项任务
            </h2>
          </div>
          <div className="rounded-2xl bg-white px-4 py-3 text-center">
            <p className="text-2xl font-bold text-indigo-600">{taskProgress.percent}%</p>
            <p className="text-xs font-semibold text-slate-500">完成率</p>
          </div>
        </div>
        <div className="mt-5">
          <ProgressBar value={taskProgress.percent} />
        </div>
      </Card>

      {!hasLearningRecord ? (
        <Card className="border-slate-200 bg-white">
          <h2 className="text-xl font-bold">暂无当日学习报告</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Demo 数据已重置，当前还没有完成任何练习。完成今日任务、AI 对话或错句复练后，这里会生成学习报告。
          </p>
          <Link to="/tasks" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">
            去今日任务
          </Link>
        </Card>
      ) : !canGenerateReport ? (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="text-xl font-bold text-amber-900">还不能生成学习报告</h2>
          <p className="mt-2 text-sm leading-7 text-amber-800">需要先完成今日核心任务，报告才会生成。当前还差：</p>
          <ul className="mt-4 space-y-2">
            {missingTasks.map((task) => (
              <li key={task} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-amber-800">
                {task}
              </li>
            ))}
          </ul>
          <Link to="/tasks" className="mt-4 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white">
            回到今日任务
          </Link>
        </Card>
      ) : !report ? (
        <Card>
          <p className="text-sm text-slate-600">正在生成报告...</p>
        </Card>
      ) : (
        <>
          <Card className="border-indigo-100 bg-white">
            <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-start">
              <div>
                <p className="text-sm font-bold text-indigo-600">今日结论</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">完成口语闭环，下一步聚焦复练质量</h2>
                <p className="mt-3 leading-7 text-slate-700">{report.summary}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center md:grid-cols-1">
                <Metric label="任务完成" value={`${report.completedTasks.length}/${tasks.length}`} />
                <Metric label="已掌握" value={`${report.masteredSentences.length}`} />
                <Metric label="待复练" value={`${report.errorsToReview.length}`} tone={report.errorsToReview.length ? "warn" : "good"} />
              </div>
            </div>
          </Card>

          <Card className="border-emerald-100 bg-emerald-50">
            <h2 className="text-lg font-bold text-emerald-950">下一步行动</h2>
            <ActionList items={getActionItems(report)} />
            <div className="mt-5 rounded-2xl bg-white/70 p-4">
              <p className="text-xs font-bold text-emerald-700">给家长的一句话</p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">{report.parentFriendlyComment}</p>
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">能力快照</h2>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">按少儿口语维度观察</span>
            </div>
            <div className="mt-4 grid gap-3">
              {report.speakingScores.map((criterion) => (
                <div key={criterion.key} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[180px_150px_1fr] md:items-center">
                  <p className="font-bold text-slate-900">{criterion.label}</p>
                  <div>
                    <ShieldRating score={criterion.score} maxScore={criterion.maxScore} />
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{criterion.feedback}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold">表现亮点</h2>
              <List items={uniqueItems(report.aiStrengths ?? []).slice(0, 3)} emptyText="本轮完成了基础口语练习。" />
            </Card>

            <Card>
              <h2 className="text-lg font-bold">练习证据</h2>
              <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
                <Evidence label="已完成" items={report.completedTasks} />
                <Evidence label="已掌握" items={report.masteredSentences} fallback="暂无已掌握错句" />
                <Evidence label="待复练" items={report.errorsToReview} fallback="暂无待复练内容" warn={report.errorsToReview.length > 0} />
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/">
          <Button variant="soft" className="w-full">
            返回首页
          </Button>
        </Link>
        <Link to="/errors">
          <Button variant="soft" className="w-full">
            查看错句本
          </Button>
        </Link>
        <Link to="/tasks">
          <Button className="w-full">回到今日任务</Button>
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "warn" }) {
  const color = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-indigo-600";
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
    </div>
  );
}

function List({ items, emptyText }: { items: string[]; emptyText?: string }) {
  const visibleItems = items.length ? items : [emptyText ?? "暂无内容"];
  return (
    <ul className="mt-3 space-y-3">
      {visibleItems.map((item) => (
        <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ActionList({ items }: { items: string[] }) {
  return (
    <ol className="mt-4 grid gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <li key={item} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs font-black text-emerald-600">行动 {index + 1}</p>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-900">{item}</p>
        </li>
      ))}
    </ol>
  );
}

function Evidence({ label, items, fallback, warn = false }: { label: string; items: string[]; fallback?: string; warn?: boolean }) {
  const value = items.length ? items.join("、") : fallback;
  return (
    <p>
      <span className={`mr-2 rounded-full px-3 py-1 text-xs font-bold ${warn ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-indigo-700"}`}>
        {label}
      </span>
      {value}
    </p>
  );
}

function getActionItems(report: StudyReport) {
  const llmSteps = uniqueItems(report.aiNextSteps ?? []).slice(0, 3);
  if (llmSteps.length >= 2) return llmSteps;

  const reviewSteps = report.errorsToReview.slice(0, 2).map((item) => `复练：${item}`);
  const fallback = report.errorsToReview.length
    ? ["先完成错句复练，再做一轮 AI 对话巩固。"]
    : ["明天继续完成一轮 AI 对话，并尝试用完整句回答。"];

  return uniqueItems([...llmSteps, ...reviewSteps, ...fallback]).slice(0, 3);
}

function uniqueItems(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
