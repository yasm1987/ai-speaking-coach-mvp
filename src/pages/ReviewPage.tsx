import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, PageHeader, ProgressBar } from "../components/UI";
import { analyzeReading, checkReviewStep, generateReviewSteps } from "../services/aiService";
import { createAudioRecorder } from "../services/recorder";
import { playTeacherSpeech, stopTeacherSpeech } from "../services/teacherSpeech";
import { useLearning } from "../state/LearningContext";
import type { ErrorSentence, PracticeTask } from "../types";

type ReviewSteps = Awaited<ReturnType<typeof generateReviewSteps>>;
type ReviewMode = "reading" | "dialogue";
type Phase = "playing" | "recording" | "analyzing" | "feedback";

const REVIEW_PASS_SCORE = 85;
const FEEDBACK_HOLD_SECONDS = 7;
const MAX_REVIEW_ATTEMPTS = 3;
const REVIEW_ROUND_KEY = "ai-speaking-review-round";
const REVIEW_SKIPPED_KEY = "ai-speaking-review-skipped";

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, errors, updateErrorStatus, updateTaskStatus } = useLearning();
  const [phase, setPhase] = useState<Phase>("playing");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [reviewSteps, setReviewSteps] = useState<ReviewSteps | null>(null);
  const timerRef = useRef<number | null>(null);
  const playbackFallbackRef = useRef<number | null>(null);
  const promptStartTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const cycleRef = useRef(0);
  const attemptRef = useRef(0);
  const reviewRoundRef = useRef(readReviewRound());
  const skippedErrorIdsRef = useRef<string[]>(readReviewSkippedIds());
  const error = errors.find((item) => item.id === id);
  const mode: ReviewMode = error?.source === "dialogue" ? "dialogue" : "reading";

  useEffect(() => {
    if (!error) return;
    attemptRef.current = 0;
    setRetryToken(0);
    generateReviewSteps(error).then(setReviewSteps);
  }, [error?.id]);

  const targetText = error?.correctedSentence ?? "";
  const dialogueQuestion = error?.question ?? reviewSteps?.followUpQuestion ?? "What food do you like?";
  const progress = phase === "feedback" ? 100 : phase === "analyzing" ? 75 : phase === "recording" ? 50 : 20;
  const limitSeconds = mode === "dialogue" ? 5 : getRecordingLimitSeconds(targetText);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const clearPlaybackFallback = () => {
    if (playbackFallbackRef.current) {
      window.clearTimeout(playbackFallbackRef.current);
      playbackFallbackRef.current = null;
    }
  };

  const clearPromptStartTimer = () => {
    if (promptStartTimerRef.current) {
      window.clearTimeout(promptStartTimerRef.current);
      promptStartTimerRef.current = null;
    }
  };

  const speak = (text: string, onDone?: () => void) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearPlaybackFallback();
      onDone?.();
    };

    void playTeacherSpeech(text, finish);
    playbackFallbackRef.current = window.setTimeout(finish, getPromptPlaybackFallbackMs(text));
  };

  const startRecording = (cycleId: number) => {
    if (cycleRef.current !== cycleId) return;
    setPhase("recording");
    setRecordingElapsedMs(0);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setRecordingElapsedMs(Math.min(elapsed, limitSeconds * 1000));
      if (elapsed >= limitSeconds * 1000) {
        clearTimer();
        stopRecording(cycleId);
      }
    }, 100);
  };

  const stopRecording = (cycleId: number) => {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
      return;
    }
    void analyzeReview(cycleId, null);
  };

  const startRealRecording = async (cycleId: number) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      startRecording(cycleId);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (cycleRef.current !== cycleId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const recorder = createAudioRecorder(stream);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob =
          recordingChunksRef.current.length > 0
            ? new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" })
            : null;
        recordingChunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cycleRef.current === cycleId) void analyzeReview(cycleId, audioBlob);
      };

      recorder.start();
      startRecording(cycleId);
    } catch {
      startRecording(cycleId);
    }
  };

  const stopCurrentRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recordingChunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const analyzeReview = async (cycleId: number, audioBlob?: Blob | null) => {
    if (!error || cycleRef.current !== cycleId) return;
    setPhase("analyzing");
    attemptRef.current += 1;

    let finalScore = 0;
    let baseFeedback = "";

    if (mode === "reading") {
      const result = await analyzeReading({ targetText, userText: targetText, audioBlob });
      if (cycleRef.current !== cycleId) return;
      finalScore = result.score;
      baseFeedback = result.feedback;
    } else {
      const result = await checkReviewStep({ error, stepIndex: 2, responseText: targetText });
      if (cycleRef.current !== cycleId) return;
      finalScore = result.passed ? 90 : 72;
      baseFeedback = result.feedback;
    }

    const passed = finalScore >= REVIEW_PASS_SCORE;
    const reachedMaxAttempts = attemptRef.current >= MAX_REVIEW_ATTEMPTS;
    const finalFeedback = passed
      ? `${baseFeedback} 已达到 ${REVIEW_PASS_SCORE} 分通过线，本条错句已掌握。`
      : reachedMaxAttempts
        ? `${baseFeedback} 已连续复练 ${MAX_REVIEW_ATTEMPTS} 次仍未达到 ${REVIEW_PASS_SCORE} 分，先保留在错句本，系统会跳到下一条错句。`
        : `${baseFeedback} 当前是第 ${attemptRef.current}/${MAX_REVIEW_ATTEMPTS} 次复练，还没有达到 ${REVIEW_PASS_SCORE} 分，请再练一次。`;

    setScore(finalScore);
    setFeedback(finalFeedback);
    setPhase("feedback");
    setAutoAdvanceSeconds(FEEDBACK_HOLD_SECONDS);
  };

  useEffect(() => {
    if (!error || !reviewSteps) return;
    cycleRef.current += 1;
    const cycleId = cycleRef.current;
    setFeedback("");
    setScore(null);
    setAutoAdvanceSeconds(null);
    setPhase("playing");
    setRecordingElapsedMs(0);
    if (retryToken === 0) {
      attemptRef.current = 0;
    }
    clearTimer();
    clearPlaybackFallback();
    clearPromptStartTimer();

    const prompt = mode === "dialogue" ? dialogueQuestion : targetText;
    promptStartTimerRef.current = window.setTimeout(() => {
      if (cycleRef.current !== cycleId) return;
      speak(prompt, () => void startRealRecording(cycleId));
    }, 250);

    return () => {
      cycleRef.current += 1;
      clearTimer();
      clearPlaybackFallback();
      clearPromptStartTimer();
      stopCurrentRecording();
      stopTeacherSpeech();
    };
  }, [error?.id, reviewSteps, mode, retryToken]);

  useEffect(() => {
    if (phase !== "feedback" || !error || score === null) return;
    const passed = score >= REVIEW_PASS_SCORE;
    const reachedMaxAttempts = attemptRef.current >= MAX_REVIEW_ATTEMPTS;

    const countdownTimer = window.setInterval(() => {
      setAutoAdvanceSeconds((seconds) => (seconds === null ? null : Math.max(0, seconds - 1)));
    }, 1000);
    const advanceTimer = window.setTimeout(() => {
      window.clearInterval(countdownTimer);

      if (passed) {
        skippedErrorIdsRef.current = skippedErrorIdsRef.current.filter((skippedId) => skippedId !== error.id);
        writeReviewSkippedIds(skippedErrorIdsRef.current);
        updateErrorStatus(error.id, "mastered");
        const destination = getNextReviewDestination(errors, error.id, "mastered", tasks, skippedErrorIdsRef.current, reviewRoundRef.current);
        applyReviewDestination(destination, skippedErrorIdsRef, reviewRoundRef, updateTaskStatus);
        navigate(destination.path);
        return;
      }

      updateErrorStatus(error.id, "practicing");
      if (reachedMaxAttempts) {
        skippedErrorIdsRef.current = [...new Set([...skippedErrorIdsRef.current, error.id])];
        writeReviewSkippedIds(skippedErrorIdsRef.current);
        const destination = getNextReviewDestination(errors, error.id, "practicing", tasks, skippedErrorIdsRef.current, reviewRoundRef.current);
        applyReviewDestination(destination, skippedErrorIdsRef, reviewRoundRef, updateTaskStatus);
        navigate(destination.path);
      } else {
        setRetryToken((value) => value + 1);
      }
    }, FEEDBACK_HOLD_SECONDS * 1000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [phase, score, error?.id]);

  if (!error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="错句复练" title="没有找到这条错句" />
        <Button onClick={() => navigate("/errors")}>返回错句本</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="错句复练"
        title={mode === "dialogue" ? "回到 AI 对话场景复练" : "回到 AI 跟读流程复练"}
        description={
          mode === "dialogue"
            ? "这类错句来自 AI 对话，所以只复练当时出错的那一个提问和回答。"
            : "这类错句来自词汇或句型跟读，所以使用同样的跟读界面和评分标准复练。"
        }
      />

      <Card className="border-amber-200 bg-amber-50">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div>
            <p className="text-xs font-bold text-amber-600">原来出错</p>
            <p className="mt-2 text-2xl font-black text-amber-900">{error.originalSentence}</p>
          </div>
          <div className="hidden text-2xl font-black text-amber-500 md:block">→</div>
          <div>
            <p className="text-xs font-bold text-emerald-600">复练目标</p>
            <p className="mt-2 text-2xl font-black text-emerald-800">{targetText}</p>
          </div>
        </div>
      </Card>

      <Card className={mode === "dialogue" ? "border-violet-100 bg-violet-50" : "border-indigo-100 bg-indigo-50"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-indigo-700">{mode === "dialogue" ? "AI 对话复练" : "AI 跟读复练"}</p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-indigo-700">{phaseText(phase)}</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={progress} color={mode === "dialogue" ? "bg-violet-600" : "bg-indigo-600"} />
        </div>

        {mode === "dialogue" ? (
          <div className="mt-6 rounded-3xl bg-white/80 p-5">
            <p className="text-xs font-bold text-violet-500">AI 老师</p>
            <h2 className="mt-2 text-3xl font-black text-slate-950">{dialogueQuestion}</h2>
            <p className="mt-5 text-xs font-bold text-slate-400">学生目标回答</p>
            <p className="mt-2 text-2xl font-black text-indigo-700">{targetText}</p>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl bg-white/80 p-5">
            <p className="text-xs font-bold text-indigo-500">跟读内容</p>
            <h2 className="mt-2 text-4xl font-black text-slate-950">{targetText}</h2>
          </div>
        )}

        <div className="mt-5 rounded-2xl bg-white/80 p-4">
          <div className="flex items-center justify-between text-sm font-bold text-indigo-900">
            <span>{phase === "recording" ? "正在录音" : "自动流程"}</span>
            <span>
              {(recordingElapsedMs / 1000).toFixed(1)}s / {limitSeconds}s
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-rose-500 transition-[width] duration-100 ease-linear"
              style={{ width: `${Math.min((recordingElapsedMs / (limitSeconds * 1000)) * 100, 100)}%` }}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">AI 复练反馈</h2>
          {autoAdvanceSeconds ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              {feedbackBadgeText(score, attemptRef.current, autoAdvanceSeconds)}
            </span>
          ) : null}
        </div>
        <div className="mt-4 min-h-32 rounded-2xl bg-slate-50 p-4">
          {phase === "feedback" ? (
            <>
              <p className={score !== null && score >= REVIEW_PASS_SCORE ? "text-2xl font-black text-emerald-700" : "text-2xl font-black text-amber-700"}>
                {score} 分
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{feedback}</p>
              <p className={score !== null && score >= REVIEW_PASS_SCORE ? "mt-2 text-sm font-bold text-emerald-700" : "mt-2 text-sm font-bold text-amber-700"}>
                {statusHint(score, attemptRef.current)}
              </p>
            </>
          ) : (
            <p className="text-sm leading-7 text-slate-600">系统会自动播放、录音并按原练习标准判断。</p>
          )}
        </div>
      </Card>

      <div className="flex justify-end">
        <Link to="/errors">
          <Button variant="ghost" className="border border-slate-200">
            返回错句本
          </Button>
        </Link>
      </div>
    </div>
  );
}

function phaseText(phase: Phase) {
  const labels = {
    playing: "正在播放",
    recording: "正在录音",
    analyzing: "AI 正在判断",
    feedback: "查看反馈",
  };
  return labels[phase];
}

function feedbackBadgeText(score: number | null, attempt: number, seconds: number) {
  if (score !== null && score >= REVIEW_PASS_SCORE) return `${seconds} 秒后进入下一条`;
  if (attempt >= MAX_REVIEW_ATTEMPTS) return `${seconds} 秒后跳到下一条`;
  return `${seconds} 秒后再练一次`;
}

function statusHint(score: number | null, attempt: number) {
  if (score !== null && score >= REVIEW_PASS_SCORE) return "已达到通过线，本条错句停止复练。";
  if (attempt >= MAX_REVIEW_ATTEMPTS) return "已练习 3 次仍未掌握，本条先保留，继续复练下一条。";
  return "未达到通过线，本条继续复练。";
}

function getRecordingLimitSeconds(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 1) return 3;
  return Math.max(5, Math.min(10, Math.ceil(words / 2.2 + 2)));
}

function getPromptPlaybackFallbackMs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 1) return 4200;
  return Math.max(4200, Math.ceil((words / 1.3 + 1.5) * 1000));
}

function getNextReviewDestination(
  errors: ErrorSentence[],
  currentId: string,
  nextStatus: ErrorSentence["status"],
  tasks: { type: string; status: string }[],
  skippedErrorIds: string[],
  reviewRound: number,
) {
  const nextErrors = errors.map((error) => (error.id === currentId ? { ...error, status: nextStatus } : error));
  const currentIndex = Math.max(
    0,
    nextErrors.findIndex((error) => error.id === currentId),
  );
  const orderedErrors = [...nextErrors.slice(currentIndex + 1), ...nextErrors.slice(0, currentIndex)];
  const nextError = orderedErrors.find(
    (error) => error.id !== currentId && error.status !== "mastered" && !skippedErrorIds.includes(error.id),
  );
  if (nextError) return { path: `/review/${nextError.id}`, startNextRound: false, completeReview: false };

  const hasPendingReview = nextErrors.some((error) => error.status !== "mastered");
  if (hasPendingReview) {
    const nextRoundError = nextErrors.find((error) => error.status !== "mastered");
    if (reviewRound < 2 && nextRoundError) {
      return { path: `/review/${nextRoundError.id}`, startNextRound: true, completeReview: false };
    }

    return { path: "/report", startNextRound: false, completeReview: true };
  }

  return {
    path: shouldOpenReportAfterReview(tasks, nextErrors) ? "/report" : "/tasks",
    startNextRound: false,
    completeReview: true,
  };
}

function applyReviewDestination(
  destination: { path: string; startNextRound: boolean; completeReview: boolean },
  skippedErrorIdsRef: MutableRefObject<string[]>,
  reviewRoundRef: MutableRefObject<number>,
  updateTaskStatus: (idOrType: string, status: PracticeTask["status"]) => void,
) {
  if (destination.startNextRound) {
    skippedErrorIdsRef.current = [];
    writeReviewSkippedIds([]);
    reviewRoundRef.current += 1;
    writeReviewRound(reviewRoundRef.current);
  }

  if (destination.completeReview) {
    updateTaskStatus("review", "completed");
    clearReviewSession();
  }
}

function shouldOpenReportAfterReview(tasks: { type: string; status: string }[], errors: { status: string }[]) {
  const coreDone = ["word", "sentence", "dialogue"].every((type) =>
    tasks.some((task) => task.type === type && task.status === "completed"),
  );
  const allErrorsMastered = errors.every((error) => error.status === "mastered");

  return coreDone && allErrorsMastered;
}

function readReviewRound() {
  if (typeof window === "undefined") return 1;
  const value = Number(window.sessionStorage.getItem(REVIEW_ROUND_KEY));
  return value === 2 ? 2 : 1;
}

function writeReviewRound(round: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REVIEW_ROUND_KEY, String(round));
}

function readReviewSkippedIds() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(REVIEW_SKIPPED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeReviewSkippedIds(ids: string[]) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REVIEW_SKIPPED_KEY, JSON.stringify([...new Set(ids)]));
}

function clearReviewSession() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(REVIEW_ROUND_KEY);
  window.sessionStorage.removeItem(REVIEW_SKIPPED_KEY);
}
