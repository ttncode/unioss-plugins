# UNIOSS Pipeline — Configuration + Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two related improvements to the unioss-pipeline plugin: **Part A (Tasks 1-9)** replaces scattered hardcoded config with one resolver (`env → local file → built-in default`). **Part B (Tasks 10-15)** makes pipeline re-runs non-destructive via *rounds* — each re-run does only its requested delta and freezes all prior rounds' artifacts.

**Architecture:** Part A — a single ESM module `scripts/config.mjs` owns defaults + resolution; JS consumers import `resolveConfig()`, markdown skills call its CLI. Part B — a `scripts/rounds.mjs` helper owns round-path math; the orchestrator writes per-round artifacts under `.walkthrough/<ticket>/round-N/` and tracks `current_round` in pipeline-state; two hooks keep migrations scoped to the active round and block writes to sealed rounds.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test`, `node:fs`/`node:path`/`node:url`/`node:os` only — no external dependencies. Plugin lives at `plugins/unioss-pipeline/`.

## Parts & order

- **Part A — Configuration (Tasks 1-9):** self-contained; ships on its own; bumps to `1.1.0`.
- **Part B — Rounds (Tasks 10-15):** builds on Part A (imports `resolveConfig` for `artifactRoot`; extends the guard-migrations work from Task 4). Execute **after** Part A. Bumps to `1.2.0`.

Part B intentionally **supersedes Task 4's flat-folder plan lookup**: Task 11 rewrites the guard to look inside `round-N/`. Where the two touch the same file, Part B is the final state.

## Global Constraints

- **No external dependencies** — only `node:*` builtins. The plugin has no `package.json`; tests run via `node --test`.
- **Cross-platform** — never assume POSIX paths; use `node:path`. For ESM dynamic import of a path, convert with `pathToFileURL`.
- **Config file path** — always `<cwd>/.walkthrough/config/unioss.config.json`, resolved from `process.cwd()` (the workspace), NOT relative to the script's own location.
- **Resolution order, highest wins** — `env` → local file → built-in default. Deep-merge objects; arrays replace wholesale.
- **Secrets** — `db.password` resolves env `DB_PASSWORD` → file → default `"ProotW"`. `GITLAB_TOKEN` is env-only, never written to the file. `print` redacts both as `******`.
- **`db.testName` does not exist** — `testing_DB` stays a literal codebase constant; never add it to config.
- **Built-in defaults reproduce today's behavior exactly** — an absent config file must change nothing.
- All paths in this plan are relative to the plugin root `plugins/unioss-pipeline/` unless stated otherwise.

---

### Task 1: Resolver core (`config.mjs`) + tests

**Files:**
- Create: `plugins/unioss-pipeline/scripts/config.mjs`
- Test: `plugins/unioss-pipeline/scripts/config.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `DEFAULTS` — the frozen default config object (shape below).
  - `configPath(cwd = process.cwd()): string` — absolute path to the local file.
  - `deepMerge(base, override): object` — recursive merge; arrays replace.
  - `resolveConfig(cwd = process.cwd()): Config` — `deepMerge(DEFAULTS, fileConfig)` then env overrides (`DB_PASSWORD`). Throws on malformed JSON in the file.
  - Config shape: `{ gitlab:{host}, repos:{adminPage:{id,path}, frontEnd:{id,path}}, docker:{mysql,php}, db:{name,user,password}, git:{baseBranch,protected[]}, artifactRoot }`.

- [ ] **Step 1: Write the failing test**

Create `plugins/unioss-pipeline/scripts/config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, configPath, deepMerge, resolveConfig } from './config.mjs';

function workspace(fileContents) {
  const dir = mkdtempSync(join(tmpdir(), 'uniconf-'));
  if (fileContents !== undefined) {
    mkdirSync(join(dir, '.walkthrough', 'config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', 'config', 'unioss.config.json'), fileContents);
  }
  return dir;
}

test('defaults: absent file yields built-in values', () => {
  const dir = workspace(undefined);
  const cfg = resolveConfig(dir);
  assert.equal(cfg.docker.mysql, 'mysql-unioss3');
  assert.equal(cfg.repos.adminPage.id, 32);
  assert.equal(cfg.db.password, 'ProotW');
  rmSync(dir, { recursive: true, force: true });
});

test('file partial override deep-merges only its keys', () => {
  const dir = workspace(JSON.stringify({ docker: { mysql: 'db-local' } }));
  const cfg = resolveConfig(dir);
  assert.equal(cfg.docker.mysql, 'db-local');   // overridden
  assert.equal(cfg.docker.php, 'php-unioss3');   // default preserved
  rmSync(dir, { recursive: true, force: true });
});

test('arrays replace wholesale, not merge', () => {
  const dir = workspace(JSON.stringify({ git: { protected: ['main'] } }));
  assert.deepEqual(resolveConfig(dir).git.protected, ['main']);
  rmSync(dir, { recursive: true, force: true });
});

test('env DB_PASSWORD overrides file and default', () => {
  const dir = workspace(JSON.stringify({ db: { password: 'fromfile' } }));
  process.env.DB_PASSWORD = 'fromenv';
  try { assert.equal(resolveConfig(dir).db.password, 'fromenv'); }
  finally { delete process.env.DB_PASSWORD; rmSync(dir, { recursive: true, force: true }); }
});

test('malformed JSON throws with the path', () => {
  const dir = workspace('{ not json');
  assert.throws(() => resolveConfig(dir), /unioss\.config\.json/);
  rmSync(dir, { recursive: true, force: true });
});

test('configPath is under the given cwd', () => {
  assert.ok(configPath('/tmp/ws').endsWith(join('.walkthrough', 'config', 'unioss.config.json')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: FAIL — `Cannot find module './config.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `plugins/unioss-pipeline/scripts/config.mjs`:

```js
#!/usr/bin/env node
// Single source of truth for UNIOSS pipeline configuration.
// Resolution order (highest wins): env -> local file -> built-in default.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = {
  gitlab: { host: 'gitlab.unioss.jp' },
  repos: {
    adminPage: { id: 32, path: 'AdminPage/' },
    frontEnd: { id: 31, path: 'FrontEnd/' },
  },
  docker: { mysql: 'mysql-unioss3', php: 'php-unioss3' },
  db: { name: '_unioss', user: 'root', password: 'ProotW' },
  git: {
    baseBranch: 'v3-master',
    protected: ['master', 'v3-master', 'develop', 'v3-develop', 'v3-develop-tps'],
  },
  artifactRoot: '.walkthrough',
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(base, override) {
  const out = isObject(base) ? { ...base } : base;
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = isObject(v) && isObject(out[k]) ? deepMerge(out[k], v) : v;
  }
  return out;
}

export function configPath(cwd = process.cwd()) {
  return join(cwd, '.walkthrough', 'config', 'unioss.config.json');
}

function readFileConfig(cwd) {
  const p = configPath(cwd);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid JSON in ${p}: ${e.message}`);
  }
}

export function resolveConfig(cwd = process.cwd()) {
  const merged = deepMerge(DEFAULTS, readFileConfig(cwd));
  if (process.env.DB_PASSWORD) merged.db.password = process.env.DB_PASSWORD;
  return merged;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config.test.mjs
git commit -m "feat(unioss-pipeline): add config resolver core (env > file > default)"
```

---

### Task 2: Resolver CLI (`print` / `get` / `env` / `init` / `check`) + tests

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.mjs` (append exports + CLI dispatcher)
- Test: `plugins/unioss-pipeline/scripts/config-cli.test.mjs` (create)

**Interfaces:**
- Consumes: `DEFAULTS`, `configPath`, `resolveConfig` (Task 1).
- Produces:
  - `flatten(obj, prefix=''): Record<string,any>` — dotted-key leaves (arrays are leaves).
  - `valueSources(cwd): Array<{key, value, source}>` — `source ∈ 'default'|'file'|'env'`.
  - `getValue(cwd, dottedKey): string` — resolved leaf as string (`JSON.stringify` for non-scalars).
  - `buildEnv(cwd): string` — newline-joined `US_*` shell exports for skills.
  - `formatPrint(cwd): string` — human table, secrets redacted, `GITLAB_TOKEN` line appended.
  - `initFile(cwd): {created: boolean, path: string}` — scaffold DEFAULTS; never overwrite.
  - `runCheck(cwd): {ok: boolean, report: string}` — validate types + `GITLAB_TOKEN` presence.
  - CLI: `node config.mjs <print|get <key>|env|init|check>`. `check` exits non-zero when `ok` is false.

- [ ] **Step 1: Write the failing test**

Create `plugins/unioss-pipeline/scripts/config-cli.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flatten, valueSources, getValue, buildEnv, formatPrint, initFile, runCheck } from './config.mjs';

const ws = () => mkdtempSync(join(tmpdir(), 'unicli-'));

test('flatten produces dotted leaves; arrays are leaves', () => {
  const f = flatten({ a: { b: 1 }, c: [1, 2] });
  assert.equal(f['a.b'], 1);
  assert.deepEqual(f['c'], [1, 2]);
});

test('getValue returns resolved scalar as string', () => {
  assert.equal(getValue(ws(), 'docker.mysql'), 'mysql-unioss3');
});

test('buildEnv emits US_ exports including db password', () => {
  const out = buildEnv(ws());
  assert.match(out, /US_MYSQL='mysql-unioss3'/);
  assert.match(out, /US_DB_PASS='ProotW'/);
});

test('formatPrint redacts db.password and shows GITLAB_TOKEN line', () => {
  delete process.env.GITLAB_TOKEN;
  const out = formatPrint(ws());
  assert.doesNotMatch(out, /ProotW/);
  assert.match(out, /db\.password\s+\*{6}/);
  assert.match(out, /GITLAB_TOKEN.*MISSING/);
});

test('valueSources marks db.password env when DB_PASSWORD set', () => {
  process.env.DB_PASSWORD = 'x';
  try {
    const src = valueSources(ws()).find((r) => r.key === 'db.password');
    assert.equal(src.source, 'env');
  } finally { delete process.env.DB_PASSWORD; }
});

test('initFile scaffolds defaults and refuses to overwrite', () => {
  const dir = ws();
  const first = initFile(dir);
  assert.equal(first.created, true);
  assert.ok(existsSync(first.path));
  assert.equal(JSON.parse(readFileSync(first.path, 'utf8')).docker.php, 'php-unioss3');
  assert.equal(initFile(dir).created, false);
});

test('runCheck fails when GITLAB_TOKEN missing', () => {
  delete process.env.GITLAB_TOKEN;
  assert.equal(runCheck(ws()).ok, false);
});

test('runCheck passes with token and clean defaults', () => {
  process.env.GITLAB_TOKEN = 'tok';
  try { assert.equal(runCheck(ws()).ok, true); }
  finally { delete process.env.GITLAB_TOKEN; }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/scripts/config-cli.test.mjs`
Expected: FAIL — `flatten` (and the other names) `is not exported`.

- [ ] **Step 3: Write minimal implementation**

Append to `plugins/unioss-pipeline/scripts/config.mjs`:

```js
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function readFileConfigSafe(cwd) {
  try { return JSON.parse(readFileSync(configPath(cwd), 'utf8')); } catch { return {}; }
}

export function valueSources(cwd = process.cwd()) {
  const resolved = flatten(resolveConfig(cwd));
  const fileFlat = flatten(readFileConfigSafe(cwd));
  return Object.entries(resolved).map(([key, value]) => {
    let source = 'default';
    if (key === 'db.password' && process.env.DB_PASSWORD) source = 'env';
    else if (key in fileFlat) source = 'file';
    return { key, value, source };
  });
}

export function getValue(cwd, dottedKey) {
  const v = dottedKey.split('.').reduce((o, k) => (o == null ? o : o[k]), resolveConfig(cwd));
  if (v === undefined) throw new Error(`Unknown config key: ${dottedKey}`);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

export function buildEnv(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
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
  ].join('\n');
}

const SECRET_KEYS = new Set(['db.password']);

export function formatPrint(cwd = process.cwd()) {
  const lines = valueSources(cwd).map(({ key, value, source }) => {
    const shown = SECRET_KEYS.has(key) ? '******' : (Array.isArray(value) ? value.join(',') : value);
    return `  ${key.padEnd(22)} ${String(shown).padEnd(28)} (${source})`;
  });
  const token = process.env.GITLAB_TOKEN ? '******                       (env)' : 'MISSING                      (env)';
  lines.push(`  ${'GITLAB_TOKEN'.padEnd(22)} ${token}`);
  return lines.join('\n');
}

export function initFile(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (existsSync(p)) return { created: false, path: p };
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(DEFAULTS, null, 2) + '\n');
  return { created: true, path: p };
}

export function runCheck(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  const errors = [];
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
  if (!process.env.GITLAB_TOKEN) errors.push('GITLAB_TOKEN is not set in the environment');
  const report = [formatPrint(cwd), '', errors.length ? errors.map((e) => `  ERROR: ${e}`).join('\n') : '  All checks passed.'].join('\n');
  return { ok: errors.length === 0, report };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'get') process.stdout.write(getValue(process.cwd(), arg) + '\n');
  else if (cmd === 'env') process.stdout.write(buildEnv() + '\n');
  else if (cmd === 'print') process.stdout.write('\nUNIOSS pipeline — resolved config\n\n' + formatPrint() + '\n');
  else if (cmd === 'init') {
    const r = initFile();
    process.stdout.write(r.created ? `Created ${r.path}\n` : `Exists (left unchanged): ${r.path}\n`);
  } else if (cmd === 'check') {
    const r = runCheck();
    process.stdout.write('\nUNIOSS pipeline — config check\n\n' + r.report + '\n');
    process.exit(r.ok ? 0 : 1);
  } else {
    process.stderr.write('Usage: config.mjs <print|get <key>|env|init|check>\n');
    process.exit(1);
  }
}
```

Note: the `import` statements appended here are hoisted by the engine, so placing them mid-file is valid ESM. If a linter objects, move the three `import` lines to the top of the file beside the Task 1 imports.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-pipeline/scripts/config-cli.test.mjs`
Expected: PASS — 8 tests pass.

Then smoke-test the CLI from a scratch dir:

Run: `cd "$(mktemp -d)" && node "$OLDPWD/plugins/unioss-pipeline/scripts/config.mjs" print; cd "$OLDPWD"`
Expected: a resolved table printed; `db.password ******`; `GITLAB_TOKEN ... MISSING` (unless set).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config-cli.test.mjs
git commit -m "feat(unioss-pipeline): add config CLI (print/get/env/init/check)"
```

---

### Task 3: Refactor `doctor.mjs` onto the resolver

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/doctor.mjs` (replace `readContainerNames`, add config source reporting)

**Interfaces:**
- Consumes: `resolveConfig`, `runCheck` from `./config.mjs`.
- Produces: no new exports (doctor is a CLI entrypoint).

- [ ] **Step 1: Replace the container-name discovery with the resolver**

In `plugins/unioss-pipeline/scripts/doctor.mjs`, add the import at the top (next to the existing imports):

```js
import { resolveConfig, runCheck } from './config.mjs';
```

Delete the entire `readContainerNames()` function (lines ~31-48) and the line:

```js
const { mysql: mysqlName, php: phpName } = readContainerNames();
```

Replace that line with:

```js
const cfg = resolveConfig();
const { mysql: mysqlName, php: phpName } = cfg.docker;
```

Also remove the now-unused imports `existsSync`, `readFileSync`, and `join` **only if** nothing else in the file uses them (grep first — Step 2).

- [ ] **Step 2: Verify no orphaned references remain**

Run: `grep -nE "readContainerNames|existsSync|readFileSync|\bjoin\(" plugins/unioss-pipeline/scripts/doctor.mjs`
Expected: no matches (if any line still uses one of these, keep that import). Remove only the imports with zero remaining uses.

- [ ] **Step 3: Append a resolved-config block to the doctor output**

Find the final summary section (after the checks loop, before `process.exit`). Immediately before `process.exit(allOk ? 0 : 1);`, insert:

```js
const check = runCheck();
console.log('\nResolved configuration (env > file > default):\n');
console.log(check.report);
console.log('\nTo override locally:  node "${0}" --init-config  (creates .walkthrough/config/unioss.config.json)\n'
  .replace('${0}', 'scripts/config.mjs'));
if (!check.ok) allOk = false;
```

- [ ] **Step 4: Run the doctor and confirm it prints config + still exits correctly**

Run: `cd "$(mktemp -d)" && GITLAB_TOKEN=test node "$OLDPWD/plugins/unioss-pipeline/scripts/doctor.mjs"; echo "exit=$?"; cd "$OLDPWD"`
Expected: the env table prints, followed by "Resolved configuration" with `docker.mysql mysql-unioss3 (default)`. Exit is non-zero only because Docker containers aren't running in the scratch dir — that's correct.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/doctor.mjs
git commit -m "refactor(unioss-pipeline): doctor reads container names + reports config via resolver"
```

---

### Task 4: `guard-migrations.mjs` — config artifactRoot + active-ticket scoping

**Files:**
- Modify: `plugins/unioss-pipeline/hooks/guard-migrations.mjs`
- Test: `plugins/unioss-pipeline/hooks/guard-migrations.test.mjs` (create)

**Interfaces:**
- Consumes: `resolveConfig` from `../scripts/config.mjs`.
- Produces: `activeTicketDir(root): string | null` — the `<root>/<PREFIX>#IID` whose `.pipeline/.../pipeline-state.json` has the newest mtime, or `null` if none.
- Behavior change: a migration edit is authorized only by IMPLEMENTATION plans under the **active ticket's** folder; if no pipeline-state exists, fall back to scanning all ticket folders (preserves today's behavior).

- [ ] **Step 1: Write the failing test**

Create `plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeTicketDir } from './guard-migrations.mjs';

function ticket(root, name, stateMtimeSec) {
  mkdirSync(join(root, name), { recursive: true });
  const pdir = join(root, '.pipeline', name);
  mkdirSync(pdir, { recursive: true });
  const state = join(pdir, 'pipeline-state.json');
  writeFileSync(state, '{}');
  if (stateMtimeSec) utimesSync(state, stateMtimeSec, stateMtimeSec);
}

test('activeTicketDir picks the newest pipeline-state', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  ticket(root, 'AP#1', 1000);
  ticket(root, 'AP#2', 2000);
  assert.equal(activeTicketDir(root), join(root, 'AP#2'));
});

test('activeTicketDir returns null when no state files', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  mkdirSync(join(root, 'AP#1'), { recursive: true });
  assert.equal(activeTicketDir(root), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`
Expected: FAIL — `activeTicketDir is not exported`.

- [ ] **Step 3: Rewrite the hook to export `activeTicketDir` and scope the match**

Replace the full contents of `plugins/unioss-pipeline/hooks/guard-migrations.mjs` with:

```js
#!/usr/bin/env node
// PreToolUse(Edit|Write): block edits under application/migrations/ unless the ACTIVE
// ticket's implementation plan references the file.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';

export function activeTicketDir(root) {
  const pipelineDir = join(root, '.pipeline');
  if (!existsSync(pipelineDir)) return null;
  let newest = null;
  for (const entry of readdirSync(pipelineDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const state = join(pipelineDir, entry.name, 'pipeline-state.json');
    if (!existsSync(state)) continue;
    const mtime = statSync(state).mtimeMs;
    if (!newest || mtime > newest.mtime) newest = { mtime, name: entry.name };
  }
  return newest ? join(root, newest.name) : null;
}

function planFilesIn(dir) {
  try {
    return readdirSync(dir)
      .filter((n) => /IMPLEMENTATION/.test(n) && n.endsWith('.md'))
      .map((n) => join(dir, n));
  } catch { return []; }
}

function allTicketPlanFiles(root) {
  let plans = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      plans.push(...planFilesIn(join(root, entry.name)));
    }
  } catch { /* no artifact root yet */ }
  return plans;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
  const f = file.replace(/\\/g, '/');
  if (!f.includes('application/migrations/')) process.exit(0);
  const base = basename(f);
  const root = resolveConfig().artifactRoot;
  const active = activeTicketDir(root);
  const planFiles = active ? planFilesIn(active) : allTicketPlanFiles(root);
  const referenced = planFiles.some((p) => {
    try { return readFileSync(p, 'utf8').includes(base); } catch { return false; }
  });
  if (!referenced) {
    const scope = active ? `the active ticket plan (${active})` : `any implementation plan under ${root}/`;
    process.stderr.write(`Blocked: ${base} is not referenced by ${scope}. Add it to the plan first.\n`);
    process.exit(2);
  }
  process.exit(0);
});
```

Note: the stdin handler runs only when invoked as a hook. Importing `activeTicketDir` in tests registers the stdin listeners too, but with no stdin piped they never fire `end`, so the test process exits cleanly after its assertions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`
Expected: PASS — 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/hooks/guard-migrations.mjs plugins/unioss-pipeline/hooks/guard-migrations.test.mjs
git commit -m "fix(unioss-pipeline): scope migration guard to active ticket + use config artifactRoot"
```

---

### Task 5: `php-lint.mjs` — container + repo path from config

**Files:**
- Modify: `plugins/unioss-pipeline/hooks/php-lint.mjs`

**Interfaces:**
- Consumes: `resolveConfig` from `../scripts/config.mjs`.
- Produces: no new exports.
- Behavior: lint container name and the AdminPage path segment come from config; the `/var/www/html/` container mount prefix stays a literal (it is fixed inside the container, not per-machine).

- [ ] **Step 1: Rewrite the hook to resolve container + path from config**

Replace the full contents of `plugins/unioss-pipeline/hooks/php-lint.mjs` with:

```js
#!/usr/bin/env node
// PostToolUse(Edit|Write): php -l edited PHP files under the AdminPage repo via the container.
import { execFileSync } from 'node:child_process';
import { resolveConfig } from '../scripts/config.mjs';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
  file = file.replace(/\\/g, '/');
  if (!file.endsWith('.php')) process.exit(0);

  const cfg = resolveConfig();
  const repo = cfg.repos.adminPage.path.replace(/\/+$/, ''); // "AdminPage"
  const marker = `/${repo}/`;
  const idx = file.indexOf(marker);
  if (idx === -1) process.exit(0);

  const rel = file.slice(idx + marker.length);
  try {
    execFileSync('docker', ['exec', '-i', cfg.docker.php, 'php', '-l', `/var/www/html/${repo}/${rel}`], { stdio: ['ignore', 'ignore', 'inherit'] });
    process.exit(0);
  } catch {
    process.stderr.write(`php -l failed for ${file}\n`);
    process.exit(2);
  }
});
```

- [ ] **Step 2: Verify it loads without error**

Run: `echo '{"tool_input":{"file_path":"/x/y.txt"}}' | node plugins/unioss-pipeline/hooks/php-lint.mjs; echo "exit=$?"`
Expected: `exit=0` (non-PHP file is ignored; no docker call, no import error).

- [ ] **Step 3: Verify a non-AdminPage PHP path is ignored**

Run: `echo '{"tool_input":{"file_path":"/x/FrontEnd/foo.php"}}' | node plugins/unioss-pipeline/hooks/php-lint.mjs; echo "exit=$?"`
Expected: `exit=0` (outside the AdminPage repo path — unchanged behavior; FrontEnd coverage is a separate thread).

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/hooks/php-lint.mjs
git commit -m "refactor(unioss-pipeline): php-lint resolves container + repo path from config"
```

---

### Task 6: `fetch-ticket.js` — drop the hardcoded host

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js:80`

**Interfaces:**
- Consumes: nothing new. The host is already parsed from the ticket URL into the `host` variable (`fetch-ticket.js:25`); the image regex just needs to use it instead of a literal.
- Rationale: this satisfies the spec's "no hardcoded host" intent without bridging an ESM module into this CommonJS script. The URL host *is* the configured host, so deriving from it is correct and simpler.

- [ ] **Step 1: Replace the hardcoded-host regex with one built from `host`**

In `plugins/unioss-pipeline/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js`, replace line 80:

```js
	const imgRegex = /!\[([^\]]*)\]\((https:\/\/gitlab\.unioss\.jp\/-\/project\/[^)]+)\)/g;
```

with:

```js
	const hostEsc = host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const imgRegex = new RegExp(`!\\[([^\\]]*)\\]\\((${hostEsc}/-/project/[^)]+)\\)`, 'g');
```

- [ ] **Step 2: Verify the script still parses and runs to its arg check**

Run: `node plugins/unioss-pipeline/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js; echo "exit=$?"`
Expected: prints `Usage: fetch-ticket.js <GITLAB_URL>` and `exit=1` (no syntax error; the new RegExp compiles at module load only when reached, but `node -c` below confirms syntax).

Run: `node -c plugins/unioss-pipeline/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js && echo "syntax OK"`
Expected: `syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js
git commit -m "refactor(unioss-pipeline): build image-URL regex from parsed host, drop literal"
```

---

### Task 7: Replace literal values in REFERENCE.md + skills with config-resolved commands

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md:21`
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md:15`
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md` (DB/container references, if any literal remains after review)

**Interfaces:**
- Consumes: the `config.mjs` CLI (`env`, `get`) from Tasks 1-2 via `${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`.
- Produces: documentation only. No code interfaces.

- [ ] **Step 1: Add a Configuration section to REFERENCE.md**

In `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`, immediately after the `# UNIOSS Pipeline — Shared Reference` heading, insert:

```markdown
## Configuration (resolved at runtime)

All per-machine values come from `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs"`
(resolution: env → `.walkthrough/config/unioss.config.json` → built-in default).
Do not hardcode these in commands — resolve them.

| Key | Default | Used for |
| --- | --- | --- |
| `gitlab.host` | `gitlab.unioss.jp` | API + image URLs |
| `repos.adminPage.id` / `.path` | `32` / `AdminPage/` | project id, repo path |
| `repos.frontEnd.id` / `.path` | `31` / `FrontEnd/` | project id, repo path |
| `docker.mysql` / `docker.php` | `mysql-unioss3` / `php-unioss3` | container names |
| `db.name` / `db.user` / `db.password` | `_unioss` / `root` / `ProotW` | DB access |
| `git.baseBranch` | `v3-master` | base for feature branches |
| `git.protected` | `master, v3-master, develop, v3-develop, v3-develop-tps` | never-commit list |
| `artifactRoot` | `.walkthrough` | output dir |

Secrets: `GITLAB_TOKEN` is env-only (required). `db.password` resolves env `DB_PASSWORD`
→ file → default. `testing_DB` is a fixed codebase constant — not configurable.

To run a DB query in a skill, resolve config into shell vars first:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; SHOW TABLES;"
```
```

- [ ] **Step 2: Update the GitLab + Database sections of REFERENCE.md to reference config**

In the same file, replace the literal DB examples (the `## Database` block, currently
`docker exec -i mysql-unioss3 mysql -u root -pProotW …`) with:

```markdown
## Database (non-interactive: `-i`, not `-it`)

Resolve config first, then query (read-only):

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# Production data
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; SHOW TABLES;"
# Testing data (fixed name, imported during PHPUnit runs)
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE testing_DB; SHOW TABLES;"
```
```

In the `## GitLab (read-only)` block, change the Host line from the literal to:
`Host: \`gitlab.host\` from config (default \`gitlab.unioss.jp\`).` Leave the URL regex
and endpoints unchanged. Confirm no literal `-pProotW` remains anywhere in the file (Step 5).

- [ ] **Step 3: Update `unioss-investigate` Step 3 DB command**

In `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md`, replace the Step 3 command:

```
`docker exec -i mysql-unioss3 mysql -u root -pProotW -e "USE _unioss; DESCRIBE <table>;"`
```

with:

```
Resolve config, then describe the affected tables (read-only):
`eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; DESCRIBE <table>;"`
```

- [ ] **Step 4: Update `unioss-verify` Step 2 DB command**

In `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md`, replace the Step 2 command line:

```
`docker exec -i mysql-unioss3 mysql -u root -pProotW -e "USE <db>; SELECT ...;"`
```

with:

```
`eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE <db>; SELECT ...;"`  (use `$US_DB` for production data; `testing_DB` for post-PHPUnit data)
```

- [ ] **Step 5: Verify no committed literal secret/container names remain in skills**

Run: `grep -rnE "pProotW|mysql-unioss3|php-unioss3" plugins/unioss-pipeline/skills plugins/unioss-pipeline/scripts/doctor.mjs plugins/unioss-pipeline/hooks`
Expected: matches only inside `config.mjs` `DEFAULTS` (the legitimate single source) and the REFERENCE config table; **no** `-pProotW` outside the defaults. If any skill still shows a literal, fix it the same way.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/skills
git commit -m "refactor(unioss-pipeline): skills + REFERENCE resolve DB/host from config, drop literals"
```

---

### Task 8: README Configuration section

**Files:**
- Modify: `README.md` (repo root)

**Interfaces:**
- Consumes: the `config.mjs` CLI commands. Documentation only.

- [ ] **Step 1: Add a Configuration section to the README**

In `README.md`, after the `## Usage` section and before `## Requirements`, insert:

```markdown
## Configuration

The pipeline works with zero configuration on a standard UNIOSS setup — built-in defaults
cover container names, GitLab host, project IDs, repo paths, branches, and the local DB.

To override anything for your machine, create a local (gitignored) file at the UNIOSS
workspace root:

```
.walkthrough/config/unioss.config.json
```

Scaffold it with every default written out, then edit what differs:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
```

Resolution order is **env → this file → built-in default**, deep-merged, so the file only
needs the keys you change. For example, different container names:

```json
{ "docker": { "mysql": "unioss-db-local", "php": "unioss-php-81" } }
```

Inspect what is resolved (secrets redacted) and validate your setup:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" print
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" check
```

`/unioss-doctor` runs `check` for you.

**Secrets stay in the environment, never committed:**

- `GITLAB_TOKEN` — **required**, env only (`export GITLAB_TOKEN=…`).
- `DB_PASSWORD` — optional; defaults to the local-DB password. Since the config file is
  gitignored, you may instead set `db.password` in it.

`testing_DB` is a fixed name in the UNIOSS codebase and is intentionally not configurable.
```

- [ ] **Step 2: Verify the README renders the new section**

Run: `grep -n "## Configuration" README.md && grep -n "unioss.config.json" README.md`
Expected: both match — section present and the file path documented.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document unioss-pipeline configuration (file, CLI, secrets)"
```

---

### Task 9: Full suite green + version bump

**Files:**
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json` (version bump)

**Interfaces:** none.

- [ ] **Step 1: Run every test in the plugin**

Run: `node --test plugins/unioss-pipeline/scripts/*.test.mjs plugins/unioss-pipeline/hooks/*.test.mjs`
Expected: all tests across Tasks 1, 2, 4 PASS; 0 failures.

- [ ] **Step 2: Confirm acceptance criteria 1-5 by inspection**

Run: `grep -rnE "pProotW" plugins/unioss-pipeline | grep -v "DEFAULTS\|password: 'ProotW'"`
Expected: no matches (criterion 3 — no stray literal password).

Run: `cd "$(mktemp -d)" && node "$OLDPWD/plugins/unioss-pipeline/scripts/config.mjs" check; echo "exit=$?"; cd "$OLDPWD"`
Expected: report prints with `(default)` sources and `GITLAB_TOKEN ... MISSING`, `exit=1` (criterion 4).

- [ ] **Step 3: Bump the plugin version**

In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, change `"version": "1.0.1"` to `"version": "1.1.0"` (new feature, backward compatible).

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "chore(unioss-pipeline): bump version to 1.1.0 (centralized config)"
```

---

## Self-Review — Part A (Configuration)

**Spec coverage:**
- Single resolver `config.mjs` with `env→file→default`, JS API + CLI → Tasks 1, 2. ✅
- Schema (no `db.testName`; `db.password` present) → Task 1 `DEFAULTS`. ✅
- `doctor.mjs` uses resolver + reports sources → Task 3. ✅
- `guard-migrations` artifactRoot + active-ticket scoping → Task 4. ✅
- `php-lint` container + repo path from config → Task 5. ✅
- `fetch-ticket.js` host (no literal) → Task 6. ✅
- REFERENCE.md + investigate/verify/implement skills resolve via config, drop `-pProotW` → Task 7. ✅
- README Configuration section → Task 8. ✅
- Resolver test suite (precedence, deep-merge, redaction, fallback, missing file, check fails on missing token) → Tasks 1, 2. ✅
- Acceptance criteria 1-7 → verified in Tasks 2, 4, 7, 9. ✅
- Back-compat (defaults reproduce behavior) → Task 1 tests + Task 9 Step 2. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands include expected output.

**Type consistency:** `resolveConfig(cwd)`, `configPath(cwd)`, `deepMerge`, `flatten`, `valueSources`, `getValue`, `buildEnv`, `formatPrint`, `initFile`, `runCheck`, `activeTicketDir(root)` — names used identically across Tasks 1-8. The `US_*` shell var names in `buildEnv` (Task 2) match those consumed in REFERENCE/skills (Task 7).

**Note on `unioss-implement` (Task 7):** it has no literal `-pProotW`/container today (it delegates DB to other skills), so Step changes there are conditional — the grep in Task 7 Step 5 confirms whether any edit is needed. If clean, no edit; the task still passes.

---

# Part B — Pipeline Rounds (non-destructive re-runs)

> Execute after Part A. Part B assumes `scripts/config.mjs` (`resolveConfig`) exists.

**Part B goal:** Re-running `/unioss-pipeline` on a ticket that already has outputs opens a new *round*. The full A→Z process runs each round, but each round does only its requested delta; every prior round's artifacts are frozen and never overwritten.

## Part B — Concepts (read before Task 10)

- **Round** = one full pipeline pass for a specific requested change. Round 1 = initial.
- **Layout:** artifacts live under `<artifactRoot>/<PREFIX>#[IID]/round-N/` (was the flat `<PREFIX>#[IID]/`). `round-1` is never modified once sealed.
- **Sealed round** = its verify + finalize completed. Re-running with new work when the latest round is sealed → open round N+1. If the latest round is incomplete → resume it.
- **Round brief** = `round-N/ROUND_BRIEF.md`, capturing what round N must do (ticket delta since last round and/or the user's instruction at Step 0). Every stage in the round reads it + prior rounds as immutable baseline.
- **`current_round`** lives in `.walkthrough/.pipeline/<PREFIX>#[IID]/pipeline-state.json`.
- **Branch:** rounds share the ticket's one feature branch; round N adds commits on top. No new branch per round.

## Part B — Global Constraints

- `round-N` directory names are exactly `round-` + a positive integer, no padding (`round-1`, `round-2`, … `round-10`).
- Stages write **only** under the current `round-N/`; never modify `round-<N`. Task 14 enforces this.
- The flat-folder layout from earlier versions is legacy; helpers fall back to it only when no `round-*` dir exists (back-compat), but new runs always create `round-N/`.

---

### Task 10: `scripts/rounds.mjs` round-path helpers + tests

**Files:**
- Create: `plugins/unioss-pipeline/scripts/rounds.mjs`
- Test: `plugins/unioss-pipeline/scripts/rounds.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `listRounds(ticketDir): number[]` — ascending round numbers present.
  - `latestRoundNum(ticketDir): number` — highest round, or `0` if none.
  - `roundDir(ticketDir, n): string` — `<ticketDir>/round-N`.
  - `planFilesForRound(ticketDir, n): string[]` — IMPLEMENTATION plans in that round.

- [ ] **Step 1: Write the failing test**

Create `plugins/unioss-pipeline/scripts/rounds.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listRounds, latestRoundNum, roundDir, planFilesForRound } from './rounds.mjs';

function ticketWith(rounds) {
  const dir = mkdtempSync(join(tmpdir(), 'rounds-'));
  for (const [n, files] of Object.entries(rounds)) {
    const rd = join(dir, `round-${n}`);
    mkdirSync(rd, { recursive: true });
    for (const f of files) writeFileSync(join(rd, f), 'x');
  }
  return dir;
}

test('listRounds returns ascending numbers and ignores non-round dirs', () => {
  const dir = ticketWith({ 2: [], 1: [] });
  mkdirSync(join(dir, 'screenshots'));
  assert.deepEqual(listRounds(dir), [1, 2]);
});

test('latestRoundNum is 0 when none exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rounds-'));
  assert.equal(latestRoundNum(dir), 0);
});

test('latestRoundNum picks the highest, not lexical', () => {
  const dir = ticketWith({ 2: [], 10: [], 1: [] });
  assert.equal(latestRoundNum(dir), 10);
});

test('roundDir builds the expected path', () => {
  assert.ok(roundDir('/t', 3).endsWith(join('/t', 'round-3')));
});

test('planFilesForRound returns only IMPLEMENTATION md files of that round', () => {
  const dir = ticketWith({ 1: ['AP#1_IMPLEMENTATION_V1.md', 'AP#1_REVIEW.md'] });
  const plans = planFilesForRound(dir, 1);
  assert.equal(plans.length, 1);
  assert.match(plans[0], /IMPLEMENTATION_V1\.md$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/scripts/rounds.test.mjs`
Expected: FAIL — `Cannot find module './rounds.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `plugins/unioss-pipeline/scripts/rounds.mjs`:

```js
// Round-path math for the UNIOSS pipeline. A round is `<ticketDir>/round-N`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUND_RE = /^round-(\d+)$/;

export function listRounds(ticketDir) {
  if (!existsSync(ticketDir)) return [];
  return readdirSync(ticketDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && ROUND_RE.test(e.name))
    .map((e) => Number(e.name.match(ROUND_RE)[1]))
    .sort((a, b) => a - b);
}

export function latestRoundNum(ticketDir) {
  const rounds = listRounds(ticketDir);
  return rounds.length ? rounds[rounds.length - 1] : 0;
}

export function roundDir(ticketDir, n) {
  return join(ticketDir, `round-${n}`);
}

export function planFilesForRound(ticketDir, n) {
  try {
    return readdirSync(roundDir(ticketDir, n))
      .filter((name) => /IMPLEMENTATION/.test(name) && name.endsWith('.md'))
      .map((name) => join(roundDir(ticketDir, n), name));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-pipeline/scripts/rounds.test.mjs`
Expected: PASS — 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/rounds.mjs plugins/unioss-pipeline/scripts/rounds.test.mjs
git commit -m "feat(unioss-pipeline): add round-path helpers (rounds.mjs)"
```

---

### Task 11: Make `guard-migrations` round-aware (supersedes Task 4 lookup)

**Files:**
- Modify: `plugins/unioss-pipeline/hooks/guard-migrations.mjs`
- Modify: `plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`

**Interfaces:**
- Consumes: `latestRoundNum`, `planFilesForRound` from `../scripts/rounds.mjs`; `activeTicketDir` (from Task 4) stays.
- Behavior: a migration edit is authorized only by an IMPLEMENTATION plan in the active ticket's **latest round**. If the ticket has no `round-*` dirs (legacy), fall back to the flat lookup from Task 4.

- [ ] **Step 1: Add a failing test for round-scoped authorization**

Append to `plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`:

```js
import { authorizingPlanFiles } from './guard-migrations.mjs';

test('authorizingPlanFiles uses only the latest round of the active ticket', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  // active ticket AP#9 with two rounds; the migration is only in round-2's plan
  mkdirSync(join(root, 'AP#9', 'round-1'), { recursive: true });
  writeFileSync(join(root, 'AP#9', 'round-1', 'AP#9_IMPLEMENTATION_V1.md'), 'no match here');
  mkdirSync(join(root, 'AP#9', 'round-2'), { recursive: true });
  writeFileSync(join(root, 'AP#9', 'round-2', 'AP#9_IMPLEMENTATION_V1.md'), 'touches 099_add_col.php');
  const pdir = join(root, '.pipeline', 'AP#9');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'pipeline-state.json'), '{}');

  const files = authorizingPlanFiles(root);
  assert.equal(files.length, 1);
  assert.match(files[0], /round-2/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`
Expected: FAIL — `authorizingPlanFiles is not exported`.

- [ ] **Step 3: Refactor the hook to export `authorizingPlanFiles` and use rounds**

In `plugins/unioss-pipeline/hooks/guard-migrations.mjs`, add the import beside the others:

```js
import { latestRoundNum, planFilesForRound } from '../scripts/rounds.mjs';
```

Add this exported function (next to `activeTicketDir`):

```js
export function authorizingPlanFiles(root) {
  const active = activeTicketDir(root);
  if (!active) return allTicketPlanFiles(root);
  const latest = latestRoundNum(active);
  return latest ? planFilesForRound(active, latest) : planFilesIn(active);
}
```

In the stdin handler, replace the block that computes `planFiles`:

```js
  const root = resolveConfig().artifactRoot;
  const active = activeTicketDir(root);
  const planFiles = active ? planFilesIn(active) : allTicketPlanFiles(root);
```

with:

```js
  const root = resolveConfig().artifactRoot;
  const planFiles = authorizingPlanFiles(root);
```

And update the block message to describe rounds:

```js
  if (!referenced) {
    const active = activeTicketDir(root);
    const where = active
      ? `the active ticket's latest round plan (under ${active})`
      : `any implementation plan under ${root}/`;
    process.stderr.write(`Blocked: ${base} is not referenced by ${where}. Add it to the plan first.\n`);
    process.exit(2);
  }
```

- [ ] **Step 4: Run the full guard test file**

Run: `node --test plugins/unioss-pipeline/hooks/guard-migrations.test.mjs`
Expected: PASS — the Task 4 tests (`activeTicketDir`) and the new `authorizingPlanFiles` test all pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/hooks/guard-migrations.mjs plugins/unioss-pipeline/hooks/guard-migrations.test.mjs
git commit -m "feat(unioss-pipeline): scope migration guard to the active ticket's latest round"
```

---

### Task 12: Sealed-round write guard (`guard-rounds.mjs`) + hook registration

**Files:**
- Create: `plugins/unioss-pipeline/hooks/guard-rounds.mjs`
- Test: `plugins/unioss-pipeline/hooks/guard-rounds.test.mjs`
- Modify: `plugins/unioss-pipeline/hooks/hooks.json`

**Interfaces:**
- Consumes: `resolveConfig` from `../scripts/config.mjs`.
- Produces: `sealedRoundViolation(filePath, root): number | null` — the round number being illegally written, or `null` if the write is allowed. A write is illegal when the path is under `round-K` and `K < current_round` for that ticket.

- [ ] **Step 1: Write the failing test**

Create `plugins/unioss-pipeline/hooks/guard-rounds.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealedRoundViolation } from './guard-rounds.mjs';

function root(currentRound) {
  const dir = mkdtempSync(join(tmpdir(), 'gr-'));
  const pdir = join(dir, '.pipeline', 'AP#7');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'pipeline-state.json'), JSON.stringify({ current_round: currentRound }));
  return dir;
}

test('writing a prior (sealed) round is a violation', () => {
  const dir = root(2);
  const file = join(dir, 'AP#7', 'round-1', 'AP#7_REVIEW.md');
  assert.equal(sealedRoundViolation(file, dir), 1);
});

test('writing the current round is allowed', () => {
  const dir = root(2);
  const file = join(dir, 'AP#7', 'round-2', 'AP#7_REVIEW.md');
  assert.equal(sealedRoundViolation(file, dir), null);
});

test('paths outside any round are ignored', () => {
  const dir = root(2);
  assert.equal(sealedRoundViolation(join(dir, 'AP#7', 'screenshots', 'x.png'), dir), null);
});

test('no state file -> nothing sealed, allowed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gr-'));
  assert.equal(sealedRoundViolation(join(dir, 'AP#7', 'round-1', 'x.md'), dir), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-pipeline/hooks/guard-rounds.test.mjs`
Expected: FAIL — `Cannot find module './guard-rounds.mjs'`.

- [ ] **Step 3: Write minimal implementation**

Create `plugins/unioss-pipeline/hooks/guard-rounds.mjs`:

```js
#!/usr/bin/env node
// PreToolUse(Edit|Write): block writes into a sealed (prior) round's folder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';

function currentRoundFor(root, ticket) {
  try {
    const state = JSON.parse(readFileSync(join(root, '.pipeline', ticket, 'pipeline-state.json'), 'utf8'));
    return Number(state.current_round) || 0;
  } catch {
    return 0;
  }
}

export function sealedRoundViolation(filePath, root) {
  const f = filePath.replace(/\\/g, '/');
  const m = f.match(/\/([^/]+)\/round-(\d+)\//);
  if (!m) return null;
  const ticket = m[1];
  const round = Number(m[2]);
  const current = currentRoundFor(root, ticket);
  return current && round < current ? round : null;
}

const isMain = process.argv[1] && process.argv[1].endsWith('guard-rounds.mjs');
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let file = '';
    try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
    const root = resolveConfig().artifactRoot;
    const violated = sealedRoundViolation(file, root);
    if (violated !== null) {
      process.stderr.write(`Blocked: round-${violated} is sealed. Write into the current round instead.\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-pipeline/hooks/guard-rounds.test.mjs`
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Register the hook**

In `plugins/unioss-pipeline/hooks/hooks.json`, add `guard-rounds.mjs` to the existing `PreToolUse` `Edit|Write` matcher so the array reads:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Edit|Write", "hooks": [
        { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard-migrations.mjs\"" },
        { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/guard-rounds.mjs\"" }
      ] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/php-lint.mjs\"" } ] }
    ]
  }
}
```

- [ ] **Step 6: Smoke-test the hook end to end**

Run: `echo '{"tool_input":{"file_path":"/x/AP#7/round-1/y.md"}}' | node plugins/unioss-pipeline/hooks/guard-rounds.mjs; echo "exit=$?"`
Expected: `exit=0` (no pipeline-state in cwd, so nothing is sealed — allowed).

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/hooks/guard-rounds.mjs plugins/unioss-pipeline/hooks/guard-rounds.test.mjs plugins/unioss-pipeline/hooks/hooks.json
git commit -m "feat(unioss-pipeline): block writes to sealed prior rounds"
```

---

### Task 13: Orchestrator round logic (`unioss-pipeline/SKILL.md` + REFERENCE.md)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`

**Interfaces:** documentation/orchestration only. Defines the `pipeline-state.json` shape consumed by Tasks 11-12 (`current_round`).

- [ ] **Step 1: Update the State & resume section of SKILL.md**

In `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md`, replace the `## State & resume` paragraph with:

```markdown
## State & resume

State file: `.walkthrough/.pipeline/<PREFIX>#[IID]/pipeline-state.json` —
`{ current_round, rounds: { "<n>": { stage, gate_decisions, plan_version, review_counts, test_status } } }`.

On start, determine the round:
- No state, or no `round-*` dirs → this is **round 1**. Set `current_round = 1`.
- Latest round is **incomplete** (its `stage` is not `finalized`) → resume that round; do not open a new one.
- Latest round is **sealed** (`stage = finalized`) **and** there is new requested work (ticket changed since the round, or the user gives an instruction) → open **round N+1**: set `current_round = N+1`.

Update the current round's entry after every stage.
```

- [ ] **Step 2: Add a round-brief + freeze rule to Step 0 of SKILL.md**

In the same file, at the end of the `## Step 0` section (after "Wait for the user to say to proceed."), append:

```markdown
**Rounds.** All artifacts for this run go under `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`.
If this is a re-run (a sealed round already exists), first write
`round-<current_round>/ROUND_BRIEF.md` capturing exactly what this round must do — from the
ticket delta since the last round and/or the user's instruction — and state in Step 0 that
all prior rounds stay frozen. Every stage this round is scoped to the brief and treats prior
rounds as an immutable, already-delivered baseline. Never write outside the current round
(the sealed-round guard enforces this).
```

- [ ] **Step 3: Point the Flow's artifact paths at the current round in SKILL.md**

In the `## Flow` section, change step 1 and the stage descriptions so every artifact path is
written as `.walkthrough/<PREFIX>#[IID]/round-<current_round>/…`. Concretely, in step 1 replace:

```markdown
1. **Parse** the URL → IID + origin repo → prefix `AP`/`FE`. Create `.walkthrough/.pipeline/<PREFIX>#[IID]/`.
```

with:

```markdown
1. **Parse** the URL → IID + origin repo → prefix `AP`/`FE`. Determine `current_round` (see State & resume). Create `.walkthrough/.pipeline/<PREFIX>#[IID]/` and `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`.
```

For steps 2-10, where the text names an artifact under `.walkthrough/<PREFIX>#[IID]/`, insert
`round-<current_round>/` after the ticket folder (e.g. INVESTIGATION.md, IMPLEMENTATION_V{n}.md,
CHANGES.md, REVIEW.md, TEST_RESULTS.md, UT_*.txt, screenshots/). Pass the resolved round path to
each subagent in its prompt so the subagents write to the right place.

- [ ] **Step 4: Update the Artifact Layout section of REFERENCE.md**

In `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`, replace the `## Artifact Layout`
section body with the round-based layout:

```markdown
## Artifact Layout (project root `.walkthrough/`)

Each run is a **round**. Visible artifacts live under
`.walkthrough/<PREFIX>#[IID]/round-<N>/` (the human reads these):
- `ROUND_BRIEF.md` (round 2+: what this round must do)
- `<PREFIX>#[IID]_INVESTIGATION.md`, `<PREFIX>#[IID]_REPORT.md` (vi)
- `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`
- `<PREFIX>#[IID]_CHANGES.md`, `<PREFIX>#[IID]_REVIEW.md`, `<PREFIX>#[IID]_TEST_RESULTS.md`
- `UT_#[IID]_[YYYYMMDD]_V1.txt` (full PHPUnit run, AdminPage only)
- `screenshots/` (tester UI screenshots)

`round-1` is the initial run; each re-run opens the next round and **never modifies a prior
round**. Hidden tracking lives in `.walkthrough/.pipeline/<PREFIX>#[IID]/`
(`RAW_TICKET_DATA.json`, `TICKET_SUMMARY.md`, `pipeline-state.json` with `current_round`).

`<PREFIX>` is `AP` or `FE`, decided from the ticket URL.
```

- [ ] **Step 5: Verify the docs are internally consistent**

Run: `grep -n "round-<current_round>\|round-<N>\|current_round\|ROUND_BRIEF" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
Expected: matches in both files; the flow, state section, and layout all reference rounds.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "feat(unioss-pipeline): orchestrator round logic + round-based artifact layout"
```

---

### Task 14: Stage skills + agents write into the current round

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-plan/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-review/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md`
- Modify: `plugins/unioss-pipeline/agents/unioss-investigator.md`, `unioss-planner.md`, `unioss-reviewer.md`, `unioss-tester.md`

**Interfaces:** documentation only. Each stage receives a round path from the orchestrator (Task 13) and writes there.

- [ ] **Step 1: Make each stage skill write under the round path**

In each of the five stage `SKILL.md` files, change every output path of the form
`.walkthrough/<PREFIX>#[IID]/<file>` to `.walkthrough/<PREFIX>#[IID]/round-<N>/<file>`, and add
this sentence to each skill's intro (right after the "Read … REFERENCE.md first" line):

```markdown
Write all artifacts under the round folder the orchestrator gives you
(`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.
```

Apply to: `unioss-investigate` (INVESTIGATION.md, REPORT.md), `unioss-plan`
(IMPLEMENTATION_V{n}.md), `unioss-implement` (CHANGES.md, UT_*.txt), `unioss-review`
(REVIEW.md), `unioss-verify` (TEST_RESULTS.md, screenshots/).

- [ ] **Step 2: Tell the four subagents they receive a round path**

In each agent file (`unioss-investigator.md`, `unioss-planner.md`, `unioss-reviewer.md`,
`unioss-tester.md`), add to the inputs line:

```markdown
The orchestrator passes the round path (`.walkthrough/<PREFIX>#[IID]/round-<N>/`) in your prompt — write your artifacts there.
```

- [ ] **Step 3: Verify no stage still writes to the flat ticket folder**

Run: `grep -rnE "walkthrough/<PREFIX>#\[IID\]/[A-Za-z]" plugins/unioss-pipeline/skills/unioss-{investigate,plan,implement,review,verify}/SKILL.md`
Expected: no matches — every visible-artifact path now has `round-<N>/` between the ticket folder and the filename. (Paths under `.pipeline/` are unchanged and won't match this pattern.)

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills plugins/unioss-pipeline/agents
git commit -m "feat(unioss-pipeline): stages write artifacts into the current round"
```

---

### Task 15: README rounds section, full suite green, version bump

**Files:**
- Modify: `README.md`
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json`

**Interfaces:** none.

- [ ] **Step 1: Document rounds in the README**

In `README.md`, after the `## Configuration` section (added in Task 8), insert:

```markdown
## Re-running a ticket (rounds)

Re-running `/unioss-pipeline` on a ticket that already has outputs opens a new **round**.
The full investigate → plan → implement → review → verify process runs again, but each round
only does the work requested for it, and every prior round is frozen — nothing is overwritten.

```
.walkthrough/AP#1834/
  round-1/   first run's investigation, plan, changes, review, test results
  round-2/   a later requirement — round-1 untouched
```

Round 2+ starts from a `ROUND_BRIEF.md` describing just that round's change (from the updated
ticket and/or your instruction). All rounds share the ticket's one feature branch; later rounds
add commits on top.
```

- [ ] **Step 2: Run the entire plugin test suite**

Run: `node --test plugins/unioss-pipeline/scripts/*.test.mjs plugins/unioss-pipeline/hooks/*.test.mjs`
Expected: every test from Tasks 1, 2, 4, 10, 11, 12 PASS; 0 failures.

- [ ] **Step 3: Bump the plugin version**

In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, change `"version": "1.1.0"` to `"version": "1.2.0"`.

- [ ] **Step 4: Commit**

```bash
git add README.md plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "docs+chore(unioss-pipeline): document rounds, bump to 1.2.0"
```

---

## Self-Review — Part B (Rounds)

**Requirement coverage:**
- Re-runs are non-destructive; prior rounds frozen → round-N layout (Tasks 10, 13, 14) + sealed-round guard (Task 12). ✅
- Full A→Z process each round, scoped to the round's delta → orchestrator round logic + ROUND_BRIEF (Task 13). ✅
- "Only perform the tasks requested in round 2, round 1 unchanged" → ROUND_BRIEF scoping + freeze rule (Task 13 Step 2) + write guard (Task 12). ✅
- Continue for further requirements → `current_round` increments; latest-sealed-→-open-N+1 rule (Task 13 Step 1). ✅
- Migrations stay correct under rounds → guard searches the active ticket's latest round (Task 11). ✅
- One feature branch, cumulative commits → stated in Concepts + README (Tasks 13, 15). ✅

**Placeholder scan:** No TBD/TODO; JS steps show full code; doc steps quote exact replacement text; every step has an expected result.

**Type consistency:** `listRounds` / `latestRoundNum` / `roundDir` / `planFilesForRound` (Task 10) are consumed with those exact names in Tasks 11. `sealedRoundViolation(filePath, root)` (Task 12) matches its test. `current_round` is written by the orchestrator (Task 13) and read by `guard-rounds.mjs` (Task 12) and `guard-migrations.mjs`'s active-round lookup (Task 11) — one consistent key.

**Cross-part interaction:** Task 11 deliberately rewrites the `guard-migrations` lookup created in Task 4 — Part B is the final state of that file. Both rely on `resolveConfig().artifactRoot` (Part A, Task 1).
