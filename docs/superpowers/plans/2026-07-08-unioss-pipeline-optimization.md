# UNIOSS Pipeline Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four independent usability improvements to the `unioss-pipeline` plugin — configurable host source paths, a proven `.walkthrough`-at-cwd invariant, standalone stage commands, and a doctor browser-readiness check — shipped as v1.3.0.

**Architecture:** Extend the single config resolver (`scripts/config.mjs`) with a `source` block whose paths resolve from cwd by default; expose them as `US_SRC_*` shell exports. Harden the existing cwd-derived artifact paths with a test. Add a "Standalone use" section to each stage skill so it degrades to a plain task with no `.walkthrough` writes. Switch the playwright MCP to branded Chrome and add a doctor probe that guides installation.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test`, `node --test`; Claude Code plugin (skills/hooks/MCP as markdown + JSON); Docker; Playwright MCP.

## Global Constraints

- Node built-ins only (`node:*`) — the plugin has no `package.json`, no external deps.
- Config resolution order (highest wins): **env → `.walkthrough/config/unioss.config.json` → built-in default**. Arrays replace wholesale.
- `DEFAULTS` must never be mutated by resolution (keep the fresh-`{}` deep-merge guard).
- Secrets unchanged: `GITLAB_TOKEN` is env-only; `db.password` stays in the local gitignored config. Never print the token.
- Module keys are **kebab-case**: `admin-page`, `front-end`, `common-helper`, `common-models`.
- Env var scheme: `US_SRC_<KEY>` where `<KEY>` = module key upper-cased with `-` → `_`.
- Standalone stage runs write **nothing** under `.walkthrough/` unless the user explicitly asks.
- `.mcp.json` playwright browser = `chrome` (branded channel), not `chromium`.
- Run tests with `timeout 30 node --test` from `plugins/unioss-pipeline/` (hook tests register stdin listeners; the timeout guards against hangs).
- Version bump: `plugin.json` `1.2.0` → `1.3.0`.

---

### Task 1: `source` block in the config resolver

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.mjs`
- Test: `plugins/unioss-pipeline/scripts/config.test.mjs`, `plugins/unioss-pipeline/scripts/config-cli.test.mjs`

**Interfaces:**
- Consumes: existing `DEFAULTS`, `deepMerge`, `resolveConfig(cwd)`, `flatten`, `valueSources`, `buildEnv`, `runCheck`, `sq`, `join`, `existsSync`.
- Produces:
  - `resolveConfig(cwd).source` = `{ root: <string>, modules: { 'admin-page': 'AdminPage', 'front-end': 'FrontEnd', 'common-helper': 'common-helper', 'common-models': 'common-models' } }`. `root` resolves `SOURCE_ROOT` env → file → `cwd`.
  - `buildEnv(cwd)` additionally emits `US_SRC_ROOT` and `US_SRC_ADMIN_PAGE` / `US_SRC_FRONT_END` / `US_SRC_COMMON_HELPER` / `US_SRC_COMMON_MODELS` (absolute `join(root, dir)`).
  - `runCheck(cwd)` adds non-fatal `WARN:` lines for missing module dirs; `source.root` non-empty is a fatal check.

- [ ] **Step 1: Write the failing resolver tests**

Append to `plugins/unioss-pipeline/scripts/config.test.mjs`:

```js
test('source.root defaults to the given cwd when unset', () => {
  const dir = workspace(undefined);
  assert.equal(resolveConfig(dir).source.root, dir);
  assert.equal(DEFAULTS.source.root, null); // DEFAULTS never mutated
  rmSync(dir, { recursive: true, force: true });
});

test('SOURCE_ROOT env overrides the cwd default', () => {
  const dir = workspace(undefined);
  process.env.SOURCE_ROOT = '/srv/unioss3';
  try { assert.equal(resolveConfig(dir).source.root, '/srv/unioss3'); }
  finally { delete process.env.SOURCE_ROOT; rmSync(dir, { recursive: true, force: true }); }
});

test('file source.root overrides the cwd default', () => {
  const dir = workspace(JSON.stringify({ source: { root: '/from/file' } }));
  assert.equal(resolveConfig(dir).source.root, '/from/file');
  rmSync(dir, { recursive: true, force: true });
});

test('module keys are kebab-case with on-disk dir values', () => {
  const dir = workspace(undefined);
  const mods = resolveConfig(dir).source.modules;
  assert.equal(mods['admin-page'], 'AdminPage');
  assert.equal(mods['common-helper'], 'common-helper');
  rmSync(dir, { recursive: true, force: true });
});
```

Append to `plugins/unioss-pipeline/scripts/config-cli.test.mjs`:

```js
test('buildEnv emits absolute US_SRC_* paths from root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'unisrc-'));
  process.env.SOURCE_ROOT = '/srv/unioss3';
  try {
    const out = buildEnv(dir);
    assert.match(out, /US_SRC_ROOT='\/srv\/unioss3'/);
    assert.match(out, /US_SRC_ADMIN_PAGE='\/srv\/unioss3\/AdminPage'/);
    assert.match(out, /US_SRC_COMMON_HELPER='\/srv\/unioss3\/common-helper'/);
  } finally { delete process.env.SOURCE_ROOT; }
});

test('runCheck warns (non-fatal) when a source module dir is missing', () => {
  process.env.GITLAB_TOKEN = 'tok';
  const dir = mkdtempSync(join(tmpdir(), 'uniwarn-'));
  try {
    const r = runCheck(dir); // modules do not exist in this empty tmp dir
    assert.equal(r.ok, true);            // warning is non-fatal
    assert.match(r.report, /WARN: source module 'admin-page' not found/);
  } finally { delete process.env.GITLAB_TOKEN; }
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `cd plugins/unioss-pipeline && timeout 30 node --test scripts/config.test.mjs scripts/config-cli.test.mjs`
Expected: FAIL — `cfg.source` is undefined / `US_SRC_*` not matched.

- [ ] **Step 3: Add the `source` block to `DEFAULTS`**

In `scripts/config.mjs`, inside `DEFAULTS`, after the `git` block and before `artifactRoot`:

```js
  git: {
    baseBranch: 'v3-master',
    protected: ['master', 'v3-master', 'develop', 'v3-develop', 'v3-develop-tps'],
  },
  source: {
    root: null,
    modules: {
      'admin-page': 'AdminPage',
      'front-end': 'FrontEnd',
      'common-helper': 'common-helper',
      'common-models': 'common-models',
    },
  },
  artifactRoot: '.walkthrough',
```

- [ ] **Step 4: Resolve `source.root` in `resolveConfig`**

Replace the body of `resolveConfig`:

```js
export function resolveConfig(cwd = process.cwd()) {
  // deepMerge onto a fresh {} guarantees DEFAULTS is never mutated.
  const merged = deepMerge(deepMerge({}, DEFAULTS), readFileConfig(cwd));
  if (process.env.DB_PASSWORD) merged.db.password = process.env.DB_PASSWORD;
  merged.source.root = process.env.SOURCE_ROOT || merged.source.root || cwd;
  return merged;
}
```

- [ ] **Step 5: Emit `US_SRC_*` in `buildEnv`**

Replace `buildEnv`:

```js
export function buildEnv(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  const srcRoot = c.source.root;
  const srcLines = Object.entries(c.source.modules).map(
    ([key, dir]) => `US_SRC_${key.toUpperCase().replace(/-/g, '_')}=${sq(join(srcRoot, dir))}`,
  );
  return [
    `US_MYSQL=${sq(c.docker.mysql)}`,
    `US_PHP=${sq(c.docker.php)}`,
    `US_DB=${sq(c.db.name)}`,
    `US_DB_USER=${sq(c.db.user)}`,
    `US_DB_PASS=${sq(c.db.password)}`,
    `US_GITLAB_HOST=${sq(c.gitlab.host)}`,
    `US_AP_PATH=${sq(c.repos.adminPage.path)}`,
    `US_FE_PATH=${sq(c.repos.frontEnd.path)}`,
    `US_BASE_BRANCH=${sq(c.git.baseBranch)}`,
    `US_ARTIFACT_ROOT=${sq(c.artifactRoot)}`,
    `US_SRC_ROOT=${sq(srcRoot)}`,
    ...srcLines,
  ].join('\n');
}
```

- [ ] **Step 6: Mark `source.root` source in `valueSources`**

In `valueSources`, in the `.map` callback, add the middle branch:

```js
    let source = 'default';
    if (key === 'db.password' && process.env.DB_PASSWORD) source = 'env';
    else if (key === 'source.root' && process.env.SOURCE_ROOT) source = 'env';
    else if (key in fileFlat) source = 'file';
    return { key, value, source };
```

- [ ] **Step 7: Validate source + warn on missing dirs in `runCheck`**

Replace `runCheck`:

```js
export function runCheck(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  const errors = [];
  const warnings = [];
  const isStr = (v) => typeof v === 'string' && v.length > 0;
  if (!isStr(c.gitlab.host)) errors.push('gitlab.host must be a non-empty string');
  for (const r of ['adminPage', 'frontEnd']) {
    if (typeof c.repos[r].id !== 'number') errors.push(`repos.${r}.id must be a number`);
    if (!isStr(c.repos[r].path)) errors.push(`repos.${r}.path must be a non-empty string`);
  }
  if (!isStr(c.docker.mysql)) errors.push('docker.mysql must be a non-empty string');
  if (!isStr(c.docker.php)) errors.push('docker.php must be a non-empty string');
  if (!isStr(c.db.name) || !isStr(c.db.user) || !isStr(c.db.password)) errors.push('db.name/user/password must be non-empty strings');
  if (!isStr(c.git.baseBranch)) errors.push('git.baseBranch must be a non-empty string');
  if (!Array.isArray(c.git.protected) || c.git.protected.length === 0) errors.push('git.protected must be a non-empty array');
  if (!isStr(c.artifactRoot)) errors.push('artifactRoot must be a non-empty string');
  if (!isStr(c.source.root)) errors.push('source.root must resolve to a non-empty string');
  for (const [key, dir] of Object.entries(c.source.modules)) {
    if (!existsSync(join(c.source.root, dir))) warnings.push(`source module '${key}' not found at ${join(c.source.root, dir)}`);
  }
  if (!process.env.GITLAB_TOKEN) errors.push('GITLAB_TOKEN is not set in the environment');
  const status = errors.length ? errors.map((e) => `  ERROR: ${e}`).join('\n') : '  All checks passed.';
  const warnBlock = warnings.length ? warnings.map((w) => `  WARN: ${w}`).join('\n') : '';
  const report = [formatPrint(cwd), '', status, warnBlock].filter(Boolean).join('\n');
  return { ok: errors.length === 0, report };
}
```

- [ ] **Step 8: Run the whole config test suite to verify pass**

Run: `cd plugins/unioss-pipeline && timeout 30 node --test scripts/config.test.mjs scripts/config-cli.test.mjs`
Expected: PASS — all config + cli tests green (existing 14 + 6 new).

- [ ] **Step 9: Sanity-check the CLI output**

Run: `cd plugins/unioss-pipeline && node scripts/config.mjs env | grep US_SRC`
Expected: `US_SRC_ROOT=...`, `US_SRC_ADMIN_PAGE=.../AdminPage`, `US_SRC_FRONT_END`, `US_SRC_COMMON_HELPER`, `US_SRC_COMMON_MODELS` — root = current dir.

- [ ] **Step 10: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config.test.mjs plugins/unioss-pipeline/scripts/config-cli.test.mjs
git commit -m "feat(unioss-pipeline): configurable host source paths (US_SRC_*) with cwd default"
```

---

### Task 2: Document source paths + point source-reading skills at `$US_SRC_*`

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-plan/SKILL.md`

**Interfaces:**
- Consumes: the `US_SRC_*` env vars produced by Task 1's `buildEnv`.
- Produces: documentation only — no runtime code.

- [ ] **Step 1: Add source rows to the REFERENCE config table**

In `skills/unioss-pipeline/REFERENCE.md`, in the config table, add two rows after the `artifactRoot` row:

```md
| `artifactRoot` | `.walkthrough` | output dir |
| `source.root` | current workspace (cwd) | host root that holds the module checkouts |
| `source.modules.*` | `admin-page`→`AdminPage`, `front-end`→`FrontEnd`, `common-helper`, `common-models` | on-disk subdir per module |
```

- [ ] **Step 2: Add a Source-paths subsection to REFERENCE**

In `skills/unioss-pipeline/REFERENCE.md`, immediately after the `eval "$(node …)"` DB example block, add:

````md
### Source paths (read the real code)

`config.mjs env` also exports absolute host paths to each module. Resolve them before reading source; never assume cwd is a repo checkout:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_SRC_ROOT, $US_SRC_ADMIN_PAGE, $US_SRC_FRONT_END, $US_SRC_COMMON_HELPER, $US_SRC_COMMON_MODELS
grep -rn "some_symbol" "$US_SRC_ADMIN_PAGE/application"
```

`source.root` defaults to the workspace you opened Claude in; override with the `SOURCE_ROOT` env var or `source.root` in the local config.
````

- [ ] **Step 3: Point the investigator at `$US_SRC_*`**

In `skills/unioss-investigate/SKILL.md`, on the line after `Write all artifacts under the round folder…`, add:

```md
To read module source, resolve host paths first: `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` then Grep/Read under `$US_SRC_ADMIN_PAGE`, `$US_SRC_FRONT_END`, `$US_SRC_COMMON_HELPER`, `$US_SRC_COMMON_MODELS` — do not assume cwd is a repo (see REFERENCE → Source paths).
```

- [ ] **Step 4: Point the planner at `$US_SRC_*`**

In `skills/unioss-plan/SKILL.md`, on the line after `Write all artifacts under the round folder…`, add the same line as Step 3.

- [ ] **Step 5: Verify the docs mention the env vars**

Run: `cd plugins/unioss-pipeline && grep -rl "US_SRC_ADMIN_PAGE" skills/unioss-pipeline/REFERENCE.md skills/unioss-investigate/SKILL.md skills/unioss-plan/SKILL.md`
Expected: all three paths listed.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md plugins/unioss-pipeline/skills/unioss-plan/SKILL.md
git commit -m "docs(unioss-pipeline): document source paths; direct investigator/planner to \$US_SRC_*"
```

---

### Task 3: Prove `.walkthrough` derives from the workspace (cwd)

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.test.mjs`
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`

**Interfaces:**
- Consumes: `configPath(cwd)` from `config.mjs`.
- Produces: a regression test locking the invariant; a documented invariant line.

- [ ] **Step 1: Audit for plugin-root-relative artifact writes**

Run: `cd plugins/unioss-pipeline && grep -rn "CLAUDE_PLUGIN_ROOT\|__dirname\|import.meta.url" scripts hooks skills/unioss-gitlab-issue-context/scripts | grep -iv "config.mjs\" \|/scripts/config.mjs\|/rules/\|/REFERENCE" | grep -i "walkthrough\|writeFile\|mkdir" || echo "CLEAN: no artifact path built from plugin root"`
Expected: `CLEAN` — artifact/state paths use `process.cwd()`, only asset reads use plugin root.

- [ ] **Step 2: Write the failing invariant test**

Append to `scripts/config.test.mjs`:

```js
test('config path derives from the passed cwd, not the script location', () => {
  const p = configPath('/tmp/ws');
  assert.ok(p.startsWith('/tmp/ws'));
  assert.ok(!p.includes(join('plugins', 'unioss-pipeline', 'scripts')));
});
```

- [ ] **Step 3: Run it (passes immediately — it locks current behavior)**

Run: `cd plugins/unioss-pipeline && timeout 30 node --test scripts/config.test.mjs`
Expected: PASS — including the new invariant test.

- [ ] **Step 4: Document the invariant in REFERENCE**

In `skills/unioss-pipeline/REFERENCE.md`, at the top of the `## Artifact Layout` section, add:

```md
**Invariant:** artifacts always live in `<cwd>/.walkthrough/` — the workspace you opened Claude in — never under the plugin install dir. Open Claude at the project you are working on.
```

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.test.mjs plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "test(unioss-pipeline): lock .walkthrough-at-cwd invariant + document it"
```

---

### Task 4: Standalone use for the six stage skills

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-plan/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-review/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: a uniform `## Standalone use` section that changes agent behavior when there is no orchestrator/round context.

- [ ] **Step 1: Append the Standalone block to each of the six skills**

Append this exact block to the **end** of each of the six `SKILL.md` files listed above:

```md
## Standalone use

You can be invoked directly on a free-form task (e.g. `/unioss-implement Optimize this function …`), outside the orchestrated pipeline. When **no orchestrator context** was handed to you — no ticket, no round path:

- Do the requested task on the file(s) named, using this skill's rules and domain knowledge.
- **Write nothing under `.walkthrough/`** — no round folders, no INVESTIGATION / PLAN / CHANGES / REVIEW / TEST / UT artifacts, no state files — **unless the user explicitly asks** for a written artifact.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections above describe.
```

- [ ] **Step 2: Verify all six carry the section**

Run: `cd plugins/unioss-pipeline && grep -rl "## Standalone use" skills/unioss-implement/SKILL.md skills/unioss-investigate/SKILL.md skills/unioss-plan/SKILL.md skills/unioss-review/SKILL.md skills/unioss-verify/SKILL.md skills/unioss-phpunit-test/SKILL.md | wc -l`
Expected: `6`

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-implement/SKILL.md plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md plugins/unioss-pipeline/skills/unioss-plan/SKILL.md plugins/unioss-pipeline/skills/unioss-review/SKILL.md plugins/unioss-pipeline/skills/unioss-verify/SKILL.md plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md
git commit -m "feat(unioss-pipeline): standalone use for stage skills (no .walkthrough writes)"
```

---

### Task 5: Browser readiness — Chrome channel + doctor check

**Files:**
- Modify: `plugins/unioss-pipeline/.mcp.json`
- Modify: `plugins/unioss-pipeline/scripts/doctor.mjs`

**Interfaces:**
- Consumes: existing `has`, `out`, `isWin`, `platform` in `doctor.mjs`.
- Produces: a `Chrome (tester browser)` doctor row contributing to overall pass/fail; MCP launches branded Chrome.

- [ ] **Step 1: Switch the playwright MCP to branded Chrome**

Replace `.mcp.json`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["--yes", "@playwright/mcp@latest", "--browser", "chrome"]
    }
  }
}
```

- [ ] **Step 2: Import `existsSync` in the doctor**

In `scripts/doctor.mjs`, after the `import { platform } from 'node:os';` line, add:

```js
import { existsSync } from 'node:fs';
```

- [ ] **Step 3: Detect Chrome, cross-platform**

In `scripts/doctor.mjs`, after the `const runningNames = …` line and before `const cfg = resolveConfig();`, add:

```js
const chromeOk = isWin
  ? (!!out('where chrome') || existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe'))
  : platform() === 'darwin'
    ? (has('google-chrome') || existsSync('/Applications/Google Chrome.app'))
    : (has('google-chrome') || has('google-chrome-stable'));
```

- [ ] **Step 4: Add the Chrome check row**

In `scripts/doctor.mjs`, add to the `checks` array, right after the `GITLAB_TOKEN` entry:

```js
  { name: 'Chrome (tester browser)', ok: chromeOk, fix: 'Playwright Chrome not found — the tester cannot verify UI. Run in a real terminal (needs a TTY for sudo):  ! npx playwright install --with-deps chrome' },
```

- [ ] **Step 5: Run the doctor and confirm the row renders**

Run: `cd plugins/unioss-pipeline && node scripts/doctor.mjs; echo "exit=$?"`
Expected: output contains a `[OK]` or `[XX] Chrome (tester browser)` line; when absent, the fix line shows `! npx playwright install --with-deps chrome`. (Exit code non-zero is fine here if Chrome/containers/token are absent on this machine.)

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/.mcp.json plugins/unioss-pipeline/scripts/doctor.mjs
git commit -m "feat(unioss-pipeline): use branded Chrome for tester MCP + doctor browser-readiness check"
```

---

### Task 6: Version bump, README, full suite

**Files:**
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: v1.3.0 release state with all tests green.

- [ ] **Step 1: Bump the plugin version**

In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, change `"version": "1.2.0"` to `"version": "1.3.0"`.

- [ ] **Step 2: Document source paths + browser in the README**

In `README.md`, under the existing `## Configuration` section, add:

```md
### Source paths

Agents read module source from host paths resolved by `scripts/config.mjs`:
`source.root` (defaults to the workspace you open Claude in) plus one subdir per
module — `admin-page`, `front-end`, `common-helper`, `common-models`. Override
`source.root` with the `SOURCE_ROOT` env var or in the local
`.walkthrough/config/unioss.config.json`. Resolved paths are exported as
`US_SRC_ROOT`, `US_SRC_ADMIN_PAGE`, `US_SRC_FRONT_END`, `US_SRC_COMMON_HELPER`,
`US_SRC_COMMON_MODELS`.

### Browser for the tester

The tester drives a real browser through the bundled Playwright MCP (branded
Chrome). If `unioss-doctor` reports Chrome missing, install it in a real
terminal (the password prompt needs a TTY):

    ! npx playwright install --with-deps chrome
```

- [ ] **Step 3: Run the entire plugin test suite**

Run: `cd plugins/unioss-pipeline && timeout 60 node --test scripts/*.test.mjs hooks/*.test.mjs`
Expected: PASS — all suites (config, config-cli, rounds, guard-migrations, guard-rounds) green, 0 failing.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json README.md
git commit -m "chore(unioss-pipeline): bump to 1.3.0; document source paths + tester browser"
```

---

## Self-review notes

- **Spec coverage:** Part 1 → Tasks 1–2; Part 2 → Task 3; Part 3 → Task 4; Part 4 → Task 5; version/README/acceptance → Task 6. All 7 acceptance criteria mapped.
- **Criterion 4** (artifact root derives from passed cwd) → Task 3 Step 2 test.
- **No automated test for the Chrome probe** (system-dependent, env-specific) — verified by running the doctor (Task 5 Step 5); this is the one intentional manual verification, consistent with the doctor being an env report with no existing unit tests.
- **Naming consistency:** `source.root` / `source.modules` / `US_SRC_<KEY>` used identically across config code, tests, docs, and skills. Module keys kebab-case everywhere.
```