# Making Claude Code persistent on a Replit project

## The problem

On Replit, only the workspace disk (`/home/runner/workspace`, aka `$REPL_HOME`)
survives container restarts. Everything else under `$HOME` (`/home/runner`)
gets rebuilt fresh from the base image every time the container reboots
(idle eviction, explicit restart, redeploy, etc.) — even though it can
*feel* persistent across ordinary tool calls within the same boot.

Claude Code's official installer (`curl -fsSL https://claude.ai/install.sh | bash`)
already caches the actual versioned binaries under
`workspace/.local/share/claude/versions/<version>` — that part is fine.
But two things still live outside the persistent disk and get wiped on
every restart:

1. **The `claude` command itself.** The installer links it at
   `~/.local/bin/claude`, which is under `$HOME`, not workspace. After a
   restart this symlink is gone, so `claude` isn't on `PATH` until you
   rerun the installer.
2. **Claude's config** — `~/.claude/` (credentials, settings, session
   history, projects) and `~/.claude.json` — also lives directly under
   `$HOME` by default. Losing this on every restart is what causes
   re-auth prompts and lost session/conversation history.

## The fix

Two independent pieces, both anchored in the persistent workspace disk.

### 1. Persist config: `CLAUDE_CONFIG_DIR`

Claude Code honors the `CLAUDE_CONFIG_DIR` env var to relocate its entire
config directory (including `.claude.json`). Point it at a path inside
the workspace and set it via `.replit`'s `[env]` block — those vars are
injected into every new shell/SSH session by Replit's supervisor, so this
applies automatically without touching the install command.

`.replit`:
```toml
[env]
CLAUDE_CONFIG_DIR = "/home/runner/workspace/.local/share/claude-config"
```

One-time migration of whatever's already in `$HOME` (safe, non-destructive —
copies, doesn't move, so the live session isn't disrupted):
```bash
mkdir -p /home/runner/workspace/.local/share/claude-config
cp -a /home/runner/.claude/.       /home/runner/workspace/.local/share/claude-config/
cp -a /home/runner/.claude.json    /home/runner/workspace/.local/share/claude-config/.claude.json
```

Don't put this under `<project>/.claude/` — that path is the *project-level*
config dir (settings.json, skills, hooks, etc.), usually git-tracked and
shared. The user-level config (credentials!) needs a separate, gitignored
location. `.local/` and `.config/` are already covered by the default
Replit `.gitignore`, so a path under `workspace/.local/...` is safe by
default — double check with `git check-ignore -v <path>` before relying on it.

### 2. Persist the `claude` command itself

Don't fight `.replit [env] PATH = "...:$PATH"` — whether Replit's TOML
loader actually interpolates `$PATH` there is unverified, and getting it
wrong silently breaks the Node/nix toolchain used by deploy builds. There's
a safer, already-built-in hook:

Replit's stock `~/.bashrc` (read-only, in the nix store) contains:
```bash
BASHRC="${REPL_HOME}/.config/bashrc"
if [[ -f "${BASHRC}" ]] && [[ -z "${REPLIT_MODE}" ]]; then
    source "${BASHRC}"
fi
```

So any file at `workspace/.config/bashrc` is auto-sourced on every
interactive shell, and — unlike anything directly under `$HOME` — it
persists across restarts because it lives in the workspace.

Use it to prepend a persistent wrapper directory to `PATH`:

`workspace/.config/bashrc`:
```bash
export PATH="/home/runner/workspace/.local/bin:$PATH"
```

`workspace/.local/bin/claude` (the wrapper — always resolves to the
newest cached version, so it stays correct as Claude's own auto-updater
adds new versions over time):
```bash
#!/usr/bin/env bash
set -euo pipefail
versions_dir="/home/runner/workspace/.local/share/claude/versions"
latest="$(ls -1 "$versions_dir" 2>/dev/null | sort -V | tail -n1)"
if [[ -z "$latest" ]]; then
  echo "claude: no cached version found in $versions_dir — run the installer once" >&2
  exit 127
fi
exec "$versions_dir/$latest" "$@"
```
```bash
chmod +x /home/runner/workspace/.local/bin/claude
```

**Gotcha:** stock `.profile` sources `.bashrc` first, then *re-prepends*
`$HOME/.local/bin` to `PATH` afterward — so if both a real install and the
wrapper are on PATH, the `$HOME` one wins on ordering. That's harmless
(both resolve to a working binary); the wrapper only needs to win when
`$HOME/.local/bin/claude` doesn't exist at all, e.g. right after a fresh
restart, before any reinstall — which is exactly the case it was built for.

## End state

- New shell, same boot: `claude` already works (config dir set via
  `.replit [env]`, same as before).
- New shell, after a full restart: `claude` still works immediately — no
  reinstall needed at all, version and config both resolve from the
  workspace disk.
- The `curl ... | install.sh` one-liner is now only needed to fetch a
  genuinely new version (or bootstrap a brand-new Repl with nothing
  cached yet) — not on every startup.

## Checklist for a new Replit project

1. Add to `.replit`:
   ```toml
   [env]
   CLAUDE_CONFIG_DIR = "/home/runner/workspace/.local/share/claude-config"
   ```
2. Run the installer once normally (`curl -fsSL https://claude.ai/install.sh | bash`).
3. Create `workspace/.local/bin/claude` (wrapper script above), `chmod +x` it.
4. Create `workspace/.config/bashrc` with the `PATH` export above.
5. Verify with a simulated fresh `$HOME`:
   ```bash
   env -i HOME=/tmp/fake-home REPL_HOME=/home/runner/workspace bash --rcfile <(echo '
     HOME=/tmp/fake-home; mkdir -p "$HOME"; cp /home/runner/.profile "$HOME/.profile"
     source "$HOME/.profile"') -ic 'which claude && claude --version'
   ```
6. Confirm both new paths are gitignored: `git check-ignore -v workspace/.local/bin/claude workspace/.config/bashrc`.
