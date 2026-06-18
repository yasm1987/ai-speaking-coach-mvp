import type { ErrorSentence, PracticeTask, SpeakingCriterionScore, StudyReport, Unit } from "../types";
import { convertBlobToWav } from "./audioFormat";

function normalizeApiBaseUrl(value?: string) {
  const baseUrl = (value ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
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
      label: "璇嶆眹涓庡彞鍨?Words & Sentence Patterns",
      score: 4,
      maxScore: 5,
      feedback: "鑳藉浣跨敤鏈崟鍏冩牳蹇冭瘝姹囧拰鍩虹鍙ュ瀷锛屼釜鍒〃杈捐繕鍙互鍐嶇ǔ涓€鐐广€?,
    },
    {
      key: "discourseManagement",
      label: "鐞嗚В涓庡洖搴?Understanding & Response",
      score: 4,
      maxScore: 5,
      feedback: "鑳藉鍚噦绠€鍗曢棶棰橈紝骞剁粰鍑鸿创棰樼殑鐭彞鍥炵瓟銆?,
    },
    {
      key: "pronunciation",
      label: "鍙戦煶 Pronunciation",
      score: 4,
      maxScore: 5,
      feedback: "鏁翠綋鍙戦煶娓呮锛屼釜鍒瘝灏惧拰閲嶉煶杩樺彲浠ユ洿绋冲畾銆?,
    },
    {
      key: "interactiveCommunication",
      label: "浜掑姩涓庤嚜淇?Interaction & Confidence",
      score: 4,
      maxScore: 5,
      feedback: "鑳藉弬涓庨棶绛旓紝鍥炵瓟鏃舵瘮杈冭嚜鐒讹紝鏈変竴瀹氳嚜淇°€?,
    },
    {
      key: "globalAchievement",
      label: "鍙ｈ鐩剧墝 Speaking Shields",
      score: 4,
      maxScore: 5,
      feedback: "鏁翠綋杈惧埌鏈疆灏戝効鍙ｈ缁冧範鐩爣銆?,
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
    // 淇濆瓨瀛︿範璁板綍澶辫触鏃朵笉鎵撴柇鍓嶇婕旂ず娴佺▼
  }
}

function getMockTasks(unit: Unit): PracticeTask[] {
  return [
    {
      id: "task-word",
      title: `璇嶆眹璺熻 ${unit.words.length} 涓猔,
      description: `鍚 ${unit.title} 鐨勬牳蹇冭瘝姹囷紝閲嶇偣鎰熺煡椋熺墿绫诲崟璇嶅彂闊炽€俙,
      type: "word",
      status: "not_started",
    },
    {
      id: "task-sentence",
      title: `鍙ュ瀷璺熻 ${unit.sentences.length} 涓猔,
      description: "璺熻鏈崟鍏冮噸鐐瑰彞鍨嬶紝鍑嗗杩涘叆 AI 瀵硅瘽銆?,
      type: "sentence",
      status: "not_started",
    },
    {
      id: "task-dialogue",
      title: "AI 瀵硅瘽 1 杞?,
      description: `鍥炵瓟 AI 鍏充簬 ${unit.topic} 鐨勯棶棰橈紝绯荤粺浼氳褰曢渶瑕佺籂姝ｇ殑鍙ュ瓙銆俙,
      type: "dialogue",
      status: "not_started",
    },
    {
      id: "task-review",
      title: "閿欏彞澶嶇粌",
      description: "澶嶇粌閿欏彞鏈腑鐨勫緟鎺屾彙鍐呭锛屽畬鎴愬悗杩涘叆瀛︿範鎶ュ憡銆?,
      type: "review",
      status: "not_started",
    },
    {
      id: "task-report",
      title: "鏌ョ湅瀛︿範鎶ュ憡",
      description: "姹囨€讳粖鏃ヤ换鍔°€佸凡鎺屾彙琛ㄨ揪銆佸緟澶嶇粌閿欏彞鍜?AI 寤鸿銆?,
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
      ? "鏁翠綋琛ㄨ揪娓呮锛屼絾 apples 缁撳熬鐨?/s/ 杩橀渶瑕佹洿鏄庢樉涓€浜涖€?
      : hasPronunciationRisk
        ? "鑳藉璇诲嚭鐩爣璇嶏紝浣嗗彂闊虫竻鏅板害杩樹笉澶熺ǔ瀹氾紝寤鸿鍔犲叆閿欏彞鏈户缁缁冦€?
        : "鍙戦煶娓呮锛岃妭濂忚嚜鐒讹紝鍙互杩涘叆涓嬩竴棰樸€?,
    lowScoreWords,
    criteria: speakingScores(
      hasPluralMiss
        ? {
            pronunciation: { score: 3, feedback: "闇€瑕佸姞寮鸿瘝灏?/s/ 鐨勫彂闊虫竻鏅板害銆? },
            grammarVocabulary: { score: 4, feedback: "鐩爣璇嶆眹鑳借瘑鍒紝澶嶆暟褰㈠紡杩樿缁х画缁冦€? },
          }
        : {
            pronunciation: { score: 4, feedback: "鍙戦煶娓呮锛岄噸闊冲拰鑺傚姣旇緝鑷劧銆? },
            globalAchievement: { score: 4, feedback: "瀹屾垚鏈璺熻鐩爣銆? },
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
      feedback: "鎰忔€濊〃杈惧嚭鏉ヤ簡锛屼絾杩欓噷瑕佽 I like apples.",
      correctedSentence: "I like apples.",
      explanation: "琛ㄨ揪鍠滄鏌愪竴绫婚鐗╂椂锛宎pple 鍦ㄨ繖閲岄€氬父瑕佺敤澶嶆暟 apples銆?,
      errorType: "鍚嶈瘝鍗曞鏁?,
      criteria: speakingScores({
        grammarVocabulary: { score: 2, feedback: "椋熺墿绫诲悕璇嶅鏁拌繕涓嶇ǔ瀹氾紝闇€瑕佸缁?I like + 澶嶆暟鍚嶈瘝銆? },
        interactiveCommunication: { score: 4, feedback: "鑳藉洖搴旈棶棰橈紝琛ㄨ揪鎰忓浘娓呮銆? },
        globalAchievement: { score: 3, feedback: "鎰忔€濆彲鐞嗚В锛屼絾杩橀渶瑕佷慨姝ｅ悗鍐嶆嬁鏇撮珮鐩剧墝銆? },
      }),
    };
  }

  if (normalizedAnswer === "i no like milk.") {
    return {
      isCorrect: false,
      feedback: "鍚﹀畾鍙ョ粨鏋勯渶瑕佽皟鏁达紝鍙互璇?I don't like milk.",
      correctedSentence: "I don't like milk.",
      explanation: "鑻辫鍚﹀畾鍙ラ渶瑕佺敤 don't锛屼笉鑳界洿鎺ヨ no like銆?,
      errorType: "鍚﹀畾鍙ョ粨鏋?,
      criteria: speakingScores({
        grammarVocabulary: { score: 2, feedback: "鍚﹀畾鍙ラ渶瑕佷娇鐢?don't like銆? },
        interactiveCommunication: { score: 4, feedback: "鍥炵瓟鏂瑰悜姝ｇ‘锛岃兘琛ㄨ揪涓嶅枩娆€? },
        globalAchievement: { score: 3, feedback: "淇鍙ュ瀷鍚庡彲浠ヨ幏寰楁洿绋冲畾鐨勫彛璇〃鐜般€? },
      }),
    };
  }

  if (normalizedQuestion.includes("milk")) {
    const answersMilkQuestion =
      normalizedAnswer.includes("milk") || normalizedAnswer === "yes, i do." || normalizedAnswer === "no, i don't.";

    if (!answersMilkQuestion) {
      return {
        isCorrect: false,
        feedback: "杩欏彞璇濇湰韬彲浠ワ紝浣嗘病鏈夌洿鎺ュ洖绛?Do you like milk? 杩欎釜闂銆?,
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "鍚噦棰樼洰鍚庨渶瑕佺洿鎺ュ洖绛?milk 鐩稿叧闂銆? },
          interactiveCommunication: { score: 2, feedback: "娌℃湁鐩存帴鍥炲簲褰撳墠闂锛屼簰鍔ㄧ浉鍏虫€т笉澶熴€? },
          globalAchievement: { score: 3, feedback: "琛ㄨ揪娓呮锛屼絾浠诲姟瀹屾垚搴︿笉澶熴€? },
        }),
      };
    }
  }

  if (normalizedQuestion.includes("fruit")) {
    const answersFruitQuestion = fruitWords.some((item) => normalizedAnswer.includes(item));
    if (!answersFruitQuestion) {
      return {
        isCorrect: false,
        feedback: "杩欏彞璇濇病鏈夊洖绛旀按鏋滈棶棰樸€傚彲浠ヨ I like apples. 鎴?I like bananas.",
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "闇€瑕佸惉鍒?fruit锛屽苟鐢ㄦ按鏋滆瘝鍥炵瓟銆? },
          interactiveCommunication: { score: 2, feedback: "鍥炵瓟娌℃湁鍥寸粫 fruit 闂灞曞紑銆? },
          globalAchievement: { score: 3, feedback: "闇€瑕佹洿璐村悎浠诲姟瑕佹眰銆? },
        }),
      };
    }
  }

  if (normalizedQuestion.includes("food")) {
    const answersFoodQuestion = foodWords.some((item) => normalizedAnswer.includes(item));
    if (!answersFoodQuestion) {
      return {
        isCorrect: false,
        feedback: "杩欏彞璇濇病鏈夊洖绛斿枩娆粈涔堥鐗┿€傝鐢ㄦ湰鍗曞厓鐨勯鐗╄瘝姹囦綔绛斻€?,
        criteria: speakingScores({
          discourseManagement: { score: 2, feedback: "闇€瑕佸惉鍒?food锛屽苟鐢ㄩ鐗╄瘝鍥炵瓟銆? },
          interactiveCommunication: { score: 2, feedback: "娌℃湁鍥炵瓟 What food do you like? 鐨勬牳蹇冧俊鎭€? },
          globalAchievement: { score: 3, feedback: "闇€瑕佺敤椋熺墿璇嶆眹瀹屾垚浠诲姟銆? },
        }),
      };
    }
  }

  return {
    isCorrect: true,
    feedback: "鍥炵瓟涓嶉敊锛岃〃杈炬竻妤氾紝涔熷洖绛斾簡褰撳墠闂銆?,
    criteria: speakingScores({
      grammarVocabulary: { score: 4, feedback: "鍙ュ瀷鍜岃瘝姹囦娇鐢ㄥ噯纭€? },
      discourseManagement: { score: 4, feedback: "鍚噦闂锛屽苟鑳界敤鐭彞浣滅瓟銆? },
      interactiveCommunication: { score: 5, feedback: "鑳界洿鎺ュ洖搴斿綋鍓嶉棶棰橈紝浜掑姩琛ㄧ幇寰堝ソ銆? },
      globalAchievement: { score: 4, feedback: "瀹屾垚鏈疆灏戝効鍙ｈ浠诲姟銆? },
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
      feedback: `${reply} 鍙﹀锛岃繖閲屽缓璁 ${firstMistake.suggestion}`,
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
    .map((task) => (task.type === "review" ? "閿欏彞澶嶇粌" : task.title));
  const masteredSentences = input.errors
    .filter((error) => error.status === "mastered")
    .map((error) => error.correctedSentence);
  const errorsToReview = input.errors
    .filter((error) => error.status !== "mastered")
    .map((error) => error.correctedSentence);

  return {
    id: "report-demo-today",
    date: new Date().toISOString().slice(0, 10),
    summary: `浠婃棩瀹屾垚 ${completedTasks.length}/${input.tasks.length} 椤逛换鍔★紝宸叉帉鎻?${masteredSentences.length} 鏉″叧閿〃杈俱€俙,
    completedTasks,
    masteredSentences,
    errorsToReview,
    speakingScores: speakingScores({
      grammarVocabulary: {
        score: errorsToReview.length ? 3 : 4,
        feedback: errorsToReview.length ? "浠嶉渶澶嶇粌椋熺墿璇嶆眹銆佸鏁板拰鍚﹀畾鍙ャ€? : "鏈崟鍏冩牳蹇冭瘝姹囧拰鍙ュ瀷鎺屾彙杈冪ǔ瀹氥€?,
      },
      discourseManagement: { score: 4, feedback: "鑳藉鍚噦 Food 涓婚鐨勭畝鍗曢棶棰樺苟浣滅瓟銆? },
      pronunciation: { score: 4, feedback: "璺熻琛ㄧ幇娓呮锛屽悗缁彲鎺ョ湡瀹炲綍闊宠瘎鍒嗐€? },
      interactiveCommunication: { score: 4, feedback: "鑳藉弬涓?Food 涓婚闂瓟锛屼簰鍔ㄤ俊蹇冭緝濂姐€? },
      globalAchievement: { score: completedTasks.length >= 3 ? 4 : 3, feedback: "鏈疆 Speaking 鍙幏寰楃害 3-4 涓浘鐗岀殑琛ㄧ幇銆? },
    }),
    aiSuggestion: "涓嬩竴杞缓璁户缁粌涔?food 涓婚闂瓟锛岄噸鐐瑰叧娉ㄥ悕璇嶅鏁般€佸惁瀹氬彞鍜屽彂闊虫竻鏅板害銆?,
    parentFriendlyComment: "瀛╁瓙宸茬粡鑳藉鍥寸粫椋熺墿涓婚杩涜绠€鍗曡〃杈俱€傞亣鍒伴敊璇悗锛屽彲浠ラ€氳繃閿欏彞澶嶇粌閫愭淇锛屽缓璁瘡澶╀繚鎸?5-8 鍒嗛挓鍙ｈ缁冧範銆?,
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
      data.provider && data.provider !== "tencent_soe" ? `锛堝綋鍓嶈瘎鍒嗘潵婧愶細${data.provider}锛岃妫€鏌ヨ吘璁櫤鑱嗚繑鍥炰俊鎭€傦級` : "";
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
          feedback: data.fluency >= 85 ? "琛ㄨ揪鑺傚姣旇緝鑷劧銆? : "鑺傚杩樺彲浠ユ洿绋冲畾涓€浜涖€?,
        },
      }),
    };

    void saveLearningSession("reading", `Reading practice: ${input.targetText}`, result.score);
    return result;
  } catch (error) {
    await delay();
    const fallback = getMockReadingAnalysis(input.targetText, input.userText);
    const message = error instanceof Error ? error.message : "unknown error";
    fallback.feedback = `鍚庣鍙ｈ璇勫垎鏈垚鍔燂紝褰撳墠鏄剧ず婕旂ず璇勫垎銆傚師鍥狅細${message}`;
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
      error.errorType === "鍚嶈瘝鍗曞鏁?
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
      feedback: "AI 妫€鏌ラ€氳繃锛氳窡璇诲唴瀹规竻妤氾紝鐩爣鍙ュ瓙宸茬粡璇撮『浜嗐€?,
    };
  }

  if (input.stepIndex === 1) {
    const usesTargetPattern = input.responseText.includes("likes") || input.responseText.includes("I like");
    return {
      passed: usesTargetPattern,
      feedback: usesTargetPattern
        ? "AI 妫€鏌ラ€氳繃锛氳兘鎶婃纭彞鍨嬭縼绉诲埌鏂拌瘝姹囬噷銆?
        : "杩橀渶瑕佸啀缁冧竴娆★細璇蜂娇鐢ㄦ湰棰樼殑鐩爣鍙ュ瀷瀹屾垚鏇挎崲閫犲彞銆?,
    };
  }

  const isUsingCorrectSentence = input.responseText === input.error.correctedSentence;
  return {
    passed: isUsingCorrectSentence,
    feedback: isUsingCorrectSentence
      ? "AI 妫€鏌ラ€氳繃锛氬洖绛旇嚜鐒讹紝骞朵笖浣跨敤浜嗘纭〃杈俱€?
      : `杩橀渶瑕佸啀缁冧竴娆★細璇峰敖閲忚鎴?${input.error.correctedSentence}`,
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
        summary: `浠婃棩浠诲姟 ${completedCount}/${input.tasks.length} 椤瑰畬鎴愶紱閿欏彞 ${input.errors.length} 鏉★紱宸叉帉鎻?${masteredCount} 鏉★紱浠嶉渶澶嶇粌 ${pendingErrorCount} 鏉°€備笉瑕佺敓鎴愭纭巼銆俙,
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
      .map((task) => (task.type === "review" ? "閿欏彞澶嶇粌" : task.title));
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
          feedback: data.report.next_steps[0] ?? "寤鸿缁х画宸╁浐璇嶆眹鍜屽彞鍨嬨€?,
        },
        discourseManagement: {
          score: 4,
          feedback: data.report.strengths[0] ?? "鑳藉鍥寸粫涓婚鐞嗚В骞跺洖搴旈棶棰樸€?,
        },
        pronunciation: {
          score: errorsToReview.length ? 3 : 4,
          feedback: errorsToReview.length ? "浠嶆湁琛ㄨ揪闇€瑕佽繘鍏ヤ笅涓€杞缁冦€? : "鏈疆鍙戦煶琛ㄧ幇姣旇緝绋冲畾銆?,
        },
        interactiveCommunication: {
          score: 4,
          feedback: data.report.strengths[1] ?? "浜掑姩琛ㄧ幇鑷劧锛岃兘瀹屾垚鍩烘湰闂瓟銆?,
        },
        globalAchievement: {
          score: completedTasks.length >= 3 ? 4 : 3,
          feedback: `鍚庣宸茬疮璁?${data.report.related_session_count} 鏉″涔犺褰曘€俙,
        },
      }),
      aiStrengths: data.report.strengths,
      aiNextSteps: data.report.next_steps,
      aiSuggestion: data.report.next_steps.join("锛?) || "寤鸿缁х画瀹屾垚涓嬩竴杞彛璇粌涔犮€?,
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
