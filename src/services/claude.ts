/**
 * Claude API client (handoff §12.1).
 *
 * Generates the three-part per-entry summary. Transcript text only is sent —
 * never audio (principle §2.1 / §5.3). Callers MUST check `entry.isPrivate`
 * and skip this entirely for private entries (§5.5 / Step 9).
 *
 * Transport:
 *   - Web  → POSTs `{ transcript }` to our own `/api/anthropic/summary`
 *            proxy. The Anthropic key lives ONLY on the server, never in the
 *            client bundle (fixes Open Q #3 for hosted web).
 *   - Native → calls the Anthropic API directly using a locally-configured
 *            key (dev). Native production should move to the proxy too.
 */
import { Platform } from 'react-native';

import { Config } from '@/constants/config';
import { ENTRY_SUMMARY_PROMPT_VERSION, ENTRY_SUMMARY_SYSTEM } from '@/constants/prompts';

/** Same-origin proxy endpoint served by server/index.mjs. */
const PROXY_PATH = '/api/anthropic/summary';

export interface EntrySummary {
  whatSaid: string;
  unseen: string;
  action: string;
}

export interface EntrySummaryResult {
  summary: EntrySummary;
  model: string;
  promptVersion: string;
  raw: string;
}

export class ClaudeAuthError extends Error {}
export class ClaudeDisabledError extends Error {}

function extractText(data: any): string {
  const block = Array.isArray(data?.content)
    ? data.content.find((b: { type?: string }) => b.type === 'text')
    : undefined;
  return block?.text ?? '';
}

function parseSummary(text: string): EntrySummary {
  // The prompt instructs Claude to return bare JSON; be defensive anyway.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const json = start >= 0 && end > start ? text.slice(start, end + 1) : text;
  const parsed = JSON.parse(json);
  return {
    whatSaid: String(parsed.what_said ?? ''),
    unseen: String(parsed.unseen ?? ''),
    action: String(parsed.action ?? ''),
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Web: hit our server proxy. Native: hit Anthropic directly. */
async function sendRequest(transcript: string): Promise<Response> {
  if (Platform.OS === 'web') {
    return fetch(PROXY_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
  }

  if (!Config.anthropic.apiKey) {
    throw new ClaudeDisabledError('No Anthropic API key configured for native dev.');
  }
  return fetch(Config.anthropic.baseUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': Config.anthropic.apiKey,
      'anthropic-version': Config.anthropic.version,
    },
    body: JSON.stringify({
      model: Config.anthropic.model,
      max_tokens: Config.anthropic.maxTokens.entrySummary,
      system: ENTRY_SUMMARY_SYSTEM,
      messages: [{ role: 'user', content: `Here is my journal entry transcript:\n\n${transcript}` }],
    }),
  });
}

/**
 * Generate a per-entry summary. Retries once on 529 (overloaded) per §12.1.
 * Throws ClaudeAuthError on 401 so the caller can surface a settings prompt.
 */
export async function generateEntrySummary(transcript: string): Promise<EntrySummaryResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await sendRequest(transcript);

    if (res.status === 529 && attempt === 0) {
      await sleep(3000);
      continue;
    }
    if (res.status === 401) {
      throw new ClaudeAuthError('Anthropic API key rejected (401).');
    }
    if (res.status === 503) {
      throw new ClaudeDisabledError('AI summaries are not configured on the server.');
    }
    if (!res.ok) {
      throw new Error(`Claude request failed ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const raw = extractText(data);
    return {
      summary: parseSummary(raw),
      model: Config.anthropic.model,
      promptVersion: ENTRY_SUMMARY_PROMPT_VERSION,
      raw,
    };
  }
  throw new Error('Claude API overloaded (529) after retry.');
}
