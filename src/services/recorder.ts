export function createAudioRecorder(stream: MediaStream): MediaRecorder {
  const mimeType = getPreferredAudioMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

export function getPreferredAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

export function getAudioExtension(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function buildAudioFileName(prefix: string, mimeType: string): string {
  const extension = getAudioExtension(mimeType);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${sanitizeFilePart(prefix)}-${stamp}.${extension}`;
}

export function describeMicrophoneError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "无法使用麦克风，已切换为演示录音流程。";
  }

  if (error.message === "microphone-request-timeout") {
    return "没有看到麦克风授权提示，已切换为演示录音流程。";
  }

  const name = error.name.toLowerCase();
  if (name.includes("notallowed") || name.includes("permission")) {
    return "浏览器没有获得麦克风权限，已切换为演示录音流程。";
  }

  if (name.includes("notfound")) {
    return "没有检测到可用麦克风设备，已切换为演示录音流程。";
  }

  if (name.includes("notreadable") || name.includes("trackstart")) {
    return "麦克风当前被占用或无法读取，已切换为演示录音流程。";
  }

  return "无法使用麦克风，已切换为演示录音流程。";
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-z0-9-_]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "recording";
}
