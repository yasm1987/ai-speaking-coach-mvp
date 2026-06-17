import type React from "react";
import { NavLink } from "react-router-dom";
import type { ErrorStatus, PracticeTask } from "../types";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "success" | "ghost" }) {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "bg-white text-slate-600 hover:bg-slate-50",
  };

  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, color = "bg-indigo-600" }: { value: number; color?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}

export function ShieldRating({ score, maxScore = 5 }: { score: number; maxScore?: number }) {
  const earned = Math.max(0, Math.min(score, maxScore));

  return (
    <div className="flex items-center" aria-label={`${earned}/${maxScore} 盾牌`}>
      <div className="flex items-center gap-2">
        {Array.from({ length: maxScore }).map((_, index) => {
          const filled = index < earned;

          return (
            <span
              key={index}
              className={`block h-4 w-4 rounded-full ${
                filled ? "bg-[#10a7c8] ring-2 ring-[#7ad85a]" : "border-2 border-slate-300 bg-white"
              }`}
              title={filled ? "已获得盾牌" : "未获得盾牌"}
            />
          );
        })}
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: PracticeTask["status"] | ErrorStatus }) {
  const styles = {
    not_started: "bg-slate-100 text-slate-600",
    in_progress: "bg-violet-100 text-violet-700",
    completed: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    practicing: "bg-violet-100 text-violet-700",
    mastered: "bg-emerald-100 text-emerald-700",
  };
  const labels = {
    not_started: "未开始",
    in_progress: "进行中",
    completed: "已完成",
    pending: "待复练",
    practicing: "练习中",
    mastered: "已掌握",
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header>
      <p className="text-sm font-semibold text-indigo-600">{eyebrow}</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
      {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
    </header>
  );
}

export function NavBar() {
  const links = [
    { to: "/", label: "产品首页" },
    { to: "/tasks", label: "今日任务" },
    { to: "/library", label: "内容库" },
    { to: "/practice", label: "AI 练习" },
    { to: "/dialogue", label: "AI 对话" },
    { to: "/errors", label: "错句本" },
    { to: "/report", label: "学习报告" },
  ];

  return (
    <nav className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex max-w-[960px] gap-2 overflow-x-auto pb-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) =>
              `shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
