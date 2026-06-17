import type { ErrorSentence, PracticeTask, SpeakingCriterionScore, StudyReport, Unit } from "../types";
import { convertBlobToWav } from "./audioFormat";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
const DEMO_USER_ID = "demo-student";

type ApiEnvelope<T> = {
  status: string;
  data: T;
  message: string;
};

type BackendGrammarMistake = {
  original: string;
  suggestion: string;
  error_type: string;
  explanation: string;
};

export type BackendProviderStatus = {
  app_env: string;
  llm_provider: string;
  asr_provider: string;
  tts_provider: string;
  speech_score_provider: string;
  use_mock_fallback: boolean;
};

const delay = (ms = 240) => new Promise((resolve) => window.setTimeout(resolve, ms));

function speakingScores(
  overrides: Partial<Record<SpeakingCriterionScore["key"], { score: number; feedback: string }>> = {},
) {
  const base: SpeakingCriterionScore[] = [
    {
      key: "grammarVocabulary",
      label: "词汇与句型 Words & Sentence Patterns",
      score: 4,
      maxScore: 5,
      feedback: "能够使用本单元核心词汇和基础句型，个别表达还可以再稳一点。",
    },
    {
      key: "discourseManagement",
      label: "理解与回应 Understanding & Response",
      score: 4,
      maxScore: 5,
      feedback: "能够听懂简单问题，并给出贴题的短句回答。",
    },
    {
      key: "pronunciation",
      label: "发音 Pronunciation",
      score: 4,
      maxScore: 5,
      feedback: "整体发音清楚，个别词尾和重音还可以更稳定。",
    },
    {
      key: "interactiveCommunication",
      label: "互动与自信 Interaction & Confidence",
      score: 4,
      maxScore: 5,
      feedback: "能参与问答，回答时比较自然，有一定自信。",
    },
    {
      key: "globalAchievement",
      label: "口语盾牌 Speaking Shields",
      score: 4,
      maxScore: 5,
      feedback: "整体达到本轮少儿口语练习目标。",
    },
  ];

  return base.map((item) => ({ ...item, ...overrides[item.key] }));
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  const json = (await response.json()) as ApiEnvelope<T>;
  return json.data;
}

export async function getBackendProviderStatus(): Promise<BackendProviderStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/system/providers`);
    if (!response.ok) return null;
    const json = (await response.json()) as ApiEnvelope<BackendProviderStatus>;
    return json.data;
  } catch {
    return null;
  }
}

export async function recognizeSpeech(input: { audioBlob: Blob; fileName?: string }): Promise<string> {
  let uploadBlob = input.audioBlob;
  let uploadFileName = input.fileName ?? "recording.webm";

  try {
    uploadBlob = await convertBlobToWav(input.audioBlob);
    uploadFileName = replaceExtension(uploadFileName, "wav");
  } catch {
    uploadBlob = input.audioBlob;
  }

  const formData = new FormData();
  formData.append("file", uploadBlob, uploadFileName);

  const response = await fetch(`${API_BASE_URL}/asr/recognize`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `ASR request failed: ${response.status}`);
  }

  const json = (await response.json()) as ApiEnvelope<{ text: string }>;
  const cleanedText = json.data.text.trim();
  if (!cleanedText) {
    throw new Error("ASR returned empty text.");
  }

  return cleanedText;
}

function replaceExtension(fileName: string, extension: string) {
  const normalized = extension.startsWith(".") ? extension.slice(1) : extension;
  return fileName.includes(".") ? fileName.replace(/\.[^.]+$/, `.${normalized}`) : `${fileName}.${normalized}`;
}

async function saveLearningSession(sessionType: string, summary: string, score?: number) {
  try {
    await postJson<{ success: boolean; record_id: number }>("/learning/save", {
      user_id: DEMO_USER_ID,
      session_data: {
        session_type: sessionType,
        unit_id: "unit-3-food",
        summary,
        score,
        events: [],
      },
    });
  } catch {
    // 保存学习记录失败时不打断前端演示流程
  }
}

function getMockTasks(unit: Unit): PracticeTask[] {
  return [
    {
      id: "task-word",
      title: `词汇跟读 ${unit.words.length} 个`,
      description: `听读 ${unit.title} 的核心词汇，重点感知食物类单词发音。`,
      type: "word",
      status: "not_started",
    },
    {
      id: "task-sentence",
      title: `句型跟读 ${unit.sentences.length} 个`,
      description: "跟读本单元重点句型，准备进入 AI 对话。",
      type: "sentence",
      status: "not_started",
    },
    {
      id: "task-dialogue",
      title: "AI 对话 1 轮",
      description: `回答 AI 关于 ${unit.topic} 的问题，系统会记录需要纠正的句子。`,
      type: "dialogue",
      status: "not_started",
    },
    {
      id: "task-review",
      title: "错句复练",
      description: "复练错句本中的待掌握内容，完成后进入学习报告。",
      type: "review",
      status: "not_started",
    },
    {
      id: "task-report",
      title: "查看学习报告",
      description: "汇总今日任务、已掌握表达、待复练错句和 AI 建议。",
      type: "report",
      status: "not_started",
    },
  ];
}

function getMockReadingAnalysis(targetText: string, userText?: string) {
  const text = userText?.trim() || targetText;
  const hasPluralMiss = targetText.includes("apples") && !text.includes("apples");
  const hasPronunciationRisk = /\b(sandwich|milk)\b/i.test(targetText);
  const score = hasPluralMiss ? 78 : hasPronunciationRisk ? 82 : 91;
  const lowScoreWords = hasPluralMiss ? ["apples"] : hasPronunciationRisk ? [targetText] : [];

  return {
    score,
    feedback: hasPluralMiss
      ? "整体表达清楚，但 apples 结尾的 /s/ 还需要更明显一些。"
      : hasPronunciationRisk
        ? "能够读出目标词，但发音清晰度还不够稳定，建议加入错句本继续复练。"
        : "发音清楚，节奏自然，可以进入下一题。",
    lowScoreWords,
    criteria: speakingScores(
      hasPluralMiss
        ? {
            pronunciation: { score: 3, feedback: "需要加强词尾 /s/ 的发音清晰度。" },
            grammarVocabulary: { score: 4, feedback: "目标词汇能识别，复数形式还要继续练。" },
          }
        : {
            pronunciation: { score: 4, feedback: "发音清楚，重音和节奏比较自然。" },
            globalAchievement: { score: 4, feedback: "完成本题跟读目标。" },
          },
    ),
  };
}

function getMockDialogueRuleResult(question: string, answer: string) {
  const normalizedQuestion = question.trim().toLowerCase();
  const normalizedAnswer = answer.trim().toLowerCase();
  const fruitWords = ["apple", "banana", "watermelon", "orange", "pear", "grape", "strawberry", "mango"];
  const foodWords = [...fruitWords, "sandwich", "milk", "pizza", "bread", "cake", "rice", "noodle", "egg", "cheese"];

  if (normalizedAnswer === "i like apple.") {
    return {
      isCorrect: false,
      feedback: "意思表达出来了，但这里要说 I like apples.",
      correctedSentence: "I like apples.",
      explanation: "表达喜欢某一类食物时，apple 在这里通常要用复数 apples。",
      errorType: "名词单复数",
      criteria: speakingScores({
        grammarVocabulary: { score: 2, feedback: "食物类名词复数还不稳定，需要复练 I like + 复数名词。" },
        interactiveCommunication: { score: 4, feedback: "能回应问题，表达意图清楚。" },
        globalAchievement: { score: 3, feedback: "意思可理解，但还需要修正后再拿更高盾牌。" },
      }),
    };
  }

  if (normalizedAnswer === "i no like milk.") {
    return {
      isCorrect: false,
      feedback: "否定句结构需要调整，可以说 I don't like milk.",
      correctedSentence: "I don't like milk.",
      explanation: "英语否定句需要用 don't，不能直接说 no like。",
      errorType: "否定句结构",
      criteria: speakingScores({
        grammarVocabulary: { score: 2, feedback: "否定句需要使用 don't like。" },
        interactiveCommunication: { score: 4, feedback: "回答方向正确，能表达不喜欢。" },
        globalAchievement: { score: 3, feedback: "修正句型后可以获得更稳定的口语表现。" },
      }),
    };
  }

  if (normalizedQuestion.includes("milk")) {
    const answersMilkQuestion =
      normalizedAnswer.includes("milk") || normalizedAnswer === "yes, i do." || normalizedAnswer === "no, i don't.";

    if (!answersMilkQuestion) {
      return {
        isCorrect: false,
        feedback: "这句话本身可以，但没有直接回答 Do you like milk? 这个问题。",
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "听懂题目后需要直接回答 milk 相关问题。" },
          interactiveCommunication: { score: 2, feedback: "没有直接回应当前问题，互动相关性不够。" },
          globalAchievement: { score: 3, feedback: "表达清楚，但任务完成度不够。" },
        }),
      };
    }
  }

  if (normalizedQuestion.includes("fruit")) {
    const answersFruitQuestion = fruitWords.some((item) => normalizedAnswer.includes(item));
    if (!answersFruitQuestion) {
      return {
        isCorrect: false,
        feedback: "这句话没有回答水果问题。可以说 I like apples. 或 I like bananas.",
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "需要听到 fruit，并用水果词回答。" },
          interactiveCommunication: { score: 2, feedback: "回答没有围绕 fruit 问题展开。" },
          globalAchievement: { score: 3, feedback: "需要更贴合任务要求。" },
        }),
      };
    }
  }

  if (normalizedQuestion.includes("food")) {
    const answersFoodQuestion = foodWords.some((item) => normalizedAnswer.includes(item));
    if (!answersFoodQuestion) {
      return {
        isCorrect: false,
        feedback: "这句话没有回答喜欢什么食物。请用本单元的食物词汇作答。",
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "需要听到 food，并用食物词回答。" },
          interactiveCommunication: { score: 2, feedback: "没有回答 What food do you like? 的核心信息。" },
          globalAchievement: { score: 3, feedback: "需要用食物词汇完成任务。" },
        }),
      };
    }
  }

  return {
    isCorrect: true,
    feedback: "回答不错，表达清楚，也回答了当前问题。",
    criteria: speakingScores({
      grammarVocabulary: { score: 4, feedback: "句型和词汇使用准确。" },
      discourseManagement: { score: 4, feedback: "听懂问题，并能用短句作答。" },
      interactiveCommunication: { score: 5, feedback: "能直接回应当前问题，互动表现很好。" },
      globalAchievement: { score: 4, feedback: "完成本轮少儿口语任务。" },
    }),
  };
}

function getFastDialogueReply(question: string, answer: string) {
  const normalizedQuestion = question.trim().toLowerCase();
  const normalizedAnswer = answer.trim().toLowerCase();

  if (normalizedQuestion.includes("what food do you like")) {
    if (normalizedAnswer.includes("pizza")) return "Great job! Pizza is yummy. Do you like cheese on it?";
    if (normalizedAnswer.includes("sandwich")) return "Nice. A sandwich is good. Do you like eggs in it?";
    if (normalizedAnswer.includes("bread")) return "Good answer. Bread is nice. Do you like to eat it with jam?";
    if (normalizedAnswer.includes("watermelon")) return "Great job! Watermelon is so yummy. Do you like to eat it in summer?";
    if (normalizedAnswer.includes("milk")) return "Good answer. Do you drink milk every day?";
    if (normalizedAnswer.includes("banana")) return "Great. Bananas are healthy. Do you like yellow bananas?";
    if (normalizedAnswer.includes("apple")) return "Nice answer. Apples are yummy. Do you like red apples?";
  }

  if (normalizedQuestion.includes("do you like milk")) {
    return normalizedAnswer.includes("don't") || normalizedAnswer.includes("no")
      ? "Good answer. You said it clearly."
      : "Good answer. Milk is healthy.";
  }

  if (normalizedQuestion.includes("what fruit do you like")) {
    if (normalizedAnswer.includes("watermelon")) return "Great. Watermelon is a good fruit for summer.";
    if (normalizedAnswer.includes("banana")) return "Great. Bananas are a good fruit.";
    if (normalizedAnswer.includes("apple")) return "Great. Apples are a good fruit.";
  }

  return "Good answer. Let's continue.";
}

function buildDialogueFeedback(question: string, answer: string, reply: string, mistakes: BackendGrammarMistake[]) {
  const ruleResult = getMockDialogueRuleResult(question, answer);

  if (mistakes.length > 0) {
    const firstMistake = mistakes[0];
    return {
      ...ruleResult,
      isCorrect: false,
      feedback: `${reply} 另外，这里建议说 ${firstMistake.suggestion}`,
      correctedSentence: firstMistake.suggestion,
      explanation: firstMistake.explanation,
      errorType: firstMistake.error_type,
    };
  }

  return {
    ...ruleResult,
    feedback: ruleResult.isCorrect ? reply : `${reply} ${ruleResult.feedback}`,
  };
}

function getMockStudyReport(input: { tasks: PracticeTask[]; errors: ErrorSentence[] }): StudyReport {
  const completedTasks = input.tasks
    .filter((task) => task.status === "completed")
    .map((task) => (task.type === "review" ? "错句复练" : task.title));
  const masteredSentences = input.errors
    .filter((error) => error.status === "mastered")
    .map((error) => error.correctedSentence);
  const errorsToReview = input.errors
    .filter((error) => error.status !== "mastered")
    .map((error) => error.correctedSentence);

  return {
    id: "report-demo-today",
    date: new Date().toISOString().slice(0, 10),
    summary: `今日完成 ${completedTasks.length}/${input.tasks.length} 项任务，已掌握 ${masteredSentences.length} 条关键表达。`,
    completedTasks,
    masteredSentences,
    errorsToReview,
    speakingScores: speakingScores({
      grammarVocabulary: {
        score: errorsToReview.length ? 3 : 4,
        feedback: errorsToReview.length ? "仍需复练食物词汇、复数和否定句。" : "本单元核心词汇和句型掌握较稳定。",
      },
      discourseManagement: { score: 4, feedback: "能够听懂 Food 主题的简单问题并作答。" },
      pronunciation: { score: 4, feedback: "跟读表现清楚，后续可接真实录音评分。" },
      interactiveCommunication: { score: 4, feedback: "能参与 Food 主题问答，互动信心较好。" },
      globalAchievement: { score: completedTasks.length >= 3 ? 4 : 3, feedback: "本轮 Speaking 可获得约 3-4 个盾牌的表现。" },
    }),
    aiSuggestion: "下一轮建议继续练习 food 主题问答，重点关注名词复数、否定句和发音清晰度。",
    parentFriendlyComment: "孩子已经能够围绕食物主题进行简单表达。遇到错误后，可以通过错句复练逐步修正，建议每天保持 5-8 分钟口语练习。",
  };
}

export async function generateTodayTasks(unit: Unit): Promise<PracticeTask[]> {
  await delay();
  return getMockTasks(unit);
}

export async function analyzeReading(input: {
  targetText: string;
  userText?: string;
  audioBlob?: Blob | null;
}): Promise<{
  score: number;
  feedback: string;
  lowScoreWords: string[];
  criteria: SpeakingCriterionScore[];
}> {
  try {
    const scoredAudio = input.audioBlob ? await prepareAudioForBackend(input.audioBlob) : null;
    const data = await postJson<{
      score: number;
      fluency: number;
      pronunciation: number;
      feedback: string;
      completeness?: number;
      provider?: string;
    }>("/speech/score", {
      audio_url: "mock://browser-recording",
      text: input.targetText,
      audio_base64: scoredAudio?.audioBase64,
      audio_format: scoredAudio?.audioFormat,
    });

    const providerNote =
      data.provider && data.provider !== "tencent_soe" ? `（当前评分来源：${data.provider}，请检查腾讯智聆返回信息。）` : "";
    const result = {
      score: data.score,
      feedback: providerNote ? `${data.feedback} ${providerNote}` : data.feedback,
      lowScoreWords: data.score < 85 ? [input.targetText] : [],
      criteria: speakingScores({
        pronunciation: {
          score: Math.max(1, Math.min(5, Math.round(data.pronunciation / 20))),
          feedback: data.feedback,
        },
        discourseManagement: {
          score: Math.max(1, Math.min(5, Math.round(data.fluency / 20))),
          feedback: data.fluency >= 85 ? "表达节奏比较自然。" : "节奏还可以更稳定一些。",
        },
      }),
    };

    void saveLearningSession("reading", `Reading practice: ${input.targetText}`, result.score);
    return result;
  } catch (error) {
    await delay();
    const fallback = getMockReadingAnalysis(input.targetText, input.userText);
    const message = error instanceof Error ? error.message : "unknown error";
    fallback.feedback = `后端口语评分未成功，当前显示演示评分。原因：${message}`;
    void saveLearningSession("reading", `Reading practice: ${input.targetText}`, fallback.score);
    return fallback;
  }
}

async function prepareAudioForBackend(audioBlob: Blob) {
  let uploadBlob = audioBlob;
  let audioFormat = getAudioFormat(audioBlob.type);

  try {
    uploadBlob = await convertBlobToWav(audioBlob);
    audioFormat = "wav";
  } catch {
    audioFormat = getAudioFormat(audioBlob.type);
  }

  return {
    audioBase64: await blobToBase64(uploadBlob),
    audioFormat,
  };
}

function getAudioFormat(mimeType: string) {
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  return "wav";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",", 2)[1] : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read audio blob."));
    reader.readAsDataURL(blob);
  });
}

export async function analyzeDialogueAnswer(input: {
  question: string;
  answer: string;
}): Promise<{
  isCorrect: boolean;
  feedback: string;
  correctedSentence?: string;
  explanation?: string;
  errorType?: string;
  criteria: SpeakingCriterionScore[];
}> {
  const ruleResult = getMockDialogueRuleResult(input.question, input.answer);

  try {
    const history = [{ role: "ai", content: input.question }];
    const chatRequest = postJson<{ reply: string }>("/tutor/chat", {
      message: input.answer,
      history,
      level: "kids",
    });

    if (ruleResult.isCorrect) {
      const result = { ...ruleResult, feedback: getFastDialogueReply(input.question, input.answer) };
      void chatRequest.catch(() => undefined);
      void saveLearningSession("dialogue", `Dialogue answer: ${input.answer}`, 90);
      return result;
    }

    const [chatData, errorData] = await Promise.all([
      chatRequest,
      postJson<{ mistakes: BackendGrammarMistake[] }>("/analyze/error", {
        text: input.answer,
      }),
    ]);

    const result = buildDialogueFeedback(input.question, input.answer, chatData.reply, errorData.mistakes);
    void saveLearningSession("dialogue", `Dialogue answer: ${input.answer}`, result.isCorrect ? 90 : 78);
    return result;
  } catch {
    await delay();
    void saveLearningSession("dialogue", `Dialogue answer: ${input.answer}`, ruleResult.isCorrect ? 90 : 78);
    return ruleResult;
  }
}

export async function generateReviewSteps(error: ErrorSentence): Promise<{
  shadowingText: string;
  substitutionPrompts: string[];
  followUpQuestion: string;
}> {
  await delay();

  return {
    shadowingText: error.correctedSentence,
    substitutionPrompts:
      error.errorType === "名词单复数"
        ? ["I like bananas.", "I like sandwiches.", "I like pizzas."]
        : ["He likes apples.", "She likes milk.", "He likes sandwiches."],
    followUpQuestion: error.question ?? "What fruit do you like?",
  };
}

export async function checkReviewStep(input: {
  error: ErrorSentence;
  stepIndex: number;
  responseText: string;
}): Promise<{
  passed: boolean;
  feedback: string;
}> {
  await delay();

  if (input.stepIndex === 0) {
    return {
      passed: true,
      feedback: "AI 检查通过：跟读内容清楚，目标句子已经说顺了。",
    };
  }

  if (input.stepIndex === 1) {
    const usesTargetPattern = input.responseText.includes("likes") || input.responseText.includes("I like");
    return {
      passed: usesTargetPattern,
      feedback: usesTargetPattern
        ? "AI 检查通过：能把正确句型迁移到新词汇里。"
        : "还需要再练一次：请使用本题的目标句型完成替换造句。",
    };
  }

  const isUsingCorrectSentence = input.responseText === input.error.correctedSentence;
  return {
    passed: isUsingCorrectSentence,
    feedback: isUsingCorrectSentence
      ? "AI 检查通过：回答自然，并且使用了正确表达。"
      : `还需要再练一次：请尽量说成 ${input.error.correctedSentence}`,
  };
}

export async function generateStudyReport(input: {
  tasks: PracticeTask[];
  errors: ErrorSentence[];
}): Promise<StudyReport> {
  try {
    const completedCount = input.tasks.filter((task) => task.status === "completed").length;
    const masteredCount = input.errors.filter((error) => error.status === "mastered").length;
    const pendingErrorCount = input.errors.filter((error) => error.status !== "mastered").length;
    const data = await postJson<{
      report: {
        user_id: string;
        summary: string;
        strengths: string[];
        next_steps: string[];
        parent_comment: string;
        related_session_count: number;
      };
    }>("/report/generate", {
      user_id: DEMO_USER_ID,
      session_data: {
        session_type: "daily_report",
        unit_id: "unit-3-food",
        summary: `今日任务 ${completedCount}/${input.tasks.length} 项完成；错句 ${input.errors.length} 条；已掌握 ${masteredCount} 条；仍需复练 ${pendingErrorCount} 条。不要生成正确率。`,
        score: completedCount,
        events: [
          ...input.tasks.map((task) => ({
            event_type: task.type,
            content: {
              title: task.title,
              status: task.status,
            },
          })),
          ...input.errors.map((error) => ({
            event_type: "error_sentence",
            content: {
              original: error.originalSentence,
              corrected: error.correctedSentence,
              error_type: error.errorType,
              status: error.status,
              source: error.source,
            },
          })),
        ],
      },
    });

    const completedTasks = input.tasks
      .filter((task) => task.status === "completed")
      .map((task) => (task.type === "review" ? "错句复练" : task.title));
    const masteredSentences = input.errors
      .filter((error) => error.status === "mastered")
      .map((error) => error.correctedSentence);
    const errorsToReview = input.errors
      .filter((error) => error.status !== "mastered")
      .map((error) => error.correctedSentence);

    const report: StudyReport = {
      id: "report-backend-today",
      date: new Date().toISOString().slice(0, 10),
      summary: data.report.summary,
      completedTasks,
      masteredSentences,
      errorsToReview,
      speakingScores: speakingScores({
        grammarVocabulary: {
          score: errorsToReview.length ? 3 : 4,
          feedback: data.report.next_steps[0] ?? "建议继续巩固词汇和句型。",
        },
        discourseManagement: {
          score: 4,
          feedback: data.report.strengths[0] ?? "能够围绕主题理解并回应问题。",
        },
        pronunciation: {
          score: errorsToReview.length ? 3 : 4,
          feedback: errorsToReview.length ? "仍有表达需要进入下一轮复练。" : "本轮发音表现比较稳定。",
        },
        interactiveCommunication: {
          score: 4,
          feedback: data.report.strengths[1] ?? "互动表现自然，能完成基本问答。",
        },
        globalAchievement: {
          score: completedTasks.length >= 3 ? 4 : 3,
          feedback: `后端已累计 ${data.report.related_session_count} 条学习记录。`,
        },
      }),
      aiStrengths: data.report.strengths,
      aiNextSteps: data.report.next_steps,
      aiSuggestion: data.report.next_steps.join("；") || "建议继续完成下一轮口语练习。",
      parentFriendlyComment: data.report.parent_comment,
    };

    void saveLearningSession("report", "Study report generated.", completedTasks.length);
    return report;
  } catch {
    await delay();
    const fallback = getMockStudyReport(input);
    void saveLearningSession("report", "Study report generated.", fallback.completedTasks.length);
    return fallback;
  }
}
