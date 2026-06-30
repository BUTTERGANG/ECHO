/**
 * App configuration: model names, API endpoints, and defaults.
 *
 * SECURITY / Open Question #3:
 *   `apiKey` below is read from an EXPO_PUBLIC_ env var and is used ONLY by
 *   the native (iOS/Android) dev build, which calls Anthropic directly.
 *   EXPO_PUBLIC_* values are inlined into the bundle and are extractable, so
 *   it must NOT be set for the web build. The web app calls Anthropic through
 *   the server proxy (server/index.mjs → /api/anthropic/summary), keeping the
 *   key server-side. Native production should also migrate to the proxy.
 */

export const WHISPER_MODELS = ['base', 'small', 'large-v3'] as const;
export type WhisperModelName = (typeof WHISPER_MODELS)[number];

/** transformers.js model ids (web). Mapped from the doc's ggml model names. */
export const WHISPER_WEB_MODEL_IDS: Record<WhisperModelName, string> = {
  base: 'Xenova/whisper-base.en',
  small: 'Xenova/whisper-small.en',
  'large-v3': 'onnx-community/whisper-large-v3',
};

export const Config = {
  /** Default Whisper model on first launch (Open Q #2 — lean toward `small`). */
  defaultWhisperModel: 'small' as WhisperModelName,

  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1/messages',
    version: '2023-06-01',
    model: 'claude-sonnet-4-6',
    maxTokens: {
      entrySummary: 1000,
      patternExtraction: 2000,
      weeklyReview: 1500,
    },
    /** Dev-only direct browser access. Replace with a proxy before release. */
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '',
  },

  defaults: {
    /** Privacy-first: AI summaries are OFF until the user opts in (Open Q #5). */
    aiSummariesEnabled: false,
    /** Daily streak reminder time (24h local). */
    reminderHour: 20,
    reminderMinute: 0,
  },
} as const;

export const FILE_PATHS = {
  audioDir: 'echo/audio',
  exportsDir: 'echo/exports',
  modelsDir: 'echo/whisper_models',
} as const;
