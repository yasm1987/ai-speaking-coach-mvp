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

function getDemoTranscript(question: string) {
  if (question.includes("milk")) return "I don't like milk.";
  if (question.includes("fruit")) return "I like bananas.";
  return "I like apples.";
}

function getGuidance(referenceAnswer: string) {
  return `I couldn't hear you clearly. The reference answer is: ${referenceAnswer}. Listen to the question again, then answer.`;
}

function getAnswerRecordingMs(question: string, isFollowUp = false) {
  const words = question.trim().split(/\s+/).filter(Boolean).length;
  const baseMs = Math.ceil((words / 1.2 + 5) * 1000);
  return Math.max(isFollowUp ? 12000 : 9500, baseMs);
}

function getMinimumListenMs(isFollowUp = false) {
  return isFollowUp ? 7000 : 5200;
}

function getSilenceStopMs(isFollowUp = false) {
  return isFollowUp ? 2800 : 2300;
}

function extractFollowUpQuestion(reply: string) {
  const normalized = reply.replace(/\s+/g, " ").trim();
  const englishQuestionMark = normalized.lastIndexOf("?");
  const chineseQuestionMark = normalized.lastIndexOf("？");
  const end = Math.max(englishQuestionMark, chineseQuestionMark);
  if (end < 0) return "";

  const sentenceBreaks = ".!?。！？";
  let start = end - 1;
  while (start >= 0 && !sentenceBreaks.includes(normalized[start])) start -= 1;

  const question = normalized.slice(start + 1, end + 1).trim();
  return question.length > 3 ? question : "";
}

function removeFollowUpQuestion(reply: string, followUpQuestion: string) {
  if (!followUpQuestion) return reply.trim();
  return reply
    .replace(followUpQuestion, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([.!?])/g, "$1")
    .trim();
}

function cleanQuestionForSpeech(question: string) {
  return question.replace(/^[^A-Za-z0-9"']+/, "").trim();
}

function getWebkitAudioContext(): typeof AudioContext | undefined {
  return (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export default function DialoguePage() {
  const { currentUnit, tasks, errors, submitDialogueAnswer } = useLearning();
  const navigate = useNavigate();
  const questions = currentUnit.aiQuestions;

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<DialoguePhase>("teacher");
  const [, setAttempt] = useState(0);
  const [, setGuidanceGiven] = useState(false);
  const [, setPostGuidanceAttempt] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [autoAdvanceSeconds, setAutoAdvanceSeconds] = useState<number | null>(null);
  const [sceneMessages, setSceneMessages] = useState<SceneMessage[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState("");

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const timersRef = useRef<number[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceAnalyserRef = useRef<AnalyserNode | null>(null);
  const silenceFrameRef = useRef<number | null>(null);
  const silenceStartedAtRef = useRef<number | null>(null);
  const listeningStartedAtRef = useRef<number>(0);
  const cycleRef = useRef(0);
  const attemptRef = useRef(0);
  const guidanceGivenRef = useRef(false);
  const postGuidanceAttemptRef = useRef(0);
  const activeQuestionRef = useRef("");
  const followUpQuestionRef = useRef("");
  const questionIndexRef = useRef(0);

  const currentQuestion = questions[questionIndex] ?? questions[0] ?? "What food do you like?";
  const activeQuestion = followUpQuestion || currentQuestion;
  activeQuestionRef.current = activeQuestion;
  followUpQuestionRef.current = followUpQuestion;
  questionIndexRef.current = questionIndex;

  const referenceAnswer = useMemo(() => getDemoTranscript(activeQuestion), [activeQuestion]);
  const guidance = useMemo(() => getGuidance(referenceAnswer), [referenceAnswer]);

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function schedule(callback: () => void, delayMs: number) {
    const timer = window.setTimeout(callback, delayMs);
    timersRef.current.push(timer);
    return timer;
  }

  function clearSilenceDetection() {
    if (silenceFrameRef.current) {
      cancelAnimationFrame(silenceFrameRef.current);
      silenceFrameRef.current = null;
    }
    silenceStartedAtRef.current = null;
    silenceAnalyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }

  function stopCurrentMedia() {
    clearSilenceDetection();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function speak(text: string, onDone?: () => void) {
    if (!text.trim()) {
      onDone?.();
      return;
    }
    void playTeacherSpeech(text, { onDone });
  }

  function addMessage(role: SceneMessage["role"], content: string, shouldSpeak = false, onDone?: () => void) {
    const message: SceneMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role,
      content,
    };
    setSceneMessages((messages) => [...messages, message]);

    if (shouldSpeak) {
      speak(content, onDone);
      return;
    }
    onDone?.();
  }

  function addGuidanceMessage(content: string, highlight: string, onDone?: () => void) {
    const message: SceneMessage = {
      id: `system-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: "system",
      content,
      highlight,
    };
    setSceneMessages((messages) => [...messages, message]);
    speak(content, onDone);
  }

  function askQuestion(cycleId: number, questionText = activeQuestionRef.current) {
    if (cycleRef.current !== cycleId) return;
    const question = cleanQuestionForSpeech(questionText);
    activeQuestionRef.current = question;
    setPhase("teacher");
    setTranscript("");
    stopCurrentMedia();
    warmTeacherSpeech(question).catch(() => undefined);
    addMessage("teacher", question, true, () => {
      if (cycleRef.current !== cycleId) return;
      schedule(() => startListening(cycleId), 450);
    });
  }

  async function startListening(cycleId: number) {
    if (cycleRef.current !== cycleId) return;
    setPhase("listening");
    setTranscript("");
    stopCurrentMedia();

    const isFollowUp = Boolean(followUpQuestionRef.current);
    const recordingMs = getAnswerRecordingMs(activeQuestionRef.current, isFollowUp);

    if (!navigator.mediaDevices?.getUserMedia) {
      schedule(() => recognizeAnswer(cycleId, null), recordingMs);
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
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      listeningStartedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob = chunks.length ? new Blob(chunks, { type: recorder.mimeType }) : null;
        stopCurrentMedia();
        recognizeAnswer(cycleId, audioBlob);
      };

      recorder.start();
      startSilenceDetection(stream, cycleId, isFollowUp);
      schedule(() => {
        if (cycleRef.current !== cycleId) return;
        if (recorder.state !== "inactive") recorder.stop();
      }, recordingMs);
    } catch {
      schedule(() => recognizeAnswer(cycleId, null), recordingMs);
    }
  }

  function startSilenceDetection(stream: MediaStream, cycleId: number, isFollowUp: boolean) {
    const AudioContextClass = window.AudioContext ?? getWebkitAudioContext();
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    const data = new Uint8Array(analyser.fftSize);
    const minimumListenMs = getMinimumListenMs(isFollowUp);
    const silenceStopMs = getSilenceStopMs(isFollowUp);

    source.connect(analyser);
    analyser.fftSize = 1024;
    audioContextRef.current = audioContext;
    silenceAnalyserRef.current = analyser;

    const checkSilence = () => {
      if (cycleRef.current !== cycleId || recorderRef.current?.state !== "recording") return;
      analyser.getByteTimeDomainData(data);
      const volume = data.reduce((sum, value) => sum + Math.abs(value - 128), 0) / data.length;
      const listenedMs = Date.now() - listeningStartedAtRef.current;

      if (listenedMs > minimumListenMs && volume < 2.4) {
        silenceStartedAtRef.current ??= Date.now();
        if (Date.now() - silenceStartedAtRef.current > silenceStopMs) {
          recorderRef.current?.stop();
          return;
        }
      } else {
        silenceStartedAtRef.current = null;
      }

      silenceFrameRef.current = requestAnimationFrame(checkSilence);
    };

    silenceFrameRef.current = requestAnimationFrame(checkSilence);
  }

  async function recognizeAnswer(cycleId: number, audioBlob: Blob | null) {
    if (cycleRef.current !== cycleId) return;
    setPhase("recognizing");

    const nextAttempt = attemptRef.current + 1;
    attemptRef.current = nextAttempt;
    setAttempt(nextAttempt);

    let text = "";
    try {
      text = audioBlob
        ? await recognizeSpeech({
            audioBlob,
            fileName: buildAudioFileName("dialogue-answer", audioBlob.type),
          })
        : "";
    } catch {
      text = "";
    }

    if (cycleRef.current !== cycleId) return;

    if (!text.trim()) {
      if (guidanceGivenRef.current) {
        const nextPostGuidanceAttempt = postGuidanceAttemptRef.current + 1;
        postGuidanceAttemptRef.current = nextPostGuidanceAttempt;
        setPostGuidanceAttempt(nextPostGuidanceAttempt);

        if (nextPostGuidanceAttempt >= 2) {
          setPhase("completed");
          addMessage("system", "We will stop this dialogue for now. Please try again later.", true, () => {
            navigate("/");
          });
          return;
        }
      }

      if (!guidanceGivenRef.current && nextAttempt >= 3) {
        setPhase("guidance");
        addGuidanceMessage(guidance, referenceAnswer, () => {
          if (cycleRef.current !== cycleId) return;
          guidanceGivenRef.current = true;
          setGuidanceGiven(true);
          attemptRef.current = 0;
          postGuidanceAttemptRef.current = 0;
          setAttempt(0);
          setPostGuidanceAttempt(0);
          schedule(() => askQuestion(cycleId, activeQuestionRef.current), 900);
        });
        return;
      }

      setPhase("retry");
      addMessage("system", "I couldn't hear you clearly. Please answer again in English.", true, () => {
        if (cycleRef.current !== cycleId) return;
        schedule(() => startListening(cycleId), 700);
      });
      return;
    }

    setTranscript(text);
    addMessage("student", text);
    await submitRecognizedAnswer(cycleId, text);
  }

  async function submitRecognizedAnswer(cycleId: number, answer: string) {
    const answeredQuestion = activeQuestionRef.current;
    const nextPresetQuestion = questions[questionIndexRef.current + 1] ?? "本轮对话完成";
    const analysis = await submitDialogueAnswer(answer, answeredQuestion, nextPresetQuestion);
    if (cycleRef.current !== cycleId) return;

    setPhase("feedback");
    attemptRef.current = 0;
    guidanceGivenRef.current = false;
    postGuidanceAttemptRef.current = 0;
    setAttempt(0);
    setGuidanceGiven(false);
    setPostGuidanceAttempt(0);

    const rawFollowUp = !followUpQuestionRef.current && analysis.isCorrect ? extractFollowUpQuestion(analysis.feedback) : "";
    const spokenFollowUp = cleanQuestionForSpeech(rawFollowUp);
    const feedbackText = removeFollowUpQuestion(analysis.feedback, rawFollowUp);

    if (spokenFollowUp) {
      followUpQuestionRef.current = spokenFollowUp;
      setFollowUpQuestion(spokenFollowUp);
      warmTeacherSpeech(spokenFollowUp).catch(() => undefined);

      const askFollowUp = () => {
        if (cycleRef.current !== cycleId) return;
        askQuestion(cycleId, spokenFollowUp);
      };

      if (feedbackText) {
        addMessage("teacher", feedbackText, true, () => schedule(askFollowUp, 950));
      } else {
        schedule(askFollowUp, 950);
      }
      return;
    }

    if (!analysis.isCorrect) {
      const retryQuestion = answeredQuestion;
      const askAgain = () => {
        if (cycleRef.current !== cycleId) return;
        askQuestion(cycleId, retryQuestion);
      };
      addMessage("teacher", feedbackText || analysis.feedback, true, () => schedule(askAgain, 950));
      return;
    }

    setFollowUpQuestion("");
    followUpQuestionRef.current = "";
    addMessage("teacher", feedbackText || analysis.feedback, true, () => {
      if (cycleRef.current !== cycleId) return;
      setAutoAdvanceSeconds(2);
    });
  }

  useEffect(() => {
    if (phase !== "feedback" || autoAdvanceSeconds === null) return;

    const timer = window.setTimeout(() => {
      if (questionIndex >= questions.length - 1) {
        setPhase("completed");
        navigate(shouldOpenReportAfterDialogue(tasks, errors) ? "/report" : "/");
        return;
      }

      setAutoAdvanceSeconds(null);
      setFollowUpQuestion("");
      followUpQuestionRef.current = "";
      setQuestionIndex((index) => Math.min(index + 1, questions.length - 1));
    }, autoAdvanceSeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [autoAdvanceSeconds, errors, navigate, phase, questionIndex, questions.length, tasks]);

  useEffect(() => {
    const cycleId = cycleRef.current + 1;
    cycleRef.current = cycleId;
    clearTimers();
    stopTeacherSpeech();
    stopCurrentMedia();
    attemptRef.current = 0;
    guidanceGivenRef.current = false;
    postGuidanceAttemptRef.current = 0;
    setAttempt(0);
    setGuidanceGiven(false);
    setPostGuidanceAttempt(0);
    setTranscript("");
    setAutoAdvanceSeconds(null);
    setFollowUpQuestion("");
    followUpQuestionRef.current = "";

    const question = questions[questionIndex] ?? currentQuestion;
    activeQuestionRef.current = question;
    warmTeacherSpeech(question).catch(() => undefined);
    const nextQuestion = questions[questionIndex + 1];
    if (nextQuestion) warmTeacherSpeech(nextQuestion).catch(() => undefined);
    schedule(() => askQuestion(cycleId, question), 450);

    return () => {
      clearTimers();
      stopTeacherSpeech();
      stopCurrentMedia();
    };
  }, [currentQuestion, questionIndex, questions]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sceneMessages, transcript, phase]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopTeacherSpeech();
      stopCurrentMedia();
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI 对话练习"
        title="AI 老师实时口语问答"
        description="AI 老师会先反馈，再追问或进入下一题。追问会单独朗读，并等待学生回答。"
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
