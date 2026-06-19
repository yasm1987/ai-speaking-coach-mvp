import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, PageHeader, ProgressBar } from "../components/UI";
import { analyzeReading } from "../services/aiService";
import { createAudioRecorder, describeMicrophoneError } from "../services/recorder";
import { playTeacherSpeech, stopTeacherSpeech } from "../services/teacherSpeech";
import { useLearning } from "../state/LearningContext";

type Feedback = {
  score: number;
  feedback: string;
  lowScoreWords: string[];
};

type PracticeMode = "word" | "sentence" | "all";
type PracticePhase = "playing" | "recording" | "analyzing" | "feedback";
type PracticeItem = {
  id: string;
  text: string;
  meaning: string;
  label: "词汇" | "句型";
  taskType: "word" | "sentence";
};
type TextPart = {
  text: string;
  wordIndex?: number;
};

export default function PracticePage() {
  const { currentUnit, tasks, errors, addError, updateTaskStatus } = useLearning();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = getPracticeMode(searchParams.get("mode"));
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [phase, setPhase] = useState<PracticePhase>("playing");
  const [micError, setMicError] = useState("");
  const [micStatus, setMicStatus] = useState("等待自动开始");
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [activeReadWordIndex, setActiveReadWordIndex] = useState<number | null>(null);
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const advanceTimerRef = useRef<number | null>(null);
  const playbackFallbackRef = useRef<number | null>(null);
  const activeCycleRef = useRef(0);
  const hasNewReviewNeededRef = useRef(false);

  const items = useMemo<PracticeItem[]>(() => {
    const wordItems = currentUnit.words.map((word) => ({ ...word, label: "词汇" as const, taskType: "word" as const }));
    const sentenceItems = currentUnit.sentences.map((sentence) => ({
      ...sentence,
      label: "句型" as const,
      taskType: "sentence" as const,
    }));

    if (mode === "word") return wordItems;
    if (mode === "sentence") return sentenceItems;
    return [...wordItems, ...sentenceItems];
  }, [currentUnit, mode]);

  const current = items[index] ?? items[0];
  const textParts = useMemo(() => getTextParts(current.text), [current.text]);
  const percent = Math.round(((index + (feedback ? 1 : 0)) / items.length) * 100);
  const recordingLimitSeconds = getRecordingLimitSeconds(current);
  const recordingProgress = Math.min((recordingElapsedMs / (recordingLimitSeconds * 1000)) * 100, 100);
  const lowScoreThreshold = 85;
  const progressLabel = mode === "word" ? "词汇跟读进度" : mode === "sentence" ? "句型跟读进度" : "练习进度";
  const phaseLabel = {
    playing: "正在播放标准音",
    recording: "正在录音",
    analyzing: "AI 正在分析",
    feedback: "查看反馈",
  }[phase];

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const clearPlaybackFallback = () => {
    if (playbackFallbackRef.current) {
      window.clearTimeout(playbackFallbackRef.current);
      playbackFallbackRef.current = null;
    }
  };

  const stopCurrentMedia = () => {
    stopTeacherSpeech();
    clearRecordingTimer();
    clearPlaybackFallback();

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recordingChunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const analyzeRecording = async (cycleId: number, audioBlob?: Blob | null) => {
    setPhase("analyzing");
    setMicStatus("录音完成，AI 正在分析");
    const result = await analyzeReading({ targetText: current.text, userText: current.text, audioBlob });
    if (activeCycleRef.current !== cycleId) return;
    if (result.score < lowScoreThreshold) {
      hasNewReviewNeededRef.current = true;
      addError({
        originalSentence: current.text,
        correctedSentence: current.text,
        explanation: `本题跟读得分 ${result.score} 分，低于 ${lowScoreThreshold} 分，需要复练发音、节奏和清晰度。`,
        errorType: current.taskType === "word" ? "词汇发音" : "句子跟读",
        source: "reading",
      });
    }
    setFeedback(result);
    setPhase("feedback");
  };

  const startRecordingTimer = (cycleId: number) => {
    setRecordingElapsedMs(0);
    const startedAt = Date.now();
    recordingTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setRecordingElapsedMs(Math.min(elapsed, recordingLimitSeconds * 1000));
      if (elapsed >= recordingLimitSeconds * 1000) stopRecording(cycleId);
    }, 100);
  };

  const stopRecording = (cycleId: number) => {
    clearRecordingTimer();

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
      recorderRef.current = null;
      setPhase("analyzing");
      return;
    }

    void analyzeRecording(cycleId, null);
  };

  const startDemoRecording = (cycleId: number) => {
    updateTaskStatus(current.taskType, "in_progress");
    setMicStatus("演示录音中，未连接真实麦克风");
    setPhase("recording");
    startRecordingTimer(cycleId);
  };

  const startRecording = async (cycleId: number) => {
    setMicError("");
    setFeedback(null);
    setAutoAdvanceSeconds(null);

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMicError("当前浏览器不支持真实录音，已切换为演示录音进度。");
      startDemoRecording(cycleId);
      return;
    }

    try {
      setMicStatus("正在请求麦克风权限...");
      updateTaskStatus(current.taskType, "in_progress");
      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia({ audio: true }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("microphone-request-timeout")), 8000);
        }),
      ]);
      if (activeCycleRef.current !== cycleId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      setMicStatus("麦克风录音中");
      setPhase("recording");
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
        if (activeCycleRef.current === cycleId) void analyzeRecording(cycleId, audioBlob);
      };

      recorder.start();
      startRecordingTimer(cycleId);
    } catch (error) {
      if (activeCycleRef.current !== cycleId) return;
      setMicError(describeMicrophoneError(error));
      startDemoRecording(cycleId);
    }
  };

  const playStandardAudio = (cycleId: number) => {
    setPhase("playing");
    setMicStatus("正在播放标准音，播放结束后自动录音");
    setActiveReadWordIndex(0);
    const spokenWordCount = getSpokenWordCount(current.text);

    const startRecordingOnce = (() => {
      let started = false;
      return () => {
        if (started || activeCycleRef.current !== cycleId) return;
        started = true;
        clearPlaybackFallback();
        setActiveReadWordIndex(null);
        void startRecording(cycleId);
      };
    })();

    void playTeacherSpeech(current.text, {
      onDone: startRecordingOnce,
      onProgress: (progress) => {
        if (activeCycleRef.current !== cycleId) return;
        const activeIndex = Math.min(Math.floor(progress * spokenWordCount), Math.max(spokenWordCount - 1, 0));
        setActiveReadWordIndex(activeIndex);
      },
    });
  };

  const finishCurrentItem = () => {
    if (index >= items.length - 1) {
      updateTaskStatus(current.taskType, "completed");
      navigate(shouldOpenReportAfterTask(current.taskType, tasks, errors, hasNewReviewNeededRef.current) ? "/report" : "/tasks");
      return;
    }

    if (mode === "all" && current.taskType === "word" && items[index + 1]?.taskType === "sentence") {
      updateTaskStatus("word", "completed");
    }

    setIndex((value) => value + 1);
  };

  useEffect(() => {
    setIndex(0);
    hasNewReviewNeededRef.current = false;
  }, [mode]);

  useEffect(() => {
    activeCycleRef.current += 1;
    const cycleId = activeCycleRef.current;
    stopCurrentMedia();
    clearAdvanceTimer();
    setFeedback(null);
    setMicError("");
    setRecordingElapsedMs(0);
    setActiveReadWordIndex(null);
    setAutoAdvanceSeconds(null);

    const startTimer = window.setTimeout(() => playStandardAudio(cycleId), 500);

    return () => {
      window.clearTimeout(startTimer);
      stopCurrentMedia();
    };
  }, [index, mode]);

  useEffect(() => {
    if (!feedback || phase !== "feedback") return;

    setAutoAdvanceSeconds(3);
    const countdownTimer = window.setInterval(() => {
      setAutoAdvanceSeconds((seconds) => (seconds === null ? null : Math.max(0, seconds - 1)));
    }, 1000);
    advanceTimerRef.current = window.setTimeout(() => {
      window.clearInterval(countdownTimer);
      setAutoAdvanceSeconds(null);
      finishCurrentItem();
    }, 3000);

    return () => {
      window.clearInterval(countdownTimer);
      clearAdvanceTimer();
    };
  }, [feedback, phase, index, items.length]);

  useEffect(() => {
    if (!navigator.permissions?.query) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((permission) => {
        const updateStatus = () => {
          if (phase === "playing" || phase === "recording" || phase === "analyzing") return;
          const map = {
            granted: "麦克风权限已允许",
            denied: "麦克风权限已被拒绝",
            prompt: "等待自动请求麦克风权限",
          };
          setMicStatus(map[permission.state]);
        };

        updateStatus();
        permission.onchange = updateStatus;
      })
      .catch(() => undefined);
  }, [phase]);

  useEffect(() => {
    return () => {
      activeCycleRef.current += 1;
      stopCurrentMedia();
      clearAdvanceTimer();
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI 练习流程"
        title="考试式自动跟读"
        description="系统会自动播放标准音、自动录音、自动分析并进入下一题。词汇跟读会覆盖内容库中今天全部词汇。"
      />

      <Card>
        <div className="flex items-center justify-between text-sm font-semibold">
          <span>{progressLabel}</span>
          <span className="text-indigo-700">
            {Math.min(index + 1, items.length)} / {items.length}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={percent} />
        </div>
      </Card>

      <Card className="min-h-[430px] border-indigo-100 bg-indigo-50">
        <div className="grid min-h-[390px] grid-rows-[auto_auto_1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-indigo-700">{current.label}跟读</p>
              <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-indigo-700">{phaseLabel}</span>
            </div>
            <h2 className="mt-4 min-h-12 text-4xl font-bold leading-tight text-slate-950">
              {textParts.map((part, partIndex) =>
                part.wordIndex === undefined ? (
                  <span key={`${part.text}-${partIndex}`}>{part.text}</span>
                ) : (
                  <span
                    key={`${part.text}-${partIndex}`}
                    className={`rounded-lg px-1 transition-colors duration-150 ${
                      part.wordIndex === activeReadWordIndex ? "bg-amber-200 text-slate-950" : "bg-transparent"
                    }`}
                  >
                    {part.text}
                  </span>
                ),
              )}
            </h2>
            <p className="mt-2 min-h-7 text-lg text-slate-600">{current.meaning}</p>
          </div>

          <div className="mt-6 rounded-2xl bg-white/70 p-4">
            <p className="text-sm font-semibold text-indigo-900">
              {phase === "playing"
                ? "请听标准音，跟随高亮文字准备作答。"
                : phase === "recording"
                  ? "现在开始作答，请在规定时间内读出内容。"
                  : phase === "analyzing"
                    ? "录音已提交，AI 正在分析。"
                    : "反馈已生成，稍后自动进入下一题。"}
            </p>
            <p className="mt-2 text-sm text-indigo-700">麦克风状态：{micStatus}</p>
          </div>

          <div className="mt-4">
            <div className="min-h-[110px] rounded-2xl bg-white/80 p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-indigo-900">
                <span>{phaseLabel}</span>
                <span>
                  {(recordingElapsedMs / 1000).toFixed(1)}s / {recordingLimitSeconds}s
                </span>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full transition-[width] duration-100 ease-linear"
                  style={{
                    width: `${recordingProgress}%`,
                    backgroundColor: phase === "recording" || phase === "analyzing" ? "#f43f5e" : "#cbd5e1",
                  }}
                />
              </div>
              <p className="mt-3 text-xs font-semibold text-slate-500">
                {phase === "recording" ? "时间到会自动停止录音并提交分析。" : "播放结束后会自动开始录音。"}
              </p>
            </div>
          </div>

          <div className="mt-4 min-h-12">
            {micError ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700">{micError}</p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">AI 反馈</h2>
          {autoAdvanceSeconds ? (
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
              {autoAdvanceSeconds} 秒后自动进入下一题
            </span>
          ) : null}
        </div>
        {phase === "analyzing" ? (
          <p className="mt-4 flex min-h-32 items-center rounded-2xl bg-indigo-50 p-4 text-sm font-semibold leading-7 text-indigo-700">
            AI 正在分析录音...
          </p>
        ) : feedback ? (
          <div className="mt-4 min-h-32 rounded-2xl bg-emerald-50 p-4">
            <p className="text-2xl font-bold text-emerald-700">{feedback.score} 分</p>
            <p className="mt-2 leading-7 text-emerald-800">{feedback.feedback}</p>
            <p className="mt-2 text-sm text-slate-500">
              需要注意：{feedback.lowScoreWords.length ? feedback.lowScoreWords.join(", ") : "暂无"}
            </p>
          </div>
        ) : (
          <p className="mt-4 flex min-h-32 items-center rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            系统会在录音结束后自动提交分析。真实接口不可用时，会明确显示演示兜底反馈。
          </p>
        )}
      </Card>

      <div className="flex min-h-11 justify-end">
        <Link to="/" className="block">
          <Button variant="ghost" className="w-full border border-slate-200 sm:w-auto">
            中止练习，返回首页
          </Button>
        </Link>
      </div>
    </div>
  );
}

function getPracticeMode(mode: string | null): PracticeMode {
  if (mode === "word" || mode === "sentence") return mode;
  return "all";
}

function getRecordingLimitSeconds(item: PracticeItem) {
  if (item.taskType === "word") return 3;

  const words = item.text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSpeakingSeconds = Math.ceil(words / 2.2 + 2);
  return Math.max(5, Math.min(10, estimatedSpeakingSeconds));
}

function getSpokenWordCount(text: string) {
  return Math.max(text.trim().split(/\s+/).filter(Boolean).length, 1);
}

function getTextParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let cursor = 0;
  let wordIndex = 0;

  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    if (start > cursor) parts.push({ text: text.slice(cursor, start) });
    parts.push({ text: match[0], wordIndex });
    cursor = start + match[0].length;
    wordIndex += 1;
  }

  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

function shouldOpenReportAfterTask(
  completedType: "word" | "sentence",
  tasks: { type: string; status: string }[],
  errors: { status: string }[],
  hasNewReviewNeeded: boolean,
) {
  const nextTasks = tasks.map((task) => (task.type === completedType ? { ...task, status: "completed" } : task));
  const coreDone = ["word", "sentence", "dialogue"].every((type) =>
    nextTasks.some((task) => task.type === type && task.status === "completed"),
  );
  const hasPendingReview = hasNewReviewNeeded || errors.some((error) => error.status !== "mastered");
  const reviewDone = nextTasks.some((task) => task.type === "review" && task.status === "completed");

  return coreDone && (!hasPendingReview || reviewDone);
}
