/**
 * Pre-build guard for the web bundle.
 *
 * EXPO_PUBLIC_* values are inlined into the client bundle at build time. The
 * Anthropic key must NEVER be there — the web app uses the server proxy. This
 * script fails the build if the key is present in the environment or in a
 * committed/loaded `.env`, so it can't leak into a hosted bundle by accident.
 */
import fs from 'node:fs';
import path from 'node:path';

const VAR = 'EXPO_PUBLIC_ANTHROPIC_API_KEY';
const reasons = [];

// 1) Process environment.
if ((process.env[VAR] ?? '').trim()) {
  reasons.push(`${VAR} is set in the build environment.`);
}

// 2) .env files Expo loads during export.
for (const file of ['.env', '.env.local', '.env.production']) {
  const p = path.resolve(process.cwd(), file);
  if (!fs.existsSync(p)) continue;
  for (const raw of fs.readFileSync(p, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    if (key.trim() === VAR && rest.join('=').trim()) {
      reasons.push(`${VAR} has a value in ${file}.`);
    }
  }
}

if (reasons.length) {
  console.error('\n✖ Web build blocked — Anthropic key would leak into the client bundle:');
  for (const r of reasons) console.error(`  • ${r}`);
  console.error(
    `\nRemove ${VAR} from the web build. The web app calls the server proxy\n` +
      `(/api/anthropic/summary); set ANTHROPIC_API_KEY as a server secret instead.\n`,
  );
  process.exit(1);
}

console.log('✓ web env guard: no EXPO_PUBLIC Anthropic key present.');
