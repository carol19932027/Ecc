# AGENTS.md — Arena & Cross-Harness Project Instructions

This repository packages a curated subset of **Everything Claude Code (ECC)** alongside an `ecc-install` CLI wrapper and the **Aether // ECC** Liquid Glass Mobile-first PWA Dashboard.

## Installed Agent Assets

- **Arena / Cross-Agent directory**: `.agents/` (`skills/`, `agents/`, `workflows/`, tracked in `.agents/ecc-curated-state.json`)
- **Claude Project directory**: `.claude/` (`skills/`, `agents/`, `commands/`, tracked in `.claude/ecc/curated-state.json`)
- **Curated Canonical Source**: `skills/` (21), `agents/` (9), `commands/` (30), `legacy-command-shims/commands/` (6)

## Key Commands

- Run installer tests: `npm test`
- Start dashboard PWA server: `npm run dashboard` (or `node dashboard/server.js`, binds `0.0.0.0:${PORT:-3000}`)
- List curated ECC components: `ecc-install --list`
- Install for Arena project agents: `ecc-install --target arena`
- Install for Claude project-local: `ecc-install --target claude-project`

## Engineering Conventions

- Keep dependencies zero-bloat (built-in Node.js modules for CLI & server).
- Validate any CLI, installer, or dashboard changes with `npm test` before committing.
- Never write persistent workspace artifacts inside `.arena/` (excluded from snapshots); use `.agents/` and `.claude/` for project-scoped agent assets.
