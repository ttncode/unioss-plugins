# UNIOSS Pipeline Optimization — Design

- **Date:** 2026-07-08
- **Plugin:** `unioss-pipeline`
- **Version target:** 1.2.0 → **1.3.0**
- **Status:** Approved (pending spec review)

## Goal

Four independent usability improvements to the `unioss-pipeline` plugin:

1. Configurable **host source paths** so agents read the real source of every UNIOSS module, wherever it lives on the device.
2. Guarantee the `.walkthrough` artifact folder always sits in the **current workspace** (cwd).
3. Let each pipeline **stage command run standalone** on a free-form task, outside the orchestrated pipeline.
4. Make the **browser launchable** so the tester (playwright MCP) can actually verify UI.

Each part is self-contained; they share only the config resolver (`scripts/config.mjs`) and the doctor.

---

## Part 1 — Configurable host source paths

### Problem
Config only holds `repos.*` (GitLab project id + container name marker, e.g. `AdminPage/`). There is **no host-filesystem path** to any repo checkout, and no notion of the shared `common-helper` / `common-models` modules. Agents that Read/Grep source implicitly assume cwd is the repo root.

### Design
Add a `source` block to `DEFAULTS` in `scripts/config.mjs`:

```jsonc
"source": {
  "root": null,                    // null → resolves to process.cwd()
  "modules": {
    "admin-page":     "AdminPage",
    "front-end":      "FrontEnd",
    "common-helper":  "common-helper",
    "common-models":  "common-models"
  }
}
```

- **Module keys are kebab-case** (`admin-page`, `front-end`, `common-helper`, `common-models`); values are the on-disk subdir names under `root`. Access via bracket notation.
- **Root resolution** (highest wins): `SOURCE_ROOT` env → config file → **`process.cwd()`**. `DEFAULTS.source.root` is `null`; `resolveConfig` fills it with cwd when unset, then applies the env override. `DEFAULTS` is never mutated (reuse the existing fresh-`{}` deep-merge guard).
- **`buildEnv`** emits an absolute path per module plus the root, derived generically from the module map:
  - `US_SRC_ROOT`
  - `US_SRC_ADMIN_PAGE`, `US_SRC_FRONT_END`, `US_SRC_COMMON_HELPER`, `US_SRC_COMMON_MODELS`
  - Rule: `US_SRC_<KEY>` where `<KEY>` = module key upper-cased with `-` → `_`; value = `join(root, moduleValue)`.
- **`runCheck`** adds a non-fatal warning when a resolved module directory does not exist on disk (helps the user spot a wrong `root`). GITLAB_TOKEN / config errors stay fatal; missing source dir is a warning only.
- **`repos.*` is left untouched** — GitLab id and container-name concerns are separate from host read paths.

### Consumers
- `REFERENCE.md`: document the `source` block + the `US_SRC_*` env vars, with the `eval "$(node …/config.mjs env)"` pattern.
- Stage skills / agents that read source: instruct them to resolve source under `$US_SRC_*` rather than assuming cwd subdirs.

---

## Part 2 — `.walkthrough` always at the workspace (cwd)

### Problem / current state
Already correct: `config.mjs` (`configPath`, `artifactRoot`) and `fetch-ticket.js` derive paths from `process.cwd()`, not the plugin root. This part **hardens and proves** the invariant rather than changing behavior.

### Design
- Audit the plugin for any artifact/state path built from `CLAUDE_PLUGIN_ROOT`, `__dirname`, or `import.meta.url` (those are for reading *plugin* assets, never for *writing* artifacts).
- Add a test asserting the artifact root / `configPath` resolve from a supplied cwd, independent of the script's own location.
- One line in `REFERENCE.md` stating the invariant: **artifacts always live in `<cwd>/.walkthrough/`, the workspace you opened Claude in.**

---

## Part 3 — Standalone stage commands

### Problem
The stage skills (`unioss-implement`, `unioss-investigate`, `unioss-plan`, `unioss-review`, `unioss-verify`, `unioss-phpunit-test`) are written for orchestrator dispatch: they expect a round path, write mandatory artifacts into `.walkthrough/<PREFIX>#[IID]/round-<N>/`, and update pipeline state. The user wants to run one directly, e.g. `/unioss-implement Optimize this function to …`, for a quick task with no ticket.

### Design
Add a **`## Standalone use`** section to each of the six stage skills:

- **Detection:** standalone = invoked directly (no orchestrator, no round path / ticket context supplied).
- **Behavior in standalone mode:**
  - Perform the requested task on the named file(s) using the skill's domain knowledge and rules.
  - **Do NOT create or edit anything under `.walkthrough/`** — no round folders, no INVESTIGATION/PLAN/CHANGES/REVIEW/TEST artifacts, no state files — **unless the user explicitly asks** for a written artifact.
  - Skip gates and round bookkeeping.
- **Pipeline mode is unchanged:** when the orchestrator dispatches a stage (passing a round path / ticket), it writes artifacts exactly as today.

No new command files — the stage skills already surface as slash commands.

---

## Part 4 — Browser readiness (tester can verify)

### Problem
On WSL2 there is no browser, and the tester's playwright MCP could not launch one. `npx playwright install` needs a real TTY / sudo, so it silently failed and UI verification was blocked.

### Design
- **`.mcp.json`:** switch the playwright MCP to the branded Chrome channel — `--browser chrome`.
- **`unioss-doctor`:** add a check that a Google Chrome executable is present, cross-platform:
  - Linux: `google-chrome` / `google-chrome-stable` on PATH.
  - macOS: `/Applications/Google Chrome.app` present (or `google-chrome` on PATH).
  - Windows: `where chrome`, or the standard `Program Files\Google\Chrome` path.
- **Missing → actionable fix:** print the exact command, and tell the user to run it with the `!` prefix so the password prompt gets a real TTY:
  - `! npx playwright install --with-deps chrome`
- The check contributes to the doctor's overall pass/fail like the other rows.

---

## Acceptance criteria

1. `config.mjs print` shows a `source.root` (defaulting to cwd) and four kebab-keyed modules; `config.mjs env` exports `US_SRC_ROOT` + `US_SRC_ADMIN_PAGE` / `US_SRC_FRONT_END` / `US_SRC_COMMON_HELPER` / `US_SRC_COMMON_MODELS` as absolute paths.
2. `SOURCE_ROOT` env and a config-file `source.root` both override the cwd default; with neither set, root = cwd. `DEFAULTS.source.root` stays `null` after resolution.
3. `runCheck` emits a non-fatal warning for a missing module directory; GITLAB_TOKEN / type errors remain fatal.
4. A test proves the artifact root / `configPath` derive from a passed cwd, not the script location.
5. Each of the six stage skills has a `## Standalone use` section; standalone runs write nothing under `.walkthrough/` unless the user asks.
6. `.mcp.json` uses `--browser chrome`; `unioss-doctor` reports Chrome present/absent and, when absent, prints `! npx playwright install --with-deps chrome`.
7. `plugin.json` version = `1.3.0`. All existing tests still pass; new tests cover the `source` resolver + env output and the cwd-derivation invariant.

## Out of scope

- Remote / cross-device browser (CDP endpoint, MCP-as-server) — explicitly dropped.
- Auto-installing Chrome — doctor guides, does not install.
- Changing `repos.*`, GitLab access, rounds, or protected-branch behavior.
- Secrets handling changes: `GITLAB_TOKEN` stays env-only; `db.password` stays in the local gitignored config.
