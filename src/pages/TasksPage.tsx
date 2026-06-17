import { Link } from "react-router-dom";
import { Button, Card, PageHeader, ProgressBar, StatusBadge } from "../components/UI";
import { useLearning } from "../state/LearningContext";

const taskLinks = {
  word: "/practice?mode=word",
  sentence: "/practice?mode=sentence",
  dialogue: "/dialogue",
  review: "/errors",
  report: "/report",
};

export default function TasksPage() {
  const { tasks, errors, taskProgress } = useLearning();
  const reviewCount = errors.filter((error) => error.status !== "mastered").length;
  const displayTasks = tasks.map((task) =>
    task.type === "review"
      ? {
          ...task,
          title: reviewCount > 0 ? `错句复练 ${reviewCount} 条` : "暂无错句复练",
          description:
            reviewCount > 0
              ? `错句本里当前有 ${reviewCount} 条待复练内容，完成两轮后会进入学习报告。`
              : "当前没有待复练错句，可以继续完成其他口语任务。",
        }
      : task,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="今日任务"
        title="今天先完成这一组口语闭环"
        description="任务会根据当前教材单元生成。学生点击开始进入练习，状态由系统自动更新。"
      />

      <Card className="border-indigo-100 bg-indigo-50">
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>任务完成度</span>
          <span className="text-indigo-700">
            {taskProgress.completed} / {taskProgress.total}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={taskProgress.percent} />
        </div>
      </Card>

      <section className="grid gap-4">
        {displayTasks.map((task) => (
          <Card key={task.id}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold">{task.title}</h2>
                  <StatusBadge status={task.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{task.description}</p>
              </div>
              <Link to={taskLinks[task.type]} className="shrink-0">
                <Button>{task.type === "report" ? "查看" : task.status === "in_progress" ? "继续" : "开始"}</Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
