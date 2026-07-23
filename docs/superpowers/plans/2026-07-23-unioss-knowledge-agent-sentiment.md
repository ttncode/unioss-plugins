# unioss-knowledge Agent-Side Sentiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sentiment classification moves from keyword regex to the agent: scripts emit an evidence file, the agent classifies customer voice, scripts validate and render the result.

**Architecture:** `distill.mjs` gains `buildEvidence` + `validateClassified`; `refresh.mjs` splits weekly/monthly/yearly into `--phase=crawl` (evidence out) and `--phase=finalize --classified=<path>` (render + write); `ask.mjs` sentiment intent becomes the same two steps. `splitSentiment` and its regexes are deleted last so the suite stays green at every commit.

**Tech Stack:** Node ESM (`.mjs`), built-ins only, `node --test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-07-23-unioss-knowledge-agent-sentiment-design.md`

## Global Constraints

- Node built-ins only — no npm dependencies.
- Evidence observations capped at the most recent **300** by `at`.
- Classified validation: `praise`/`criticism` arrays of `{ body: string, source: string }`, ≤**20** items each, body ≤**200** chars. Invalid → error, nothing written.
- Scripts never fabricate sentiment — no keyword fallback anywhere.
- `daily` refresh behavior unchanged (no phases). Plain `refresh.mjs weekly` (no `--phase`) = crawl phase.
- Mutate gate unchanged: `sentiment/current.md` written by ask only when `--refresh` AND `periodOverlapsPresent`.
- Atomic writes (`atomicWrite`) for every file; lock held within each refresh phase, not across.
- Suite: `cd plugins/unioss-knowledge && node --test scripts/` (currently 49 passing).

---

### Task 1: `distill.mjs` — `buildEvidence` + `validateClassified` (additive)

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/distill.mjs` (append; do NOT remove `splitSentiment` yet — Tasks 2–3 still import it until switched, deletion happens in Task 4)
- Test: `plugins/unioss-knowledge/scripts/distill.test.mjs`

**Interfaces:**
- Produces: `buildEvidence(periodKey, focus, observations)` → `{ periodKey, focus, observations }` with observations sorted newest-first by `at`, capped at 300, each mapped to `{ author, at, body, source }`. `validateClassified(raw)` → `{ praise, criticism }` (arrays of `{ body, source }` only) or throws with a message naming the violation.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/distill.test.mjs` (extend the import line with `buildEvidence, validateClassified`):

```js
test('buildEvidence keeps the 300 most recent and maps shape', () => {
  const obs = Array.from({ length: 301 }, (_, i) => ({
    id: `x${i}`, project_id: 1, iid: 2,
    author: 'A', at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), body: `b${i}`, source: 's',
  }));
  const ev = buildEvidence('2026-W30', ['f1'], obs);
  assert.equal(ev.periodKey, '2026-W30');
  assert.deepEqual(ev.focus, ['f1']);
  assert.equal(ev.observations.length, 300);
  assert.equal(ev.observations[0].body, 'b300'); // newest first
  assert.ok(!ev.observations.some((o) => o.body === 'b0')); // oldest dropped
  assert.deepEqual(Object.keys(ev.observations[0]), ['author', 'at', 'body', 'source']);
});

test('validateClassified accepts a good shape and strips extra keys', () => {
  const out = validateClassified({ praise: [{ body: 'Fast fix appreciated', source: 'u1', extra: 1 }], criticism: [] });
  assert.deepEqual(out, { praise: [{ body: 'Fast fix appreciated', source: 'u1' }], criticism: [] });
});

test('validateClassified rejects bad shapes', () => {
  assert.throws(() => validateClassified(null), /object/);
  assert.throws(() => validateClassified({ praise: 'no', criticism: [] }), /array/);
  assert.throws(() => validateClassified({ praise: [{ body: 1, source: 's' }], criticism: [] }), /string/);
  assert.throws(() => validateClassified({ praise: [{ body: 'x'.repeat(201), source: 's' }], criticism: [] }), /200/);
  assert.throws(() => validateClassified({ praise: Array.from({ length: 21 }, () => ({ body: 'b', source: 's' })), criticism: [] }), /20/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/distill.test.mjs`
Expected: FAIL — `buildEvidence`/`validateClassified` not exported.

- [ ] **Step 3: Implement**

Append to `plugins/unioss-knowledge/scripts/distill.mjs`:

```js
export const EVIDENCE_CAP = 300;
const MAX_CLASSIFIED_ITEMS = 20;
const MAX_CLASSIFIED_BODY = 200;

// Evidence handed to the agent for sentiment classification — newest first, capped.
export function buildEvidence(periodKey, focus, observations) {
  const obs = [...observations]
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .slice(0, EVIDENCE_CAP)
    .map((o) => ({ author: o.author, at: o.at, body: o.body, source: o.source }));
  return { periodKey, focus, observations: obs };
}

// Agent-written sentiment must round-trip through this gate before anything is rendered.
export function validateClassified(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('classified: must be an object with praise/criticism arrays');
  const out = {};
  for (const key of ['praise', 'criticism']) {
    const arr = raw[key];
    if (!Array.isArray(arr)) throw new Error(`classified: ${key} must be an array`);
    if (arr.length > MAX_CLASSIFIED_ITEMS) throw new Error(`classified: ${key} exceeds ${MAX_CLASSIFIED_ITEMS} items`);
    out[key] = arr.map((item, i) => {
      if (!item || typeof item.body !== 'string' || typeof item.source !== 'string') throw new Error(`classified: ${key}[${i}] needs string body and source`);
      if (item.body.length > MAX_CLASSIFIED_BODY) throw new Error(`classified: ${key}[${i}] body exceeds ${MAX_CLASSIFIED_BODY} chars`);
      return { body: item.body, source: item.source };
    });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/distill.test.mjs` → all pass.
Then full suite: `node --test scripts/` → 52 pass (49 + 3).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/distill.mjs plugins/unioss-knowledge/scripts/distill.test.mjs
git commit -m "feat(unioss-knowledge): buildEvidence + validateClassified for agent-side sentiment"
```

---

### Task 2: `refresh.mjs` — two-phase weekly/monthly/yearly

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/refresh.mjs` (full rewrite below)
- Test: `plugins/unioss-knowledge/scripts/refresh.test.mjs` (full rewrite below)

**Interfaces:**
- Consumes: `buildEvidence(periodKey, focus, observations)`, `validateClassified(raw)` from Task 1.
- Produces: `runRefresh(kind, cwd, now, deps, opts)` — `opts = { phase = 'crawl', classifiedPath }`. Crawl phase (non-daily) returns `{ written: [evidencePath], count }`; finalize returns `{ written: [currentMdPath, globalMdPath] }`. Daily unchanged: `{ written: [digestPath] }`. Evidence file: `sentiment/evidence-<periodKey>.json`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `plugins/unioss-knowledge/scripts/refresh.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRefresh } from './refresh.mjs';

const crawlStub = async () => [{
  issue: {
    iid: 42, project_id: 32, title: 'Sales detail delete bug',
    web_url: 'https://g/unioss/AdminPage/-/issues/42',
    created_at: '2026-07-15T00:00:00Z', author: { name: 'A' },
  },
  notes: [{ id: 1, body: 'This is broken and frustrating', system: false, created_at: '2026-07-16T00:00:00Z', author: { name: 'U' } }],
}];

const deps = { getToken: () => 'tok', crawl: crawlStub };
const NOW = new Date('2026-07-21T00:00:00Z');
const classifiedOk = { praise: [], criticism: [{ body: 'Store page errors on click', source: 'https://g/1827' }] };
const kb = (cwd, ...p) => join(cwd, '.walkthrough', '.knowledge', ...p);

test('weekly crawl phase writes evidence only; finalize writes sentiment + GLOBAL with rules', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  mkdirSync(kb(cwd, 'rules'), { recursive: true });
  writeFileSync(kb(cwd, 'rules', 'approved.md'), '- [R-001] Never hard-delete t_sales_detail. (AP#1834)\n');

  const crawlRes = await runRefresh('weekly', cwd, NOW, deps);
  assert.ok(crawlRes.written.some((p) => /evidence-2026-W30\.json$/.test(p)));
  assert.equal(crawlRes.count, 1);
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);

  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  const globalPath = fin.written.find((p) => p.endsWith('GLOBAL.md'));
  assert.ok(globalPath);
  const content = readFileSync(globalPath, 'utf8');
  assert.match(content, /Never hard-delete t_sales_detail/);
  assert.match(content, /Store page errors on click/);
  const currentPath = fin.written.find((p) => p.endsWith('current.md'));
  assert.match(readFileSync(currentPath, 'utf8'), /Store page errors on click/);
});

test('finalize with no approved.md still succeeds and renders "(none yet)"', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await runRefresh('weekly', cwd, NOW, deps);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  const content = readFileSync(fin.written.find((p) => p.endsWith('GLOBAL.md')), 'utf8');
  assert.match(content, /## Top active pitfalls \(approved rules\)\n- \(none yet\)/);
});

test('daily refresh crawls by created window; weekly by updated', async () => {
  const fields = [];
  const spyCrawl = async (opts) => { fields.push(opts.dateField); return crawlStub(); };
  const spyDeps = { getToken: () => 'tok', crawl: spyCrawl };
  await runRefresh('daily', mkdtempSync(join(tmpdir(), 'krefresh-')), NOW, spyDeps);
  await runRefresh('weekly', mkdtempSync(join(tmpdir(), 'krefresh-')), NOW, spyDeps);
  assert.deepEqual(fields, ['created', 'updated']);
});

test('yearly refresh: crawl emits evidence, finalize writes sentiment + GLOBAL', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('yearly', cwd, NOW, { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
  assert.ok(res.written.some((p) => p.endsWith('evidence-2026.json')));
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('yearly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  assert.ok(fin.written.some((p) => p.endsWith('current.md')));
  assert.ok(fin.written.some((p) => p.endsWith('GLOBAL.md')));
});

test('finalize without prior crawl fails and writes nothing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  await assert.rejects(
    () => runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf }),
    /Evidence not found/,
  );
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
});

test('finalize rejects invalid classified and writes nothing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await runRefresh('weekly', cwd, NOW, deps);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify({ praise: 'nope', criticism: [] }));
  await assert.rejects(
    () => runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf }),
    /array/,
  );
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);
});

test('daily has no finalize phase', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await assert.rejects(
    () => runRefresh('daily', cwd, NOW, {}, { phase: 'finalize', classifiedPath: 'x' }),
    /daily has no finalize/,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs`
Expected: FAIL — current `runRefresh` ignores `opts`, writes GLOBAL from the crawl call, evidence file never written.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `plugins/unioss-knowledge/scripts/refresh.mjs` with:

```js
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
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
import { renderSentiment, renderGlobal, validateClassified, buildEvidence } from './distill.mjs';

const WINDOW = { daily: 'today', weekly: 'week', monthly: 'month', yearly: 'year' };

function readApprovedRules(dir) {
  const approvedPath = join(dir, 'rules', 'approved.md');
  if (!existsSync(approvedPath)) return [];
  return readFileSync(approvedPath, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .slice(0, 5);
}

async function crawlPhase(kind, period, cfg, dir, now, deps) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  // daily digest = tickets that arrived today; weekly/monthly/yearly = any ticket active in the window.
  const dateField = kind === 'daily' ? 'created' : 'updated';
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField });
  appendObservations(dir, toObservations(crawled));
  if (kind === 'daily') {
    ensureDir(join(dir, 'digests'));
    const p = join(dir, 'digests', `${period.key}-daily.md`);
    atomicWrite(p, renderDailyDigest(crawled.map((c) => c.issue), period.key));
    touchLayer(dir, 'daily', now);
    return { written: [p] };
  }
  // Sentiment is the agent's judgment — emit evidence only; finalize renders it.
  ensureDir(join(dir, 'sentiment'));
  const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
  const evidence = buildEvidence(period.key, focus, toObservations(crawled));
  const ep = join(dir, 'sentiment', `evidence-${period.key}.json`);
  atomicWrite(ep, JSON.stringify(evidence, null, 2) + '\n');
  return { written: [ep], count: evidence.observations.length };
}

function finalizePhase(kind, period, dir, now, classifiedPath) {
  const ep = join(dir, 'sentiment', `evidence-${period.key}.json`);
  if (!existsSync(ep)) throw new Error(`Evidence not found: ${ep} — run --phase=crawl first (same period).`);
  const evidence = JSON.parse(readFileSync(ep, 'utf8'));
  if (!classifiedPath) throw new Error('--classified=<path> is required for --phase=finalize');
  if (!existsSync(classifiedPath)) throw new Error(`Classified file not found: ${classifiedPath}`);
  const classified = validateClassified(JSON.parse(readFileSync(classifiedPath, 'utf8')));
  const written = [];
  const cp = join(dir, 'sentiment', 'current.md');
  atomicWrite(cp, renderSentiment(classified, period.key));
  written.push(cp);
  touchLayer(dir, 'sentiment', now);
  const gp = join(dir, 'GLOBAL.md');
  const age = stalenessDays(readIndex(dir), 'sentiment', now) ?? 0;
  const friction = classified.criticism.slice(0, 5).map((c) => `${c.body} (${c.source})`);
  atomicWrite(gp, renderGlobal({
    focus: Array.isArray(evidence.focus) ? evidence.focus : [],
    rules: readApprovedRules(dir),
    friction,
    updated: now.toISOString().slice(0, 10),
    sentimentAgeDays: age,
  }));
  written.push(gp);
  touchLayer(dir, kind, now);
  return { written };
}

export async function runRefresh(kind, cwd = process.cwd(), now = new Date(), deps = {}, opts = {}) {
  const { phase = 'crawl', classifiedPath } = opts;
  if (!WINDOW[kind]) throw new Error(`Unknown refresh kind: ${kind}`);
  if (phase !== 'crawl' && phase !== 'finalize') throw new Error(`Unknown phase: ${phase}`);
  if (kind === 'daily' && phase === 'finalize') throw new Error('daily has no finalize phase');
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(dir);
  if (!acquireLock(dir)) throw new Error('Another knowledge run is in progress (.lock present).');
  try {
    const period = parsePeriod(WINDOW[kind], now);
    return phase === 'crawl'
      ? await crawlPhase(kind, period, cfg, dir, now, deps)
      : finalizePhase(kind, period, dir, now, classifiedPath);
  } finally {
    releaseLock(dir);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const kind = argv.find((a) => !a.startsWith('--')) || 'daily';
  const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m[1], m[2] ?? true];
  }));
  runRefresh(kind, process.cwd(), new Date(), {}, { phase: flags.phase || 'crawl', classifiedPath: flags.classified })
    .then((r) => {
      console.log(r.written.join('\n'));
      if (r.count != null) console.log(`${r.count} observation(s) in evidence — classify, then run --phase=finalize --classified=<path>`);
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
```

Note the layer-touch split: crawl phase touches only `daily`; finalize touches `sentiment` + the kind — an unfinalized weekly run intentionally stays "stale" so the nudge keeps firing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs` → 7 pass.
Full suite: `node --test scripts/` → 55 pass (52 − 4 old refresh + 7 new).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/refresh.mjs plugins/unioss-knowledge/scripts/refresh.test.mjs
git commit -m "feat(unioss-knowledge): two-phase refresh — evidence out, agent-classified sentiment in"
```

---

### Task 3: `ask.mjs` — sentiment intent in two steps

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/ask.mjs` (full rewrite below)
- Test: `plugins/unioss-knowledge/scripts/ask.test.mjs` (full rewrite below)

**Interfaces:**
- Consumes: `buildEvidence`, `validateClassified` from Task 1.
- Produces: `runAsk({ intent, period, mutate, classifiedPath }, cwd, now, deps)`. Sentiment without `classifiedPath` → `{ path: evidencePath, markdown: '', needsClassification: true, count }`. Sentiment with `classifiedPath` → `{ path: digestPath, markdown }` (+ gated `current.md` write). Other intents unchanged.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `plugins/unioss-knowledge/scripts/ask.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAsk } from './ask.mjs';
import { parsePeriod } from './period.mjs';

const crawlStub = async () => [{
  issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-06-05T00:00:00Z', labels: [], author: { name: 'A' } },
  notes: [{ id: 1, body: 'This is broken and slow', system: false, created_at: '2026-06-06T00:00:00Z', author: { name: 'U' } }],
}];

const NOW = new Date('2026-07-21T00:00:00Z');
const classifiedOk = { praise: [], criticism: [{ body: 'Login lock duration is confusing', source: 'https://g/1832' }] };
const kb = (cwd, ...p) => join(cwd, '.walkthrough', '.knowledge', ...p);

test('ask sentiment evidence step writes evidence, no digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const res = await runAsk({ intent: 'sentiment', period, mutate: false }, cwd, NOW, { getToken: () => 'tok', crawl: crawlStub });
  assert.ok(res.needsClassification);
  assert.match(res.path, /evidence-2026-06\.json$/);
  assert.equal(res.count, 1);
  assert.equal(existsSync(kb(cwd, 'digests', '2026-06-sentiment.md')), false);
});

test('ask sentiment classified step writes digest; historical never touches live KB even with mutate', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const res = await runAsk({ intent: 'sentiment', period, mutate: true, classifiedPath: cf }, cwd, NOW, {});
  assert.ok(existsSync(res.path));
  assert.match(res.path, /2026-06-sentiment\.md$/);
  assert.match(res.markdown, /Login lock duration/);
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);
});

test('ask sentiment classified step on the current period with mutate updates current.md', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('month', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  await runAsk({ intent: 'sentiment', period, mutate: true, classifiedPath: cf }, cwd, NOW, {});
  assert.ok(existsSync(kb(cwd, 'sentiment', 'current.md')));
});

test('ask sentiment classified step rejects invalid classified and writes no digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify({ praise: 'nope', criticism: [] }));
  await assert.rejects(() => runAsk({ intent: 'sentiment', period, mutate: false, classifiedPath: cf }, cwd, NOW, {}), /array/);
  assert.equal(existsSync(kb(cwd, 'digests', '2026-06-sentiment.md')), false);
});

test('ask crawls by updated window (activity view)', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  await runAsk({ intent: 'focus', period, mutate: false }, cwd, NOW, { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/ask.test.mjs`
Expected: FAIL — current sentiment intent writes a regex digest immediately; `needsClassification`/`classifiedPath` unknown.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `plugins/unioss-knowledge/scripts/ask.mjs` with:

```js
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { periodOverlapsPresent, parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { renderSentiment, validateClassified, buildEvidence } from './distill.mjs';

function renderAnswer(intent, crawled, periodKey) {
  if (intent === 'focus') {
    const lines = [`# Customer focus — ${periodKey}`, ''];
    for (const c of crawled) lines.push(`- ${c.issue.title} (${c.issue.web_url})`);
    if (crawled.length === 0) lines.push('- (no tickets in this period)');
    return lines.join('\n') + '\n';
  }
  return renderDailyDigest(crawled.map((c) => c.issue), periodKey); // tickets / general
}

export async function runAsk({ intent, period, mutate = false, classifiedPath }, cwd = process.cwd(), now = new Date(), deps = {}) {
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);

  // Sentiment step 2: render the agent-classified result — no crawl needed.
  if (intent === 'sentiment' && classifiedPath) {
    if (!existsSync(classifiedPath)) throw new Error(`Classified file not found: ${classifiedPath}`);
    const classified = validateClassified(JSON.parse(readFileSync(classifiedPath, 'utf8')));
    const markdown = renderSentiment(classified, period.key);
    ensureDir(join(dir, 'digests'));
    const path = join(dir, 'digests', `${period.key}-sentiment.md`);
    atomicWrite(path, markdown);
    // Mutation into the live "now" KB is allowed ONLY for a current-period refresh.
    if (mutate && periodOverlapsPresent(period, now)) {
      ensureDir(join(dir, 'sentiment'));
      atomicWrite(join(dir, 'sentiment', 'current.md'), markdown);
      touchLayer(dir, 'sentiment', now);
    }
    return { path, markdown };
  }

  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  // Activity view: any ticket updated in the period counts, not only newly created ones.
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'updated' });
  const observations = toObservations(crawled);
  // observations.jsonl is the append-only, deduped evidence trail (Tier 3) — always written, never part of the curated live KB (GLOBAL.md / rules/ / sentiment/current.md).
  appendObservations(dir, observations);

  // Sentiment step 1: emit evidence for the agent to classify — no digest yet, scripts never guess sentiment.
  if (intent === 'sentiment') {
    ensureDir(join(dir, 'sentiment'));
    const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
    const evidence = buildEvidence(period.key, focus, observations);
    const path = join(dir, 'sentiment', `evidence-${period.key}.json`);
    atomicWrite(path, JSON.stringify(evidence, null, 2) + '\n');
    return { path, markdown: '', needsClassification: true, count: evidence.observations.length };
  }

  ensureDir(join(dir, 'digests'));
  const markdown = renderAnswer(intent, crawled, period.key);
  const path = join(dir, 'digests', `${period.key}-${intent}.md`);
  atomicWrite(path, markdown);
  return { path, markdown };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const period = parsePeriod(args.period);
  if (!period) { console.error('Invalid --period'); process.exit(1); }
  runAsk({
    intent: args.intent || 'general',
    period,
    mutate: Boolean(args.refresh),
    classifiedPath: typeof args.classified === 'string' ? args.classified : undefined,
  })
    .then((r) => {
      if (r.needsClassification) {
        console.log(`${r.path}\n\n${r.count} observation(s) — classify (customer voice only), write classified JSON, then re-run with --classified=<path>`);
      } else {
        console.log(`${r.path}\n\n${r.markdown}`);
      }
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/ask.test.mjs` → 5 pass.
Full suite: `node --test scripts/` → 57 pass (55 − 3 old ask + 5 new).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/ask.mjs plugins/unioss-knowledge/scripts/ask.test.mjs
git commit -m "feat(unioss-knowledge): ask sentiment intent — evidence out, classified in"
```

---

### Task 4: Delete the regex classifier + update skill docs

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/distill.mjs:1-2` (delete regexes) and `splitSentiment`
- Modify: `plugins/unioss-knowledge/scripts/distill.test.mjs` (delete the splitSentiment test + import)
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md` (full rewrite below)
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md` (step 4 replacement below)

- [ ] **Step 1: Delete the classifier**

In `plugins/unioss-knowledge/scripts/distill.mjs`, delete these lines (the file's first two lines and the `splitSentiment` function):

```js
const PRAISE = /(thank|great|good\s+job|nice|helpful|apprecia|perfect|excellent|resolved|works? (now|well))/i;
const CRITICISM = /(broken|bug|wrong|frustrat|slow|error|fail|not working|disappoint|complain|still|again)/i;
```

```js
export function splitSentiment(observations) {
  const praise = [], criticism = [];
  for (const o of observations) {
    const body = o.body || '';
    if (PRAISE.test(body)) praise.push({ body: body.slice(0, 200), source: o.source });
    else if (CRITICISM.test(body)) criticism.push({ body: body.slice(0, 200), source: o.source });
  }
  return { praise, criticism };
}
```

In `plugins/unioss-knowledge/scripts/distill.test.mjs`, delete the `splitSentiment classifies by keyword` test and remove `splitSentiment` from the import line.

Verify nothing references it: `grep -rn splitSentiment plugins/` → no matches.

- [ ] **Step 2: Rewrite the refresh skill**

Replace the entire contents of `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md` with:

````markdown
---
name: unioss-knowledge-refresh
description: Crawl + distill the current window into the knowledge base (daily WWWH; weekly/monthly/yearly two-phase sentiment + GLOBAL).
---

# UNIOSS Knowledge — Refresh

## Input

- One of `daily` (default), `weekly`, `monthly`, `yearly`.

## Workflow — daily

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" daily
   ```

2. Relay the written digest path.

## Workflow — weekly | monthly | yearly (two phases)

1. **Crawl** — run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <weekly|monthly|yearly> --phase=crawl
   ```

   It prints the evidence path (`sentiment/evidence-<period>.json`) and observation count.

2. **Classify** — read the evidence file and extract **customer voice only**:
   - Ignore developer chatter, code snippets, logs, test output, merge/CI noise.
   - Read Japanese comments natively; write each finding as one concise English line.
   - Each item: `{ "body": "<≤200 chars>", "source": "<ticket url>" }`; max 20 per list.
   - Genuinely empty is fine — empty arrays render "(none yet)". Never pad with noise.

   Write the result as `sentiment/classified-<period>.json` next to the evidence file:

   ```json
   { "praise": [{ "body": "...", "source": "..." }], "criticism": [{ "body": "...", "source": "..." }] }
   ```

3. **Finalize** — run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <weekly|monthly|yearly> --phase=finalize --classified=<classified-path>
   ```

   Relay the written paths — `sentiment/current.md` and `GLOBAL.md`.

## Notes

- `daily` windows on **creation** date — the digest answers "what new tickets arrived today".
- `weekly`/`monthly`/`yearly` window on **update** date, all states — any ticket active in the period counts.
- `yearly` can be slow — a year-wide updated window may hit the pagination cap (50 pages × 100 = 5000 issues) plus one notes call per issue.
- Sentiment classification is the agent's job (step 2) — scripts never guess sentiment from keywords.
- Run both phases within the same period; a stale evidence file fails finalize with "Evidence not found".
- Lock-guarded per phase; on a GitLab or validation error nothing is written.
````

- [ ] **Step 3: Update the ask skill's answer step**

In `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md`, replace step 4 (the block starting `4. **Answer.** Run (add \`--refresh\` only when...` through `Read the printed report path and relay the answer.`) with:

````markdown
4. **Answer.**

   **intent ≠ sentiment** — run (add `--refresh` only when the user chose to refresh a current period):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask.mjs" --intent=<intent> --period=<PERIOD_TOKEN> [--refresh]
   ```

   Read the printed report path and relay the answer.

   **intent = sentiment** — two steps:

   a. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask.mjs" --intent=sentiment --period=<PERIOD_TOKEN>
   ```

   It prints an evidence path (`sentiment/evidence-<period>.json`) — no digest yet.

   b. Classify: read the evidence and extract **customer voice only** — ignore developer chatter, code, logs, test output; read Japanese natively; one concise English line + source URL per item; ≤20 per list; ≤200 chars per body; empty arrays are fine. Write `sentiment/classified-<period>.json`:

   ```json
   { "praise": [{ "body": "...", "source": "..." }], "criticism": [{ "body": "...", "source": "..." }] }
   ```

   Then run (keep `--refresh` only if chosen at the staleness gate):

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ask.mjs" --intent=sentiment --period=<PERIOD_TOKEN> --classified=<classified-path> [--refresh]
   ```

   Relay the digest.
````

- [ ] **Step 4: Verify + commit**

Run: `cd plugins/unioss-knowledge && node --test scripts/` → 56 pass (57 − 1 deleted splitSentiment test), 0 fail. Also `node --test hooks/` → 4 pass.
`grep -rn splitSentiment plugins/` → empty.

```bash
git add plugins/unioss-knowledge/scripts/distill.mjs plugins/unioss-knowledge/scripts/distill.test.mjs plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md
git commit -m "feat(unioss-knowledge): delete regex sentiment classifier; skills teach the two-step flow"
```
