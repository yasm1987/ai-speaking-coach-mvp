import type { DialogueMessage, ErrorSentence, PracticeTask, Unit } from "../types";

export const demoUnit: Unit = {
  id: "unit-3-food",
  title: "Unit 3 Food",
  topic: "Food",
  description: "围绕常见食物，练习表达喜欢与不喜欢，并能用简单问答完成口语交流。",
  words: [
    { id: "word-apple", text: "apple", meaning: "苹果" },
    { id: "word-banana", text: "banana", meaning: "香蕉" },
    { id: "word-sandwich", text: "sandwich", meaning: "三明治" },
    { id: "word-milk", text: "milk", meaning: "牛奶" },
    { id: "word-pizza", text: "pizza", meaning: "披萨" },
  ],
  sentences: [
    { id: "sentence-like-apples", text: "I like apples.", meaning: "我喜欢苹果。" },
    { id: "sentence-dont-like-milk", text: "I don't like milk.", meaning: "我不喜欢牛奶。" },
    { id: "sentence-question-food", text: "What food do you like?", meaning: "你喜欢什么食物？" },
  ],
  aiQuestions: ["What food do you like?", "Do you like milk?", "What fruit do you like?"],
  commonErrors: [
    {
      id: "common-error-plural",
      originalSentence: "I like apple.",
      correctedSentence: "I like apples.",
      explanation: "表达喜欢某一类食物时，apple 通常要使用复数 apples。",
      errorType: "名词单复数",
    },
    {
      id: "common-error-third-person",
      originalSentence: "He like pizza.",
      correctedSentence: "He likes pizza.",
      explanation: "主语是 he 时，一般现在时里的 like 需要变成 likes。",
      errorType: "第三人称单数",
    },
    {
      id: "common-error-negative",
      originalSentence: "I no like milk.",
      correctedSentence: "I don't like milk.",
      explanation: "英语否定句需要借助 don't，不能直接说 no like。",
      errorType: "否定句结构",
    },
  ],
};

export const demoTasks: PracticeTask[] = [
  {
    id: "task-word",
    title: "词汇跟读 5 个",
    description: "听标准音并跟读 Unit 3 Food 的核心词汇。",
    type: "word",
    status: "not_started",
  },
  {
    id: "task-sentence",
    title: "句型跟读 3 个",
    description: "练习 I like..., I don't like..., What food do you like? 三个句型。",
    type: "sentence",
    status: "not_started",
  },
  {
    id: "task-dialogue",
    title: "AI 对话 1 轮",
    description: "围绕喜欢的食物和水果，完成一轮教材主题问答。",
    type: "dialogue",
    status: "not_started",
  },
  {
    id: "task-review",
    title: "错句复练",
    description: "从错句本中复练待掌握内容，完成两轮后生成学习报告。",
    type: "review",
    status: "not_started",
  },
  {
    id: "task-report",
    title: "查看学习报告",
    description: "生成今天的任务完成情况、错句总结和家长可读反馈。",
    type: "report",
    status: "not_started",
  },
];

export const demoDialogueError: ErrorSentence = {
  id: "error-dialogue-demo",
  question: "What fruit do you like?",
  originalSentence: "I like apple.",
  correctedSentence: "I like apples.",
  explanation: "在 AI 对话中回答喜欢某一类水果时，apple 通常要用复数 apples。",
  errorType: "AI 对话回答不够准确",
  status: "pending",
  source: "dialogue",
  createdAt: new Date(2026, 5, 14, 10, 30).toISOString(),
};

export const initialDialogueMessages: DialogueMessage[] = [
  {
    id: "message-ai-opening",
    role: "ai",
    content: "What food do you like?",
  },
];
