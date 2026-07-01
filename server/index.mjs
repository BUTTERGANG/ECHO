/**
 * ECHO production server (Replit Autoscale target).
 *
 * Responsibilities — deliberately thin, because ECHO is local-first and holds
 * all data in the browser:
 *   1. Serve the Expo web SPA from ../dist
 *   2. Send cross-origin-isolation headers (COOP/COEP) so wa-sqlite's
 *      SharedArrayBuffer works in production (dev-only Metro middleware does
 *      not run here).
 *   3. Proxy Claude entry-summary requests so the Anthropic API key stays
 *      server-side (never shipped in the client bundle). Rate-limited.
 *   4. /healthz for the autoscale health check.
 *
 * The process is stateless — a good fit for autoscale (scale-to-zero, no
 * shared filesystem needed).
 */
import compression from 'compression';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const PORT = Number(process.env.PORT) || 3000;
// Expo SDK 56's expo-sqlite web docs specify credentialless, not require-corp,
// for the COEP header that enables SharedArrayBuffer for the wa-sqlite worker:
// https://docs.expo.dev/versions/v56.0.0/sdk/sqlite/. require-corp also has
// the side effect of blocking the Whisper model fetch from the HuggingFace CDN
// (see DEPLOY.md). credentialless has been supported in Firefox since 119 and
// Safari since 17.4, so it's no longer the Chromium-only fallback it once was.
const COEP_POLICY = process.env.COEP_POLICY || 'credentialless';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || ''; // e.g. https://echo.replit.app
const MAX_TOKENS = 1000;
const MAX_TRANSCRIPT_CHARS = 20_000;

// IMPORTANT: keep in sync with src/constants/prompts.ts → ENTRY_SUMMARY_SYSTEM (v1.0).
// The prompt lives server-side so the proxy can't be abused as a generic Claude relay.
const ENTRY_SUMMARY_SYSTEM = `You are a private, compassionate journaling companion. Your only job is to help the user understand what they just expressed.

You will receive a raw voice journal transcript — stream of consciousness, unedited. Do not judge it. Do not moralize. Do not add unsolicited advice.

Respond ONLY with a JSON object. No preamble, no markdown, no explanation outside the JSON.

The JSON must have exactly these three fields:
- "what_said": A 2-3 sentence neutral summary of what the person expressed. Mirror their language and emotional tone. Do not editorialize.
- "unseen": One observation about a subtle pattern, contradiction, or subtext that the person may not have consciously noticed. Be specific and grounded — only flag something genuinely present in the text. If nothing meaningful is there, say "Nothing stood out beyond what you already expressed clearly."
- "action": One concrete, small, optional action the person could take today — or "No action needed" if the entry was purely reflective. Must be actionable in under 10 minutes.

Keep each field under 100 words. Never fabricate details not present in the transcript.`;

// IMPORTANT: keep in sync with src/constants/prompts.ts → WEEKLY_REVIEW_SYSTEM (v1.0).
const WEEKLY_REVIEW_SYSTEM = `You are a thoughtful journaling companion generating a private weekly review for the user.

You will receive a week's worth of journal entries and some summary statistics.

Respond ONLY with a JSON object with these fields:
- "summary": A 3-5 sentence narrative of the week. What was the general arc? What were the highs and lows? Written in second person ("You spent this week..."). Warm but grounded — not falsely positive.
- "top_themes": Array of 2-4 short theme strings that defined the week.
- "carry_forward": One thing worth paying attention to in the coming week, based on what's present in the entries. Must be specific to their actual content.

Keep the summary under 200 words. Do not fabricate. Do not repeat generic affirmations.`;

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '256kb' }));

// (1) Cross-origin isolation on every response.
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', COEP_POLICY);
  next();
});

// COI service worker — served without CORP headers so the SW can install
// itself even before cross-origin isolation is active.
const COI_SW_PATH = path.join(__dirname, 'coi-serviceworker.js');
app.get('/coi-serviceworker.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(COI_SW_PATH);
});

// (4) Health check.
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true, ai: Boolean(ANTHROPIC_API_KEY) });
});

// --- Simple per-instance rate limiter (in-memory; resets on scale events). ---
const WINDOW_MS = 60_000;
const MAX_REQ = 20;
const hits = new Map();
function rateLimited(key) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_REQ;
}

// (3) Claude entry-summary proxy. Client sends only { transcript }.
app.post('/api/anthropic/summary', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI summaries are not configured.' });

  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden origin.' });
  }

  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || 'unknown').trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const transcript = (req.body?.transcript ?? '').toString();
  if (!transcript.trim()) return res.status(400).json({ error: 'transcript is required.' });
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return res.status(413).json({ error: 'transcript too long.' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: ENTRY_SUMMARY_SYSTEM,
        messages: [{ role: 'user', content: `Here is my journal entry transcript:\n\n${transcript}` }],
      }),
    });
    // Pass the Anthropic response through verbatim; the client parses it.
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch {
    res.status(502).json({ error: 'Upstream AI request failed.' });
  }
});

// (3b) Claude weekly-review proxy. Client sends only { entries: string[] }.
app.post('/api/anthropic/weekly', async (req, res) => {
  if (!ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI summaries are not configured.' });

  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden origin.' });
  }

  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || 'unknown').trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const list = Array.isArray(req.body?.entries) ? req.body.entries : [];
  const texts = list
    .map((t) => (t ?? '').toString().trim())
    .filter(Boolean)
    .slice(0, 50);
  if (texts.length === 0) return res.status(400).json({ error: 'entries are required.' });

  let composed = texts.map((t, i) => `Entry ${i + 1}:\n${t}`).join('\n\n');
  if (composed.length > MAX_TRANSCRIPT_CHARS * 3) composed = composed.slice(0, MAX_TRANSCRIPT_CHARS * 3);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        system: WEEKLY_REVIEW_SYSTEM,
        messages: [
          { role: 'user', content: `Here are my journal entries from the past week:\n\n${composed}` },
        ],
      }),
    });
    const text = await upstream.text();
    res.status(upstream.status).type('application/json').send(text);
  } catch {
    res.status(502).json({ error: 'Upstream AI request failed.' });
  }
});

// (2) Static assets with cache headers.
app.use(
  express.static(DIST, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else if (filePath.includes(`${path.sep}_expo${path.sep}`)) {
        // Content-hashed assets — safe to cache forever.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// COI service worker registration snippet — injected into every HTML response
// so that SharedArrayBuffer is available even inside Replit's preview iframe
// (where the parent frame is not cross-origin isolated).
//
// Guards against infinite reload: sessionStorage tracks whether we've already
// reloaded once after SW activation. If crossOriginIsolated is still false
// after that reload, the parent context doesn't support it and we give up
// gracefully rather than looping.
const COI_SNIPPET = `<script>
  (function() {
    if (self.crossOriginIsolated) return; // already isolated, nothing to do
    if (!('serviceWorker' in navigator)) return; // SW not supported
    var RELOAD_KEY = '__coi_reloaded__';
    // If we've already reloaded once for COI and it still didn't work, stop.
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    navigator.serviceWorker.register('/coi-serviceworker.js').then(function(reg) {
      function doReload() {
        sessionStorage.setItem(RELOAD_KEY, '1');
        location.reload();
      }
      if (reg.active) {
        doReload();
      } else {
        (reg.installing || reg.waiting).addEventListener('statechange', function() {
          if (this.state === 'activated') doReload();
        });
      }
    });
  })();
<\/script>`;

// SPA fallback (Express 5: no wildcard route string — use terminal middleware).
// Must accept HEAD as well as GET — readiness/liveness probes (including
// Replit's preview pane and autoscale health checks) issue HEAD requests
// against `/`, and res.sendFile already handles HEAD correctly (headers
// only, no body) so there's no reason to exclude it.
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || req.path.startsWith('/api/')) return next();
  res.setHeader('Cache-Control', 'no-cache');

  // For HEAD requests skip the body; just set headers and status.
  if (req.method === 'HEAD') {
    return res.status(200).end();
  }

  const htmlPath = path.join(DIST, 'index.html');
  try {
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Inject SW registration before </head> so it runs as early as possible.
    html = html.replace('</head>', COI_SNIPPET + '</head>');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.status(500).send('Internal server error: could not read index.html');
  }
});

// Retrying EADDRINUSE matters specifically on Replit: stopping/restarting the
// "Run" workflow sends the previous process a shutdown signal, but there is
// no guarantee its socket is released before the new process starts binding
// — a stale process mid-shutdown is a *transient* conflict, not a permanent
// one, and previously this made the whole `npm run deploy:local` chain exit
// non-zero (the Run button reporting a hard failure) for something that
// clears itself within a second or two.
const BIND_RETRY_MS = 500;
const BIND_RETRY_LIMIT = 10; // ~5s total — generous for a slow prior shutdown, not indefinite.
let bindAttempts = 0;
let httpServer;

function startListening() {
  httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ECHO server listening on :${PORT} (COEP=${COEP_POLICY}, ai=${Boolean(ANTHROPIC_API_KEY)})`);
  });

  // Without this, a bind failure is an unhandled 'error' event on the
  // http.Server, which Node rethrows as an uncaught exception — the process
  // dies with a generic stack trace instead of a message that actually says
  // "the port was already in use."
  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && bindAttempts < BIND_RETRY_LIMIT) {
      bindAttempts += 1;
      console.warn(
        `Port ${PORT} still in use (attempt ${bindAttempts}/${BIND_RETRY_LIMIT}), retrying in ${BIND_RETRY_MS}ms...`,
      );
      setTimeout(startListening, BIND_RETRY_MS);
      return;
    }
    if (err.code === 'EADDRINUSE') {
      console.error(`ECHO server failed to start: port ${PORT} is still in use after retrying.`);
    } else {
      console.error('ECHO server failed to start:', err);
    }
    process.exit(1);
  });
}

startListening();

// Release the port promptly on shutdown so a fast restart (or the retry loop
// above, on someone else's process) doesn't have to wait out a stale bind.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    httpServer.close(() => process.exit(0));
  });
}
