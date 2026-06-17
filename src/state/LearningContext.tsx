import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { demoTasks, demoUnit, initialDialogueMessages } from "../data/demoData";
import { analyzeDialogueAnswer } from "../services/aiService";
import type { DialogueMessage, ErrorSentence, ErrorStatus, PracticeTask, Unit } from "../types";

const TASKS_KEY = "ai-speaking-coach.tasks";
const ERRORS_KEY = "ai-speaking-coach.errors";
const MESSAGES_KEY = "ai-speaking-coach.dialogueMessages";
const LEGACY_STORAGE_KEYS = ["speaking_buddy_tasks", "speaking_buddy_errors", "speaking_buddy_messages"];

type LearningContextValue = {
  currentUnit: Unit;
  tasks: PracticeTask[];
  errors: ErrorSentence[];
  dialogueMessages: DialogueMessage[];
  taskProgress: { completed: number; total: number; percent: number };
  errorStats: { total: number; pending: number; practicing: number; mastered: number };
  addError: (error: Omit<ErrorSentence, "id" | "createdAt" | "status"> & Partial<Pick<ErrorSentence, "status">>) => void;
  updateErrorStatus: (id: string, status: ErrorStatus) => void;
  updateTaskStatus: (idOrType: string, status: PracticeTask["status"]) => void;
  submitDialogueAnswer: (
    answer: string,
    questionOverride?: string,
    followUpQuestionOverride?: string,
  ) => Promise<Awaited<ReturnType<typeof analyzeDialogueAnswer>>>;
  resetDemoData: () => void;
};

const LearningContext = createContext<LearningContextValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function freshDemoTasks() {
  return demoTasks.map((task) => ({ ...task }));
}

function freshDemoMessages() {
  return initialDialogueMessages.map((message) => ({ ...message }));
}

function freshDemoErrors() {
  return [];
}

function inferDialogueQuestion(error: ErrorSentence) {
  const text = `${error.originalSentence} ${error.correctedSentence}`.toLowerCase();
  if (text.includes("milk")) return "Do you like milk?";
  if (text.includes("apple") || text.includes("banana")) return "What fruit do you like?";
  return "What food do you like?";
}

function normalizeStoredErrors(errors: ErrorSentence[]) {
  if (errors.length === 1 && errors[0]?.id === "error-dialogue-demo") return [];
  return errors.map((error) =>
    error.source === "dialogue" && !error.question ? { ...error, question: inferDialogueQuestion(error) } : error,
  );
}

function normalizeStoredMessages(messages: DialogueMessage[]) {
  const hasBrokenText = messages.some((message) => message.role === "ai" && !message.content.includes("口语反馈") && message.content.includes("\\"));

  return hasBrokenText ? initialDialogueMessages : messages;
}

function createError(
  error: Omit<ErrorSentence, "id" | "createdAt" | "status"> & Partial<Pick<ErrorSentence, "status">>,
): ErrorSentence {
  return {
    ...error,
    id: `error-${Date.now()}`,
    status: error.status ?? "pending",
    createdAt: new Date().toISOString(),
  };
}

function nextQuestion(messages: DialogueMessage[]) {
  const studentTurns = messages.filter((message) => message.role === "student").length;
  return demoUnit.aiQuestions[studentTurns % demoUnit.aiQuestions.length];
}

function formatAiReply(feedback: string, followUpQuestion: string, isCorrect: boolean) {
  const bridge = isCorrect ? "下一题：" : "我已经把这句话加入错句本。下一题：";
  return `口语反馈：${feedback}\n${bridge}${followUpQuestion}`;
}

export function LearningProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<PracticeTask[]>(() => readStorage(TASKS_KEY, freshDemoTasks()));
  const [errors, setErrors] = useState<ErrorSentence[]>(() =>
    normalizeStoredErrors(readStorage(ERRORS_KEY, freshDemoErrors())),
  );
  const [dialogueMessages, setDialogueMessages] = useState<DialogueMessage[]>(() =>
    normalizeStoredMessages(readStorage(MESSAGES_KEY, freshDemoMessages())),
  );

  const persistTasks = (next: PracticeTask[]) => {
    setTasks(next);
    writeStorage(TASKS_KEY, next);
  };

  const persistErrors = (next: ErrorSentence[]) => {
    setErrors(next);
    writeStorage(ERRORS_KEY, next);
  };

  const persistMessages = (next: DialogueMessage[]) => {
    setDialogueMessages(next);
    writeStorage(MESSAGES_KEY, next);
  };

  const addError: LearningContextValue["addError"] = (error) => {
    const incoming = createError(error);
    const existing = errors.find(
      (item) => item.originalSentence.trim().toLowerCase() === incoming.originalSentence.trim().toLowerCase(),
    );
    const next = existing
      ? errors.map((item) =>
          item.id === existing.id
            ? {
                ...item,
                question: incoming.question ?? item.question,
                status: item.status === "mastered" ? "practicing" : item.status,
              }
            : item,
        )
      : [incoming, ...errors];

    persistErrors(next);
  };

  const updateTaskStatus: LearningContextValue["updateTaskStatus"] = (idOrType, status) => {
    persistTasks(tasks.map((task) => (task.id === idOrType || task.type === idOrType ? { ...task, status } : task)));
  };

  const updateErrorStatus: LearningContextValue["updateErrorStatus"] = (id, status) => {
    const nextErrors = errors.map((error) => (error.id === id ? { ...error, status } : error));
    persistErrors(nextErrors);

    const mastered = nextErrors.filter((error) => error.status === "mastered").length;
    const hasPendingReview = nextErrors.some((error) => error.status !== "mastered");
    const reviewStatus: PracticeTask["status"] =
      nextErrors.length > 0 && !hasPendingReview ? "completed" : mastered > 0 ? "in_progress" : "not_started";
    persistTasks(tasks.map((task) => (task.type === "review" ? { ...task, status: reviewStatus } : task)));
  };

  const submitDialogueAnswer: LearningContextValue["submitDialogueAnswer"] = async (
    answer,
    questionOverride,
    followUpQuestionOverride,
  ) => {
    const question = questionOverride ?? nextQuestion(dialogueMessages);
    const analysis = await analyzeDialogueAnswer({ question, answer });
    const studentMessage: DialogueMessage = {
      id: `message-student-${Date.now()}`,
      role: "student",
      content: answer,
    };
    const messagesWithStudent = [...dialogueMessages, studentMessage];
    const followUpQuestion = followUpQuestionOverride ?? nextQuestion(messagesWithStudent);
    const aiMessage: DialogueMessage = {
      id: `message-ai-${Date.now()}`,
      role: "ai",
      content: formatAiReply(analysis.feedback, followUpQuestion, analysis.isCorrect),
    };

    persistMessages([...messagesWithStudent, aiMessage]);
    updateTaskStatus("dialogue", "completed");

    if (!analysis.isCorrect && analysis.correctedSentence && analysis.explanation && analysis.errorType) {
      addError({
        question,
        originalSentence: answer,
        correctedSentence: analysis.correctedSentence,
        explanation: analysis.explanation,
        errorType: analysis.errorType,
        source: "dialogue",
      });
    }

    return analysis;
  };

  const resetDemoData = () => {
    if (typeof window !== "undefined") {
      LEGACY_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.sessionStorage.removeItem("ai-speaking-review-round");
      window.sessionStorage.removeItem("ai-speaking-review-skipped");
    }

    persistTasks(freshDemoTasks());
    persistErrors(freshDemoErrors());
    persistMessages(freshDemoMessages());
  };

  const taskProgress = useMemo(() => {
    const completed = tasks.filter((task) => task.status === "completed").length;
    const total = tasks.length;
    return { completed, total, percent: total ? Math.round((completed / total) * 100) : 0 };
  }, [tasks]);

  const errorStats = useMemo(
    () => ({
      total: errors.length,
      pending: errors.filter((error) => error.status === "pending").length,
      practicing: errors.filter((error) => error.status === "practicing").length,
      mastered: errors.filter((error) => error.status === "mastered").length,
    }),
    [errors],
  );

  const value: LearningContextValue = {
    currentUnit: demoUnit,
    tasks,
    errors,
    dialogueMessages,
    taskProgress,
    errorStats,
    addError,
    updateErrorStatus,
    updateTaskStatus,
    submitDialogueAnswer,
    resetDemoData,
  };

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const context = useContext(LearningContext);
  if (!context) throw new Error("useLearning must be used inside LearningProvider");
  return context;
}
