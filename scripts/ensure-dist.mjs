/**
 * Rebuild the web bundle only when it's missing or stale.
 *
 * The Replit Run button uses `npm run start:replit` (this script + serve).
 * Always rebuilding makes every Run press take minutes; never rebuilding —
 * what the workflow used to do — silently serves a dist/ that predates the
 * latest source edits, so the preview shows stale code. Compare mtimes and
 * only pay for `expo export` when something that feeds the bundle changed.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST_INDEX = path.join(ROOT, 'dist', 'index.html');

// Everything that feeds the exported web bundle.
const SOURCES = ['src', 'assets', 'app.json', 'package.json', 'metro.config.js', 'babel.config.js', 'tsconfig.json'];

function newestMtime(target) {
  const stat = fs.statSync(target, { throwIfNoEntry: false });
  if (!stat) return 0;
  if (!stat.isDirectory()) return stat.mtimeMs;
  let newest = 0;
  for (const name of fs.readdirSync(target)) {
    newest = Math.max(newest, newestMtime(path.join(target, name)));
  }
  return newest;
}

const distTime = fs.statSync(DIST_INDEX, { throwIfNoEntry: false })?.mtimeMs ?? 0;
const sourceTime = Math.max(...SOURCES.map((s) => newestMtime(path.join(ROOT, s))));

if (distTime === 0) {
  console.log('ensure-dist: no dist/ found — building web bundle...');
} else if (sourceTime > distTime) {
  console.log('ensure-dist: sources changed since last build — rebuilding web bundle...');
} else {
  console.log('ensure-dist: dist/ is up to date, skipping build.');
  process.exit(0);
}

execSync('npm run build:web', { cwd: ROOT, stdio: 'inherit' });
