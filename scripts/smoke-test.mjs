/**
 * Smoke-tests a running ECHO server (local or deployed).
 *
 * Checks the things that have actually broken in practice:
 *   - GET / and HEAD / both succeed. HEAD matters because readiness/liveness
 *     probes (Replit's preview pane, autoscale health checks, most proxies)
 *     issue HEAD requests against `/` before treating the app as up — a
 *     GET-only SPA fallback passes manual testing but fails those probes.
 *   - A client-side route (not just `/`) resolves via the SPA fallback too.
 *   - COOP/COEP headers are present — wa-sqlite needs them for
 *     SharedArrayBuffer; losing them silently breaks persistence, not load.
 *   - The web bundle's own referenced JS/CSS assets actually serve.
 *   - /healthz reports ok.
 *
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const DIST = path.resolve(process.cwd(), 'dist');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/healthz`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server at ${BASE_URL} did not become ready within ${timeoutMs}ms`);
}

async function main() {
  console.log(`Smoke-testing ${BASE_URL}`);
  await waitForServer();

  const health = await fetch(`${BASE_URL}/healthz`);
  let healthBody = {};
  try {
    healthBody = await health.json();
  } catch {
    // leave empty, checked below
  }
  check('GET /healthz → 200', health.status === 200, `got ${health.status}`);
  check('GET /healthz → {ok:true}', healthBody.ok === true, JSON.stringify(healthBody));

  const getRoot = await fetch(`${BASE_URL}/`);
  const rootBody = await getRoot.text();
  check('GET / → 200', getRoot.status === 200, `got ${getRoot.status}`);
  check('GET / → contains <div id="root">', rootBody.includes('id="root"'));
  check(
    'GET / → Cross-Origin-Opener-Policy: same-origin',
    getRoot.headers.get('cross-origin-opener-policy') === 'same-origin',
    `got ${getRoot.headers.get('cross-origin-opener-policy')}`,
  );
  check(
    'GET / → Cross-Origin-Embedder-Policy present',
    Boolean(getRoot.headers.get('cross-origin-embedder-policy')),
  );

  const headRoot = await fetch(`${BASE_URL}/`, { method: 'HEAD' });
  check('HEAD / → 200 (readiness probes use HEAD)', headRoot.status === 200, `got ${headRoot.status}`);

  const headClientRoute = await fetch(`${BASE_URL}/settings`, { method: 'HEAD' });
  check(
    'HEAD /settings → 200 (SPA fallback covers client routes)',
    headClientRoute.status === 200,
    `got ${headClientRoute.status}`,
  );

  if (fs.existsSync(DIST)) {
    const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    const assetPaths = [...html.matchAll(/_expo\/static\/[^"']+\.(?:js|css)/g)].map((m) => m[0]);
    for (const assetPath of new Set(assetPaths)) {
      const res = await fetch(`${BASE_URL}/${assetPath}`);
      check(`GET /${assetPath} → 200`, res.status === 200, `got ${res.status}`);
    }
  } else {
    console.log('  (skipping bundled-asset checks — no local dist/ to read asset names from)');
  }

  if (failures > 0) {
    console.error(`\n${failures} smoke check(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed.');
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
