import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, PageHeader } from "../components/UI";
import { recognizeSpeech } from "../services/aiService";
import { buildAudioFileName, createAudioRecorder } from "../services/recorder";
import { playTeacherSpeech, stopTeacherSpeech, warmTeacherSpeech } from "../services/teacherSpeech";
import { useLearning } from "../state/LearningContext";

type DialoguePhase = "teacher" | "listening" | "recognizing" | "retry" | "guidance" | "feedback" | "completed";
type SceneMessage = {
  id: string;
  role: "teacher" | "student" | "system";
  content: string;
  highlight?: string;
};
type AfterFeedbackAction = "ask_followup" | "next_preset";

function getDemoTranscript(question: string) {
  if (question.includes("milk")) return "I don't like milk.";
  if (question.includes("fruit")) return "I like bananas.";
  return "I like apples.";
}

function getGuidance(referenceAnswer: string) {
  return `I couldn't hear you clearly. The reference answer is: ${referenceAnswer}. Listen to the question again, then answer.`;
}

function getAnswerRecordingMs(question: string) {
  const words = question.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(6500, Math.ceil((words / 1.45 + 3.2) * 1000));
}

function extractFollowUpQuestion(reply: string) {
  const match = reply.match(/([A-Z][^.!?]*\?)/g);
  return match?.at(-1)?.trim() ?? "";
}

function removeFollowUpQuestion(reply: string, followUpQuestion: string) {
  if (!followUpQuestion) return reply;
  return reply.replace(followUpQuestion, "").replace(/\s+/g, " ").trim();
}

function getWebkitAudioContext(): typeof AudioContext | undefined {
  return (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export default function DialoguePage() {
  const { currentUnit, tasks, errors, submitDialogueAnswer } = useLearning();
  const navigate = useNavigate();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<DialoguePhase>("teacher");
  const [attempt, setAttempt] = useState(0);
  const [guidanceGiven, setGuidanceGiven] = useState(false);
  const [postGuidanceAttempt, setPostGuidanceAttempt] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const [sceneMessages, setSceneMessages] = useState<SceneMessage[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState("");
  const [, setAfterFeedbackAction] = useState<AfterFeedbackAction>("next_preset");
  const cycleRef = useRef(0);
  const attemptRef = useRef(0);
  const guidanceGivenRef = useRef(false);
  const postGuidanceAttemptRef = useRef(0);
  const followUpQuestionRef = useRef("");
  const activeQuestionRef = useRef("");
  const afterFeedbackActionRef = useRef<AfterFeedbackAction>("next_preset");
  const timersRef = useRef<number[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const silenceCheckRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const questions = currentUnit.aiQuestions;
  const currentQuestion = questions[questionIndex];
  const activeQuestion = followUpQuestion || currentQuestion;
  activeQuestionRef.current = activeQuestion;
  const referenceAnswer = useMemo(() => getDemoTranscript(activeQuestion), [activeQuestion]);
  const guidance = useMemo(() => getGuidance(referenceAnswer), [referenceAnswer]);

  const clearTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const clearSilenceDetection = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceCheckRef.current) {
      window.clearInterval(silenceCheckRef.current);
      silenceCheckRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
  };

  const schedule = (callback: () => void, ms: number) => {
    const timer = window.setTimeout(callback, ms);
    timersRef.current.push(timer);
    return timer;
  };

  const stopCurrentMedia = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    recordingChunksRef.current = [];
    clearSilenceDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const speak = (text: string, onDone?: () => void) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDone?.();
    };

    void playTeacherSpeech(text, finish);
  };

  const addMessage = (
    role: SceneMessage["role"],
    content: string,
    shouldSpeak = role !== "student",
    onDone?: () => void,
    highlight?: string,
  ) => {
    setSceneMessages((messages) => [...messages, { id: `${role}-${Date.now()}-${Math.random()}`, role, content, highlight }]);
    if (shouldSpeak) speak(content, onDone);
    else onDone?.();
  };

  const askQuestion = (cycleId: number, questionText = activeQuestion) => {
    activeQuestionRef.current = questionText;
    setPhase("teacher");
    setTranscript("");
    addMessage("teacher", questionText, true, () => {
      if (cycleRef.current === cycleId) startListening(cycleId);
    });
  };

  const startListening = async (cycleId: number) => {
    if (cycleRef.current !== cycleId) return;
    setPhase("listening");
    setTranscript("");

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      schedule(() => recognizeAnswer(cycleId, null), 1200);
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
        clearSilenceDetection();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cycleRef.current === cycleId) void recognizeAnswer(cycleId, audioBlob);
      };

      recorder.start();
      startSilenceDetection(stream, recorder);
      schedule(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, getAnswerRecordingMs(activeQuestionRef.current || activeQuestion));
    } catch {
      schedule(() => recognizeAnswer(cycleId, null), 1200);
    }
  };

  const startSilenceDetection = (stream: MediaStream, recorder: MediaRecorder) => {
    const AudioContextClass = window.AudioContext || getWebkitAudioContext();
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();

    silenceCheckRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = sample - 128;
        sum += value * value;
      }
      const volume = Math.sqrt(sum / samples.length);
      const minimumListenMs = Date.now() - startedAt > 2600;

      if (volume < 5 && minimumListenMs) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = window.setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 1700);
        }
      } else if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }, 120);
  };

  const recognizeAnswer = async (cycleId: number, audioBlob?: Blob | null) => {
    if (cycleRef.current !== cycleId) return;
    setPhase("recognizing");

    const nextAttempt = attemptRef.current + 1;
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);
    const hasGuidance = guidanceGivenRef.current;
    const nextPostGuidanceAttempt = hasGuidance ? postGuidanceAttemptRef.current + 1 : 0;
    postGuidanceAttemptRef.current = nextPostGuidanceAttempt;
    setPostGuidanceAttempt(nextPostGuidanceAttempt);

    let recognizedText = "";

    if (audioBlob && audioBlob.size > 0) {
      try {
        recognizedText = await recognizeSpeech({
          audioBlob,
        fileName: buildAudioFileName(`dialogue-q${questionIndex + 1}`, audioBlob.type),
        });
      } catch {
        recognizedText = "";
      }
    }

    if (cycleRef.current !== cycleId) return;
    if (!recognizedText) {
      setTranscript("");
      if (hasGuidance) {
        setPhase("completed");
        addMessage("system", "We will stop here and return to today's tasks.", true, () => {
          if (cycleRef.current === cycleId) navigate("/tasks");
        });
        return;
      }
      if (!hasGuidance && nextAttempt >= 3) {
        setPhase("guidance");
        addMessage("system", guidance, true, () => {
          if (cycleRef.current !== cycleId) return;
          guidanceGivenRef.current = true;
          setGuidanceGiven(true);
          attemptRef.current = 0;
          postGuidanceAttemptRef.current = 0;
          setAttempt(0);
          setPostGuidanceAttempt(0);
          const questionText = activeQuestionRef.current || activeQuestion;
          addMessage("teacher", questionText, true, () => {
            if (cycleRef.current === cycleId) void startListening(cycleId);
          });
        }, referenceAnswer);
      } else {
        setPhase("retry");
        addMessage("system", "I couldn't hear you clearly. Please answer again in English.", true, () => {
          if (cycleRef.current === cycleId) void startListening(cycleId);
        });
      }
      return;
    }

    setTranscript(recognizedText);
    addMessage("student", recognizedText, false);
    await submitRecognizedAnswer(cycleId, recognizedText);
  };

  const submitRecognizedAnswer = async (cycleId: number, answer: string) => {
    if (cycleRef.current !== cycleId) return;
    setPhase("recognizing");
    const answeredQuestion = activeQuestionRef.current || activeQuestion;
    const analysis = await submitDialogueAnswer(answer, answeredQuestion, questions[questionIndex + 1] ?? "本轮对话完成");
    if (cycleRef.current !== cycleId) return;
    setPhase("feedback");
    const nextFollowUp = !followUpQuestionRef.current ? extractFollowUpQuestion(analysis.feedback) : "";
    const feedbackText = removeFollowUpQuestion(analysis.feedback, nextFollowUp);
    if (nextFollowUp) {
      followUpQuestionRef.current = nextFollowUp;
      setFollowUpQuestion(nextFollowUp);
      afterFeedbackActionRef.current = "ask_followup";
      setAfterFeedbackAction("ask_followup");
    } else {
      afterFeedbackActionRef.current = "next_preset";
      setAfterFeedbackAction("next_preset");
    }
    addMessage("teacher", feedbackText || analysis.feedback, true, () => {
      if (cycleRef.current === cycleId) setAutoAdvanceSeconds(1);
    });
  };

  useEffect(() => {
    if (phase !== "feedback" || autoAdvanceSeconds === null) return;

    const countdownTimer = window.setInterval(() => {
      setAutoAdvanceSeconds((seconds) => (seconds === null ? null : Math.max(0, seconds - 1)));
    }, 1000);
    const advanceTimer = window.setTimeout(() => {
      window.clearInterval(countdownTimer);
      setAutoAdvanceSeconds(null);
      if (afterFeedbackActionRef.current === "ask_followup" && followUpQuestionRef.current) {
        attemptRef.current = 0;
        setAttempt(0);
        setTranscript("");
        void warmTeacherSpeech(followUpQuestionRef.current);
        askQuestion(cycleRef.current, followUpQuestionRef.current);
        return;
      }

      followUpQuestionRef.current = "";
      setFollowUpQuestion("");

      if (questionIndex >= questions.length - 1) {
        setPhase("completed");
        navigate(shouldOpenReportAfterDialogue(tasks, errors) ? "/report" : "/tasks");
      } else {
        setQuestionIndex((value) => value + 1);
      }
    }, 1000);

    return () => {
      window.clearInterval(countdownTimer);
      window.clearTimeout(advanceTimer);
    };
  }, [phase, autoAdvanceSeconds, questionIndex, questions.length, tasks, errors, navigate, activeQuestion]);

  useEffect(() => {
    cycleRef.current += 1;
    const cycleId = cycleRef.current;
    clearTimers();
    stopTeacherSpeech();
    stopCurrentMedia();
    attemptRef.current = 0;
    guidanceGivenRef.current = false;
    postGuidanceAttemptRef.current = 0;
    setAttempt(0);
    setPostGuidanceAttempt(0);
    setGuidanceGiven(false);
    setTranscript("");
    setAutoAdvanceSeconds(null);
    followUpQuestionRef.current = "";
    afterFeedbackActionRef.current = "next_preset";
    setFollowUpQuestion("");
    setAfterFeedbackAction("next_preset");
    void warmTeacherSpeech(currentQuestion);
    const nextQuestion = questions[questionIndex + 1];
    if (nextQuestion) void warmTeacherSpeech(nextQuestion);
    schedule(() => askQuestion(cycleId), 500);

    return () => {
      clearTimers();
      stopTeacherSpeech();
      stopCurrentMedia();
      clearSilenceDetection();
    };
  }, [questionIndex]);

  useEffect(() => {
    return () => {
      cycleRef.current += 1;
      clearTimers();
      stopTeacherSpeech();
      stopCurrentMedia();
      clearSilenceDetection();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sceneMessages, transcript, phase]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI 对话练习"
        title="AI 老师实时口语问答"
        description="AI 老师会朗读提问和引导。连续 3 次识别不清后，会给出参考答案并要求学生继续重复回答，直到识别通过。"
      />

      <Card className="overflow-hidden border-indigo-100 bg-gradient-to-br from-sky-50 via-indigo-50 to-violet-50">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="flex h-[520px] min-h-[420px] flex-col rounded-3xl bg-white/80 p-5 shadow-inner">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-indigo-600">对话场景</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">Food Talk</h2>
              </div>
              <span className="rounded-full bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                第 {questionIndex + 1} 题
              </span>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scroll-smooth">
              {sceneMessages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-3xl px-5 py-4 shadow-sm ${
                      message.role === "student"
                        ? "bg-indigo-600 text-white"
                        : message.role === "system"
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : "border border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    <p className="mb-1 text-xs font-bold opacity-70">
                      {message.role === "student" ? "学生" : message.role === "system" ? "AI 引导" : "AI 老师"}
                    </p>
                    <p className="text-lg font-bold leading-8">{message.content}</p>
                    {message.highlight ? (
                      <div className="mt-3 rounded-2xl border border-amber-300 bg-white px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-wide text-amber-600">Reference answer</p>
                        <p className="mt-1 text-2xl font-black leading-8 text-indigo-700">{message.highlight}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} className="h-1" />
            </div>
          </div>

          <div className="rounded-3xl bg-white/85 p-5 shadow-sm">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-4xl font-black text-indigo-600">
              AI
            </div>
            <p className="mt-4 text-center text-sm font-bold text-slate-500">当前状态</p>
            <p className="mt-2 text-center text-lg font-black text-slate-950">{phaseText(phase)}</p>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-400">识别文字</p>
              <div className="mt-2 flex min-h-14 items-center text-lg font-black leading-7 text-slate-900">
                {transcript ? (
                  <p>{transcript}</p>
                ) : phase === "listening" ? (
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 animate-pulse rounded-full bg-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,0.15)]" />
                    <span className="text-sm font-bold text-rose-600">Recording</span>
                  </div>
                ) : phase === "recognizing" ? null : (
                  <p className="text-sm font-bold text-slate-400">等待回答</p>
                )}
              </div>
            </div>
            {autoAdvanceSeconds ? (
              <p className="mt-4 rounded-full bg-indigo-100 px-3 py-2 text-center text-xs font-bold text-indigo-700">
                {autoAdvanceSeconds} 秒后继续
              </p>
            ) : null}
          </div>
        </div>
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

function phaseText(phase: DialoguePhase) {
  const labels = {
    teacher: "AI 老师提问中",
    listening: "正在听学生回答",
    recognizing: "正在识别与判断",
    retry: "请学生重新回答",
    guidance: "AI 正在给参考答案",
    feedback: "本题已完成",
    completed: "对话完成",
  };
  return labels[phase];
}

function shouldOpenReportAfterDialogue(tasks: { type: string; status: string }[], errors: { status: string }[]) {
  const nextTasks = tasks.map((task) => (task.type === "dialogue" ? { ...task, status: "completed" } : task));
  const coreDone = ["word", "sentence", "dialogue"].every((type) =>
    nextTasks.some((task) => task.type === type && task.status === "completed"),
  );
  const hasPendingReview = errors.some((error) => error.status !== "mastered");
  const reviewDone = nextTasks.some((task) => task.type === "review" && task.status === "completed");

  return coreDone && (!hasPendingReview || reviewDone);
}
