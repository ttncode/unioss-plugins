# UNIOSS Pipeline Maintenance (v1.6.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship nine maintenance fixes/additions to the `unioss-pipeline` plugin: table/link rendering, gate friction, device-independent PHPUnit, tester/coder guidance, ship automation, and an API-spec generator.

**Architecture:** Node ESM scripts (`node:test`, builtins only — no deps) hold the logic; markdown skills orchestrate. Machine-specific values always resolve through `scripts/config.mjs`. Pure transform functions are unit-tested; file/network I/O sits at the CLI edge.

**Tech Stack:** Node ≥18 (global `fetch`), `node:test`, `node:assert/strict`. Plugin root: `plugins/unioss-pipeline/`. Run tests from there: `node --test`.

## Global Constraints

- Node builtins only. No `package.json`, no dependencies. ESM (`.mjs`).
- All machine-specific values (docker names, DB creds, hosts, source paths, tester URLs) resolve via `scripts/config.mjs` — never hardcode in skills.
- `GITLAB_TOKEN` is env-only: never written to a file, never committed, never printed.
- Protected branches (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`) are never committed/pushed/modified — only valid as an MR **target**.
- GitLab writes are permitted **only** inside `/unioss-ship` (push a feature branch + create a merge request). Never merge. Never POST/PUT/DELETE anywhere else, never during read-only investigation.
- `db.password` (`ProotW`) is a LOCAL dev DB password; acceptable only in the gitignored local config file.
- Reviewer severity scale: 🔴 Critical / 🟡 Violation / 🟢 Good-Style.
- Version target: `plugin.json` → `1.6.0`.
- Run all script tests from `plugins/unioss-pipeline/scripts/`: `node --test` (baseline: 33 passing before this plan).

---

### Task 1: Wide-glyph aware `displayWidth` (item 1 — table border)

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/box.mjs:6`
- Test: `plugins/unioss-pipeline/scripts/box.test.mjs`

**Interfaces:**
- Produces: `displayWidth(str: string): number` — now returns 2 per East-Asian-wide / emoji code point, 1 otherwise. `box(title, lines, width)` unchanged signature.

- [ ] **Step 1: Write the failing tests** — append to `box.test.mjs`:

```js
test('displayWidth counts emoji and no-entry sign as width 2', () => {
  assert.equal(displayWidth('🛑'), 2);
  assert.equal(displayWidth('⛔'), 2);
  assert.equal(displayWidth('🛑 GATE 1'), 9); // 2 + ' GATE 1' (7)
});

test('check mark and box glyphs stay width 1', () => {
  assert.equal(displayWidth('✓'), 1);
  assert.equal(displayWidth('·─│'), 3);
});

test('a line with a wide emoji keeps the right border aligned', () => {
  const out = box('T', ['plain row', '🛑 GATE 1 stop'], 40);
  const widths = new Set(out.split('\n').map(displayWidth));
  assert.equal(widths.size, 1);
  assert.equal([...widths][0], 43); // width + 3
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test box.test.mjs`
Expected: FAIL — `displayWidth('🛑')` returns 1, alignment set size 2.

- [ ] **Step 3: Implement wide-aware width** — in `box.mjs`, replace line 6 (`export const displayWidth = (str) => Array.from(str).length;`) with:

```js
function charWidth(cp) {
  if (
    (cp >= 0x1100 && cp <= 0x115f) ||   // Hangul Jamo
    (cp >= 0x2600 && cp <= 0x26ff) ||   // Misc symbols (⛔ U+26D4)
    (cp >= 0x2e80 && cp <= 0xa4cf) ||   // CJK & radicals … Yi
    (cp >= 0xac00 && cp <= 0xd7a3) ||   // Hangul syllables
    (cp >= 0xf900 && cp <= 0xfaff) ||   // CJK compatibility ideographs
    (cp >= 0xfe30 && cp <= 0xfe4f) ||   // CJK compatibility forms
    (cp >= 0xff00 && cp <= 0xff60) ||   // Fullwidth forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||   // Fullwidth signs
    (cp >= 0x1f000 && cp <= 0x1faff)    // Emoji & pictographs (🛑 U+1F6D1)
  ) return 2;
  return 1;
}

export const displayWidth = (str) =>
  Array.from(str).reduce((w, ch) => w + charWidth(ch.codePointAt(0)), 0);
```

Note: `✓` (U+2713) and box-drawing (U+2500–U+257F) sit outside every range above, so they stay width 1 and the existing `'✓ node' === 6` test still passes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test box.test.mjs`
Expected: PASS (old + new box tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/box.mjs plugins/unioss-pipeline/scripts/box.test.mjs
git commit -m "fix(unioss-pipeline): wide-glyph aware box width so GATE rows align (item 1)"
```

---

### Task 2: Environment-aware artifact links (item 2 — openable links)

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/link.mjs`
- Test: `plugins/unioss-pipeline/scripts/link.test.mjs`

**Interfaces:**
- Produces: `fileLink(path, { label?, cwd?, procVersion?, env? }): string`. When `env.WSL_DISTRO_NAME` is set AND `procVersion` contains `microsoft`, emits `file://wsl.localhost/<distro><absPath>`; otherwise `file://<absPath>` (today's form). `procVersion` defaults to reading `/proc/version`; `env` defaults to `process.env`.

- [ ] **Step 1: Rewrite the tests** — replace the whole body of `link.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileLink } from './link.mjs';

// Force the native branch deterministically (no WSL) by passing empty env + procVersion.
const NATIVE = { env: {}, procVersion: '' };

test('native: encodes # as %23, resolves absolute, default label is basename', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md', { cwd: '/ws', ...NATIVE });
  assert.equal(out, '[AP#1583_REVIEW.md](file:///ws/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)');
});

test('native: no bare # remains in the url portion', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/', { cwd: '/ws', ...NATIVE });
  const url = out.slice(out.indexOf('(') + 1, -1);
  assert.ok(!url.includes('#'));
  assert.match(url, /%23/);
});

test('native: custom label is used verbatim', () => {
  const out = fileLink('/abs/UT_#1583_20260709_V1.txt', { label: 'full test run', ...NATIVE });
  assert.equal(out, '[full test run](file:///abs/UT_%231583_20260709_V1.txt)');
});

test('native: spaces encode to %20', () => {
  const out = fileLink('/abs/my file.md', { ...NATIVE });
  assert.match(out, /file:\/\/\/abs\/my%20file\.md/);
});

test('wsl: emits file://wsl.localhost/<distro> when under WSL', () => {
  const out = fileLink('/home/ttndev/ws/.walkthrough/AP#1/round-1/x.md', {
    cwd: '/home/ttndev/ws',
    env: { WSL_DISTRO_NAME: 'Ubuntu' },
    procVersion: 'Linux version 5.15 microsoft-standard-WSL2',
  });
  assert.equal(out, '[x.md](file://wsl.localhost/Ubuntu/home/ttndev/ws/.walkthrough/AP%231/round-1/x.md)');
});

test('wsl: not triggered when procVersion lacks microsoft even if distro var set', () => {
  const out = fileLink('/a/b.md', { cwd: '/a', env: { WSL_DISTRO_NAME: 'Ubuntu' }, procVersion: 'Linux generic' });
  assert.equal(out, '[b.md](file:///a/b.md)');
});
```

- [ ] **Step 2: Run tests to verify the WSL ones fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test link.test.mjs`
Expected: FAIL on the two `wsl:` tests (current code ignores env/procVersion).

- [ ] **Step 3: Implement env detection** — replace the whole body of `link.mjs` with:

```js
#!/usr/bin/env node
// Emit a clickable file:// markdown link for a pipeline artifact path.
// The bare '#' in ticket dirs (AP#1583) breaks terminal linkifiers, so encode it.
// Under WSL, emit a file://wsl.localhost/<distro> URL a Windows-side IDE can open.
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

function readProcVersion() {
  try { return readFileSync('/proc/version', 'utf8'); } catch { return ''; }
}

function wslDistro(procVersion, env) {
  return (/microsoft/i.test(procVersion) && env.WSL_DISTRO_NAME) ? env.WSL_DISTRO_NAME : null;
}

export function fileLink(path, { label, cwd = process.cwd(), procVersion, env = process.env } = {}) {
  const abs = resolve(cwd, path);
  // encodeURI leaves '/' intact and encodes spaces; it does NOT encode '#', so do that explicitly.
  const encoded = encodeURI(abs).replace(/#/g, '%23');
  const text = label ?? basename(path.replace(/\/+$/, '')) ?? abs;
  const distro = wslDistro(procVersion ?? readProcVersion(), env);
  const url = distro ? `file://wsl.localhost/${distro}${encoded}` : `file://${encoded}`;
  return `[${text}](${url})`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [path, label] = process.argv.slice(2);
  if (!path) { process.stderr.write('Usage: link.mjs <path> [label]\n'); process.exit(1); }
  process.stdout.write(fileLink(path, label ? { label } : {}) + '\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test link.test.mjs`
Expected: PASS (all native + WSL tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/link.mjs plugins/unioss-pipeline/scripts/link.test.mjs
git commit -m "fix(unioss-pipeline): emit wsl.localhost file links so any host IDE can open them (item 2)"
```

---

### Task 3: `tester` config block + `US_TESTER_*` env (item 6 — config side)

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.mjs` (DEFAULTS, buildEnv, runCheck)
- Test: `plugins/unioss-pipeline/scripts/config.test.mjs`

**Interfaces:**
- Produces: `resolveConfig().tester = { mailhog, ecsiteLogin }`; `buildEnv()` emits `US_TESTER_MAILHOG`, `US_TESTER_ECSITE_LOGIN`.

- [ ] **Step 1: Write the failing tests** — append to `config.test.mjs`:

```js
test('tester block defaults resolve', () => {
  const c = resolveConfig('/tmp/ws-tester');
  assert.equal(c.tester.mailhog, 'http://localhost:8225');
  assert.equal(c.tester.ecsiteLogin, 'http://localhost:2380/storetax/login');
});

test('buildEnv exports US_TESTER_* vars', () => {
  const env = buildEnv('/tmp/ws-tester');
  assert.match(env, /US_TESTER_MAILHOG='http:\/\/localhost:8225'/);
  assert.match(env, /US_TESTER_ECSITE_LOGIN='http:\/\/localhost:2380\/storetax\/login'/);
});
```

Confirm `resolveConfig` and `buildEnv` are imported at the top of `config.test.mjs`; add them to the existing import if missing.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test config.test.mjs`
Expected: FAIL — `c.tester` is undefined.

- [ ] **Step 3: Add the tester block** — in `config.mjs` DEFAULTS, insert after the `source: { … }` block and before `artifactRoot`:

```js
  tester: {
    mailhog: 'http://localhost:8225',
    ecsiteLogin: 'http://localhost:2380/storetax/login',
  },
```

In `buildEnv`, add these two lines to the returned array (after the `US_SRC_ROOT` line, before `...srcLines`):

```js
    `US_TESTER_MAILHOG=${sq(c.tester.mailhog)}`,
    `US_TESTER_ECSITE_LOGIN=${sq(c.tester.ecsiteLogin)}`,
```

In `runCheck`, after the `artifactRoot` check add:

```js
  if (!isStr(c.tester.mailhog) || !isStr(c.tester.ecsiteLogin)) errors.push('tester.mailhog/ecsiteLogin must be non-empty strings');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test config.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config.test.mjs
git commit -m "feat(unioss-pipeline): add tester.mailhog/ecsiteLogin config + US_TESTER_* env (item 6)"
```

---

### Task 4: `phpunit-config.mjs` — stash-free test config (item 5)

**Files:**
- Create: `plugins/unioss-pipeline/scripts/phpunit-config.mjs`
- Test: `plugins/unioss-pipeline/scripts/phpunit-config.test.mjs`

**Interfaces:**
- Produces (pure transforms, each takes file content + returns new content):
  - `applyDatabasePhp(content, { mysql, user, pass }): string`
  - `applyStartedSubscriber(content, { mysql, user, pass, skipImport }): string`
  - `applyConfigPhp(content): string`
  - `applyPhpunitXml(content): string`
- CLI: `phpunit-config.mjs apply [--import|--skip-import]` (default `--skip-import`) and `phpunit-config.mjs restore`.

- [ ] **Step 1: Write the failing tests** — create `phpunit-config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDatabasePhp, applyStartedSubscriber, applyConfigPhp, applyPhpunitXml,
} from './phpunit-config.mjs';

const CREDS = { mysql: 'mysql-unioss3', user: 'root', pass: 'ProotW' };

test('applyDatabasePhp rewrites hostname/username/password to config values', () => {
  const base = [
    "$db['default'] = array(",
    "\t'dsn'\t=> '',",
    "\t'hostname' => $_SERVER['DEV_MYSQL_HOST'] ?? '127.0.0.1',",
    "\t'username' => $_SERVER['DEV_MYSQL_USER'] ?? 'unioss',",
    "\t'password' => $_SERVER['DEV_MYSQL_PASS'] ?? 'testPassWord',",
    "\t'database' => 'testing_DB',",
    ');',
  ].join('\n');
  const out = applyDatabasePhp(base, CREDS);
  assert.match(out, /'hostname' => 'mysql-unioss3',/);
  assert.match(out, /'username' => 'root',/);
  assert.match(out, /'password' => 'ProotW',/);
  assert.match(out, /'database' => 'testing_DB',/); // untouched
});

test('applyDatabasePhp is idempotent', () => {
  const base = "\t'hostname' => '127.0.0.1',\n\t'username' => 'x',\n\t'password' => 'y',";
  const once = applyDatabasePhp(base, CREDS);
  assert.equal(applyDatabasePhp(once, CREDS), once);
});

test('applyStartedSubscriber (skipImport) comments the exec line with config creds', () => {
  const base = '        exec("mysql $mysql_host -u $username -p$password < " . $db_dump_dir, $output, $retval);';
  const out = applyStartedSubscriber(base, { ...CREDS, skipImport: true });
  assert.match(out, /^\s*\/\/ exec\('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' \. \$db_dump_dir, \$output, \$retval\);/m);
});

test('applyStartedSubscriber (import) leaves the exec line active', () => {
  const base = "        // exec('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' . $db_dump_dir, $output, $retval);";
  const out = applyStartedSubscriber(base, { ...CREDS, skipImport: false });
  assert.match(out, /^\s*exec\('mysql --ssl=0 -hmysql-unioss3 -P3306 -uroot -pProotW < ' \. \$db_dump_dir, \$output, \$retval\);/m);
  assert.ok(!/\/\/ exec\(/.test(out));
});

test('applyConfigPhp adds HTTP_HOST before base_url and composer_autoload once', () => {
  const base = [
    '$config[\'base_url\'] = $http_or_https . \'://\'.$_SERVER["HTTP_HOST"];',
    '$config[\'log_path\'] = APPPATH.\'logs/testing/\';',
  ].join('\n');
  const out = applyConfigPhp(base);
  assert.match(out, /\$_SERVER\["HTTP_HOST"\] = 'localhost:2380\/admin';\n\$config\['base_url'\]/);
  assert.match(out, /\$config\['composer_autoload'\] = realpath\(APPPATH \. '\.\.\/\.\.\/my-vendor\/vendor\/autoload\.php'\);/);
  assert.equal(applyConfigPhp(out), out); // idempotent
});

test('applyPhpunitXml replaces the <php> block with the testing env', () => {
  const base = "<logging></logging>\n\t<php>\n        <server name='HTTP_HOST' value='192.168.56.10' />\n\t\t<ini name=\"memory_limit\" value=\"2048M\"/>\n    </php>\n\t<!-- x -->";
  const out = applyPhpunitXml(base);
  assert.match(out, /<server name='CI_ENV' value='testing' \/>/);
  assert.match(out, /<env name="ENVIRONMENT" value="testing" \/>/);
  assert.match(out, /<server name='HTTP_HOST' value='127\.0\.0\.1' \/>/);
  assert.equal((out.match(/<php>/g) || []).length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test phpunit-config.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `phpunit-config.mjs`** — create the file:

```js
#!/usr/bin/env node
// Device-independent PHPUnit test config for AdminPage — replaces the manual
// 'git stash apply' step. `apply` writes machine-specific values from config.mjs
// into the four testing-config files; `restore` reverts them via git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';

const FILES = {
  database: 'application/config/testing/database.php',
  subscriber: 'application/tests/StartedSubscriberImpl.php',
  config: 'application/config/testing/config.php',
  phpunit: 'application/tests/phpunit.xml',
};

export function applyDatabasePhp(content, { mysql, user, pass }) {
  return content
    .replace(/('hostname'\s*=>\s*)[^,]+,/, `$1'${mysql}',`)
    .replace(/('username'\s*=>\s*)[^,]+,/, `$1'${user}',`)
    .replace(/('password'\s*=>\s*)[^,]+,/, `$1'${pass}',`);
}

export function applyStartedSubscriber(content, { mysql, user, pass, skipImport }) {
  const body = `exec('mysql --ssl=0 -h${mysql} -P3306 -u${user} -p${pass} < ' . $db_dump_dir, $output, $retval);`;
  const line = '        ' + (skipImport ? '// ' : '') + body;
  // Match the existing exec line whether commented or not.
  return content.replace(/^[ \t]*\/\/[ \t]*exec\(.*\$db_dump_dir.*\);|^[ \t]*exec\(.*\$db_dump_dir.*\);/m, line);
}

export function applyConfigPhp(content) {
  let out = content;
  if (!out.includes('$_SERVER["HTTP_HOST"] = \'localhost:2380/admin\';')) {
    out = out.replace(
      /(\$config\['base_url'\] = \$http_or_https)/,
      "$_SERVER[\"HTTP_HOST\"] = 'localhost:2380/admin';\n$1",
    );
  }
  if (!out.includes("$config['composer_autoload']")) {
    out = out.replace(/\s*$/, '') +
      "\n\n$config['composer_autoload'] = realpath(APPPATH . '../../my-vendor/vendor/autoload.php');\n";
  }
  return out;
}

const PHP_BLOCK = [
  '\t<php>',
  "\t\t<server name='HTTP_HOST' value='127.0.0.1' />",
  "\t\t<server name='CI_ENV' value='testing' />",
  '\t\t<env name="ENVIRONMENT" value="testing" />',
  '\t\t<ini name="memory_limit" value="2048M" />',
  '\t</php>',
].join('\n');

export function applyPhpunitXml(content) {
  return content.replace(/[ \t]*<php>[\s\S]*?<\/php>/, PHP_BLOCK);
}

function adminPageDir(cwd) {
  const c = resolveConfig(cwd);
  return join(c.source.root, c.repos.adminPage.path);
}

function runApply(cwd, skipImport) {
  const c = resolveConfig(cwd);
  const creds = { mysql: c.docker.mysql, user: c.db.user, pass: c.db.password };
  const dir = adminPageDir(cwd);
  const rw = (rel, fn) => {
    const p = join(dir, rel);
    writeFileSync(p, fn(readFileSync(p, 'utf8')));
  };
  rw(FILES.database, (t) => applyDatabasePhp(t, creds));
  rw(FILES.subscriber, (t) => applyStartedSubscriber(t, { ...creds, skipImport }));
  rw(FILES.config, applyConfigPhp);
  rw(FILES.phpunit, applyPhpunitXml);
}

function runRestore(cwd) {
  const dir = adminPageDir(cwd);
  execSync(`git checkout -- ${Object.values(FILES).join(' ')}`, { cwd: dir, stdio: 'inherit' });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, flag] = process.argv.slice(2);
  if (cmd === 'apply') { runApply(process.cwd(), flag !== '--import'); process.stdout.write('phpunit-config applied\n'); }
  else if (cmd === 'restore') { runRestore(process.cwd()); process.stdout.write('phpunit-config restored\n'); }
  else { process.stderr.write('Usage: phpunit-config.mjs <apply [--import|--skip-import]|restore>\n'); process.exit(1); }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test phpunit-config.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/phpunit-config.mjs plugins/unioss-pipeline/scripts/phpunit-config.test.mjs
git commit -m "feat(unioss-pipeline): device-independent phpunit-config apply/restore (item 5)"
```

---

### Task 5: `ship.mjs` create mode — MR payload + create (item 8 — script)

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/ship.mjs`
- Test: `plugins/unioss-pipeline/scripts/ship.test.mjs`

**Interfaces:**
- Produces:
  - `mrCreatePayload({ sourceBranch, targetBranch, title, assigneeId, reviewerId, label, removeSourceBranch, squash }): object` — GitLab MR POST body.
  - `repoRef(cwd, repoKey): { id, webPath }` — maps `'adminPage'|'frontEnd'` to project id + `<namespace>/<Repo>` web path.
  - CLI `ship.mjs create <staging|customer> <adminPage|frontEnd> <branch> <title>` — resolves user ids (`GET /users`), POSTs the MR, prints `web_url`. Never merges.

- [ ] **Step 1: Write the failing tests** — append to `ship.test.mjs`:

```js
import { mrCreatePayload, repoRef } from './ship.mjs';

test('mrCreatePayload maps ids, label and options into the POST body', () => {
  const body = mrCreatePayload({
    sourceBranch: 'feature/v3/#1584', targetBranch: 'v3-develop-tps', title: '#1584 - Do the thing',
    assigneeId: 7, reviewerId: 9, label: 'UNIOSS 3', removeSourceBranch: false, squash: false,
  });
  assert.deepEqual(body, {
    source_branch: 'feature/v3/#1584',
    target_branch: 'v3-develop-tps',
    title: '#1584 - Do the thing',
    assignee_ids: [7],
    reviewer_ids: [9],
    labels: 'UNIOSS 3',
    remove_source_branch: false,
    squash: false,
  });
});

test('mrCreatePayload emits empty id arrays when a user is unresolved', () => {
  const body = mrCreatePayload({ sourceBranch: 'b', targetBranch: 't', title: 'x' });
  assert.deepEqual(body.assignee_ids, []);
  assert.deepEqual(body.reviewer_ids, []);
});

test('repoRef maps repo keys to project id + web path', () => {
  assert.deepEqual(repoRef(process.cwd(), 'adminPage'), { id: 32, webPath: 'unioss/AdminPage' });
  assert.deepEqual(repoRef(process.cwd(), 'frontEnd'), { id: 31, webPath: 'unioss/FrontEnd' });
});

test('repoRef throws on unknown repo key', () => {
  assert.throws(() => repoRef(process.cwd(), 'nope'), /Unknown repo key/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test ship.test.mjs`
Expected: FAIL — `mrCreatePayload`/`repoRef` not exported.

- [ ] **Step 3: Implement create mode** — in `ship.mjs`, after the `shipInfo` function add:

```js
export function mrCreatePayload({ sourceBranch, targetBranch, title, assigneeId, reviewerId, label, removeSourceBranch, squash }) {
  return {
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title,
    assignee_ids: assigneeId ? [assigneeId] : [],
    reviewer_ids: reviewerId ? [reviewerId] : [],
    labels: label ?? '',
    remove_source_branch: !!removeSourceBranch,
    squash: !!squash,
  };
}

const REPO_WEB = { adminPage: 'unioss/AdminPage', frontEnd: 'unioss/FrontEnd' };

export function repoRef(cwd, repoKey) {
  const cfg = resolveConfig(cwd);
  const repo = cfg.repos[repoKey];
  if (!repo || !REPO_WEB[repoKey]) throw new Error(`Unknown repo key: ${repoKey} (use adminPage|frontEnd)`);
  return { id: repo.id, webPath: REPO_WEB[repoKey] };
}

async function gitlabUserId(host, token, username) {
  const res = await fetch(`https://${host}/api/v4/users?username=${encodeURIComponent(username)}`, {
    headers: { 'PRIVATE-TOKEN': token },
  });
  if (!res.ok) throw new Error(`GitLab user lookup failed for ${username}: HTTP ${res.status}`);
  const users = await res.json();
  return users[0]?.id ?? null;
}

async function createMr({ cwd = process.cwd(), mode, repoKey, sourceBranch, title }) {
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN is not set (needs `api` scope to create an MR)');
  if (!MODES.has(mode)) throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
  const cfg = resolveConfig(cwd);
  const m = cfg.ship[mode];
  const { id, webPath } = repoRef(cwd, repoKey);
  const [assigneeId, reviewerId] = await Promise.all([
    gitlabUserId(cfg.gitlab.host, token, cfg.ship.assignee),
    gitlabUserId(cfg.gitlab.host, token, m.reviewer),
  ]);
  const payload = mrCreatePayload({
    sourceBranch, targetBranch: m.targetBranch, title,
    assigneeId, reviewerId, label: cfg.ship.label,
    removeSourceBranch: m.deleteSourceBranch, squash: m.squash,
  });
  const res = await fetch(`https://${cfg.gitlab.host}/api/v4/projects/${id}/merge_requests`, {
    method: 'POST',
    headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`MR create failed: HTTP ${res.status} — ${await res.text()}`);
  const mr = await res.json();
  return { webUrl: mr.web_url, webPath };
}
```

Then extend the CLI dispatch at the bottom. Replace the existing `if (isMain) { … }` block with:

```js
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === 'create') {
    const [, mode, repoKey, sourceBranch, ...titleParts] = args;
    if (!mode || !repoKey || !sourceBranch || titleParts.length === 0) {
      process.stderr.write('Usage: ship.mjs create <staging|customer> <adminPage|frontEnd> <branch> <title...>\n');
      process.exit(1);
    }
    createMr({ mode, repoKey, sourceBranch, title: titleParts.join(' ') })
      .then(({ webUrl }) => process.stdout.write(`MR created (not merged):\n  ${webUrl}\n`))
      .catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
  } else {
    const [mode, repoWebPath, sourceBranch] = args;
    if (!mode || !repoWebPath || !sourceBranch) {
      process.stderr.write('Usage: ship.mjs <staging|customer> <repoWebPath> <sourceBranch>\n');
      process.exit(1);
    }
    const { url, settings } = shipInfo({ mode, repoWebPath, sourceBranch });
    process.stdout.write(`Open MR (click to create):\n  ${url}\n\nThen set on the MR page:\n${renderSettings(settings)}\n`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test ship.test.mjs`
Expected: PASS (old shipInfo/mrUrl tests + 4 new).

- [ ] **Step 5: Run the full script suite (regression gate)**

Run: `cd plugins/unioss-pipeline/scripts && node --test`
Expected: PASS — all files green (baseline 33 + new cases).

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/scripts/ship.mjs plugins/unioss-pipeline/scripts/ship.test.mjs
git commit -m "feat(unioss-pipeline): ship.mjs create-MR mode (push + POST, never merge) (item 8)"
```

---

### Task 6: GATE 3 auto-continue on clean review (item 3)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` (Flow step 10, stage table GATE 3 row, Rules line)

**Interfaces:** Consumes reviewer return counts (🔴/🟡/🟢) from step 9.

- [ ] **Step 1: Update Flow step 10** — replace the current step 10 block:

```markdown
10. **GATE 3 — Review fix/accept.** Present findings by severity.
   - **fix** → invoke `unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 9.
   - **accept** → (AdminPage) invoke `unioss-implement` full mode: uncomment the dump-import line, run the full suite → `.walkthrough/<PREFIX>#[IID]/round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.
```

with:

```markdown
10. **GATE 3 — Review fix/accept.**
   - **Clean review (🔴 0 and 🟡 0)** → do NOT stop. Print `GATE 3 auto-passed (clean review: 0 Critical, 0 Violation)` plus any 🟢 notes, then proceed straight to the accept path below.
   - **Any 🔴 or 🟡** → stop and present findings by severity:
     - **fix** → invoke `unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 9.
     - **accept** → proceed to the accept path below.
   - **Accept path** → (AdminPage) invoke `unioss-implement` full mode: run the full suite with a fresh DB → `.walkthrough/<PREFIX>#[IID]/round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.
```

- [ ] **Step 2: Update the stage-table GATE 3 row** — replace:

```markdown
│ 🛑 GATE 3   │ you                  │ fix (loop) or accept (→ full PHPUnit → UT_#[IID]_…)          │
```

with:

```markdown
│ 🛑 GATE 3   │ you (auto if clean)  │ 🔴0/🟡0 → auto-accept; else fix (loop) or accept            │
```

- [ ] **Step 3: Update the Rules gate line** — replace:

```markdown
- Honor the gates — never run past Step 0, GATE 1, GATE 2, or GATE 3 without an explicit user decision.
```

with:

```markdown
- Honor the gates — never run past Step 0, GATE 1, or GATE 2 without an explicit user decision. GATE 3 auto-passes ONLY on a clean review (🔴 0 and 🟡 0); any 🔴/🟡 still requires an explicit user decision.
```

- [ ] **Step 4: Verify the edits landed**

Run: `grep -n "auto-passed\|auto if clean\|GATE 3 auto-passes" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md`
Expected: three matches (one per edit).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md
git commit -m "feat(unioss-pipeline): auto-continue GATE 3 on a clean review (item 3)"
```

---

### Task 7: Submodule pointer — no bump commit (item 4)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` (Submodules section, step 4 + closing line)
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md:19` (common-code paragraph)
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` (Finalize step 12)

- [ ] **Step 1: REFERENCE — rewrite submodule step 4 + the closing pointer line.** Replace:

```markdown
4. In each consuming app that needs the change, cd into the consuming path (`application/models/common` or `application/helpers/common`) and run `git fetch origin && git checkout feature/v3/[ORIGIN]#[IID] && git pull` — this moves the app's submodule pointer to the updated branch.

Only common-submodule feature branches are pushed; AdminPage/FrontEnd app branches are committed locally only (no push, no MR).
```

with:

```markdown
4. In each consuming app that needs the change, cd into the consuming path (`application/models/common` or `application/helpers/common`) and run `git fetch origin && git checkout feature/v3/[ORIGIN]#[IID] && git pull` — this moves the app's submodule pointer in the **working tree only**.

**Do not commit or push the pointer bump** in AdminPage/FrontEnd — do not `git add` the submodule gitlink, do not commit it, do not push the app repo for the pointer change. The pushed submodule branch alone carries the common-code change; whoever merges wires the pointer.

Only common-submodule feature branches are pushed; AdminPage/FrontEnd app branches are committed locally only (no push, no MR) and their commits **exclude the submodule gitlink**.
```

- [ ] **Step 2: `unioss-implement` line 19 — append the no-commit rule.** Replace the trailing clause `… to move the pointer.` at the end of the common-code paragraph with:

```markdown
… to move the pointer **in the working tree only — never `git add`/commit/push the pointer bump in the app repo**.
```

- [ ] **Step 3: `unioss-pipeline` Finalize (step 12) — state the gitlink exclusion.** In step 12, replace `common-models/common-helper submodule branches are pushed and the consuming apps' pointers updated.` with:

```markdown
common-models/common-helper submodule branches are pushed; consuming apps' pointers move in the working tree but the app commit **excludes the submodule gitlink** (never commit or push the pointer bump).
```

- [ ] **Step 4: Verify**

Run: `grep -rn "excludes the submodule gitlink\|working tree only" plugins/unioss-pipeline/skills`
Expected: matches in REFERENCE.md, unioss-implement/SKILL.md, unioss-pipeline/SKILL.md.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md plugins/unioss-pipeline/skills/unioss-implement/SKILL.md plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md
git commit -m "fix(unioss-pipeline): never commit the submodule pointer bump in app repos (item 4)"
```

---

### Task 8: PHPUnit skills use `phpunit-config` (item 5 — skill side)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md` (Run Commands: Fast mode + Full mode)
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md` (Step 2 + Step 5)

Depends on Task 4 (`phpunit-config.mjs` exists).

- [ ] **Step 1: Replace Fast mode in `unioss-phpunit-test`.** Replace the whole `### Fast mode — only new/modified tests` block (its numbered steps 1–3) with:

````markdown
### Fast mode — only new/modified tests
1. Apply the device-independent test config (no git stash needed), skipping the slow dump import:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" apply --skip-import
   ```
2. Run only the target test(s):
   ```bash
   eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
   docker exec -i "$US_PHP" sh -lc "cd /var/www/html/AdminPage && ./vendor/phpunit/phpunit/phpunit -c application/tests/phpunit.xml --filter '<test_classname>' --testdox"
   # one method:  --filter '<test_classname>::<test_method>'
   # several:     --filter '<test_classname>::<m1>|<m2>'
   ```
3. When done iterating, restore the repo: `node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" restore`.
````

- [ ] **Step 2: Replace Full mode in `unioss-phpunit-test`.** Replace the whole `### Full mode — all tests with a fresh DB (on GATE 3 accept)` block with:

````markdown
### Full mode — all tests with a fresh DB (on GATE 3 accept)
1. Apply the test config with the dump import enabled (fresh DB):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" apply --import
   ```
2. Run the whole suite and save the report:
   ```bash
   eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
   docker exec -i "$US_PHP" sh -lc "cd /var/www/html/AdminPage && ./vendor/phpunit/phpunit/phpunit -c application/tests/phpunit.xml --testdox" > .walkthrough/<PREFIX>#[IID]/UT_#[IID]_[YYYYMMDD]_V1.txt
   ```
3. Restore the repo when finished: `node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" restore`.
````

- [ ] **Step 3: Update `unioss-implement` Step 2.** Replace the Step 2 body:

```markdown
Write/modify tests for the changed logic, then **fast mode** from `unioss-phpunit-test` `## Run Commands`: apply the `PHPUnit config` stash, comment out the dump-import line in `StartedSubscriberImpl.php`, run only the new/modified tests until green. (FrontEnd: skip — no unit tests.)
```

with:

```markdown
Write/modify tests for the changed logic, then **fast mode** from `unioss-phpunit-test` `## Run Commands`: run `phpunit-config.mjs apply --skip-import`, run only the new/modified tests until green, then `phpunit-config.mjs restore`. (FrontEnd: skip — no unit tests.)
```

- [ ] **Step 4: Update `unioss-implement` Step 5.** Replace the Step 5 body:

```markdown
Switch to **full mode**: uncomment the dump-import line (fresh DB), run the full suite, save output to `.walkthrough/<PREFIX>#[IID]/round-<N>/UT_#[IID]_[YYYYMMDD]_V1.txt`.
```

with:

```markdown
Switch to **full mode**: `phpunit-config.mjs apply --import` (fresh DB), run the full suite, save output to `.walkthrough/<PREFIX>#[IID]/round-<N>/UT_#[IID]_[YYYYMMDD]_V1.txt`, then `phpunit-config.mjs restore`.
```

- [ ] **Step 5: Verify no stale stash references remain**

Run: `grep -rn "git stash\|stash@\|PHPUnit config stash" plugins/unioss-pipeline/skills`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md plugins/unioss-pipeline/skills/unioss-implement/SKILL.md
git commit -m "refactor(unioss-pipeline): drive PHPUnit config via phpunit-config.mjs, drop the stash (item 5)"
```

---

### Task 9: Migration verify guide + coder step (item 7)

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-implement/migration-verify.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md` (new step after Step 1)

- [ ] **Step 1: Create `migration-verify.md`** with the guide (verbatim content the user supplied):

```markdown
---
name: migration up/down verify (multi-environment)
---

# Migration Up/Down Verify Guide (multi-environment)

## 1. Identify current/target environment

ENVIRONMENT is set in `AdminPage/public/index.php:56`:
`define('ENVIRONMENT', isset($_SERVER['CI_ENV']) ? $_SERVER['CI_ENV'] : 'development');`
No `CI_ENV` is set anywhere in this repo's docker-compose.yml / nginx config, so local docker (localhost:2380) is always `development`.

For any other target (staging box, production box, virtualbox_direct_domain, etc.) `CI_ENV` is injected at that host's webserver/php-fpm level (outside this repo). To confirm the live value on a given host:
- Ask infra/DevOps what `CI_ENV` that vhost sets, or
- Temporarily add `echo ENVIRONMENT; exit;` right after the `define(...)` line in `AdminPage/public/index.php`, hit any URL on that host, read the value, then immediately revert the line — never commit this debug line.

## 2. Confirm the target environment has a migrations folder

Only these environments have a `migrations/{ENV}/` directory (CI errors if missing):
`development`, `testing`, `staging`, `production`, `virtualbox_direct_domain`.
(`demo`, `sample`, `virtualbox`, `virtualbox20head`, `virtualbox_fusion` have config only — do not attempt migrate there.)

- Config file to edit: `AdminPage/application/config/{ENV}/migration.php`
- Migration files: `AdminPage/application/migrations/{ENV}/`
- Endpoint: `http://{target-host}/admin/migrate` (same Migrate controller for every environment).

`migration_enabled = TRUE` is already confirmed for development/staging/production/virtualbox_direct_domain.

## 3. Before touching staging/production/virtualbox: check what up() AND down() destroy

Read both methods together and ask:
1. Does `up()` delete/modify pre-existing data (rows/columns/tables that existed before this migration)?
2. Does `down()` actually restore it, or is it a no-op / partial restore?

| up() touches pre-existing data? | down() restores it? | Verdict |
| --- | --- | --- |
| No (only creates new table/column) | drops only what up() created | Safe — nothing pre-existing at risk |
| Yes (DELETE/UPDATE/DROP on existing data) | Yes, fully | Confirm before running (risk if down() is buggy) |
| Yes (DELETE/UPDATE/DROP on existing data) | No / no-op | Irreversible — confirm before running up() itself, not just down |

Example, irreversible case (`20260608090246_delete_duplicated_asct_records_a1798_241.php`):
`public function up() { /* DELETE FROM ascts ... duplicate rows, real data */ }`
`public function down() { echo "..."; return true; }  // does NOT restore deleted rows`
Running up() on staging/production here permanently removes those `ascts` rows — down() gives no way back.

**Rule:** STOP and ask the user for explicit go-ahead before running up() OR down() whenever either one destroys data that existed before the migration and the other side can't restore it. Say plainly what's deleted, on which table, on which environment, whether it's recoverable, and wait for confirmation. Pure create-then-drop cases (nothing pre-existing touched) can proceed without asking.

## 4. Run the verify (per-environment)

1. Note the new migration's timestamp and the previous active timestamp in that env's `migration.php`.
2. Up: set `migration_version` to the new timestamp → hit `/admin/migrate` → confirm before/after version.
3. Down (only after user confirms, see step 3): set `migration_version` back to the previous timestamp → hit `/admin/migrate` → confirm before/after version + DB reverted.
4. Restore `migration_version` to the latest timestamp, reload once more, confirm the re-up is clean.
5. On dev, config edits can stay local/throwaway. On staging/production, treat the config edit itself as a deploy action — confirm with the user whether it should be committed/deployed or reverted after the test.
```

- [ ] **Step 2: Add a migration-verify step to `unioss-implement`** — insert immediately after `## Step 1 — Apply the approved plan`:

```markdown
## Step 1b — Verify the migration (only if the plan added one)
If the approved plan added a migration, verify it per `migration-verify.md` (this skill dir): on `development` by default, run up → down → re-up and confirm the version + DB effect at each step. **STOP and ask the user for explicit go-ahead before running `up()` or `down()`** whenever either destroys data that existed before the migration and the other side can't restore it (name the table, environment, and recoverability). Pure create-then-drop migrations proceed without asking.
```

- [ ] **Step 3: Verify**

Run: `grep -n "Step 1b — Verify the migration" plugins/unioss-pipeline/skills/unioss-implement/SKILL.md && test -f plugins/unioss-pipeline/skills/unioss-implement/migration-verify.md && echo OK`
Expected: the grep match + `OK`.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-implement/migration-verify.md plugins/unioss-pipeline/skills/unioss-implement/SKILL.md
git commit -m "feat(unioss-pipeline): coder verifies migrations up/down with a destructive-data stop (item 7)"
```

---

### Task 10: `/unioss-ship` push + create MR + scoped write policy (item 8 — skill/docs)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-ship/SKILL.md` (staging + customer modes, Rules)
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` (GitLab section — scoped-write exception)
- Modify: `plugins/unioss-pipeline/scripts/doctor.mjs` (GITLAB_TOKEN fix hint mentions `api` scope)

Depends on Task 5 (`ship.mjs create`).

- [ ] **Step 1: REFERENCE GitLab rule — scope the exception.** Replace:

```markdown
- ⛔ Never POST/PUT/DELETE. Never print the token.
```

with:

```markdown
- ⛔ Read-only everywhere EXCEPT `/unioss-ship`: never POST/PUT/DELETE during investigation or any read stage. The **only** permitted GitLab writes are inside `/unioss-ship` — push a feature branch and create a merge request (`POST …/merge_requests`). Never merge. Never print the token. MR creation needs `GITLAB_TOKEN` to carry the `api` scope (read stages need only `read_api`).
```

- [ ] **Step 2: Ship staging mode — push reliably, then create the MR.** Replace staging steps 2–3 with:

````markdown
2. For each touched repo, create the MR via the GitLab API (never merges); the title is the ticket commit subject `#[IID] - [Message]`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" create staging <adminPage|frontEnd> "<branch>" "#[IID] - <subject>"
   ```
   If the create fails (token lacks `api` scope, or you decline the write), fall back to the printed pre-filled URL + manual settings:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" staging <repoWebPath> "<branch>"
   ```
3. Present the created MR URL(s) (or the fallback links). Creation sets assignee/reviewer/label/options from config; **merge stays a human action**. STOP.
````

- [ ] **Step 3: Ship customer mode — same create step.** Replace customer step 4 with:

````markdown
4. For each touched repo, create the MR via the API targeting `v3-develop` (never merges):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" create customer <adminPage|frontEnd> "<branch>" "#[IID] - <subject>"
   ```
   Fallback on failure: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" customer <repoWebPath> "<branch>"` (prints the pre-filled URL + settings).
````

- [ ] **Step 4: Ship Rules — note the push is expected + the scoped write.** Replace:

```markdown
- Never merge, never POST to GitLab, never touch a protected branch except as an MR **target**.
```

with:

```markdown
- Pushing the feature branch and creating the MR (`ship.mjs create`) are the two permitted GitLab writes — perform them. The push is a required network operation; if the environment blocks it, tell the user and retry rather than skipping. **Never merge**, never write any other GitLab endpoint, never touch a protected branch except as an MR **target**.
```

- [ ] **Step 5: doctor.mjs — mention the `api` scope in the token fix hint.** In `doctor.mjs`, replace the `GITLAB_TOKEN` check's `fix`:

```js
  { name: 'GITLAB_TOKEN', ok: !!process.env.GITLAB_TOKEN, fix: isWin ? 'setx GITLAB_TOKEN <your-token>' : 'export GITLAB_TOKEN=<your-token>  (add to your shell profile)' },
```

with:

```js
  { name: 'GITLAB_TOKEN', ok: !!process.env.GITLAB_TOKEN, fix: (isWin ? 'setx GITLAB_TOKEN <your-token>' : 'export GITLAB_TOKEN=<your-token>  (add to your shell profile)') + '  — needs `api` scope for /unioss-ship MR creation' },
```

- [ ] **Step 6: Verify**

Run: `grep -n "api. scope\|ship.mjs\" create\|create staging\|create customer" plugins/unioss-pipeline/skills/unioss-ship/SKILL.md; node --check plugins/unioss-pipeline/scripts/doctor.mjs && echo DOCTOR_OK`
Expected: ship create references present + `DOCTOR_OK`.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-ship/SKILL.md plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md plugins/unioss-pipeline/scripts/doctor.mjs
git commit -m "feat(unioss-pipeline): /unioss-ship pushes + creates the MR via API, scoped write policy (item 8)"
```

---

### Task 11: Tester access — Mailhog + ECSite login (item 6 — docs)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/tester-access.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` (MCP/tester section)

Depends on Task 3 (`tester.*` config + `US_TESTER_*`).

- [ ] **Step 1: Extend `tester-access.md`** — after the `## 4. ECSite (storefront) entry` section, append:

````markdown
## 5. ECSite customer login (email-verification flows)

- Login: `http://localhost:2380/storetax/login`
- Credentials are **ticket/seed-specific** — e.g. `test-ap1584@example.com` / `password` for ticket 1584. Use the account the ticket/investigation names, not a hardcoded one.

Resolve the stable URLs from config instead of hardcoding:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_TESTER_ECSITE_LOGIN  → http://localhost:2380/storetax/login
# $US_TESTER_MAILHOG       → http://localhost:8225
```

## 6. Verify emails via Mailhog

- Inbox: `http://localhost:8225` (open `/#` for the message list).
- After triggering an email action in the UI, open Mailhog, find the message, and assert subject/recipient/body against the acceptance criteria.
````

- [ ] **Step 2: Point REFERENCE's tester section at the URLs.** In `REFERENCE.md` `## MCP (tester)`, append a line:

```markdown
Tester env access (login + email verification) resolves from config: `US_TESTER_ECSITE_LOGIN` (`http://localhost:2380/storetax/login`) and `US_TESTER_MAILHOG` (`http://localhost:8225`). Login credentials are ticket/seed-specific. See `../unioss-verify/tester-access.md`.
```

- [ ] **Step 3: Verify**

Run: `grep -n "Mailhog\|storetax/login\|US_TESTER" plugins/unioss-pipeline/skills/unioss-verify/tester-access.md plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
Expected: matches in both files.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-verify/tester-access.md plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "docs(unioss-pipeline): tester Mailhog + ECSite login access (item 6)"
```

---

### Task 12: `unioss-api-spec` skill + template + coder hook (item 9)

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-api-spec/SKILL.md`
- Create: `plugins/unioss-pipeline/skills/unioss-api-spec/api-spec-template.md`
- Create: `plugins/unioss-pipeline/commands/unioss-api-spec.md` (slash command, if commands dir pattern exists)
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md` (new-endpoint hook)

- [ ] **Step 1: Check the command-registration pattern.**

Run: `ls plugins/unioss-pipeline/commands/ 2>/dev/null && head -20 plugins/unioss-pipeline/commands/unioss-ship.md 2>/dev/null`
Expected: reveals whether commands are separate files. If `commands/` exists, mirror `unioss-ship.md` for the new command in Step 4; if not, skip the command file (skills auto-expose `/unioss-api-spec`).

- [ ] **Step 2: Create the template** `api-spec-template.md` — copy the user's template verbatim (the `UPSERT_TICKET_STATUS_API_SPEC.md` structure) as the canonical shape:

```markdown
# [System] API Specification: [Feature]

## Overview
[One-paragraph purpose.]

## API Endpoint
- **URL**: `/path/to/endpoint`
- **HTTP Method**: `POST|GET|PUT|DELETE`
- **Content-Type**: `application/json`

## Authentication
| Header | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `X-Api-Key` | string | Yes | Secret key. |

A missing, empty, or non-matching key returns HTTP `401`.

## Request Parameters (JSON)
| Field | Type | Required | Rules / Description |
| :--- | :--- | :--- | :--- |
| `field` | string | Yes | Rule. |

### Request Example
​```bash
curl --request POST --url http://localhost:2380/... --header 'content-type: application/json' --data '{ }'
​```

## Response Structure (JSON)
**Success (HTTP 200):**
​```json
{ "status": "success", "message": "...", "data": [] }
​```
**Error:** `data` is `null`; `message` may hold newline-separated per-index errors.
​```json
{ "status": "error", "message": "...", "data": null }
​```
**Unauthorized (HTTP 401):**
​```json
{ "status": "error", "message": "...", "data": null }
​```

### Error Codes
| HTTP | Cause |
| :--- | :--- |
| 401 | Missing / invalid key. |
| 400 | Validation failure / malformed request. |
| 404 | Referenced resource not found. |
| 500 | Server/DB failure. |
```

(Replace the two `​```` fences that show a zero-width marker with real triple backticks when writing the file.)

- [ ] **Step 3: Create `SKILL.md`** for `unioss-api-spec`:

```markdown
---
name: unioss-api-spec
description: Writes a UNIOSS API specification for a new/changed endpoint following the house template (URL, method, auth, request params + rules, request example, success/error/401 shapes, HTTP error-code table). Use when a change adds an API endpoint, or standalone via /unioss-api-spec.
---

# UNIOSS API Spec Writer

Read `../unioss-pipeline/REFERENCE.md` first. Produce an API spec that matches `api-spec-template.md` (this skill dir) exactly in structure.

## Inputs
Identify the endpoint from the request or the changed controller. Read the controller action + its validation/model to fill every section — never invent fields:
- **URL / method / Content-Type** — from the route + controller.
- **Authentication** — the header(s) checked and the 401 behavior.
- **Request parameters** — each field's type, required flag, and validation rule (max length, numeric ranges, allowed enum values, format).
- **Request example** — a working `curl` with a realistic body.
- **Responses** — the success 200 shape (with `data`), the error shape (`data: null`, per-index messages), and the 401 shape. Copy real response messages (including Japanese) from the code.
- **Error codes** — the HTTP → cause table.

## Output
- **Coder-integrated (pipeline):** when the approved change adds a new API endpoint, the orchestrator's coder invokes this skill and writes `<PREFIX>#[IID]_API_SPEC.md` into the current round dir `.walkthrough/<PREFIX>#[IID]/round-<N>/`.
- **Standalone** (`/unioss-api-spec <endpoint|controller>`): print the spec. **Write nothing under `.walkthrough/`** unless the user explicitly asks for a file.

## Standalone use
When no orchestrator context (no ticket, no round path) is handed to you: do the task on the named endpoint, skip round bookkeeping, and write nothing under `.walkthrough/` unless asked.
```

- [ ] **Step 4: Register the command (only if `commands/` exists per Step 1).** Create `commands/unioss-api-spec.md` mirroring `commands/unioss-ship.md`'s front-matter, pointing at the `unioss-api-spec` skill. If `commands/` does not exist, skip.

- [ ] **Step 5: Coder hook in `unioss-implement`** — append to Step 3 (after CHANGES.md) a new line, or add Step 3b:

```markdown
## Step 3b — API spec (only if a new API endpoint was added)
If the change adds a new API endpoint, invoke `unioss-api-spec` to write `<PREFIX>#[IID]_API_SPEC.md` into the round dir `.walkthrough/<PREFIX>#[IID]/round-<N>/`.
```

- [ ] **Step 6: Verify**

Run: `test -f plugins/unioss-pipeline/skills/unioss-api-spec/SKILL.md && test -f plugins/unioss-pipeline/skills/unioss-api-spec/api-spec-template.md && grep -n "Step 3b — API spec" plugins/unioss-pipeline/skills/unioss-implement/SKILL.md && echo OK`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-api-spec plugins/unioss-pipeline/skills/unioss-implement/SKILL.md plugins/unioss-pipeline/commands/unioss-api-spec.md 2>/dev/null; git add plugins/unioss-pipeline/skills/unioss-api-spec plugins/unioss-pipeline/skills/unioss-implement/SKILL.md
git commit -m "feat(unioss-pipeline): add unioss-api-spec skill + coder hook for new endpoints (item 9)"
```

---

### Task 13: Version bump + full verification (release gate)

**Files:**
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json` (version → `1.6.0`)

- [ ] **Step 1: Bump the version.** In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, set `"version": "1.6.0"` (from `1.5.0`).

- [ ] **Step 2: Run the full script test suite.**

Run: `cd plugins/unioss-pipeline/scripts && node --test`
Expected: PASS — every test file green (baseline 33 + Task 1/2/3/4/5 additions).

- [ ] **Step 3: Syntax-check every script.**

Run: `cd plugins/unioss-pipeline/scripts && for f in *.mjs; do node --check "$f" || echo "FAIL $f"; done; echo done`
Expected: `done` with no `FAIL` lines.

- [ ] **Step 4: Confirm no stale references survive.**

Run: `grep -rn "git stash\|Never POST/PUT/DELETE\." plugins/unioss-pipeline/skills`
Expected: no `git stash`; the blanket "Never POST/PUT/DELETE." line is gone (replaced by the scoped exception in Task 10).

- [ ] **Step 5: Commit.**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "chore(unioss-pipeline): bump to 1.6.0"
```

---

## Self-Review (author checklist — completed)

**Spec coverage:** item 1→T1, item 2→T2, item 3→T6, item 4→T7, item 5→T4+T8, item 6→T3+T11, item 7→T9, item 8→T5+T10, item 9→T12, version→T13. All nine covered.

**Placeholder scan:** no TBD/TODO; every code step shows full code; doc edits show exact before/after strings.

**Type consistency:** `displayWidth` (T1) signature preserved; `fileLink` options object extended, not renamed (T2); `resolveConfig().tester` used consistently in T3/T4/T11; `phpunit-config.mjs` export names match between T4 impl and T8 callers; `ship.mjs` `mrCreatePayload`/`repoRef`/`create` CLI match between T5 and T10.

**Notes for the executor:**
- Tasks 1–5 are TDD script changes (run each file's `node --test`); Tasks 6–13 are doc/config edits verified by `grep`/`node --check` plus the full `node --test` regression at T13.
- `ship.mjs create` network path (GET users / POST MR) is not unit-tested against live GitLab by design — the payload/mapping is. Exercise it live once against a real branch during acceptance.
- Task order respects dependencies: T4 before T8, T5 before T10, T3 before T11.
