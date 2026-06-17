export type ErrorStatus = "pending" | "practicing" | "mastered";

export type WordItem = {
  id: string;
  text: string;
  meaning: string;
};

export type SentenceItem = {
  id: string;
  text: string;
  meaning: string;
};

export type Unit = {
  id: string;
  title: string;
  topic: string;
  description: string;
  words: WordItem[];
  sentences: SentenceItem[];
  aiQuestions: string[];
  commonErrors: CommonError[];
};

export type CommonError = {
  id: string;
  originalSentence: string;
  correctedSentence: string;
  explanation: string;
  errorType: string;
};

export type ErrorSentence = {
  id: string;
  question?: string;
  originalSentence: string;
  correctedSentence: string;
  explanation: string;
  errorType: string;
  status: ErrorStatus;
  source: "dialogue" | "reading" | "review";
  createdAt: string;
};

export type PracticeTask = {
  id: string;
  title: string;
  description: string;
  type: "word" | "sentence" | "dialogue" | "review" | "report";
  status: "not_started" | "in_progress" | "completed";
};

export type DialogueMessage = {
  id: string;
  role: "ai" | "student";
  content: string;
};

export type SpeakingCriterionKey =
  | "grammarVocabulary"
  | "discourseManagement"
  | "pronunciation"
  | "interactiveCommunication"
  | "globalAchievement";

export type SpeakingCriterionScore = {
  key: SpeakingCriterionKey;
  label: string;
  score: number;
  maxScore: number;
  feedback: string;
};

export type StudyReport = {
  id: string;
  date: string;
  summary: string;
  completedTasks: string[];
  masteredSentences: string[];
  errorsToReview: string[];
  speakingScores: SpeakingCriterionScore[];
  aiStrengths?: string[];
  aiNextSteps?: string[];
  aiSuggestion: string;
  parentFriendlyComment: string;
};
