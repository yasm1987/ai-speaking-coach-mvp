type ApiEnvelope<T> = {
  status: string;
  data: T;
  message: string;
};

type TTSData = {
  audio_base64: string;
  audio_format: string;
  provider: string;
  voice_type: string;
  text: string;
};

type TeacherSpeechOptions = {
  onDone?: () => void;
  onProgress?: (progress: number) => void;
};

function normalizeApiBaseUrl(value?: string) {
  const baseUrl = (value ?? "http://127.0.0.1:8000/api/v1").replace(/\/$/, "");
  return baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`;
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
const ALLOW_BROWSER_TTS_FALLBACK = import.meta.env.VITE_ALLOW_BROWSER_TTS_FALLBACK === "true";

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
const speechCache = new Map<string, TTSData>();

export function stopTeacherSpeech() {
  window.speechSynthesis?.cancel();
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export async function playTeacherSpeech(text: string, optionsOrDone?: TeacherSpeechOptions | (() => void)) {
  stopTeacherSpeech();
  const options = normalizeOptions(optionsOrDone);

  try {
    const audio = await synthesizeTeacherSpeech(text);
    if (audio.audio_base64) {
      await playBase64Audio(audio.audio_base64, audio.audio_format, options);
      return;
    }
    throw new Error("TTS returned empty audio.");
  } catch (error) {
    console.warn("Teacher TTS unavailable.", error);
  }

  if (ALLOW_BROWSER_TTS_FALLBACK) {
    playBrowserSpeech(text, options);
    return;
  }

  completeAfterEstimatedDuration(text, options);
}

export async function warmTeacherSpeech(text: string) {
  const key = getCacheKey(text);
  if (speechCache.has(key)) return;
  try {
    const audio = await synthesizeTeacherSpeech(text);
    if (audio.audio_base64) speechCache.set(key, audio);
  } catch {
    // Prefetch is opportunistic; playback still handles errors.
  }
}

async function synthesizeTeacherSpeech(text: string): Promise<TTSData> {
  const key = getCacheKey(text);
  const cached = speechCache.get(key);
  if (cached) return cached;

  const response = await fetch(`${API_BASE_URL}/tts/synthesize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  const json = (await response.json()) as ApiEnvelope<TTSData>;
  if (json.data.audio_base64) speechCache.set(key, json.data);
  return json.data;
}

async function playBase64Audio(audioBase64: string, audioFormat: string, options: TeacherSpeechOptions) {
  const normalizedBase64 = audioBase64.replace(/^data:audio\/[a-z0-9.+-]+;base64,/i, "").replace(/\s/g, "");
  const mimeType = audioFormat === "wav" ? "audio/wav" : audioFormat === "ogg" ? "audio/ogg" : "audio/mpeg";
  const dataUrl = `data:${mimeType};base64,${normalizedBase64}`;

  try {
    await playAudioUrl(dataUrl, options);
  } catch {
    const binary = window.atob(normalizedBase64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const blob = new Blob([bytes], { type: mimeType });
    activeObjectUrl = URL.createObjectURL(blob);
    await playAudioUrl(activeObjectUrl, options);
  }
}

function playAudioUrl(url: string, options: TeacherSpeechOptions) {
  return new Promise<void>((resolve, reject) => {
    activeAudio = new Audio(url);
    activeAudio.preload = "auto";

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      options.onProgress?.(1);
      stopTeacherSpeech();
      options.onDone?.();
      resolve();
    };

    activeAudio.ontimeupdate = () => {
      if (!activeAudio?.duration || Number.isNaN(activeAudio.duration)) return;
      options.onProgress?.(Math.min(activeAudio.currentTime / activeAudio.duration, 1));
    };
    activeAudio.onended = finish;
    activeAudio.onerror = () => {
      if (done) return;
      done = true;
      reject(new Error("Audio playback failed."));
    };
    activeAudio.play().catch(reject);
  });
}

function completeAfterEstimatedDuration(text: string, options: TeacherSpeechOptions) {
  runEstimatedProgress(text, options);
}

function playBrowserSpeech(text: string, options: TeacherSpeechOptions) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    options.onProgress?.(1);
    options.onDone?.();
  };

  if (!("speechSynthesis" in window)) {
    globalThis.setTimeout(finish, getPlaybackFallbackMs(text));
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  utterance.onend = finish;
  utterance.onerror = finish;
  window.speechSynthesis.speak(utterance);
  runEstimatedProgress(text, { ...options, onDone: finish });
}

function getPlaybackFallbackMs(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1500, Math.ceil((words / 1.8 + 0.8) * 1000));
}

function getCacheKey(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeOptions(optionsOrDone?: TeacherSpeechOptions | (() => void)): TeacherSpeechOptions {
  if (typeof optionsOrDone === "function") return { onDone: optionsOrDone };
  return optionsOrDone ?? {};
}

function runEstimatedProgress(text: string, options: TeacherSpeechOptions) {
  const durationMs = getPlaybackFallbackMs(text);
  const startedAt = Date.now();
  const timer = globalThis.setInterval(() => {
    const progress = Math.min((Date.now() - startedAt) / durationMs, 1);
    options.onProgress?.(progress);
    if (progress >= 1) {
      globalThis.clearInterval(timer);
      options.onDone?.();
    }
  }, 80);
}
