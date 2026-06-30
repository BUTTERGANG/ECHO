/**
 * Whisper transcription — NATIVE implementation (iOS/Android).
 *
 * STUB. To be implemented when the native build is set up (requires a dev
 * client / EAS build, not Expo Go). Planned backend: whisper.cpp via
 * `whisper-rn`, loading a ggml model from FILE_PATHS.modelsDir.
 *
 * Keeps the same public surface as `whisper.ts` so callers are
 * platform-agnostic. Metro selects this file automatically on native.
 */
import { Config, type WhisperModelName } from '@/constants/config';

export interface TranscriptionResult {
  transcript: string;
  model: WhisperModelName;
}

export type AudioInput = Float32Array | string;

export type ModelLoadProgress = (percent: number | undefined) => void;

const NOT_IMPLEMENTED =
  'Native Whisper (whisper-rn) is not wired up yet — see Phase 1 Step 3 of the handoff. ' +
  'The native build requires a dev client; this is intentionally stubbed for the web-first scaffold.';

export async function loadModel(
  _model: WhisperModelName = Config.defaultWhisperModel,
  _onProgress?: ModelLoadProgress,
): Promise<void> {
  throw new Error(NOT_IMPLEMENTED);
}

export async function transcribe(
  _audio: AudioInput,
  _model: WhisperModelName = Config.defaultWhisperModel,
  _onProgress?: ModelLoadProgress,
): Promise<TranscriptionResult> {
  throw new Error(NOT_IMPLEMENTED);
}

export function unloadModel(): void {
  /* no-op until native is implemented */
}
