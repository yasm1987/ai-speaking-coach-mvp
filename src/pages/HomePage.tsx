import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ProgressBar, StatusBadge } from "../components/UI";
import { useLearning } from "../state/LearningContext";

const loopItems = ["今日任务", "AI 跟读", "AI 对话", "AI 纠错", "错句复练", "学习报告"];

export default function HomePage() {
  const { currentUnit, errors, taskProgress, resetDemoData } = useLearning();
  const [resetNotice, setResetNotice] = useState("");
  const activeErrors = errors.filter((error) => error.status !== "mastered").length;

  const handleResetDemo = () => {
    resetDemoData();
    setResetNotice("Demo 数据已重置");
    window.setTimeout(() => setResetNotice(""), 1800);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-blue-600 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-indigo-100">火箭泡英语</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">AI 口语助教</h1>
            <div className="mt-5 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-indigo-50">
              当前演示单元：{currentUnit.title}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tasks">
                <Button variant="ghost">开始体验</Button>
              </Link>
              <button onClick={handleResetDemo} className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white/90">
                重置 Demo 数据
              </button>
            </div>
            {resetNotice ? <p className="mt-3 text-sm font-semibold text-emerald-100">{resetNotice}</p> : null}
          </div>

          <div className="rounded-2xl border border-white/20 bg-white/95 p-5 shadow-lg backdrop-blur">
            <p className="text-3xl font-black tracking-wide">
              <span className="text-sky-500">爱乐奇</span>
              <span className="text-orange-400">英语</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-sky-600">AI Speaking Coach</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">核心闭环</h2>
            <StatusBadge status={activeErrors > 0 ? "pending" : "mastered"} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {loopItems.map((item, index) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-indigo-600">0{index + 1}</p>
                <p className="mt-2 font-bold">{item}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold">今日进度</h2>
          <p className="mt-2 text-3xl font-bold text-indigo-600">{taskProgress.percent}%</p>
          <p className="mt-1 text-sm text-slate-500">
            已完成 {taskProgress.completed} / {taskProgress.total} 项任务
          </p>
          <div className="mt-4">
            <ProgressBar value={taskProgress.percent} />
          </div>
          <p className="mt-4 text-sm text-slate-600">待复练错句：{activeErrors} 条</p>
        </Card>
      </div>

      <Card>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-semibold text-indigo-600">学生端</p>
            <h2 className="mt-1 text-lg font-bold">少儿友好的口语练习</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">用跟读、实时对话和错句复练降低开口难度。</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-600">AI 助教</p>
            <h2 className="mt-1 text-lg font-bold">即时反馈与复练路径</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">把错误表达自动沉淀到错句本，并引导学生复练。</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-600">家长/老师</p>
            <h2 className="mt-1 text-lg font-bold">学习报告可视化</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">用少儿口语盾牌和简洁建议说明学习表现。</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
