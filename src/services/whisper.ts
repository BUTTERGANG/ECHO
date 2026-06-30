/**
 * Whisper transcription — WEB / default implementation.
 *
 * transformers.js is loaded from a CDN at RUNTIME rather than bundled. Its
 * `onnxruntime-web` dependency ships prebuilt `.mjs` files whose dynamic
 * `import()` calls Metro cannot parse, so static bundling fails. Runtime
 * loading is also how transformers.js is meant to run in a browser: the model
 * weights are fetched and cached on-device and inference runs client-side, so
 * audio still never leaves the device (handoff principle §2.1).
 *
 * The CDN library + model download is cross-origin, so under the app's
 * `Cross-Origin-Embedder-Policy: require-corp` it may need `COEP_POLICY=
 * credentialless` (see server/index.mjs) — the same toggle the model download
 * already required.
 *
 * Native (iOS/Android) overrides this file with `whisper.native.ts`.
 */
import { Config, WHISPER_WEB_MODEL_IDS, type WhisperModelName } from '@/constants/config';

/** jsdelivr's flattened ESM build resolves transformers.js + onnxruntime deps. */
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/+esm';

export interface TranscriptionResult {
  transcript: string;
  model: WhisperModelName;
}

/** Audio input as 16 kHz mono PCM, or a URL/blob URL the pipeline can fetch. */
export type AudioInput = Float32Array | string;

/**
 * Model-download progress (0–100). Emitted while transformers.js fetches and
 * caches the model on first use; `undefined` once it's loaded from cache.
 */
export type ModelLoadProgress = (percent: number | undefined) => void;

type AsrPipeline = (audio: AudioInput, opts?: Record<string, unknown>) => Promise<unknown>;
interface TransformersModule {
  pipeline: (task: string, model: string, opts?: Record<string, unknown>) => Promise<AsrPipeline>;
  env: { allowLocalModels: boolean; [k: string]: unknown };
}

// Import via an indirect eval so Metro never tries to statically resolve (and
// bundle) the CDN URL. Runs only on web, where remote ESM import is supported.
const importRemote = new Function('u', 'return import(u)') as (u: string) => Promise<TransformersModule>;

let modulePromise: Promise<TransformersModule> | null = null;
function getTransformers(): Promise<TransformersModule> {
  if (!modulePromise) {
    modulePromise = importRemote(TRANSFORMERS_CDN).then((mod) => {
      // Fetch weights from the HuggingFace CDN, not from our own origin.
      mod.env.allowLocalModels = false;
      return mod;
    });
  }
  return modulePromise;
}

// transformers.js pipeline is heavy to construct; cache per model.
let currentModel: WhisperModelName | null = null;
let asrPipeline: AsrPipeline | null = null;

export async function loadModel(
  model: WhisperModelName = Config.defaultWhisperModel,
  onProgress?: ModelLoadProgress,
): Promise<void> {
  if (asrPipeline && currentModel === model) {
    onProgress?.(undefined);
    return;
  }
  const { pipeline } = await getTransformers();
  asrPipeline = await pipeline('automatic-speech-recognition', WHISPER_WEB_MODEL_IDS[model], {
    // transformers.js reports per-file download progress; surface the latest.
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (!onProgress) return;
      if (p.status === 'progress' && typeof p.progress === 'number') onProgress(Math.round(p.progress));
      else if (p.status === 'ready' || p.status === 'done') onProgress(undefined);
    },
  });
  currentModel = model;
}

export async function transcribe(
  audio: AudioInput,
  model: WhisperModelName = Config.defaultWhisperModel,
  onProgress?: ModelLoadProgress,
): Promise<TranscriptionResult> {
  await loadModel(model, onProgress);
  if (!asrPipeline) throw new Error('Whisper model failed to load');
  // chunk_length_s keeps long recordings within the model's receptive field.
  const output = await asrPipeline(audio, { chunk_length_s: 30, stride_length_s: 5 });
  const text = Array.isArray(output)
    ? output
        .map((o: { text?: string }) => o.text ?? '')
        .join(' ')
        .trim()
    : ((output as { text?: string })?.text ?? '').trim();
  return { transcript: text, model };
}

export function unloadModel(): void {
  asrPipeline = null;
  currentModel = null;
}
