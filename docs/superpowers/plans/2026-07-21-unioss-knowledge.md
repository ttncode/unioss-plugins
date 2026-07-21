# unioss-knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new `unioss-knowledge` Claude Code plugin that crawls GitLab `UNIOSS 3` tickets + comments, renders human digests (WWWH / focus / sentiment) for any period, and maintains a tiered, token-budgeted agent knowledge base injected before every ticket.

**Architecture:** A shared crawl layer (label-scoped GitLab issues + notes) feeds two consumers — a human digest renderer and an agent-KB distiller. The store lives under `.walkthrough/.knowledge/` in three tiers (GLOBAL.md tiny / domain+rules on-demand / sentiment raw). A SessionStart hook injects GLOBAL.md; the pipeline's investigate stage reads the deeper tiers. Filesystem-coupled to `unioss-pipeline` — no code import.

**Tech Stack:** Node.js ESM (`.mjs`), built-in `fetch`, `node:test` + `node:assert/strict`, `node:crypto`. Markdown command/skill files. No external npm dependencies.

## Global Constraints

- **Runtime:** Node ESM only. `export`/`import`, no CommonJS `require`. Files end `.mjs`. Tests are `<name>.test.mjs` beside the source, run with `node --test`.
- **No new npm dependencies.** Use built-ins only (`node:fs`, `node:path`, `node:crypto`, `node:os`, `node:url`, global `fetch`).
- **Read-only against GitLab.** Only `GET` requests. Never POST/PUT/DELETE. Header `PRIVATE-TOKEN`. Token via `process.env.GITLAB_TOKEN` or `export GITLAB_TOKEN=…` in `~/.zshrc.local`.
- **Ticket source:** the dashboard label filter — `labels=<workLabel>` (default `UNIOSS 3`), across all projects, via `GET /api/v4/issues`. Config resolves `workLabel` from `.walkthrough/.config/unioss.config.json` (`gitlab.workLabel` → `ship.label` → default `UNIOSS 3`).
- **Store path:** `<cwd>/<artifactRoot>/.knowledge/` where `artifactRoot` defaults to `.walkthrough`.
- **GLOBAL.md token cap:** 1200 tokens (~4800 chars, `chars/4` estimate). Staleness threshold: 7 days.
- **Writing principle:** all skill/command/hook text is clear, concise, agent-optimized — imperative, scannable, lists over paragraphs, no rambling.
- **Fixed multi-option prompt format** (inline text, not the AskUserQuestion tool):
  ```
  <context sentence>. What would you like to do?

  1. <recommended option> (recommended)
  2. <next option>

  Which option?
  ```
  Header question → blank line → numbered options (safe default first, suffixed `(recommended)`, exactly one) → blank line → `Which option?`. A neutral scope selector (period picker) marks nothing.
- **All writes atomic:** temp file + rename. On any GitLab error, abort before writing — never leave a half-written artifact.

---

## File Structure

```
plugins/unioss-knowledge/
  .claude-plugin/plugin.json
  scripts/
    config.mjs        resolve host / workLabel / artifactRoot from shared config
    gitlab.mjs        token + apiGet + listIssues (paginated) + listNotes
    period.mjs        parse period strings + detect intent/period from a question
    store.mjs         paths, atomic write, jsonl dedupe, index.json, staleness, lock
    crawl.mjs         compose gitlab+period → normalized issues+notes; observations
    wwwh.mjs          render one WWWH block + a daily digest (count-safe)
    distill.mjs       sentiment split, GLOBAL render, token-cap truncation
    ticket.mjs        CLI: one ticket → WWWH
    today.mjs         CLI: today's UNIOSS 3 tickets → daily digest
    refresh.mjs       CLI: daily|weekly|monthly distill (mutates current KB)
    ask.mjs           CLI: intent+period → dated report (read-only)
    status.mjs        CLI: index/staleness summary
    *.test.mjs
  hooks/
    inject-knowledge.mjs   SessionStart: inject GLOBAL.md + staleness nudge
    hooks.json
    inject-knowledge.test.mjs
  commands/
    unioss-knowledge.md  -ticket.md  -today.md  -ask.md  -refresh.md  -approve.md
  skills/
    unioss-knowledge-ask/SKILL.md          (interactive picker + staleness gate)
    unioss-knowledge-refresh/SKILL.md
    unioss-knowledge-approve/SKILL.md
.claude-plugin/marketplace.json            (edit: register plugin)
plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md   (edit: GATE-0 KB read + domain append)
```

---

## Task 1: Plugin scaffold + config resolver

**Files:**
- Create: `plugins/unioss-knowledge/.claude-plugin/plugin.json`
- Create: `plugins/unioss-knowledge/scripts/config.mjs`
- Test: `plugins/unioss-knowledge/scripts/config.test.mjs`
- Modify: `.claude-plugin/marketplace.json` (add plugin entry)

**Interfaces:**
- Produces: `DEFAULTS` `{ host: string, workLabel: string, artifactRoot: string }`; `resolveConfig(cwd?) → { host, workLabel, artifactRoot }`.

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/config.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, resolveConfig } from './config.mjs';

function withConfig(json) {
  const dir = mkdtempSync(join(tmpdir(), 'kcfg-'));
  if (json !== undefined) {
    mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), JSON.stringify(json));
  }
  return dir;
}

test('defaults when no config file', () => {
  assert.deepEqual(resolveConfig(withConfig(undefined)), DEFAULTS);
});

test('gitlab.workLabel wins', () => {
  const dir = withConfig({ gitlab: { host: 'g.example', workLabel: 'X' }, artifactRoot: '.wt' });
  assert.deepEqual(resolveConfig(dir), { host: 'g.example', workLabel: 'X', artifactRoot: '.wt' });
});

test('falls back to ship.label then default', () => {
  const dir = withConfig({ ship: { label: 'UNIOSS 3' } });
  assert.equal(resolveConfig(dir).workLabel, 'UNIOSS 3');
});

test('malformed JSON yields defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kcfg-'));
  mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
  writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), '{bad');
  assert.deepEqual(resolveConfig(dir), DEFAULTS);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/config.test.mjs`
Expected: FAIL — `Cannot find module './config.mjs'`.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/config.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = { host: 'gitlab.unioss.jp', workLabel: 'UNIOSS 3', artifactRoot: '.walkthrough' };

export function resolveConfig(cwd = process.cwd()) {
  const p = join(cwd, '.walkthrough', '.config', 'unioss.config.json');
  if (!existsSync(p)) return { ...DEFAULTS };
  let file;
  try { file = JSON.parse(readFileSync(p, 'utf8')); } catch { return { ...DEFAULTS }; }
  return {
    host: file.gitlab?.host ?? DEFAULTS.host,
    workLabel: file.gitlab?.workLabel ?? file.ship?.label ?? DEFAULTS.workLabel,
    artifactRoot: file.artifactRoot ?? DEFAULTS.artifactRoot,
  };
}
```

- [ ] **Step 4: Create the plugin manifest**

```json
// plugins/unioss-knowledge/.claude-plugin/plugin.json
{
  "name": "unioss-knowledge",
  "version": "0.1.0",
  "description": "UNIOSS knowledge base + digests: crawl UNIOSS 3 tickets/comments into human reports and a tiered agent knowledge base injected before every ticket.",
  "author": { "name": "ttncode" }
}
```

- [ ] **Step 5: Register the plugin in the marketplace**

In `.claude-plugin/marketplace.json`, add a second entry to the `plugins` array (after the `unioss-pipeline` object):

```json
    ,{
      "name": "unioss-knowledge",
      "source": "./plugins/unioss-knowledge",
      "description": "UNIOSS knowledge base + digests: UNIOSS 3 ticket/comment intelligence and an agent knowledge base read before every ticket."
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/config.test.mjs`
Expected: PASS (4 tests). Also: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json'))"` exits 0.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-knowledge/.claude-plugin/plugin.json plugins/unioss-knowledge/scripts/config.mjs plugins/unioss-knowledge/scripts/config.test.mjs .claude-plugin/marketplace.json
git commit -m "feat(unioss-knowledge): plugin scaffold + config resolver"
```

---

## Task 2: GitLab client (token, apiGet, listIssues, listNotes)

**Files:**
- Create: `plugins/unioss-knowledge/scripts/gitlab.mjs`
- Test: `plugins/unioss-knowledge/scripts/gitlab.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `getToken() → string | undefined`
  - `apiGet(host, endpoint, token, fetchImpl?) → Promise<any>` (throws `Error` on non-2xx)
  - `listIssues(host, token, { label?, createdAfter?, createdBefore?, state? }, fetchImpl?) → Promise<Issue[]>` (paginated, hard cap 50 pages)
  - `listNotes(host, token, projectId, iid, fetchImpl?) → Promise<Note[]>`
  - Issue fields used downstream: `{ id, iid, project_id, title, description, web_url, created_at, updated_at, labels, author:{name} }`. Note fields: `{ id, body, system, created_at, author:{name} }`.

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/gitlab.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiGet, listIssues } from './gitlab.mjs';

function fakeFetch(pages) {
  let i = 0;
  return async () => ({ ok: true, status: 200, json: async () => pages[i++] ?? [] });
}

test('apiGet throws on non-2xx', async () => {
  const f = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => apiGet('h', 'issues', 't', f), /404/);
});

test('listIssues paginates until a short page', async () => {
  const full = Array.from({ length: 100 }, (_, k) => ({ iid: k }));
  const issues = await listIssues('h', 't', { label: 'UNIOSS 3' }, fakeFetch([full, [{ iid: 999 }]]));
  assert.equal(issues.length, 101);
  assert.equal(issues.at(-1).iid, 999);
});

test('listIssues stops on first empty page', async () => {
  const issues = await listIssues('h', 't', {}, fakeFetch([[]]));
  assert.equal(issues.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/gitlab.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/gitlab.mjs
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export function getToken() {
  const home = homedir();
  if (home) {
    const p = join(home, '.zshrc.local');
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/export GITLAB_TOKEN=(.+)/);
      if (m) return m[1].trim();
    }
  }
  return process.env.GITLAB_TOKEN;
}

export async function apiGet(host, endpoint, token, fetchImpl = fetch) {
  const url = `https://${host}/api/v4/${endpoint}`;
  const res = await fetchImpl(url, { headers: { 'PRIVATE-TOKEN': token } });
  if (!res.ok) throw new Error(`GitLab ${res.status} for ${endpoint}`);
  return res.json();
}

const MAX_PAGES = 50;

export async function listIssues(host, token, opts = {}, fetchImpl = fetch) {
  const { label, createdAfter, createdBefore, state = 'all' } = opts;
  const params = new URLSearchParams({ scope: 'all', per_page: '100', order_by: 'created_at', sort: 'desc', state });
  if (label) params.set('labels', label);
  if (createdAfter) params.set('created_after', createdAfter);
  if (createdBefore) params.set('created_before', createdBefore);
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    params.set('page', String(page));
    const batch = await apiGet(host, `issues?${params.toString()}`, token, fetchImpl);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export async function listNotes(host, token, projectId, iid, fetchImpl = fetch) {
  return apiGet(host, `projects/${projectId}/issues/${iid}/notes?per_page=100`, token, fetchImpl);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/gitlab.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/gitlab.mjs plugins/unioss-knowledge/scripts/gitlab.test.mjs
git commit -m "feat(unioss-knowledge): read-only GitLab client with paginated issue listing"
```

---

## Task 3: Period + intent parsing

**Files:**
- Create: `plugins/unioss-knowledge/scripts/period.mjs`
- Test: `plugins/unioss-knowledge/scripts/period.test.mjs`

**Interfaces:**
- Produces:
  - `parsePeriod(input, now?) → { key: string, from: Date, to: Date } | null` — accepts `today`, `week`, `month`, `year`, `YYYY-MM`, `YYYY-MM-DD..YYYY-MM-DD` (also `to` separator).
  - `detectIntent(question) → 'focus' | 'sentiment' | 'tickets' | 'general'`
  - `detectPeriod(question, now?) → period | null` — natural language; `null` means "ask the picker".
  - `periodOverlapsPresent(period, now?) → boolean`

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/period.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePeriod, detectIntent, detectPeriod, periodOverlapsPresent } from './period.mjs';

const NOW = new Date('2026-07-21T10:00:00Z');

test('month period spans month start to now', () => {
  const p = parsePeriod('month', NOW);
  assert.equal(p.key, '2026-07');
  assert.equal(p.from.getUTCMonth(), 6);
});

test('specific YYYY-MM', () => {
  const p = parsePeriod('2026-03', NOW);
  assert.equal(p.key, '2026-03');
  assert.equal(p.from.getFullYear(), 2026);
});

test('custom range with "to"', () => {
  const p = parsePeriod('2026-06-01 to 2026-06-30', NOW);
  assert.ok(p);
  assert.equal(p.key, '20260601-20260630');
});

test('unknown input is null', () => {
  assert.equal(parsePeriod('garble', NOW), null);
});

test('detectIntent classifies sentiment and focus', () => {
  assert.equal(detectIntent('what did customers praise or criticize'), 'sentiment');
  assert.equal(detectIntent('what is the customer focusing on'), 'focus');
});

test('detectPeriod reads a named month + year', () => {
  const p = detectPeriod('what did customers praise in June 2026', NOW);
  assert.equal(p.key, '2026-06');
});

test('detectPeriod returns null when absent', () => {
  assert.equal(detectPeriod('customer focus', NOW), null);
});

test('periodOverlapsPresent true for current month, false for past', () => {
  assert.equal(periodOverlapsPresent(parsePeriod('month', NOW), NOW), true);
  assert.equal(periodOverlapsPresent(parsePeriod('2026-03', NOW), NOW), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/period.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/period.mjs
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad2 = (n) => String(n).padStart(2, '0');

function startOfWeek(now) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function isoWeek(now) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d - firstThursday) / 604800000);
  return `${d.getUTCFullYear()}-W${pad2(week)}`;
}

export function parsePeriod(input, now = new Date()) {
  const s = String(input || '').trim().toLowerCase();
  const y = now.getFullYear(), m = now.getMonth();
  if (s === 'today') { const from = new Date(y, m, now.getDate()); return { key: from.toISOString().slice(0, 10), from, to: new Date(now) }; }
  if (s === 'week') { const from = startOfWeek(now); return { key: isoWeek(now), from, to: new Date(now) }; }
  if (s === 'month') { const from = new Date(y, m, 1); return { key: `${y}-${pad2(m + 1)}`, from, to: new Date(now) }; }
  if (s === 'year') { const from = new Date(y, 0, 1); return { key: `${y}`, from, to: new Date(now) }; }
  const mm = s.match(/^(\d{4})-(\d{2})$/);
  if (mm) { const yy = +mm[1], mo = +mm[2] - 1; return { key: s, from: new Date(yy, mo, 1), to: new Date(yy, mo + 1, 1) }; }
  const rg = s.match(/^(\d{4})-(\d{2})-(\d{2})\s*(?:\.\.|to)\s*(\d{4})-(\d{2})-(\d{2})$/);
  if (rg) {
    const from = new Date(+rg[1], +rg[2] - 1, +rg[3]);
    const to = new Date(+rg[4], +rg[5] - 1, +rg[6], 23, 59, 59);
    return { key: `${rg[1]}${rg[2]}${rg[3]}-${rg[4]}${rg[5]}${rg[6]}`, from, to };
  }
  return null;
}

export function detectIntent(question) {
  const q = String(question || '').toLowerCase();
  if (/prais|satisf|apprecia|complain|criticiz|dissatisf|unhappy|friction|attention/.test(q)) return 'sentiment';
  if (/focus|priorit|develop|working on|theme/.test(q)) return 'focus';
  if (/ticket|issue|overview|\bnew\b/.test(q)) return 'tickets';
  return 'general';
}

export function detectPeriod(question, now = new Date()) {
  const q = String(question || '').toLowerCase();
  const ym = q.match(/\b(20\d{2})-(\d{2})\b/);
  if (ym) return parsePeriod(`${ym[1]}-${ym[2]}`, now);
  const named = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/);
  if (named) { const mo = MONTHS.indexOf(named[1].slice(0, 3)); return parsePeriod(`${named[2]}-${pad2(mo + 1)}`, now); }
  if (/this week/.test(q)) return parsePeriod('week', now);
  if (/this month/.test(q)) return parsePeriod('month', now);
  if (/this year/.test(q)) return parsePeriod('year', now);
  return null;
}

export function periodOverlapsPresent(period, now = new Date()) {
  if (!period) return false;
  return period.to >= now || (now >= period.from && now <= period.to);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/period.test.mjs`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/period.mjs plugins/unioss-knowledge/scripts/period.test.mjs
git commit -m "feat(unioss-knowledge): period + intent parsing"
```

---

## Task 4: Store (paths, atomic write, jsonl dedupe, index, staleness, lock)

**Files:**
- Create: `plugins/unioss-knowledge/scripts/store.mjs`
- Test: `plugins/unioss-knowledge/scripts/store.test.mjs`

**Interfaces:**
- Produces:
  - `knowledgeDir(cwd, artifactRoot) → string`
  - `ensureDir(dir) → void`
  - `atomicWrite(path, content) → void`
  - `obsId(projectId, iid, noteId) → string` (sha1 hex)
  - `appendObservations(dir, records) → number` (records: `{ id, ... }`; returns count newly added; dedupes by `id`)
  - `readIndex(dir) → object`; `writeIndex(dir, obj) → void`
  - `touchLayer(dir, layer, now?) → object` (sets `index[layer].lastRun`)
  - `stalenessDays(index, layer, now?) → number | null`
  - `acquireLock(dir) → boolean`; `releaseLock(dir) → void`

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/store.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  knowledgeDir, atomicWrite, obsId, appendObservations,
  readIndex, touchLayer, stalenessDays, acquireLock, releaseLock,
} from './store.mjs';

const mk = () => mkdtempSync(join(tmpdir(), 'kstore-'));

test('knowledgeDir composes artifactRoot/.knowledge', () => {
  assert.equal(knowledgeDir('/x', '.walkthrough'), join('/x', '.walkthrough', '.knowledge'));
});

test('obsId is stable and unique', () => {
  assert.equal(obsId(1, 2, 3), obsId(1, 2, 3));
  assert.notEqual(obsId(1, 2, 3), obsId(1, 2, 4));
});

test('appendObservations dedupes by id across runs', () => {
  const dir = mk();
  const recs = [{ id: 'a', body: 'x' }, { id: 'b', body: 'y' }];
  assert.equal(appendObservations(dir, recs), 2);
  assert.equal(appendObservations(dir, recs), 0);
  assert.equal(appendObservations(dir, [{ id: 'b' }, { id: 'c' }]), 1);
});

test('atomicWrite writes final content', () => {
  const dir = mk();
  const f = join(dir, 'x.md');
  atomicWrite(f, 'hello');
  assert.equal(readFileSync(f, 'utf8'), 'hello');
});

test('touchLayer + stalenessDays', () => {
  const dir = mk();
  const past = new Date('2026-07-12T00:00:00Z');
  touchLayer(dir, 'sentiment', past);
  const now = new Date('2026-07-21T00:00:00Z');
  assert.equal(stalenessDays(readIndex(dir), 'sentiment', now), 9);
  assert.equal(stalenessDays(readIndex(dir), 'missing', now), null);
});

test('lock is exclusive', () => {
  const dir = mk();
  assert.equal(acquireLock(dir), true);
  assert.equal(acquireLock(dir), false);
  releaseLock(dir);
  assert.equal(acquireLock(dir), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/store.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/store.mjs
import { createHash } from 'node:crypto';
import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

export function knowledgeDir(cwd, artifactRoot) { return join(cwd, artifactRoot, '.knowledge'); }
export function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

export function atomicWrite(path, content) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function obsId(projectId, iid, noteId) {
  return createHash('sha1').update(`${projectId}:${iid}:${noteId}`).digest('hex');
}

export function appendObservations(dir, records) {
  const sentimentDir = join(dir, 'sentiment');
  ensureDir(sentimentDir);
  const file = join(sentimentDir, 'observations.jsonl');
  const seen = new Set();
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { seen.add(JSON.parse(line).id); } catch { /* skip corrupt line */ }
    }
  }
  const add = records.filter((r) => r.id && !seen.has(r.id));
  if (add.length === 0) return 0;
  appendFileSync(file, add.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return add.length;
}

export function readIndex(dir) {
  const f = join(dir, 'index.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; }
}
export function writeIndex(dir, obj) {
  ensureDir(dir);
  atomicWrite(join(dir, 'index.json'), JSON.stringify(obj, null, 2) + '\n');
}
export function touchLayer(dir, layer, now = new Date()) {
  const idx = readIndex(dir);
  idx[layer] = { lastRun: now.toISOString() };
  writeIndex(dir, idx);
  return idx;
}
export function stalenessDays(index, layer, now = new Date()) {
  const iso = index?.[layer]?.lastRun;
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
}

export function acquireLock(dir) {
  ensureDir(dir);
  const lock = join(dir, '.lock');
  if (existsSync(lock)) return false;
  writeFileSync(lock, String(process.pid));
  return true;
}
export function releaseLock(dir) {
  const lock = join(dir, '.lock');
  if (existsSync(lock)) unlinkSync(lock);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/store.test.mjs`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/store.mjs plugins/unioss-knowledge/scripts/store.test.mjs
git commit -m "feat(unioss-knowledge): store — atomic write, jsonl dedupe, index, staleness, lock"
```

---

## Task 5: Crawl composition + observations

**Files:**
- Create: `plugins/unioss-knowledge/scripts/crawl.mjs`
- Test: `plugins/unioss-knowledge/scripts/crawl.test.mjs`

**Interfaces:**
- Consumes: `listIssues`, `listNotes` (Task 2, injectable via `deps`); `obsId` (Task 4).
- Produces:
  - `moduleOf(issue) → 'front-end' | 'admin-page'`
  - `crawl({ host, token, label, from, to }, deps?) → Promise<Array<{ issue, notes }>>`
  - `toObservations(crawled) → Array<{ id, project_id, iid, author, at, body, source }>` (skips `system` notes)

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/crawl.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawl, toObservations, moduleOf } from './crawl.mjs';

const issue = (over = {}) => ({ id: 1, iid: 10, project_id: 32, title: 'T', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T00:00:00Z', author: { name: 'A' }, ...over });

test('moduleOf reads repo from web_url', () => {
  assert.equal(moduleOf(issue()), 'admin-page');
  assert.equal(moduleOf(issue({ web_url: 'https://g/unioss/FrontEnd/-/issues/3' })), 'front-end');
});

test('crawl attaches notes per issue', async () => {
  const deps = {
    listIssues: async () => [issue(), issue({ iid: 11 })],
    listNotes: async (h, t, pid, iid) => [{ id: 5, body: `n${iid}`, system: false, created_at: 'x', author: { name: 'U' } }],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3' }, deps);
  assert.equal(out.length, 2);
  assert.equal(out[0].notes[0].body, 'n10');
});

test('toObservations dedup-keys and skips system notes', () => {
  const crawled = [{ issue: issue(), notes: [
    { id: 5, body: 'real', system: false, created_at: 'x', author: { name: 'U' } },
    { id: 6, body: 'changed labels', system: true, created_at: 'y', author: { name: 'bot' } },
  ] }];
  const obs = toObservations(crawled);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].body, 'real');
  assert.ok(obs[0].id.length === 40);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/crawl.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/crawl.mjs
import { listIssues, listNotes } from './gitlab.mjs';
import { obsId } from './store.mjs';

export function moduleOf(issue) {
  return issue.web_url?.includes('/FrontEnd/') ? 'front-end' : 'admin-page';
}

export async function crawl({ host, token, label, from, to }, deps = { listIssues, listNotes }) {
  const createdAfter = from ? from.toISOString() : undefined;
  const createdBefore = to ? to.toISOString() : undefined;
  const issues = await deps.listIssues(host, token, { label, createdAfter, createdBefore });
  const out = [];
  for (const issue of issues) {
    const notes = await deps.listNotes(host, token, issue.project_id, issue.iid);
    out.push({ issue, notes: Array.isArray(notes) ? notes : [] });
  }
  return out;
}

export function toObservations(crawled) {
  const recs = [];
  for (const { issue, notes } of crawled) {
    for (const n of notes) {
      if (n.system) continue;
      recs.push({
        id: obsId(issue.project_id, issue.iid, n.id),
        project_id: issue.project_id,
        iid: issue.iid,
        author: n.author?.name ?? 'unknown',
        at: n.created_at,
        body: (n.body || '').slice(0, 500),
        source: issue.web_url,
      });
    }
  }
  return recs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/crawl.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/crawl.mjs plugins/unioss-knowledge/scripts/crawl.test.mjs
git commit -m "feat(unioss-knowledge): crawl composition + observation extraction"
```

---

## Task 6: WWWH renderer

**Files:**
- Create: `plugins/unioss-knowledge/scripts/wwwh.mjs`
- Test: `plugins/unioss-knowledge/scripts/wwwh.test.mjs`

**Interfaces:**
- Consumes: `moduleOf` (Task 5).
- Produces:
  - `renderWwwh(issue) → string` (a `### PREFIX#IID — title` block with What/Why/Who/How bullets)
  - `renderDailyDigest(issues, date) → string` (asserts one block per issue; empty-safe)

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/wwwh.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWwwh, renderDailyDigest } from './wwwh.mjs';

const issue = (over = {}) => ({ iid: 10, title: 'Fix ledger', description: 'Ledger totals wrong\nmore', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T09:00:00Z', labels: ['UNIOSS 3'], author: { name: 'Sato' }, ...over });

test('renderWwwh includes prefix, title, and all four Ws', () => {
  const md = renderWwwh(issue());
  assert.match(md, /### AP#10 — Fix ledger/);
  assert.match(md, /\*\*What:\*\* Ledger totals wrong/);
  assert.match(md, /\*\*Who:\*\* Sato/);
  assert.match(md, /\*\*How:\*\* https:\/\/g/);
});

test('renderDailyDigest one block per issue, count in header', () => {
  const md = renderDailyDigest([issue(), issue({ iid: 11, title: 'B' })], '2026-07-21');
  assert.match(md, /2 ticket\(s\)/);
  assert.equal((md.match(/### AP#/g) || []).length, 2);
});

test('renderDailyDigest empty-safe', () => {
  const md = renderDailyDigest([], '2026-07-21');
  assert.match(md, /No new tickets/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/wwwh.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/wwwh.mjs
import { moduleOf } from './crawl.mjs';

function prefixOf(issue) { return moduleOf(issue) === 'front-end' ? 'FE' : 'AP'; }

function firstLine(text) {
  const line = (text || '').split('\n').map((l) => l.trim()).find(Boolean);
  return line || '(no description)';
}

function why(issue) {
  const labels = (issue.labels || []).filter((l) => l !== 'UNIOSS 3');
  return labels.length ? labels.join(', ') : 'customer request';
}

export function renderWwwh(issue) {
  return [
    `### ${prefixOf(issue)}#${issue.iid} — ${issue.title}`,
    `- **What:** ${firstLine(issue.description)}`,
    `- **Why:** ${why(issue)}`,
    `- **Who:** ${issue.author?.name ?? 'unknown'} · ${(issue.created_at || '').slice(0, 10)}`,
    `- **How:** ${issue.web_url}`,
    '',
  ].join('\n');
}

export function renderDailyDigest(issues, date) {
  const blocks = issues.map(renderWwwh);
  if (blocks.length !== issues.length) throw new Error('WWWH count mismatch');
  const header = `# New UNIOSS 3 tickets — ${date}\n_${issues.length} ticket(s)_\n\n`;
  return header + (blocks.length ? blocks.join('\n') : '_No new tickets._\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/wwwh.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/wwwh.mjs plugins/unioss-knowledge/scripts/wwwh.test.mjs
git commit -m "feat(unioss-knowledge): WWWH renderer + daily digest"
```

---

## Task 7: Distiller (sentiment split, GLOBAL render, token cap)

**Files:**
- Create: `plugins/unioss-knowledge/scripts/distill.mjs`
- Test: `plugins/unioss-knowledge/scripts/distill.test.mjs`

**Interfaces:**
- Produces:
  - `estimateTokens(text) → number` (chars/4, ceil)
  - `truncateToCap(text, capTokens) → string`
  - `splitSentiment(observations) → { praise: Array<{body, source}>, criticism: Array<{body, source}> }`
  - `renderSentiment({ praise, criticism }, periodKey) → string`
  - `renderGlobal({ focus, rules, friction, updated, sentimentAgeDays }, capTokens?) → string` (capped at 1200 by default)

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/distill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, truncateToCap, splitSentiment, renderGlobal } from './distill.mjs';

test('truncateToCap keeps short text, trims long', () => {
  assert.equal(truncateToCap('abc', 100), 'abc');
  const long = 'x'.repeat(1000);
  assert.ok(truncateToCap(long, 10).length <= 40);
});

test('splitSentiment classifies by keyword', () => {
  const obs = [
    { body: 'Thank you, this is very helpful', source: 's1' },
    { body: 'This is broken and frustrating', source: 's2' },
    { body: 'neutral status update', source: 's3' },
  ];
  const { praise, criticism } = splitSentiment(obs);
  assert.equal(praise.length, 1);
  assert.equal(criticism.length, 1);
});

test('renderGlobal respects the token cap', () => {
  const focus = Array.from({ length: 500 }, (_, i) => `focus item number ${i} with padding text`);
  const md = renderGlobal({ focus, rules: [], friction: [], updated: '2026-07-21', sentimentAgeDays: 2 }, 1200);
  assert.ok(estimateTokens(md) <= 1200);
  assert.match(md, /read before any ticket/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/distill.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// plugins/unioss-knowledge/scripts/distill.mjs
const PRAISE = /(thank|great|good\s+job|nice|helpful|apprecia|perfect|excellent|resolved|works? (now|well))/i;
const CRITICISM = /(broken|bug|wrong|frustrat|slow|error|fail|not working|disappoint|complain|still|again)/i;

export function estimateTokens(text) { return Math.ceil((text || '').length / 4); }

export function truncateToCap(text, capTokens) {
  const capChars = capTokens * 4;
  if (text.length <= capChars) return text;
  return text.slice(0, capChars).replace(/\n[^\n]*$/, '\n');
}

export function splitSentiment(observations) {
  const praise = [], criticism = [];
  for (const o of observations) {
    const body = o.body || '';
    if (PRAISE.test(body)) praise.push({ body: body.slice(0, 200), source: o.source });
    else if (CRITICISM.test(body)) criticism.push({ body: body.slice(0, 200), source: o.source });
  }
  return { praise, criticism };
}

const bullets = (arr, map) => (arr.length ? arr.map(map) : ['- (none yet)']);

export function renderSentiment({ praise, criticism }, periodKey) {
  return [
    `# Customer sentiment — ${periodKey}`,
    '', '## Praise',
    ...bullets(praise, (p) => `- ${p.body}  (${p.source})`),
    '', '## Criticism',
    ...bullets(criticism, (c) => `- ${c.body}  (${c.source})`),
    '',
  ].join('\n');
}

export function renderGlobal({ focus = [], rules = [], friction = [], updated, sentimentAgeDays }, capTokens = 1200) {
  const lines = [
    '# UNIOSS Knowledge — read before any ticket',
    `_Updated ${updated ?? '—'} · sentiment ${sentimentAgeDays ?? '?'}d old_`,
    '', '## Customer focus this month', ...bullets(focus, (f) => `- ${f}`),
    '', '## Top active pitfalls (approved rules)', ...bullets(rules, (r) => `- ${r}`),
    '', '## Current friction (this week)', ...bullets(friction, (f) => `- ${f}`),
    '',
  ];
  return truncateToCap(lines.join('\n'), capTokens);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/distill.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/distill.mjs plugins/unioss-knowledge/scripts/distill.test.mjs
git commit -m "feat(unioss-knowledge): distiller — sentiment split, GLOBAL render, token cap"
```

---

## Task 8: CLI entrypoints — ticket, today, status

**Files:**
- Create: `plugins/unioss-knowledge/scripts/ticket.mjs`
- Create: `plugins/unioss-knowledge/scripts/today.mjs`
- Create: `plugins/unioss-knowledge/scripts/status.mjs`
- Test: `plugins/unioss-knowledge/scripts/today.test.mjs`

**Interfaces:**
- Consumes: `resolveConfig` (T1), `getToken` (T2), `parsePeriod` (T3), store helpers (T4), `crawl`/`toObservations` (T5), `renderWwwh`/`renderDailyDigest` (T6).
- Produces:
  - `runToday(cwd?, now?, deps?) → Promise<{ path, count }>` (deps injectable: `{ crawl, getToken }`)
  - `runTicket(url, cwd?, deps?) → Promise<{ prefix, iid, markdown }>`
  - `runStatus(cwd?) → string`

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/today.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runToday } from './today.mjs';

const issue = (iid) => ({ iid, project_id: 32, title: `T${iid}`, description: 'desc', web_url: 'https://g/unioss/AdminPage/-/issues/' + iid, created_at: '2026-07-21T09:00:00Z', labels: [], author: { name: 'A' } });

test('runToday writes a dated digest and returns count', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const deps = {
    getToken: () => 'tok',
    crawl: async () => [{ issue: issue(10), notes: [] }, { issue: issue(11), notes: [] }],
  };
  const now = new Date('2026-07-21T10:00:00Z');
  const res = await runToday(cwd, now, deps);
  assert.equal(res.count, 2);
  assert.ok(existsSync(res.path));
  assert.match(readFileSync(res.path, 'utf8'), /2 ticket\(s\)/);
  assert.ok(existsSync(join(cwd, '.walkthrough', '.knowledge', 'index.json')));
});

test('runToday throws a clear error without a token', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await assert.rejects(() => runToday(cwd, new Date(), { getToken: () => undefined, crawl: async () => [] }), /GITLAB_TOKEN/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/today.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `today.mjs`**

```js
// plugins/unioss-knowledge/scripts/today.mjs
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';

export async function runToday(cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const period = parsePeriod('today', now);
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  const date = period.key;
  const md = renderDailyDigest(crawled.map((c) => c.issue), date);
  const path = join(dir, 'digests', `${date}-daily.md`);
  atomicWrite(path, md);
  appendObservations(dir, toObservations(crawled));
  touchLayer(dir, 'daily', now);
  return { path, count: crawled.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runToday().then((r) => console.log(`${r.count} ticket(s) → ${r.path}`)).catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 4: Write `ticket.mjs`**

```js
// plugins/unioss-knowledge/scripts/ticket.mjs
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken, apiGet } from './gitlab.mjs';
import { renderWwwh } from './wwwh.mjs';

const URL_RE = /https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/;

export async function runTicket(url, cwd = process.cwd(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const get = deps.apiGet ?? apiGet;
  const m = String(url).match(URL_RE);
  if (!m) throw new Error('Invalid GitLab ticket URL');
  const [, host, ns, repo, , iid] = m;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const project = encodeURIComponent(`${ns}/${repo}`);
  const issue = await get(host, `projects/${project}/issues/${iid}`, token);
  const prefix = repo === 'FrontEnd' ? 'FE' : 'AP';
  return { prefix, iid, markdown: renderWwwh(issue) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runTicket(process.argv[2]).then((r) => console.log(r.markdown)).catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 5: Write `status.mjs`**

```js
// plugins/unioss-knowledge/scripts/status.mjs
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { knowledgeDir, readIndex, stalenessDays } from './store.mjs';

export function runStatus(cwd = process.cwd(), now = new Date()) {
  const { artifactRoot } = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, artifactRoot);
  if (!existsSync(dir)) return 'Knowledge store not initialized. Run /unioss-knowledge-today or /unioss-knowledge-refresh.';
  const idx = readIndex(dir);
  const layers = ['daily', 'weekly', 'monthly', 'sentiment'];
  const lines = ['UNIOSS knowledge status:'];
  for (const l of layers) {
    const age = stalenessDays(idx, l, now);
    lines.push(`- ${l}: ${age == null ? 'never run' : age + 'd ago'}`);
  }
  const staged = join(dir, 'rules', 'staged.md');
  const pending = existsSync(staged) ? (readFileSync(staged, 'utf8').match(/^- /gm) || []).length : 0;
  lines.push(`- staged rules pending approval: ${pending}`);
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) console.log(runStatus());
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/today.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-knowledge/scripts/ticket.mjs plugins/unioss-knowledge/scripts/today.mjs plugins/unioss-knowledge/scripts/status.mjs plugins/unioss-knowledge/scripts/today.test.mjs
git commit -m "feat(unioss-knowledge): ticket/today/status CLI entrypoints"
```

---

## Task 9: CLI entrypoints — refresh + ask

**Files:**
- Create: `plugins/unioss-knowledge/scripts/refresh.mjs`
- Create: `plugins/unioss-knowledge/scripts/ask.mjs`
- Test: `plugins/unioss-knowledge/scripts/ask.test.mjs`

**Interfaces:**
- Consumes: all prior libs.
- Produces:
  - `runRefresh(kind, cwd?, now?, deps?) → Promise<{ written: string[] }>` — `kind ∈ {daily, weekly, monthly}`. Mutates the current-window KB: weekly writes `sentiment/current.md` + updates `index.sentiment`; monthly + weekly re-render `GLOBAL.md`. Lock-guarded; aborts on crawl error leaving the store unchanged.
  - `runAsk({ intent, period, mutate }, cwd?, now?, deps?) → Promise<{ path, markdown }>` — read-only report to `digests/<periodKey>-<intent>.md`; never writes GLOBAL/rules/sentiment unless `mutate === true` **and** the period overlaps the present (mirrors refresh for the current period).

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/scripts/ask.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAsk } from './ask.mjs';
import { parsePeriod } from './period.mjs';

const crawlStub = async () => [{
  issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-06-05T00:00:00Z', labels: [], author: { name: 'A' } },
  notes: [{ id: 1, body: 'This is broken and slow', system: false, created_at: 'x', author: { name: 'U' } }],
}];

test('ask writes a dated report and does NOT touch GLOBAL/sentiment when historical', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  const res = await runAsk({ intent: 'sentiment', period, mutate: false }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: crawlStub });
  assert.ok(existsSync(res.path));
  assert.match(res.path, /2026-06-sentiment\.md$/);
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'GLOBAL.md')), false);
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'sentiment', 'current.md')), false);
});

test('ask on historical period ignores mutate=true (never overwrites live now-KB)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  await runAsk({ intent: 'sentiment', period, mutate: true }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: crawlStub });
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'sentiment', 'current.md')), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/scripts/ask.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `refresh.mjs`**

```js
// plugins/unioss-knowledge/scripts/refresh.mjs
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import {
  knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer,
  readIndex, stalenessDays, acquireLock, releaseLock,
} from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { splitSentiment, renderSentiment, renderGlobal } from './distill.mjs';

const WINDOW = { daily: 'today', weekly: 'week', monthly: 'month' };

export async function runRefresh(kind, cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  if (!WINDOW[kind]) throw new Error(`Unknown refresh kind: ${kind}`);
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(dir);
  if (!acquireLock(dir)) throw new Error('Another knowledge run is in progress (.lock present).');
  const written = [];
  try {
    const period = parsePeriod(WINDOW[kind], now);
    const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to });
    appendObservations(dir, toObservations(crawled));

    if (kind === 'daily') {
      ensureDir(join(dir, 'digests'));
      const p = join(dir, 'digests', `${period.key}-daily.md`);
      atomicWrite(p, renderDailyDigest(crawled.map((c) => c.issue), period.key));
      written.push(p);
    }
    if (kind === 'weekly' || kind === 'monthly') {
      ensureDir(join(dir, 'sentiment'));
      const sentiment = splitSentiment(toObservations(crawled));
      const cp = join(dir, 'sentiment', 'current.md');
      atomicWrite(cp, renderSentiment(sentiment, period.key));
      written.push(cp);
      touchLayer(dir, 'sentiment', now);
      const gp = join(dir, 'GLOBAL.md');
      const age = stalenessDays(readIndex(dir), 'sentiment', now) ?? 0;
      const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
      const friction = sentiment.criticism.slice(0, 5).map((c) => `${c.body} (${c.source})`);
      atomicWrite(gp, renderGlobal({ focus, rules: [], friction, updated: now.toISOString().slice(0, 10), sentimentAgeDays: age }));
      written.push(gp);
    }
    touchLayer(dir, kind, now);
    return { written };
  } finally {
    releaseLock(dir);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runRefresh(process.argv[2] || 'daily').then((r) => console.log(r.written.join('\n'))).catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 4: Write `ask.mjs`**

```js
// plugins/unioss-knowledge/scripts/ask.mjs
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { periodOverlapsPresent } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { splitSentiment, renderSentiment } from './distill.mjs';

function renderAnswer(intent, crawled, periodKey) {
  if (intent === 'sentiment') return renderSentiment(splitSentiment(toObservations(crawled)), periodKey);
  if (intent === 'focus') {
    const lines = [`# Customer focus — ${periodKey}`, ''];
    for (const c of crawled) lines.push(`- ${c.issue.title} (${c.issue.web_url})`);
    if (crawled.length === 0) lines.push('- (no tickets in this period)');
    return lines.join('\n') + '\n';
  }
  return renderDailyDigest(crawled.map((c) => c.issue), periodKey); // tickets / general
}

export async function runAsk({ intent, period, mutate = false }, cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  appendObservations(dir, toObservations(crawled));
  const markdown = renderAnswer(intent, crawled, period.key);
  const path = join(dir, 'digests', `${period.key}-${intent}.md`);
  atomicWrite(path, markdown);

  // Mutation into the live "now" KB is allowed ONLY for a current-period refresh.
  if (mutate && periodOverlapsPresent(period, now)) {
    ensureDir(join(dir, 'sentiment'));
    atomicWrite(join(dir, 'sentiment', 'current.md'), renderSentiment(splitSentiment(toObservations(crawled)), period.key));
    touchLayer(dir, 'sentiment', now);
  }
  return { path, markdown };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/scripts/ask.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the whole script suite**

Run: `node --test plugins/unioss-knowledge/scripts/`
Expected: PASS — all script tests green.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-knowledge/scripts/refresh.mjs plugins/unioss-knowledge/scripts/ask.mjs plugins/unioss-knowledge/scripts/ask.test.mjs
git commit -m "feat(unioss-knowledge): refresh + ask CLI (read-only history, gated live mutation)"
```

---

## Task 10: SessionStart hook — inject GLOBAL.md + staleness nudge

**Files:**
- Create: `plugins/unioss-knowledge/hooks/inject-knowledge.mjs`
- Create: `plugins/unioss-knowledge/hooks/hooks.json`
- Test: `plugins/unioss-knowledge/hooks/inject-knowledge.test.mjs`

**Interfaces:**
- Consumes: `resolveConfig` (T1), `knowledgeDir`/`readIndex`/`stalenessDays` (T4), `truncateToCap` (T7).
- Produces: `buildAdditionalContext(cwd?, now?) → string` (`''` when the store/GLOBAL.md is absent).

- [ ] **Step 1: Write the failing test**

```js
// plugins/unioss-knowledge/hooks/inject-knowledge.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAdditionalContext } from './inject-knowledge.mjs';

function withStore({ global, sentimentDaysAgo } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'khook-'));
  if (global !== undefined) {
    const dir = join(cwd, '.walkthrough', '.knowledge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'GLOBAL.md'), global);
    if (sentimentDaysAgo !== undefined) {
      const at = new Date(Date.now() - sentimentDaysAgo * 86400000).toISOString();
      writeFileSync(join(dir, 'index.json'), JSON.stringify({ sentiment: { lastRun: at } }));
    }
  }
  return cwd;
}

test('empty string when no store', () => {
  assert.equal(buildAdditionalContext(withStore({})), '');
});

test('injects GLOBAL.md when present', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB\n- rule' }));
  assert.match(ctx, /# KB/);
});

test('adds a staleness nudge past threshold', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB', sentimentDaysAgo: 9 }));
  assert.match(ctx, /9d old/);
  assert.match(ctx, /unioss-knowledge-refresh weekly/);
});

test('no nudge when fresh', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB', sentimentDaysAgo: 1 }));
  assert.doesNotMatch(ctx, /old ·|old\b/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test plugins/unioss-knowledge/hooks/inject-knowledge.test.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

```js
// plugins/unioss-knowledge/hooks/inject-knowledge.mjs
// SessionStart: inject the tiny always-on knowledge slice + a staleness nudge.
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';
import { knowledgeDir, readIndex, stalenessDays } from '../scripts/store.mjs';
import { truncateToCap } from '../scripts/distill.mjs';

const STALE_DAYS = 7;
const CAP_TOKENS = 1200;

export function buildAdditionalContext(cwd = process.cwd(), now = new Date()) {
  const { artifactRoot } = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, artifactRoot);
  const globalFile = join(dir, 'GLOBAL.md');
  if (!existsSync(globalFile)) return '';
  let body = truncateToCap(readFileSync(globalFile, 'utf8'), CAP_TOKENS);
  const age = stalenessDays(readIndex(dir), 'sentiment', now);
  if (age != null && age > STALE_DAYS) {
    body += `\n\n⚠ sentiment ${age}d old · run /unioss-knowledge-refresh weekly`;
  }
  return body;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const additionalContext = buildAdditionalContext();
  if (additionalContext) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }) + '\n');
  }
}
```

- [ ] **Step 4: Write `hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/inject-knowledge.mjs\"" } ] }
    ]
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test plugins/unioss-knowledge/hooks/inject-knowledge.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-knowledge/hooks/
git commit -m "feat(unioss-knowledge): SessionStart hook injects GLOBAL.md + staleness nudge"
```

---

## Task 11: Command + skill markdown

**Files:**
- Create: `plugins/unioss-knowledge/commands/unioss-knowledge.md`, `-ticket.md`, `-today.md`, `-ask.md`, `-refresh.md`, `-approve.md`
- Create: `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md`, `.../unioss-knowledge-refresh/SKILL.md`, `.../unioss-knowledge-approve/SKILL.md`

**Interfaces:**
- Consumes: the CLI scripts from Tasks 8–9 by path (`${CLAUDE_PLUGIN_ROOT}/scripts/<name>.mjs`).
- Produces: user-facing slash commands.

This task is documentation orchestrating tested scripts. No unit test; verify by running each referenced CLI once (Step 12).

- [ ] **Step 1: `commands/unioss-knowledge-today.md`**

````markdown
---
description: Summarize today's new UNIOSS 3 tickets (WWWH) across all projects.
---

# UNIOSS Knowledge — Today

Summarize every `UNIOSS 3` ticket created today, one WWWH block each.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/today.mjs"
   ```

2. Read the printed digest path and open it. Relay the WWWH blocks to the user, unchanged.

## Output

- The backticked digest path.
- The WWWH blocks (What / Why / Who / How), one per ticket. Never drop a ticket.
- If the count is 0: `No new UNIOSS 3 tickets today.`
````

- [ ] **Step 2: `commands/unioss-knowledge-ticket.md`**

````markdown
---
description: Summarize one GitLab ticket by URL using WWWH.
---

# UNIOSS Knowledge — Ticket

## Input

- A GitLab ticket URL.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ticket.mjs" "<TICKET_URL>"
   ```

2. Relay the printed WWWH block verbatim.

## Output

- The WWWH block: What / Why / Who / How.
````

- [ ] **Step 3: `commands/unioss-knowledge.md` (status)**

````markdown
---
description: Show knowledge-base status — staleness per layer + pending staged rules.
---

# UNIOSS Knowledge — Status

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs"
   ```

2. Relay the output verbatim.
````

- [ ] **Step 4: `commands/unioss-knowledge-refresh.md`**

````markdown
---
description: Crawl + distill the current window (daily|weekly|monthly) into the knowledge base.
---

# UNIOSS Knowledge — Refresh

Invoke the `unioss-knowledge-refresh` skill with the requested cadence (default `daily`).
````

- [ ] **Step 5: `commands/unioss-knowledge-ask.md`**

````markdown
---
description: Ask a free-form question about UNIOSS 3 tickets/comments for any period.
---

# UNIOSS Knowledge — Ask

Invoke the `unioss-knowledge-ask` skill with the user's question.
````

- [ ] **Step 6: `commands/unioss-knowledge-approve.md`**

````markdown
---
description: Review staged prescriptive rules and promote approved ones into the live KB.
---

# UNIOSS Knowledge — Approve

Invoke the `unioss-knowledge-approve` skill.
````

- [ ] **Step 7: `skills/unioss-knowledge-ask/SKILL.md`** (interactive picker + staleness gate)

````markdown
---
name: unioss-knowledge-ask
description: Answer a free-form question about UNIOSS 3 tickets/comments for any period, from stored knowledge; refresh first only when stale.
---

# UNIOSS Knowledge — Ask (read-first)

Answer from the most-recently-stored knowledge. Crawl only on an opted-in refresh.

## Workflow

1. **Classify** the question. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask-classify.mjs" "<QUESTION>"
   ```

   It prints two lines: `intent=<focus|sentiment|tickets|general>` and either `period=<key>` or `period=NONE`.

2. **Period picker** — only if `period=NONE`. Ask, using the fixed format:

   ```
   No period given — which period should I use?

   1. This week
   2. This month
   3. This year
   4. A specific month (e.g. 2026-03)
   5. A custom date range (e.g. 2026-06-01 to 2026-06-30)

   Which option?
   ```

   Map the answer to a period token: `week` / `month` / `year` / the typed `YYYY-MM` / the typed range.

3. **Staleness gate** — check the stored answer's age:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask-staleness.mjs" "<PERIOD_TOKEN>"
   ```

   If it prints `stale=<N>` (N > 7 and the period overlaps now), ask:

   ```
   The knowledge was saved <N> days ago. What would you like to do?

   1. Refresh now — then answer (recommended)
   2. Use stored as-is (faster, may miss the knowledge)

   Which option?
   ```

   - Option 1 → pass `--refresh` in the next step.
   - Option 2, or `stale=fresh`, or `stale=none` → no `--refresh`.

4. **Answer.** Run (add `--refresh` only when the user chose to refresh a current period):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask.mjs" --intent=<intent> --period=<PERIOD_TOKEN> [--refresh]
   ```

   Read the printed report path and relay the answer.

## Output

- The answer in the requested shape (focus bullets / praise+criticism / WWWH list).
- The backticked report path under `digests/`.
````

- [ ] **Step 8: Add the two tiny helper CLIs the ask skill calls**

```js
// plugins/unioss-knowledge/scripts/ask-classify.mjs
import { detectIntent, detectPeriod } from './period.mjs';
const q = process.argv[2] || '';
const intent = detectIntent(q);
const period = detectPeriod(q);
console.log(`intent=${intent}`);
console.log(`period=${period ? period.key : 'NONE'}`);
```

```js
// plugins/unioss-knowledge/scripts/ask-staleness.mjs
import { resolveConfig } from './config.mjs';
import { parsePeriod, periodOverlapsPresent } from './period.mjs';
import { knowledgeDir, readIndex, stalenessDays } from './store.mjs';
const token = process.argv[2] || '';
const period = parsePeriod(token);
if (!period) { console.log('stale=none'); process.exit(0); }
const { artifactRoot } = resolveConfig();
const dir = knowledgeDir(process.cwd(), artifactRoot);
const age = stalenessDays(readIndex(dir), 'sentiment');
if (age == null) console.log('stale=none');
else if (age > 7 && periodOverlapsPresent(period)) console.log(`stale=${age}`);
else console.log('stale=fresh');
```

Extend `ask.mjs`'s `isMain` block to parse `--intent`, `--period`, `--refresh` flags and call `runAsk`. Append to `ask.mjs`:

```js
// appended to plugins/unioss-knowledge/scripts/ask.mjs
import { pathToFileURL } from 'node:url';
import { parsePeriod } from './period.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const period = parsePeriod(args.period);
  if (!period) { console.error('Invalid --period'); process.exit(1); }
  runAsk({ intent: args.intent || 'general', period, mutate: Boolean(args.refresh) })
    .then((r) => console.log(`${r.path}\n\n${r.markdown}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 9: `skills/unioss-knowledge-refresh/SKILL.md`**

````markdown
---
name: unioss-knowledge-refresh
description: Crawl + distill the current window into the knowledge base (daily WWWH, weekly/monthly sentiment + GLOBAL).
---

# UNIOSS Knowledge — Refresh

## Input

- One of `daily` (default), `weekly`, `monthly`.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <daily|weekly|monthly>
   ```

2. Relay the written file paths. For weekly/monthly, note that `sentiment/current.md` and `GLOBAL.md` were updated.

## Notes

- Mutates the current-window KB. Historical queries belong to `/unioss-knowledge-ask`.
- Lock-guarded; on a GitLab error nothing is written.
````

- [ ] **Step 10: `skills/unioss-knowledge-approve/SKILL.md`**

````markdown
---
name: unioss-knowledge-approve
description: Review staged prescriptive rules and promote the approved ones into the live rules + GLOBAL.
---

# UNIOSS Knowledge — Approve

Prescriptive rules never enter the live KB automatically. Promote them here.

## Workflow

1. Open `.walkthrough/.knowledge/rules/staged.md`. If missing or empty, report "No staged rules." and stop.
2. Present the staged rules to the user. Ask, using the fixed format:

   ```
   <N> staged rule(s) to review. What would you like to do?

   1. Approve all (recommended)
   2. Let me pick which to approve
   3. Approve none

   Which option?
   ```

3. For approved rules: append each (verbatim, with its evidence link) to `.walkthrough/.knowledge/rules/approved.md`, and remove it from `staged.md`. Both writes replace the whole file.
4. Fold the top approved rules into `GLOBAL.md`'s "Top active pitfalls" section (keep the 1200-token cap — drop overflow, do not delete from `approved.md`).

## Output

- Count approved / remaining staged.
- Confirmation that `approved.md` and `GLOBAL.md` were updated.
````

- [ ] **Step 11: Update the file list in `refresh`/`ask` skills is consistent** — confirm both helper CLIs exist and `ask.mjs` parses flags (from Step 8).

- [ ] **Step 12: Smoke-verify each CLI resolves (no network needed for --help paths)**

Run:
```bash
node "plugins/unioss-knowledge/scripts/ask-classify.mjs" "what did customers praise in June 2026"
node "plugins/unioss-knowledge/scripts/status.mjs"
```
Expected: first prints `intent=sentiment` / `period=2026-06`; second prints the "not initialized" line (in a clean cwd) or a status list.

- [ ] **Step 13: Commit**

```bash
git add plugins/unioss-knowledge/commands/ plugins/unioss-knowledge/skills/ plugins/unioss-knowledge/scripts/ask-classify.mjs plugins/unioss-knowledge/scripts/ask-staleness.mjs plugins/unioss-knowledge/scripts/ask.mjs
git commit -m "feat(unioss-knowledge): commands + skills (ask picker, staleness gate, refresh, approve)"
```

---

## Task 12: Pipeline GATE-0 integration + docs

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md`
- Create: `plugins/unioss-knowledge/README.md`

**Interfaces:**
- Consumes: the store layout under `.walkthrough/.knowledge/` (domain, rules).

- [ ] **Step 1: Read the investigate skill to find the module-detection point**

Run: `node --test` is not applicable. Open the file:
```bash
sed -n '1,80p' plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md
```
Identify the step where the ticket's module (AdminPage/FrontEnd → `admin-page`/`front-end`) is already known.

- [ ] **Step 2: Insert a KB read + domain-append step**

After the module-detection step, add this block (adjust the numbering to fit the existing list):

````markdown
N. **Knowledge base (if present).** When `.walkthrough/.knowledge/` exists:
   - **Read** `domain/<module>.md`, `domain/conventions.md`, and `rules/approved.md`. Carry any item relevant to this ticket into the investigation.
   - **Append** newly-proven durable facts about this module to `domain/<module>.md` — one line each, ending with the ticket source `(<PREFIX>#<IID>)`. Facts only. A recurring problem worth a prescriptive rule goes to `rules/staged.md` (never write `approved.md` here).
   - Skip silently if the directory is absent.
````

- [ ] **Step 3: Write the plugin README**

```markdown
# unioss-knowledge

Human digests + an agent knowledge base for UNIOSS 3 tickets.

## Commands

| Command | Does |
|---|---|
| `/unioss-knowledge-today` | Summarize today's new UNIOSS 3 tickets (WWWH). |
| `/unioss-knowledge-ticket <url>` | Summarize one ticket (WWWH). |
| `/unioss-knowledge-ask "<question>" [period]` | Free-form query for any period; refreshes only when stale. |
| `/unioss-knowledge-refresh [daily\|weekly\|monthly]` | Crawl + distill the current window into the KB. |
| `/unioss-knowledge-approve` | Promote staged rules into the live KB. |
| `/unioss-knowledge` | Status + staleness. |

## Store

`.walkthrough/.knowledge/` — `GLOBAL.md` (injected each session, ≤1200 tokens), `domain/`, `rules/` (staged→approved), `sentiment/`, `digests/`.

## Injection

- SessionStart hook injects `GLOBAL.md` + a staleness nudge.
- The pipeline's investigate stage reads `domain/<module>.md` + `rules/approved.md` per ticket and appends new facts.

## Config

Reuses `.walkthrough/.config/unioss.config.json`: `gitlab.host`, `gitlab.workLabel` (falls back to `ship.label`, default `UNIOSS 3`), `artifactRoot`. Token via `GITLAB_TOKEN` (env or `~/.zshrc.local`).
```

- [ ] **Step 4: Verify the investigate skill still reads coherently**

```bash
sed -n '1,120p' plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md
```
Expected: the new step is numbered correctly and the guard ("skip if absent") is present.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md plugins/unioss-knowledge/README.md
git commit -m "feat(unioss-knowledge): pipeline GATE-0 KB read/append + README"
```

---

## Task 13: Full suite + final verification

**Files:** none (verification only).

- [ ] **Step 1: Run every test in the new plugin**

Run: `node --test plugins/unioss-knowledge/scripts/ plugins/unioss-knowledge/hooks/`
Expected: PASS — all suites green, zero failures.

- [ ] **Step 2: Confirm the pipeline's suite still passes**

Run: `node --test plugins/unioss-pipeline/`
Expected: PASS (existing suite unaffected — the only change was a markdown skill).

- [ ] **Step 3: Confirm the marketplace manifest is valid JSON with two plugins**

Run: `node -e "const m=require('./.claude-plugin/marketplace.json'); if(m.plugins.length!==2) throw new Error('expected 2 plugins'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit any final touch-ups (version bump if desired)**

```bash
git add -A
git commit -m "chore(unioss-knowledge): verified full suite" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- WWWH new tickets (human) → Tasks 6, 8 (`renderDailyDigest`, `runToday`) + command.
- Summarize one ticket by URL → Task 8 (`runTicket`) + command.
- Focus / sentiment for any period (this month / specific month/year / range) → Tasks 3, 7, 9 (`ask`) + ask skill.
- Free-form `ask` with period picker when omitted → Task 11 ask skill + `ask-classify.mjs`.
- Staleness gate (refresh vs use-as-is, recommended default) → Task 11 ask skill + `ask-staleness.mjs`.
- Tiered store ("enough not all"): GLOBAL cap, domain, rules staged/approved, sentiment jsonl → Tasks 4, 7, 10, 12.
- Layered injection: SessionStart hook + pipeline GATE-0 → Tasks 10, 12.
- Tiered curation: facts auto, rules gated → Task 12 (append facts, stage rules) + Task 11 approve skill.
- Label-scoped ticket source (`UNIOSS 3`, cross-project) → Task 2 `listIssues`, Task 1 config.
- Idempotency / abnormal cases (repeat refresh overwrites, jsonl dedupe, rule dedupe, atomic write, lock, empty window, missing token) → Tasks 4, 5, 8, 9 tests.
- Fixed multi-option prompt format + recommended default → Task 11 skills.
- Both outputs English, agent-optimized writing → Global Constraints; enforced in md tasks.

**Deferred (explicitly out of scope in the spec):** pipeline REVIEW.md/feedback harvesting as a lesson source; cron scheduling; a standalone domain-scan command; a separate manual-authoring feature.

**Gaps found & fixed inline:** the ask skill needed two tiny helper CLIs (`ask-classify.mjs`, `ask-staleness.mjs`) and flag parsing in `ask.mjs` — added in Task 11 Step 8. Staged-rule dedupe by fingerprint is described in the spec; in this plan it is enforced at approval time (Task 11 approve skill replaces whole files) rather than a separate function — acceptable because rules are only ever written by the gated approve flow and the pipeline's `staged.md` append, both human-reviewed.

**Type consistency:** `crawl({host,token,label,from,to})` is called identically in `today.mjs`, `refresh.mjs`, `ask.mjs`. `parsePeriod` returns `{key,from,to}` used consistently. `toObservations` output shape (`{id,...}`) matches `appendObservations` dedupe key. `renderSentiment`/`renderGlobal` signatures match their callers.
