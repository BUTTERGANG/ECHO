# Changelog

All notable changes to ECHO. Newest first.

## 2026-10-23 — Security: dependency vulnerability fixes

Known advisories (OSV) in lockfiles: **2 critical, 9 high, 5 moderate → 2 high, 2 moderate**.

- `npm audit fix` — `proxy-addr`, `shell-quote` (criticals), `body-parser`, `brace-expansion`, `source-map-js`
- Critical/high advisories cleared in: `proxy-addr`, `shell-quote`, `body-parser`, `brace-expansion`, `source-map-js`
- Verified: `npm run typecheck` passes
- Remaining: `node-forge` (high) — no patched release exists; pulled in by the Expo CLI (build/dev tooling, not app runtime); `zod` (high) — zod 3 has no patched release (fix is zod 4, a breaking migration) — deferred
