# UNIOSS Pipeline Optimization v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply seven independent improvements to the `unioss-pipeline` plugin: hide the config dir, unify the doctor/plan-table UI, make artifact links clickable, add `/unioss-feedback` + `/unioss-task` entry commands, add a `/unioss-ship` skill, and give the tester a quick-access guide plus explicit per-screen verification.

**Architecture:** The plugin is a set of markdown skills/commands plus small Node ESM helper scripts under `plugins/unioss-pipeline/scripts/` (each with a `*.test.mjs` beside it using `node:test`). New behavior lands as (a) new pure helpers with unit tests (`link.mjs`, `ship.mjs`, `box.mjs`), (b) a refactor of `doctor.mjs` onto the box renderer, and (c) markdown edits to skills/commands/REFERENCE. No runtime state is shared between the seven items.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test` + `node:assert/strict`, markdown skills/commands, GitLab pre-filled MR URLs (no API writes).

## Global Constraints

- All helper scripts are Node ESM `.mjs`; each ships a `*.test.mjs` beside it run with `node --test <file>`.
- Config resolution order stays env → `.walkthrough/.config/unioss.config.json` → built-in default. Never hardcode per-machine values in skills.
- Read-only stances unchanged: no GitLab POST/PUT/DELETE anywhere (ship uses pre-filled MR URLs, human clicks).
- Protected branches `master, v3-master, develop, v3-develop, v3-develop-tps` are never committed/pushed/merged directly. Feature branches `feature/v3/…` only.
- Clean-code rules apply: `scripts/*` follow `rules/clean-code-javascript.md` (const-default, ≤2 args → options object, `===`, no dead code, guard clauses).
- Plugin version target after all tasks: `1.5.0`.
- Working dir for all paths below: repo root `/home/ttndev/workspace/personal/ttnplugins`. Plugin root: `plugins/unioss-pipeline`.

---

## File Structure

**New helper scripts (with tests):**
- `plugins/unioss-pipeline/scripts/link.mjs` + `link.test.mjs` — path → clickable `file://` markdown link.
- `plugins/unioss-pipeline/scripts/box.mjs` + `box.test.mjs` — fixed-width rounded box renderer.
- `plugins/unioss-pipeline/scripts/ship.mjs` + `ship.test.mjs` — mode → MR URL + settings block.

**Modified scripts:**
- `plugins/unioss-pipeline/scripts/config.mjs` — `.config` path; new `ship` DEFAULTS block.
- `plugins/unioss-pipeline/scripts/config.test.mjs` — `.config` path expectations.
- `plugins/unioss-pipeline/scripts/doctor.mjs` — render through `box.mjs`; `.config` message.

**New commands:**
- `plugins/unioss-pipeline/commands/unioss-feedback.md`
- `plugins/unioss-pipeline/commands/unioss-task.md`
- `plugins/unioss-pipeline/commands/unioss-ship.md`

**New skill:**
- `plugins/unioss-pipeline/skills/unioss-ship/SKILL.md`

**New docs:**
- `plugins/unioss-pipeline/skills/unioss-verify/tester-access.md`

**Modified skills/docs:**
- `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` — box plan table; entry-modes section.
- `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` — `.config` path; clickable-link rule; `ship` config rows.
- `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md` — checklist + mandatory screenshots + tester-access link.
- Stage skills' Return sections: `unioss-investigate`, `unioss-plan`, `unioss-review`, `unioss-implement` — clickable-link format.
- `plugins/unioss-pipeline/.claude-plugin/plugin.json` — version `1.5.0`.

---

## Task 1: Rename config dir `.walkthrough/config` → `.walkthrough/.config`

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.mjs:45`
- Modify: `plugins/unioss-pipeline/scripts/config.test.mjs:11-12,54`
- Modify: `plugins/unioss-pipeline/scripts/doctor.mjs:66`
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md:10`

**Interfaces:**
- Produces: `configPath(cwd)` now returns `<cwd>/.walkthrough/.config/unioss.config.json`. No signature change.

- [ ] **Step 1: Update the test expectations to `.config` (make them fail first)**

In `config.test.mjs`, the `workspace()` helper (lines 11-12) and the `configPath` assertion (line 54):

```js
// line 11-12 inside workspace():
    mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), fileContents);
```

```js
// line 54:
  assert.ok(configPath('/tmp/ws').endsWith(join('.walkthrough', '.config', 'unioss.config.json')));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: FAIL — `configPath is under the given cwd` and the file-override tests fail (path mismatch: code still writes/reads `config`, test now uses `.config`).

- [ ] **Step 3: Update `configPath()` to `.config`**

`config.mjs` line 45:

```js
export function configPath(cwd = process.cwd()) {
  return join(cwd, '.walkthrough', '.config', 'unioss.config.json');
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: PASS (all config tests green).

- [ ] **Step 5: Update the two doc/message references**

`doctor.mjs` line 66:

```js
console.log('\nTo override locally, run:  node scripts/config.mjs init  (creates .walkthrough/.config/unioss.config.json)\n');
```

`REFERENCE.md` line 10 (Configuration section):

```markdown
(resolution: env → `.walkthrough/.config/unioss.config.json` → built-in default).
```

- [ ] **Step 6: Sanity-run the CLI init path**

Run: `cd /tmp && rm -rf uni-init-check && mkdir uni-init-check && cd uni-init-check && node "/home/ttndev/workspace/personal/ttnplugins/plugins/unioss-pipeline/scripts/config.mjs" init && ls .walkthrough/.config/`
Expected: prints `Created …/.walkthrough/.config/unioss.config.json`; `ls` shows `unioss.config.json`. Then `cd /home/ttndev/workspace/personal/ttnplugins`.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config.test.mjs plugins/unioss-pipeline/scripts/doctor.mjs plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "refactor(unioss-pipeline): move config dir to .walkthrough/.config"
```

---

## Task 2: `link.mjs` — clickable artifact-link helper

**Files:**
- Create: `plugins/unioss-pipeline/scripts/link.mjs`
- Test: `plugins/unioss-pipeline/scripts/link.test.mjs`

**Interfaces:**
- Produces: `fileLink(path, { label, cwd } = {})` → string `"[label](file://<abs-encoded>)"`. `label` defaults to the path basename; `cwd` defaults to `process.cwd()`. Path is resolved absolute; `#` and spaces are percent-encoded (`%23`, `%20`); `/` preserved. CLI: `node link.mjs <path> [label]` prints the link.

- [ ] **Step 1: Write the failing test**

`plugins/unioss-pipeline/scripts/link.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileLink } from './link.mjs';

test('encodes # as %23 and resolves absolute, default label is basename', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md', { cwd: '/ws' });
  assert.equal(out, '[AP#1583_REVIEW.md](file:///ws/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)');
});

test('no bare # remains in the url portion', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/', { cwd: '/ws' });
  const url = out.slice(out.indexOf('(') + 1, -1);
  assert.ok(!url.includes('#'));
  assert.match(url, /%23/);
});

test('custom label is used verbatim', () => {
  const out = fileLink('/abs/UT_#1583_20260709_V1.txt', { label: 'full test run' });
  assert.equal(out, '[full test run](file:///abs/UT_%231583_20260709_V1.txt)');
});

test('spaces encode to %20', () => {
  const out = fileLink('/abs/my file.md', {});
  assert.match(out, /file:\/\/\/abs\/my%20file\.md/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/unioss-pipeline/scripts/link.test.mjs`
Expected: FAIL — `Cannot find module './link.mjs'`.

- [ ] **Step 3: Write the implementation**

`plugins/unioss-pipeline/scripts/link.mjs`:

```js
#!/usr/bin/env node
// Emit a clickable file:// markdown link for a pipeline artifact path.
// The bare '#' in ticket dirs (AP#1583) breaks terminal linkifiers, so encode it.
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export function fileLink(path, { label, cwd = process.cwd() } = {}) {
  const abs = resolve(cwd, path);
  // encodeURI leaves '/' intact and encodes spaces; it does NOT encode '#', so do that explicitly.
  const encoded = encodeURI(abs).replace(/#/g, '%23');
  const text = label ?? basename(path.replace(/\/+$/, '')) ?? abs;
  return `[${text}](file://${encoded})`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [path, label] = process.argv.slice(2);
  if (!path) { process.stderr.write('Usage: link.mjs <path> [label]\n'); process.exit(1); }
  process.stdout.write(fileLink(path, label ? { label } : {}) + '\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/unioss-pipeline/scripts/link.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/link.mjs plugins/unioss-pipeline/scripts/link.test.mjs
git commit -m "feat(unioss-pipeline): add link.mjs clickable artifact-link helper"
```

---

## Task 3: Wire the clickable-link format into REFERENCE + stage Return sections

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` (add a "Clickable links" subsection under Artifact Layout)
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md` (Step 6 Return)
- Modify: `plugins/unioss-pipeline/skills/unioss-plan/SKILL.md` (Return steps)
- Modify: `plugins/unioss-pipeline/skills/unioss-review/SKILL.md` (Step 6 Return)
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md` (Step 5 Return)
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` (Finalize + gate presentations reference the format)

**Interfaces:**
- Consumes: `fileLink()` / `scripts/link.mjs` from Task 2.

- [ ] **Step 1: Add the rule to REFERENCE.md**

Append this subsection to `REFERENCE.md` immediately after the "Artifact Layout" section (before "## GitLab (read-only)"):

```markdown
## Clickable links

Whenever a stage or the orchestrator surfaces an artifact path to the human (gate
presentations, Return summaries, the final report), emit it as a clickable
`file://` link — never a bare path. A bare `#` in a ticket dir (`AP#1583`) is
mangled by the terminal linkifier, so it must be percent-encoded.

Canonical form — absolute path, `#` → `%23`, spaces → `%20`, wrapped as markdown:

    [AP#1583_REVIEW.md](file:///abs/workspace/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)

Generate it deterministically:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/link.mjs" ".walkthrough/AP#1583/round-1/AP#1583_REVIEW.md"
```
```

- [ ] **Step 2: Update each stage's Return instruction**

In each stage skill below, replace the "absolute links / absolute path" phrasing in its Return step with a pointer to the canonical format. Exact edits:

`unioss-investigate/SKILL.md` — Step 6 currently: "…and absolute links to the two visible files." Change to:

```markdown
Return: prefix+IID, repo, clarity verdict, count of open questions, and clickable `file://` links (REFERENCE → Clickable links; use `scripts/link.mjs`) to the two visible files. Do not paste full file bodies.
```

`unioss-plan/SKILL.md` — both Return lines (spec mode "the spec path", plan mode "the plan path"): append `— as a clickable file:// link (REFERENCE → Clickable links)`. E.g. plan-mode Step 4:

```markdown
Return the plan path (as a clickable `file://` link — REFERENCE → Clickable links), total estimate points, and a one-line scope summary. Do not paste the full plan body.
```

`unioss-review/SKILL.md` — Step 6: append to the return instruction:

```markdown
Return the severity counts (🔴/🟡/🟢), the top-priority list, and a clickable `file://` link to `REVIEW.md` (REFERENCE → Clickable links; `scripts/link.mjs`) — do not paste the full report body.
```

`unioss-verify/SKILL.md` — Step 5: append:

```markdown
Return overall pass/fail, the count of failed criteria, and a clickable `file://` link to `TEST_RESULTS.md` (REFERENCE → Clickable links). Do not paste the full report.
```

- [ ] **Step 3: Update the orchestrator Finalize + gates**

In `unioss-pipeline/SKILL.md`, Finalize step (item 12) — the sentence "Present a final summary: branch names per repo, spec, plan, changes, review status, test status, links." Change "links" to:

```markdown
… test status, and clickable `file://` links to every artifact (REFERENCE → Clickable links — run `scripts/link.mjs` per path; never print a bare `.walkthrough/<PREFIX>#[IID]/…` path).
```

Add to the "## Rules" list at the bottom:

```markdown
- When surfacing any artifact path to the human, emit a clickable `file://` link (REFERENCE → Clickable links), never a bare path — a bare `#` breaks the terminal link.
```

- [ ] **Step 4: Verify the helper produces the exact links for the reported-broken paths**

Run:
```bash
cd /home/ttndev/workspace/personal/ttnplugins
for p in \
  ".walkthrough/AP#1583/round-1/AP#1583_IMPLEMENTATION_V1.md" \
  ".walkthrough/AP#1583/round-1/AP#1583_REVIEW.md" \
  ".walkthrough/AP#1583/round-1/" \
  ".walkthrough/AP#1583/round-1/UT_#1583_20260709_V1.txt" ; do
  node plugins/unioss-pipeline/scripts/link.mjs "$p"
done
```
Expected: each line is `[<basename>](file:///…/.walkthrough/AP%231583/round-1/…)` with `%23` and no bare `#`.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills
git commit -m "docs(unioss-pipeline): require clickable file:// links for artifacts"
```

---

## Task 4: `box.mjs` — fixed-width rounded box renderer

**Files:**
- Create: `plugins/unioss-pipeline/scripts/box.mjs`
- Test: `plugins/unioss-pipeline/scripts/box.test.mjs`

**Interfaces:**
- Produces:
  - `displayWidth(str)` → number (code-point count; correct for the width-1 glyphs used: `✓ ✗ · ─ │`).
  - `box(title, lines, width = 69)` → multi-line string. Every output line has display width `width + 3`, starts with one of `╭ │ ╰` and ends with one of `╮ │ ╯`. `lines` is an array of pre-formatted inner strings (no borders); each is padded to a flush right border.

- [ ] **Step 1: Write the failing test**

`plugins/unioss-pipeline/scripts/box.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, displayWidth } from './box.mjs';

test('displayWidth counts code points', () => {
  assert.equal(displayWidth('abc'), 3);
  assert.equal(displayWidth('✓ node'), 6);
});

test('every rendered line is the same display width', () => {
  const out = box('Title', ['a', 'a longer line here', '✓ node'], 40);
  const lines = out.split('\n');
  const widths = new Set(lines.map(displayWidth));
  assert.equal(widths.size, 1);
  assert.equal([...widths][0], 43); // width + 3
});

test('corners and borders are correct', () => {
  const lines = box('T', ['x'], 20).split('\n');
  assert.ok(lines[0].startsWith('╭') && lines[0].endsWith('╮'));
  for (const mid of lines.slice(1, -1)) {
    assert.ok(mid.startsWith('│') && mid.endsWith('│'));
  }
  const last = lines[lines.length - 1];
  assert.ok(last.startsWith('╰') && last.endsWith('╯'));
});

test('title appears in the top border', () => {
  const out = box('Env Check', [], 40);
  assert.match(out.split('\n')[0], /╭─ Env Check ─+╮/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test plugins/unioss-pipeline/scripts/box.test.mjs`
Expected: FAIL — `Cannot find module './box.mjs'`.

- [ ] **Step 3: Write the implementation**

`plugins/unioss-pipeline/scripts/box.mjs`:

```js
// Fixed-width rounded box renderer for UNIOSS pipeline terminal UIs.
// All glyphs used by callers (✓ ✗ · ─ │) are display-width 1, so a code-point
// count is the correct display width.
const H = '─', V = '│', TL = '╭', TR = '╮', BL = '╰', BR = '╯';

export const displayWidth = (str) => Array.from(str).length;

export function box(title, lines, width = 69) {
  const fill = Math.max(0, width - displayWidth(title) - 2);
  const top = `${TL}${H} ${title} ${H.repeat(fill)}${TR}`;
  const body = lines.map((line) => {
    const pad = Math.max(0, width - displayWidth(line));
    return `${V} ${line}${' '.repeat(pad)}${V}`;
  });
  const bottom = `${BL}${H.repeat(width + 1)}${BR}`;
  return [top, ...body, bottom].join('\n');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test plugins/unioss-pipeline/scripts/box.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/box.mjs plugins/unioss-pipeline/scripts/box.test.mjs
git commit -m "feat(unioss-pipeline): add box.mjs fixed-width box renderer"
```

---

## Task 5: Render `doctor.mjs` through the box UI

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/doctor.mjs`

**Interfaces:**
- Consumes: `box`, `displayWidth` from `box.mjs` (Task 4); `resolveConfig`, `valueSources`, `runCheck` from `config.mjs`.
- Produces: same exit-code contract (0 all-ok, 1 otherwise). Output is one box with `Dependencies`, `Configuration`, and `Status` sections.

- [ ] **Step 1: Replace the print section of `doctor.mjs`**

Keep the top of the file (imports + `has`/`out`/`pm`/`installCmd`/`dockerOk`/`runningNames`/`chromeOk`/`cfg`/`checks` through line 49) **unchanged**, except add the `box` import and swap the config import line to also pull `valueSources`. Replace everything from the first `console.log('\nUNIOSS pipeline — environment check\n');` (line 51) to the end of the file with the block below.

Change the import at the top (line 6) from:
```js
import { resolveConfig, runCheck } from './config.mjs';
```
to:
```js
import { resolveConfig, runCheck, valueSources } from './config.mjs';
import { box } from './box.mjs';
```

Replace lines 51-69 (the render + exit block) with:

```js
const WIDTH = 69;
const SECRET_KEYS = new Set(['db.password']);
const lines = [];

let allOk = true;
const lightMissing = [];

lines.push('Dependencies', '');
for (const c of checks) {
  lines.push(`  ${c.ok ? '✓' : '✗'}  ${c.name}`);
  if (!c.ok) {
    allOk = false;
    if (c.light) lightMissing.push(c.name);
    lines.push(`       └ ${c.fix}`);
  }
}

if (lightMissing.length && pm) {
  lines.push('', `  Light deps:  ${lightMissing.map(installCmd).join('  &&  ')}`);
}
lines.push('', '  Playwright MCP ships with this plugin (npx @playwright/mcp@latest).');

lines.push('', 'Configuration          value                 source');
for (const { key, value, source } of valueSources()) {
  const shown = SECRET_KEYS.has(key) ? '******' : (Array.isArray(value) ? value.join(',') : String(value));
  lines.push(`  ${key.padEnd(22)} ${shown.slice(0, 20).padEnd(21)} ${source}`);
}
lines.push(`  ${'GITLAB_TOKEN'.padEnd(22)} ${(process.env.GITLAB_TOKEN ? '******' : 'MISSING').padEnd(21)} env`);

const check = runCheck();
if (!check.ok) allOk = false;
const status = allOk
  ? 'All checks passed — pipeline ready.'
  : 'Issues found — resolve the ✗ items above, then re-run.';
lines.push('', `Status   ${status}`);
lines.push('', "Override locally:  node scripts/config.mjs init  (.walkthrough/.config/unioss.config.json)");

console.log('\n' + box('UNIOSS Pipeline · Environment Check', lines, WIDTH) + '\n');
process.exit(allOk ? 0 : 1);
```

- [ ] **Step 2: Run the doctor and eyeball the box alignment**

Run: `node plugins/unioss-pipeline/scripts/doctor.mjs; echo "exit=$?"`
Expected: one rounded box titled `UNIOSS Pipeline · Environment Check`; every right-edge `│` is column-flush; `Dependencies`, `Configuration`, `Status` sections present; `exit=` is `0` or `1`.

- [ ] **Step 3: Assert right-border alignment programmatically**

Run:
```bash
node -e "const {execSync}=require('child_process');const s=execSync('node plugins/unioss-pipeline/scripts/doctor.mjs',{encoding:'utf8'}).trim().split('\n').filter(l=>/^[╭│╰]/.test(l));const w=new Set(s.map(l=>[...l].length));console.log('distinct widths:',[...w]);process.exit(w.size===1?0:1)"
```
Expected: `distinct widths: [ 72 ]` and exit 0 (single width = right edge aligned; 72 = WIDTH 69 + 3).

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/scripts/doctor.mjs
git commit -m "feat(unioss-pipeline): render doctor output in unified box UI"
```

---

## Task 6: Replace the Step-0 plan table with the box style

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` (Step 0 table, lines ~26-52)

**Interfaces:** none (static markdown the orchestrator prints).

- [ ] **Step 1: Replace the ASCII grid**

In `unioss-pipeline/SKILL.md`, replace the fenced grid table under "## Step 0" (from the opening `┌────` line to the closing `└────` line) with this box, keeping the surrounding instructions ("Then print this table … substitute `<PREFIX>`, `[IID]` …" and "Wait for the user to say to proceed.") intact:

```
╭─ UNIOSS Pipeline · <PREFIX>#[IID] · round-<current_round> ─────────────╮
│                                                                       │
│   #    Stage         Runs as            Output                        │
│  ─────────────────────────────────────────────────────────────────   │
│   1    Investigate   subagent · opus    INVESTIGATION + REPORT        │
│   ⛔   GATE 0        you                clarify (only if unclear)     │
│   2    Spec          subagent · opus    SPEC.md                       │
│   ⛔   GATE 1        you                approve spec / edit           │
│   3    Plan          subagent · opus    IMPLEMENTATION_V1            │
│   ⛔   GATE 2        you                approve plan / edit           │
│   4    Code          main · sonnet      CHANGES.md + fast tests       │
│   5    Review        subagent · opus    REVIEW.md                     │
│   ⛔   GATE 3        you                fix / accept                  │
│   6    Verify        subagent · sonnet  TEST_RESULTS.md (DB+UI)       │
│   7    Finalize      main               branch + commit (no push/MR)  │
│                                                                       │
│   Gates stop for approval. Nothing runs until you confirm.            │
╰───────────────────────────────────────────────────────────────────────╯
```

Keep the instruction line telling the model to substitute `<PREFIX>`, `[IID]`, and `<current_round>` into the title bar, and to keep the branch/finalize wording per REFERENCE.

- [ ] **Step 2: Verify the box right edge is flush**

Run:
```bash
awk '/^╭─ UNIOSS Pipeline · <PREFIX>/{f=1} f{print} /^╰/{if(f)exit}' plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const ls=d.trim().split('\n');const w=new Set(ls.map(l=>[...l].length));console.log([...w]);process.exit(w.size===1?0:1)})"
```
Expected: prints a single-element array (all box lines equal display width) and exits 0. If it prints two widths, adjust padding on the offending row(s) until flush.

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md
git commit -m "docs(unioss-pipeline): unify Step-0 plan table into box UI"
```

---

## Task 7: Add the `ship` config block

**Files:**
- Modify: `plugins/unioss-pipeline/scripts/config.mjs` (DEFAULTS)
- Modify: `plugins/unioss-pipeline/scripts/config.test.mjs` (new assertion)
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md` (config table rows)

**Interfaces:**
- Produces: `resolveConfig(cwd).ship` with per-mode `staging`/`customer` objects. Readable via `getValue(cwd, 'ship.staging.targetBranch')` etc. and `flatten`.

- [ ] **Step 1: Write the failing test**

Add to `config.test.mjs`:

```js
test('ship defaults expose per-mode target branch, reviewer, merge options', () => {
  const dir = workspace(undefined);
  const { ship } = resolveConfig(dir);
  assert.equal(ship.assignee, 'nghia.truong');
  assert.equal(ship.label, 'UNIOSS 3');
  assert.equal(ship.staging.targetBranch, 'v3-develop-tps');
  assert.equal(ship.staging.reviewer, 'dat.pham');
  assert.equal(ship.staging.deleteSourceBranch, false);
  assert.equal(ship.customer.targetBranch, 'v3-develop');
  assert.equal(ship.customer.reviewer, 'r.yosimura');
  assert.equal(ship.customer.deleteSourceBranch, true);
  rmSync(dir, { recursive: true, force: true });
});

test('ship reviewer is overridable from file', () => {
  const dir = workspace(JSON.stringify({ ship: { customer: { reviewer: 'someone.else' } } }));
  const { ship } = resolveConfig(dir);
  assert.equal(ship.customer.reviewer, 'someone.else');        // overridden
  assert.equal(ship.customer.targetBranch, 'v3-develop');      // default preserved (deep merge)
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: FAIL — `ship` is undefined.

- [ ] **Step 3: Add `ship` to DEFAULTS**

In `config.mjs`, add to the `DEFAULTS` object (after `git: {…}`, before `source:`):

```js
  ship: {
    assignee: 'nghia.truong',
    label: 'UNIOSS 3',
    staging: { targetBranch: 'v3-develop-tps', reviewer: 'dat.pham', deleteSourceBranch: false, squash: false },
    customer: { targetBranch: 'v3-develop', reviewer: 'r.yosimura', deleteSourceBranch: true, squash: false },
  },
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test plugins/unioss-pipeline/scripts/config.test.mjs`
Expected: PASS (including the two new tests).

- [ ] **Step 5: Document the rows in REFERENCE.md**

Add to the config table in `REFERENCE.md` (after the `git.protected` row):

```markdown
| `ship.assignee` | `nghia.truong` | MR assignee (both modes) |
| `ship.label` | `UNIOSS 3` | MR label if it exists on the project |
| `ship.staging.targetBranch` / `.reviewer` | `v3-develop-tps` / `dat.pham` | internal-staging MR target + reviewer |
| `ship.customer.targetBranch` / `.reviewer` | `v3-develop` / `r.yosimura` | customer-staging MR target + reviewer |
```

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/scripts/config.mjs plugins/unioss-pipeline/scripts/config.test.mjs plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "feat(unioss-pipeline): add ship config block (targets/reviewers/options)"
```

---

## Task 8: `ship.mjs` — MR URL + settings helper

**Files:**
- Create: `plugins/unioss-pipeline/scripts/ship.mjs`
- Test: `plugins/unioss-pipeline/scripts/ship.test.mjs`

**Interfaces:**
- Consumes: `resolveConfig` from `config.mjs`.
- Produces:
  - `mrUrl({ host, repoWebPath, sourceBranch, targetBranch })` → GitLab new-MR URL with `merge_request%5Bsource_branch%5D` / `%5Btarget_branch%5D`, branches `encodeURIComponent`-encoded (so `#`→`%23`, `/`→`%2F`).
  - `shipInfo({ cwd, mode, repoWebPath, sourceBranch })` → `{ url, settings }` where `settings` is `{ assignee, reviewer, label, deleteSourceBranch, squash, targetBranch }` from config for `mode` (`'staging'|'customer'`). Throws on unknown mode.
  - CLI: `node ship.mjs <staging|customer> <repoWebPath> <sourceBranch>` prints the URL then the settings block.

- [ ] **Step 1: Write the failing test**

`plugins/unioss-pipeline/scripts/ship.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mrUrl, shipInfo } from './ship.mjs';

test('mrUrl encodes branch (# and /) and sets bracketed params', () => {
  const url = mrUrl({
    host: 'gitlab.unioss.jp',
    repoWebPath: 'unioss/FrontEnd',
    sourceBranch: 'feature/v3/#391',
    targetBranch: 'v3-develop-tps',
  });
  assert.equal(
    url,
    'https://gitlab.unioss.jp/unioss/FrontEnd/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Fv3%2F%23391&merge_request%5Btarget_branch%5D=v3-develop-tps',
  );
});

test('shipInfo staging pulls target/reviewer/options from config defaults', () => {
  const { url, settings } = shipInfo({
    cwd: process.cwd(), mode: 'staging', repoWebPath: 'unioss/AdminPage', sourceBranch: 'feature/v3/#1583',
  });
  assert.match(url, /target_branch%5D=v3-develop-tps$/);
  assert.equal(settings.reviewer, 'dat.pham');
  assert.equal(settings.assignee, 'nghia.truong');
  assert.equal(settings.deleteSourceBranch, false);
  assert.equal(settings.label, 'UNIOSS 3');
});

test('shipInfo customer uses v3-develop and delete-source ON', () => {
  const { url, settings } = shipInfo({
    cwd: process.cwd(), mode: 'customer', repoWebPath: 'unioss/FrontEnd', sourceBranch: 'feature/v3/#391',
  });
  assert.match(url, /target_branch%5D=v3-develop$/);
  assert.equal(settings.reviewer, 'r.yosimura');
  assert.equal(settings.deleteSourceBranch, true);
});

test('shipInfo throws on unknown mode', () => {
  assert.throws(() => shipInfo({ cwd: process.cwd(), mode: 'prod', repoWebPath: 'x/y', sourceBranch: 'b' }), /Unknown ship mode/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test plugins/unioss-pipeline/scripts/ship.test.mjs`
Expected: FAIL — `Cannot find module './ship.mjs'`.

- [ ] **Step 3: Write the implementation**

`plugins/unioss-pipeline/scripts/ship.mjs`:

```js
#!/usr/bin/env node
// Build a pre-filled GitLab "new merge request" URL + the settings the URL can't
// carry (assignee/reviewer/labels/merge options). No API writes — the human clicks.
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';

const MODES = new Set(['staging', 'customer']);

export function mrUrl({ host, repoWebPath, sourceBranch, targetBranch }) {
  const src = `merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}`;
  const tgt = `merge_request%5Btarget_branch%5D=${encodeURIComponent(targetBranch)}`;
  return `https://${host}/${repoWebPath}/-/merge_requests/new?${src}&${tgt}`;
}

export function shipInfo({ cwd = process.cwd(), mode, repoWebPath, sourceBranch }) {
  if (!MODES.has(mode)) throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
  const cfg = resolveConfig(cwd);
  const m = cfg.ship[mode];
  const url = mrUrl({ host: cfg.gitlab.host, repoWebPath, sourceBranch, targetBranch: m.targetBranch });
  const settings = {
    assignee: cfg.ship.assignee,
    reviewer: m.reviewer,
    label: cfg.ship.label,
    deleteSourceBranch: m.deleteSourceBranch,
    squash: m.squash,
    targetBranch: m.targetBranch,
  };
  return { url, settings };
}

function renderSettings(s) {
  const onOff = (b) => (b ? 'ON' : 'OFF');
  return [
    `  Assignee:              @${s.assignee}`,
    `  Reviewer:              @${s.reviewer}`,
    `  Labels:                ${s.label} (only if it exists on the project)`,
    `  Delete source branch:  ${onOff(s.deleteSourceBranch)}`,
    `  Squash commits:        ${onOff(s.squash)}`,
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [mode, repoWebPath, sourceBranch] = process.argv.slice(2);
  if (!mode || !repoWebPath || !sourceBranch) {
    process.stderr.write('Usage: ship.mjs <staging|customer> <repoWebPath> <sourceBranch>\n');
    process.exit(1);
  }
  const { url, settings } = shipInfo({ mode, repoWebPath, sourceBranch });
  process.stdout.write(`Open MR (click to create):\n  ${url}\n\nThen set on the MR page:\n${renderSettings(settings)}\n`);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test plugins/unioss-pipeline/scripts/ship.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Eyeball the CLI output**

Run: `node plugins/unioss-pipeline/scripts/ship.mjs staging unioss/FrontEnd 'feature/v3/#391'`
Expected: an `Open MR` URL targeting `v3-develop-tps` plus a settings block (assignee @nghia.truong, reviewer @dat.pham, delete-source OFF).

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/scripts/ship.mjs plugins/unioss-pipeline/scripts/ship.test.mjs
git commit -m "feat(unioss-pipeline): add ship.mjs MR-url + settings helper"
```

---

## Task 9: `unioss-ship` skill + `/unioss-ship` command

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-ship/SKILL.md`
- Create: `plugins/unioss-pipeline/commands/unioss-ship.md`

**Interfaces:**
- Consumes: `ship.mjs` (Task 8), `link.mjs` (Task 2), REFERENCE branch/protected/submodule rules.

- [ ] **Step 1: Write the command file**

`plugins/unioss-pipeline/commands/unioss-ship.md`:

```markdown
---
description: Ship a finalized UNIOSS ticket — open merge requests into staging (v3-develop-tps) or customer staging (v3-develop).
argument-hint: <staging|customer>
---

Ship the current ticket's branches. Target: $ARGUMENTS

Use the `unioss-ship` skill and follow it exactly. `staging` opens MRs into `v3-develop-tps`; `customer` syncs with `v3-master`, re-runs the tests, then opens MRs into `v3-develop`. The skill only prepares and prints the MR links + settings — it never merges and never POSTs to GitLab.
```

- [ ] **Step 2: Write the skill file**

`plugins/unioss-pipeline/skills/unioss-ship/SKILL.md`:

```markdown
---
name: unioss-ship
description: UNIOSS shipper. Pushes the finalized feature branch and prepares GitLab merge requests into staging (v3-develop-tps) or customer staging (v3-develop). Prints pre-filled MR URLs + the settings the URL can't carry; never merges, never POSTs. Use as /unioss-ship <staging|customer>.
---

# UNIOSS Shipper (main thread)

Read `../unioss-pipeline/REFERENCE.md` first — follow its Branches, Protected-branch, and Submodule rules exactly. Argument: `staging` or `customer`.

MR creation is a **human click**: this skill generates a pre-filled "new MR" URL per touched repo and prints the assignee/reviewer/label/merge-option settings to apply on the page. It never POSTs to GitLab and never merges.

## Preconditions
- Determine the touched repos + their feature branches from the latest round's `CHANGES.md` (per REFERENCE branch naming: origin repo `feature/v3/#[IID]`, others `feature/v3/[ORIGIN]#[IID]`).
- Verify every branch to ship is a `feature/v3/…` branch. **Abort** if any is a protected branch (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`).

## Mode: staging
1. For each touched repo, ensure its feature branch is current, then **push** it: `git push -u origin <branch>` (the MR source must exist on the remote; app branches were local-only until now, submodule branches are already pushed).
2. For each touched repo, resolve its GitLab web path (`<namespace>/<Repo>`, e.g. `unioss/AdminPage`) and print the MR link + settings:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" staging <repoWebPath> "<branch>"
   ```
3. Present all MR URLs together (one per repo). Remind the user MR creation + merge are manual. STOP.

## Mode: customer
1. **Sync with base.** On each touched repo's feature branch: `git fetch origin && git merge origin/v3-master`. On a merge conflict → **stop**, tell the user to resolve it manually, do not continue.
2. **Re-run tests.** AdminPage: invoke `unioss-implement` full mode (uncomment dump-import, full PHPUnit) → save `UT_#[IID]_[YYYYMMDD]_V{n}.txt`. FrontEnd: no unit tests. If tests fail → find the root cause, propose a fix plan, **ask the user to approve** it, apply via `unioss-implement`, re-run; loop until green.
3. **Push** each feature branch: `git push -u origin <branch>`.
4. For each touched repo, print the MR link + settings targeting `v3-develop`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" customer <repoWebPath> "<branch>"
   ```
5. Present all MR URLs together. STOP.

## Rules
- Never merge, never POST to GitLab, never touch a protected branch except as an MR **target**.
- Emit every artifact/URL as-is from `ship.mjs`; emit artifact file paths as clickable links (`scripts/link.mjs`, REFERENCE → Clickable links).
- All config (targets, reviewers, assignee, label, merge options) comes from `ship.*` in config — never hardcode.
```

- [ ] **Step 3: Verify the skill/command are discoverable and internally consistent**

Run:
```bash
test -f plugins/unioss-pipeline/skills/unioss-ship/SKILL.md && test -f plugins/unioss-pipeline/commands/unioss-ship.md && echo OK
grep -q "ship.mjs" plugins/unioss-pipeline/skills/unioss-ship/SKILL.md && grep -q "v3-develop-tps" plugins/unioss-pipeline/skills/unioss-ship/SKILL.md && echo REFS-OK
```
Expected: `OK` then `REFS-OK`.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-ship plugins/unioss-pipeline/commands/unioss-ship.md
git commit -m "feat(unioss-pipeline): add /unioss-ship skill + command"
```

---

## Task 10: `/unioss-feedback` + `/unioss-task` commands + pipeline entry modes

**Files:**
- Create: `plugins/unioss-pipeline/commands/unioss-feedback.md`
- Create: `plugins/unioss-pipeline/commands/unioss-task.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md` (add "## Entry modes" section)

**Interfaces:**
- Consumes: the existing `unioss-pipeline` skill Flow, `unioss-brainstorming`, rounds/state model.

- [ ] **Step 1: Write the `/unioss-feedback` command**

`plugins/unioss-pipeline/commands/unioss-feedback.md`:

```markdown
---
description: Continue a shipped UNIOSS ticket from customer feedback — opens a new round from the GitLab comments (does not restart A→Z).
argument-hint: <gitlab-ticket-url>
---

Continue the UNIOSS ticket from customer feedback: $ARGUMENTS

Use the `unioss-pipeline` skill in **feedback mode** (see its "Entry modes" section): open the next round on this existing ticket, seed the round brief from the new GitLab comments since the last round, brainstorm the feedback, then run Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize. Prior rounds stay frozen.
```

- [ ] **Step 2: Write the `/unioss-task` command**

`plugins/unioss-pipeline/commands/unioss-task.md`:

```markdown
---
description: Run the UNIOSS pipeline on an ad-hoc request that has no GitLab ticket.
argument-hint: <description of the task>
---

Run the UNIOSS pipeline for this ticket-less request: $ARGUMENTS

Use the `unioss-pipeline` skill in **task mode** (see its "Entry modes" section): there is no GitLab ticket, so skip the ticket fetch. Derive an artifact identity `TASK#<short-slug>` from the request, brainstorm it, then run Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize.
```

- [ ] **Step 3: Add the "Entry modes" section to the pipeline skill**

In `unioss-pipeline/SKILL.md`, add this section immediately after the "# UNIOSS Pipeline Orchestrator (main thread)" intro paragraph and before "## State & resume":

```markdown
## Entry modes

Three ways in. All share the same gates, rounds, and stages; they differ only in what starts the run and which early steps are skipped.

- **ticket mode** — `/unioss-pipeline <url>` (default). New GitLab ticket. Full flow from Investigate. `<PREFIX>` is `AP`/`FE` from the URL.
- **feedback mode** — `/unioss-feedback <url>`. The ticket already has ≥1 sealed round. Open round N+1 (never restart). Re-fetch the ticket (`unioss-gitlab-issue-context`), read only the **new comments since the last round**, write `round-<N+1>/ROUND_BRIEF.md` from that comment delta, invoke `unioss-brainstorming` on the feedback, then continue at the **spec** stage (step 4) onward. Prior rounds stay frozen (sealed-round guard).
- **task mode** — `/unioss-task <description>`. No GitLab ticket. Derive `<PREFIX>#[IID]` identity as `TASK#<short-slug>` from the request (slug = kebab-case of a few keywords). **Skip** the GitLab fetch and DB-from-ticket steps; the investigator works from the request text + codebase only. Write `round-1/ROUND_BRIEF.md` from the user request, invoke `unioss-brainstorming`, then run the full flow from the spec stage. No GitLab links in artifacts.

In every mode, once the brief/scope is clear, proceed through Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize exactly as the Flow section describes.
```

- [ ] **Step 4: Verify the commands + section are present and consistent**

Run:
```bash
test -f plugins/unioss-pipeline/commands/unioss-feedback.md && test -f plugins/unioss-pipeline/commands/unioss-task.md && echo CMDS-OK
grep -q "## Entry modes" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md && grep -q "feedback mode" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md && grep -q "task mode" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md && echo SECTION-OK
```
Expected: `CMDS-OK` then `SECTION-OK`.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/commands/unioss-feedback.md plugins/unioss-pipeline/commands/unioss-task.md plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md
git commit -m "feat(unioss-pipeline): add /unioss-feedback + /unioss-task entry modes"
```

---

## Task 11: Tester quick-access guide

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-verify/tester-access.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md` (link it from Step 3)

**Interfaces:** none (reference doc).

- [ ] **Step 1: Write the tester-access guide**

`plugins/unioss-pipeline/skills/unioss-verify/tester-access.md`:

```markdown
---
name: unioss tester quick-access
---

# Tester Quick-Access

Local development environment only — these are **not** production secrets. Use to reach the affected screens fast before driving the UI flow.

## 1. Point at the production-clone DB

Confirm both database configs target the local clone:

- `AdminPage/application/config/development/database.php` → `'database' => 'db_unioss_local',`
- `FrontEnd/application/config/development/database.php` → `'database' => 'db_unioss_local',`

## 2. Normalize control data

Apply the control-data SQL to set known credentials (e.g. resets passwords to `password`):

```bash
unioss_control_data.sql   # import into the local DB before logging in
```

## 3. AdminPage login

- URL: `http://localhost:2380/admin/login`
- Username: `kagi-25`
- Password: `password`

## 4. ECSite (storefront) entry

- Top: `http://localhost:2380/storetax/top/vm:2500005/st:1?QRhome=true&QR=true&products=vmonly`

Verify user-facing screens against `_docs/ECSITE_SCREENS.md`.
```

- [ ] **Step 2: Link it from the verify skill**

In `unioss-verify/SKILL.md`, under "## Step 3 — Verify UI flow", add as the first line of that section:

```markdown
Need login/URLs fast? See `tester-access.md` (this skill dir) for the local DB target, control-data SQL, AdminPage login, and the ECSite top URL.
```

- [ ] **Step 3: Verify**

Run:
```bash
test -f plugins/unioss-pipeline/skills/unioss-verify/tester-access.md && grep -q "tester-access.md" plugins/unioss-pipeline/skills/unioss-verify/SKILL.md && echo OK
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-verify/tester-access.md plugins/unioss-pipeline/skills/unioss-verify/SKILL.md
git commit -m "docs(unioss-pipeline): add tester quick-access guide"
```

---

## Task 12: Tester — explicit per-screen checklist + mandatory screenshots

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-verify/SKILL.md` (Steps 1, 3, 4)

**Interfaces:** none.

- [ ] **Step 1: Strengthen Step 1 (build the checklist)**

Replace the body of "## Step 1 — Identify what to verify" with:

```markdown
From `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_CHANGES.md` and the ticket acceptance criteria, build an explicit verification checklist — one row per acceptance criterion:

| Criterion | Screen (URL) | Action to perform | Expected on-screen result |
|-----------|--------------|-------------------|---------------------------|

List the DB effects to check separately. Every criterion must map to a concrete screen + action before you drive anything.
```

- [ ] **Step 2: Make screenshots mandatory in Step 3**

In "## Step 3 — Verify UI flow", replace the "Save screenshots …" paragraph with:

```markdown
Capture a screenshot at **each** of these moments per UI flow (mandatory, not optional): (1) after navigation to the screen, (2) after performing the ticket action, (3) after asserting the expected result. Save to `.walkthrough/<PREFIX>#[IID]/round-<N>/screenshots/<step-name>.png`.
```

- [ ] **Step 3: Require the per-criterion table in Step 4**

In "## Step 4 — Write `TEST_RESULTS.md`", replace the first sentence with:

```markdown
Save `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_TEST_RESULTS.md`. It must contain: (a) the DB verification results, and (b) a per-criterion pass/fail table (Criterion · Screen · Action · Expected · Result · Screenshot link) — every criterion from Step 1 gets a row. `SKIPPED (MCP unavailable)` is never counted as a pass.
```

- [ ] **Step 4: Verify**

Run:
```bash
grep -q "Criterion | Screen" plugins/unioss-pipeline/skills/unioss-verify/SKILL.md && grep -q "mandatory, not optional" plugins/unioss-pipeline/skills/unioss-verify/SKILL.md && echo OK
```
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-verify/SKILL.md
git commit -m "docs(unioss-pipeline): require per-screen checklist + mandatory screenshots"
```

---

## Task 13: Version bump + full test sweep

**Files:**
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json` (version)

- [ ] **Step 1: Bump the version**

`.claude-plugin/plugin.json`:

```json
{
  "name": "unioss-pipeline",
  "version": "1.5.0",
  "description": "UNIOSS A→Z ticket pipeline: gated investigator → planner → coder → reviewer → tester with PHPUnit + Playwright verification.",
  "author": { "name": "ttncode" }
}
```

- [ ] **Step 2: Run the entire helper + hook test suite**

Run:
```bash
node --test \
  plugins/unioss-pipeline/scripts/config.test.mjs \
  plugins/unioss-pipeline/scripts/config-cli.test.mjs \
  plugins/unioss-pipeline/scripts/rounds.test.mjs \
  plugins/unioss-pipeline/scripts/link.test.mjs \
  plugins/unioss-pipeline/scripts/box.test.mjs \
  plugins/unioss-pipeline/scripts/ship.test.mjs \
  plugins/unioss-pipeline/hooks/guard-migrations.test.mjs \
  plugins/unioss-pipeline/hooks/guard-rounds.test.mjs
```
Expected: all suites PASS, `0` failures.

- [ ] **Step 3: Re-run the doctor to confirm nothing regressed**

Run: `node plugins/unioss-pipeline/scripts/doctor.mjs; echo "exit=$?"`
Expected: the box UI renders; exit code reflects local env (0 or 1), no stack trace.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "chore(unioss-pipeline): bump to 1.5.0"
```

---

## Self-Review

**Spec coverage:**
1. Rename `.config` → Task 1. ✓
2. Unified box UI (doctor + plan table) → Tasks 4, 5, 6. ✓
3. Clickable links → Tasks 2, 3. ✓
4. `/unioss-feedback` + `/unioss-task` (task-mode name chosen) → Task 10. ✓
5. `/unioss-ship` skill (config + helper + skill/command) → Tasks 7, 8, 9. ✓
6. Tester quick-access → Task 11. ✓
7. Tester per-screen checklist + screenshots → Task 12. ✓
Cross-cutting version bump + test sweep → Task 13. ✓

**Type consistency:** `fileLink(path, {label,cwd})` (Task 2) used consistently. `box(title, lines, width)` / `displayWidth(str)` (Task 4) match doctor usage (Task 5). `mrUrl({host,repoWebPath,sourceBranch,targetBranch})` + `shipInfo({cwd,mode,repoWebPath,sourceBranch})` (Task 8) match the skill's CLI invocations (Task 9) and config `ship.*` shape (Task 7). Config `.config` path (Task 1) matches the ship-config tests' `workspace()` helper (already updated in Task 1).

**Placeholder scan:** no TBD/TODO; every code + doc step shows concrete content. Alignment-sensitive boxes (Tasks 5, 6) carry a programmatic width-equality check rather than "eyeball only."

**Known follow-on (not a gap):** `/unioss-task` `TASK#<slug>` identity flows through the existing round/guard regexes (`/<name>/round-N/`) unchanged; no guard edits needed.
```
