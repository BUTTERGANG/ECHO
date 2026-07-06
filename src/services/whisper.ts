/**
 * Speech-to-text — WEB / default implementation.
 *
 * Audio is uploaded to our own `/api/transcribe` proxy (server/index.mjs),
 * which forwards it to a hosted Whisper model (Groq) with the API key kept
 * server-side. The audio is streamed through the proxy and never stored.
 *
 * This replaces the earlier on-device transformers.js backend: browser-side
 * Whisper meant a large first-run model download and heavy WASM inference that
 * failed on memory-constrained devices. The trade-off is that audio now leaves
 * the device to be transcribed — reflected in the app's privacy copy.
 *
 * Native (iOS/Android) overrides this file with `whisper.native.ts`.
 */
import { Config, type WhisperModelName } from '@/constants/config';

/** Same-origin proxy endpoint served by server/index.mjs. */
const TRANSCRIBE_PATH = '/api/transcribe';

export interface TranscriptionResult {
  transcript: string;
  model: WhisperModelName;
}

/** A `blob:`/`http` URL (from the audio store) or a Blob of recorded audio. */
export type AudioInput = Float32Array | string | Blob;

/**
 * Retained for API compatibility with the native backend (which downloads a
 * model). The server backend has no client-side model, so progress is only
 * ever `undefined`.
 */
export type ModelLoadProgress = (percent: number | undefined) => void;

async function toBlob(audio: AudioInput): Promise<Blob> {
  if (typeof audio === 'string') {
    // A blob: object URL from the audio store — read it back into bytes.
    const res = await fetch(audio);
    return res.blob();
  }
  if (audio instanceof Blob) return audio;
  throw new Error('Unsupported audio input for server transcription.');
}

/** No-op with the server backend — there is no client-side model to preload. */
export async function loadModel(
  _model: WhisperModelName = Config.defaultWhisperModel,
  onProgress?: ModelLoadProgress,
): Promise<void> {
  onProgress?.(undefined);
}

export async function transcribe(
  audio: AudioInput,
  model: WhisperModelName = Config.defaultWhisperModel,
  onProgress?: ModelLoadProgress,
): Promise<TranscriptionResult> {
  onProgress?.(undefined); // no client-side model download with the server backend
  const blob = await toBlob(audio);

  const res = await fetch(TRANSCRIBE_PATH, {
    method: 'POST',
    headers: { 'content-type': blob.type || 'audio/webm' },
    body: blob,
  });

  if (res.status === 503) {
    throw new Error('Transcription is not configured on the server.');
  }
  if (!res.ok) {
    let detail = `Transcription failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) detail = String(body.error);
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as { text?: string };
  return { transcript: String(data.text ?? '').trim(), model };
}

/** No-op with the server backend. */
export function unloadModel(): void {
  /* nothing to unload */
}
