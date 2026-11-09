# Ecc

Curated subset of [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) (`ecc-universal` v2.2.3) components — skills, agents, commands, and legacy command shims — packaged at the repository root with an `ecc-install.json` manifest and a zero-dependency `ecc-install` CLI wrapper.

## Why this wrapper exists

In upstream `ecc-universal`, `ecc-install --skills <ids>` only accepts directory names under `skills/`. Passing a mixed list of skills, agents, commands, and legacy slash-command shims fails at the first non-skill entry (for example `architect`, `build-fix`, or `tdd`).

This repository places the curated components directly at the repo root and provides `ecc-install` (`bin/ecc-install.js`) + `ecc-install.json` so `--skills` resolves each requested ID across its proper ECC component family and installs it to the right destination folder.

## Curated Component Breakdown

| Category | Location | Count | Contents |
|---|---|---|---|
| Requested skills | `skills/` | 18 | `agent-harness-construction`, `api-design`, `autonomous-loops`, `blueprint`, `coding-standards`, `configure-ecc`, `continuous-agent-loop`, `continuous-learning`, `continuous-learning-v2`, `database-migrations`, `deployment-patterns`, `eval-harness`, `frontend-patterns`, `liquid-glass-design`, `prompt-optimizer`, `strategic-compact`, `tdd-workflow`, `verification-loop` |
| Canonical skills for legacy shims | `skills/` | 3 | `autonomous-agent-harness`, `dmux-workflows`, `e2e-testing` |
| Agents | `agents/` | 9 | `architect`, `build-error-resolver`, `code-reviewer`, `doc-updater`, `e2e-runner`, `harness-optimizer`, `loop-operator`, `planner`, `refactor-cleaner` |
| Commands | `commands/` | 30 | `build-fix`, `checkpoint`, `code-review`, `evolve`, `harness-audit`, `instinct-export`, `instinct-import`, `instinct-status`, `learn`, `learn-eval`, `loop-start`, `loop-status`, `model-route`, `multi-backend`, `multi-execute`, `multi-frontend`, `multi-plan`, `multi-workflow`, `plan`, `projects`, `promote`, `refactor-clean`, `resume-session`, `save-session`, `sessions`, `setup-pm`, `skill-create`, `test-coverage`, `update-codemaps`, `update-docs` |
| Legacy command shims | `legacy-command-shims/commands/` | 6 | `e2e` (-> `e2e-testing`), `eval` (-> `eval-harness`), `orchestrate` (-> `dmux-workflows`, `autonomous-agent-harness`), `prompt-optimize` (-> `prompt-optimizer`), `tdd` (-> `tdd-workflow`), `verify` (-> `verification-loop`) |

## Usage

Make `ecc-install` available on `PATH` (or run `node bin/ecc-install.js` / `./install.sh`):

```bash
npm link
```

Install all 63 requested components (default target `claude` -> `~/.claude/`):

```bash
ecc-install --skills agent-harness-construction,api-design,architect,autonomous-loops,blueprint,build-error-resolver,build-fix,checkpoint,code-review,code-reviewer,coding-standards,configure-ecc,continuous-agent-loop,continuous-learning,continuous-learning-v2,database-migrations,deployment-patterns,doc-updater,e2e,e2e-runner,eval,eval-harness,evolve,frontend-patterns,harness-audit,harness-optimizer,instinct-export,instinct-import,instinct-status,learn,learn-eval,liquid-glass-design,loop-operator,loop-start,loop-status,model-route,multi-backend,multi-execute,multi-frontend,multi-plan,multi-workflow,orchestrate,plan,planner,projects,promote,prompt-optimize,prompt-optimizer,refactor-clean,refactor-cleaner,resume-session,save-session,sessions,setup-pm,skill-create,strategic-compact,tdd,tdd-workflow,test-coverage,update-codemaps,update-docs,verification-loop,verify
```

Or install everything defined in `ecc-install.json` with no arguments:

```bash
ecc-install
```

### Guided Installer (`--guided`)

Run the interactive multi-target setup wizard in a terminal:

```bash
ecc-install --guided
```

Or run `--guided` non-interactively in CI / scripts across one or more targets:

```bash
# Preview multi-target guided install without writing files
ecc-install --guided --targets arena,claude-project,cursor --profile core --dry-run

# Apply non-interactively with explicit confirmation
ecc-install --guided --targets arena,claude-project --profile full --yes

# Install to all 9 unique target roots
ecc-install --guided --all-targets --profile frontend --yes
```

Available profiles: `full`, `core`, `agentic`, `frontend`, `devops`, `custom`.

### Common Options

- `-g, --guided`: run guided setup wizard (interactive in TTY; requires `--target`/`--targets`/`--all-targets`/`--dest` plus `--yes` or `--dry-run` in non-TTY)
- `--target <name>`: `claude` (default, `~/.claude/`), `claude-project` (`./.claude/`), `arena` (`./.agents/`), `antigravity` (`./.agents/`), `cursor` (`./.cursor/`), `codex` (`~/.codex/`), `opencode` (`~/.config/opencode/`), `gemini` (`./.gemini/`), `kimi` (`./.kimi-code/`), `copilot` (`./.github/`)
- `--targets <names>`: comma-separated list of targets (aliases `--harness` / `--harnesses` accepted)
- `--all-targets`: install into all 9 unique target directories (`--all-harnesses` alias accepted)
- `--profile <name>`: select curated preset (`full`, `core`, `agentic`, `frontend`, `devops`, `custom`)
- `-y, --yes`: confirm guided installation without prompt
- `--dest <dir>`: install into a custom directory
- `--no-shims`: omit legacy command shim Markdown files
- `--no-canonical`: do not automatically include canonical replacement skills referenced by legacy shims
- `--without <ids>`: exclude specific components (supports `skill:<id>`, `agent:<id>`, `command:<id>`, `shim:<id>`, or bare `<id>`)
- `--dry-run`: preview operations without writing files
- `--json`: emit machine-readable JSON output
- `--force`: overwrite pre-existing unmanaged files with differing contents
- `--list`: list all curated components, targets, and guided profiles
- `--uninstall`: remove unchanged files tracked in `curated-state.json`

## Aether ECC — Liquid Glass Mobile-First PWA Dashboard

Launch the interactive futuristic Liquid Glass PWA control dashboard (`dashboard/`):

```bash
npm run dashboard
```

- **Mobile-first Liquid Glass UI**: translucent adaptive dark/light surfaces, dynamic aurora backdrop, interactive pointer glint, morphing dock pill (`Pulse`, `Catalog`, `Command AI`, `System`), bottom-sheet component inspector, interactive SVG telemetry waveform, and EN / FA (RTL) switcher.
- **Installable PWA**: `manifest.webmanifest`, offline Service Worker (`sw.js`), offline fallback, and custom raster PNG + SVG icons.
- **Live ECC Integration**: inspects `.agents/` (`arena`), `.claude/` (`claude-project`), and `~/.claude/`, searches all 66 components, runs integrity audits, and recommends `ecc-install` commands via `POST /api/recommend`.

## Tests

```bash
npm test
```

## License

Curated components are from [affaan-m/ECC](https://github.com/affaan-m/ECC) (MIT License). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
