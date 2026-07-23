# unioss-knowledge Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evidence files disclose coverage and sample evenly; sentiment guidance targets relayed customer voice; today/ticket/daily digests become agent-written English reports driven by a new report skill.

**Architecture:** Part A extends `buildEvidence` (coverage fields + even sampling). Part C adds `toTicketEvidence` to `crawl.mjs`, turns `today.mjs`/`ticket.mjs`/`refresh daily` into evidence emitters, un-exports `renderWwwh`, and adds the `unioss-knowledge-report` skill that commands direct the agent to follow. Part B is prose in the refresh/ask skills.

**Tech Stack:** Node ESM (`.mjs`), built-ins only, `node --test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-07-23-unioss-knowledge-quality-design.md`

## Global Constraints

- Node built-ins only — no npm dependencies.
- `EVIDENCE_CAP` stays 300; over-cap samples **evenly across the sorted range** (newest kept); coverage fields `totalObservations`, `sampled`, `covered:{from,to}` always present.
- Ticket evidence carries the **FULL** description and **all non-system notes** — never first-line slices.
- Scripts never render WWWH digests for today/ticket/refresh-daily anymore; the only script-rendered digest left is the zero-ticket daily ("No new tickets") and ask's tickets/general intents (`renderDailyDigest` stays; empty-block guard stays).
- All file writes via `atomicWrite`.
- Suite: `cd plugins/unioss-knowledge && node --test scripts/` (currently 56 passing).

---

### Task 1: Part A — `buildEvidence` coverage fields + even sampling

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/distill.mjs` (replace `buildEvidence` only)
- Test: `plugins/unioss-knowledge/scripts/distill.test.mjs`

**Interfaces:**
- Produces: `buildEvidence(periodKey, focus, observations)` → `{ periodKey, focus, totalObservations, sampled, covered: { from, to }, observations }`. Observations sorted newest-first; over-cap → 300 picked at even stride (index `Math.floor(i * total / 300)`); `covered.from` = oldest sampled `at`, `covered.to` = newest sampled `at` (both `null` when empty).

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/distill.test.mjs`:

```js
test('buildEvidence over-cap samples evenly across the window, not newest-only', () => {
  const obs = Array.from({ length: 900 }, (_, i) => ({
    author: 'A', at: new Date(Date.UTC(2026, 0, 1) + i * 21600000).toISOString(), body: `b${i}`, source: 's',
  }));
  const ev = buildEvidence('2026', [], obs);
  assert.equal(ev.totalObservations, 900);
  assert.equal(ev.sampled, 300);
  assert.equal(ev.observations.length, 300);
  assert.equal(ev.observations[0].body, 'b899'); // newest kept
  // newest-300 would contain only b600..b899 — even sampling must reach the oldest decile
  assert.ok(ev.observations.some((o) => Number(o.body.slice(1)) < 90));
  assert.equal(ev.covered.to, ev.observations[0].at);
  assert.equal(ev.covered.from, ev.observations[299].at);
});

test('buildEvidence under-cap reports full coverage fields', () => {
  const obs = [
    { author: 'A', at: '2026-03-01T00:00:00.000Z', body: 'old', source: 's' },
    { author: 'A', at: '2026-07-01T00:00:00.000Z', body: 'new', source: 's' },
  ];
  const ev = buildEvidence('2026', [], obs);
  assert.equal(ev.totalObservations, 2);
  assert.equal(ev.sampled, 2);
  assert.equal(ev.covered.from, '2026-03-01T00:00:00.000Z');
  assert.equal(ev.covered.to, '2026-07-01T00:00:00.000Z');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/distill.test.mjs`
Expected: both new tests FAIL (`totalObservations` undefined).

- [ ] **Step 3: Implement**

In `plugins/unioss-knowledge/scripts/distill.mjs`, replace the existing `buildEvidence` function with:

```js
// Evidence handed to the agent for sentiment classification.
// Over-cap windows sample EVENLY across the sorted range — coverage over recency —
// and the coverage fields let the agent disclose exactly what it classified.
export function buildEvidence(periodKey, focus, observations) {
  const sorted = [...observations].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const total = sorted.length;
  const picked = total > EVIDENCE_CAP
    ? Array.from({ length: EVIDENCE_CAP }, (_, i) => sorted[Math.floor(i * total / EVIDENCE_CAP)])
    : sorted;
  const obs = picked.map((o) => ({ author: o.author, at: o.at, body: o.body, source: o.source }));
  return {
    periodKey,
    focus,
    totalObservations: total,
    sampled: obs.length,
    covered: obs.length
      ? { from: obs[obs.length - 1].at, to: obs[0].at }
      : { from: null, to: null },
    observations: obs,
  };
}
```

Note: the pre-existing test `buildEvidence keeps the most recent when over cap` (301 items) still passes — with 301 items the even stride drops exactly the oldest one.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/distill.test.mjs` → all pass.
Full suite: `node --test scripts/` → 58 pass (56 + 2). (refresh/ask tests consume the new shape transparently — extra fields only.)

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/distill.mjs plugins/unioss-knowledge/scripts/distill.test.mjs
git commit -m "feat(unioss-knowledge): evidence coverage fields + even sampling"
```

---

### Task 2: `toTicketEvidence` in `crawl.mjs`

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/crawl.mjs` (append)
- Test: `plugins/unioss-knowledge/scripts/crawl.test.mjs`

**Interfaces:**
- Produces: `toTicketEvidence(crawled)` → array of `{ iid, prefix ('AP'|'FE'), title, web_url, state, author, created_at, labels, description, notes: [{ author, at, body }] }` — full description, non-system notes only.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/crawl.test.mjs` (extend the import line with `toTicketEvidence`):

```js
test('toTicketEvidence keeps full description and non-system notes', () => {
  const crawled = [{
    issue: issue({ description: '# 内容\nline two\nline three', state: 'closed', labels: ['UNIOSS 3', '改修依頼'] }),
    notes: [
      { id: 5, body: 'real note', system: false, created_at: '2026-07-01T00:00:00Z', author: { name: 'U' } },
      { id: 6, body: 'changed labels', system: true, created_at: '2026-07-02T00:00:00Z', author: { name: 'bot' } },
    ],
  }];
  const [t] = toTicketEvidence(crawled);
  assert.equal(t.iid, 10);
  assert.equal(t.prefix, 'AP');
  assert.equal(t.state, 'closed');
  assert.deepEqual(t.labels, ['UNIOSS 3', '改修依頼']);
  assert.equal(t.description, '# 内容\nline two\nline three');
  assert.deepEqual(t.notes, [{ author: 'U', at: '2026-07-01T00:00:00Z', body: 'real note' }]);
});

test('toTicketEvidence prefixes FrontEnd tickets FE', () => {
  const [t] = toTicketEvidence([{ issue: issue({ web_url: 'https://g/unioss/FrontEnd/-/issues/3', iid: 3 }), notes: [] }]);
  assert.equal(t.prefix, 'FE');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/crawl.test.mjs`
Expected: FAIL — `toTicketEvidence` not exported.

- [ ] **Step 3: Implement**

Append to `plugins/unioss-knowledge/scripts/crawl.mjs`:

```js
// Full-fidelity per-ticket evidence for agent-written reports (today/ticket/daily flows).
export function toTicketEvidence(crawled) {
  return crawled.map(({ issue, notes }) => ({
    iid: issue.iid,
    prefix: moduleOf(issue) === 'front-end' ? 'FE' : 'AP',
    title: issue.title,
    web_url: issue.web_url,
    state: issue.state ?? 'opened',
    author: issue.author?.name ?? 'unknown',
    created_at: issue.created_at,
    labels: issue.labels ?? [],
    description: issue.description ?? '',
    notes: (Array.isArray(notes) ? notes : [])
      .filter((n) => !n.system)
      .map((n) => ({ author: n.author?.name ?? 'unknown', at: n.created_at, body: n.body ?? '' })),
  }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/crawl.test.mjs` → all pass. Full suite: `node --test scripts/` → 60 pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/crawl.mjs plugins/unioss-knowledge/scripts/crawl.test.mjs
git commit -m "feat(unioss-knowledge): toTicketEvidence — full-fidelity per-ticket evidence"
```

---

### Task 3: `today.mjs` — evidence emitter

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/today.mjs` (full rewrite below)
- Test: `plugins/unioss-knowledge/scripts/today.test.mjs` (full rewrite below)

**Interfaces:**
- Consumes: `toTicketEvidence` from Task 2; `renderDailyDigest` (zero-ticket case only).
- Produces: `runToday(cwd, now, deps)` → tickets found: `{ path: 'digests/<date>-daily.evidence.json', count, needsReport: true }`; zero tickets: `{ path: 'digests/<date>-daily.md', count: 0, needsReport: false }`. Evidence file: `{ date, tickets: [<toTicketEvidence shape>] }`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `plugins/unioss-knowledge/scripts/today.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runToday } from './today.mjs';

const issue = (iid) => ({ iid, project_id: 32, title: `T${iid}`, description: '# 内容\nfull body', web_url: 'https://g/unioss/AdminPage/-/issues/' + iid, created_at: '2026-07-21T09:00:00Z', labels: [], author: { name: 'A' } });
const NOW = new Date('2026-07-21T10:00:00Z');

test('runToday with tickets writes evidence json, no rendered digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const deps = {
    getToken: () => 'tok',
    crawl: async () => [
      { issue: issue(10), notes: [{ id: 1, body: 'n', system: false, created_at: '2026-07-21T09:30:00Z', author: { name: 'U' } }] },
      { issue: issue(11), notes: [] },
    ],
  };
  const res = await runToday(cwd, NOW, deps);
  assert.equal(res.count, 2);
  assert.ok(res.needsReport);
  assert.match(res.path, /2026-07-21-daily\.evidence\.json$/);
  const ev = JSON.parse(readFileSync(res.path, 'utf8'));
  assert.equal(ev.date, '2026-07-21');
  assert.equal(ev.tickets.length, 2);
  assert.equal(ev.tickets[0].description, '# 内容\nfull body');
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'digests', '2026-07-21-daily.md')), false);
});

test('runToday with zero tickets writes the empty digest itself', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const res = await runToday(cwd, NOW, { getToken: () => 'tok', crawl: async () => [] });
  assert.equal(res.count, 0);
  assert.equal(res.needsReport, false);
  assert.match(res.path, /2026-07-21-daily\.md$/);
  assert.match(readFileSync(res.path, 'utf8'), /No new tickets/);
});

test('runToday throws a clear error without a token', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await assert.rejects(() => runToday(cwd, new Date(), { getToken: () => undefined, crawl: async () => [] }), /GITLAB_TOKEN/);
});

test('today crawls by created window', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return [{ issue: issue(10), notes: [] }]; };
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await runToday(cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'created');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/today.test.mjs`
Expected: first two tests FAIL (script still writes a rendered `.md` for tickets).

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `plugins/unioss-knowledge/scripts/today.mjs` with:

```js
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations, toTicketEvidence } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';

export async function runToday(cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const period = parsePeriod('today', now);
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'created' });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  appendObservations(dir, toObservations(crawled));
  touchLayer(dir, 'daily', now);
  const date = period.key;
  if (crawled.length === 0) {
    const path = join(dir, 'digests', `${date}-daily.md`);
    atomicWrite(path, renderDailyDigest([], date));
    return { path, count: 0, needsReport: false };
  }
  // Reports are the agent's job (unioss-knowledge-report skill) — the script only emits evidence.
  const evidence = { date, tickets: toTicketEvidence(crawled) };
  const path = join(dir, 'digests', `${date}-daily.evidence.json`);
  atomicWrite(path, JSON.stringify(evidence, null, 2) + '\n');
  return { path, count: crawled.length, needsReport: true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runToday().then((r) => {
    console.log(`${r.count} ticket(s) → ${r.path}`);
    if (r.needsReport) console.log('Write the daily report per the unioss-knowledge-report skill.');
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/today.test.mjs` → 4 pass. Full suite: `node --test scripts/` → 61 pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/today.mjs plugins/unioss-knowledge/scripts/today.test.mjs
git commit -m "feat(unioss-knowledge): today emits ticket evidence for agent-written reports"
```

---

### Task 4: `refresh.mjs` daily branch — evidence emitter

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/refresh.mjs` (daily branch of `crawlPhase` + one import)
- Test: `plugins/unioss-knowledge/scripts/refresh.test.mjs`

**Interfaces:**
- Consumes: `toTicketEvidence` from Task 2.
- Produces: `runRefresh('daily', …)` → tickets found: `{ written: ['digests/<date>-daily.evidence.json'], ticketCount, needsReport: true }`; zero: `{ written: ['digests/<date>-daily.md'] }`. Same evidence shape as `today.mjs`. Non-daily phases untouched.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/refresh.test.mjs`:

```js
test('daily refresh with tickets writes evidence json, no rendered digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('daily', cwd, NOW, deps);
  assert.ok(res.needsReport);
  assert.equal(res.ticketCount, 1);
  assert.ok(res.written.some((p) => p.endsWith('2026-07-21-daily.evidence.json')));
  assert.equal(existsSync(kb(cwd, 'digests', '2026-07-21-daily.md')), false);
  const ev = JSON.parse(readFileSync(res.written[0], 'utf8'));
  assert.equal(ev.tickets[0].iid, 42);
});

test('daily refresh with zero tickets writes the empty digest itself', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('daily', cwd, NOW, { getToken: () => 'tok', crawl: async () => [] });
  assert.ok(res.written.some((p) => p.endsWith('2026-07-21-daily.md')));
  assert.match(readFileSync(res.written[0], 'utf8'), /No new tickets/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs`
Expected: first new test FAILS (daily still renders the WWWH digest).

- [ ] **Step 3: Implement**

In `plugins/unioss-knowledge/scripts/refresh.mjs`:

Extend the crawl import:

```js
import { crawl as realCrawl, toObservations, toTicketEvidence } from './crawl.mjs';
```

Replace the daily branch inside `crawlPhase` (the `if (kind === 'daily') { … }` block) with:

```js
  if (kind === 'daily') {
    ensureDir(join(dir, 'digests'));
    touchLayer(dir, 'daily', now);
    if (crawled.length === 0) {
      const p = join(dir, 'digests', `${period.key}-daily.md`);
      atomicWrite(p, renderDailyDigest([], period.key));
      return { written: [p] };
    }
    // Reports are the agent's job (unioss-knowledge-report skill) — emit evidence only.
    const evidence = { date: period.key, tickets: toTicketEvidence(crawled) };
    const p = join(dir, 'digests', `${period.key}-daily.evidence.json`);
    atomicWrite(p, JSON.stringify(evidence, null, 2) + '\n');
    return { written: [p], ticketCount: crawled.length, needsReport: true };
  }
```

In the CLI block, after the existing `if (r.count != null) …` line, add:

```js
      if (r.needsReport) console.log(`${r.ticketCount} ticket(s) — write the daily report per the unioss-knowledge-report skill.`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs` → 9 pass. Full suite: `node --test scripts/` → 63 pass.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/refresh.mjs plugins/unioss-knowledge/scripts/refresh.test.mjs
git commit -m "feat(unioss-knowledge): daily refresh emits ticket evidence"
```

---

### Task 5: `ticket.mjs` — single-ticket evidence emitter; un-export `renderWwwh`

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/ticket.mjs` (full rewrite below)
- Modify: `plugins/unioss-knowledge/scripts/wwwh.mjs` (un-export `renderWwwh`)
- Modify: `plugins/unioss-knowledge/scripts/wwwh.test.mjs` (delete the direct `renderWwwh` test + its import)
- Create: `plugins/unioss-knowledge/scripts/ticket.test.mjs`

**Interfaces:**
- Consumes: `toTicketEvidence` (Task 2), `listNotes` from `gitlab.mjs`.
- Produces: `runTicket(url, cwd, deps)` → `{ path: 'digests/ticket-<PREFIX>-<iid>.evidence.json', prefix, iid, needsReport: true }`. `deps` accepts `{ getToken, apiGet, listNotes }`. The agent's report target is `digests/ticket-<PREFIX>-<iid>.md`.

- [ ] **Step 1: Write the failing tests**

Create `plugins/unioss-knowledge/scripts/ticket.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTicket } from './ticket.mjs';

const issue = {
  iid: 1862, project_id: 32, title: 'ランディングページのチラシ種別追加',
  description: '# 内容\nサイネックス用（返礼品2割用）の種別を追加', state: 'opened',
  web_url: 'https://g/unioss/AdminPage/-/work_items/1862',
  created_at: '2026-07-23T00:00:00Z', labels: ['UNIOSS 3'], author: { name: 'Satoshi Yamaguchi' },
};

test('runTicket writes single-ticket evidence with full description and notes', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kticket-'));
  const deps = {
    getToken: () => 'tok',
    apiGet: async () => issue,
    listNotes: async () => [
      { id: 1, body: 'note body', system: false, created_at: '2026-07-23T01:00:00Z', author: { name: 'U' } },
      { id: 2, body: 'sys', system: true, created_at: '2026-07-23T02:00:00Z', author: { name: 'bot' } },
    ],
  };
  const res = await runTicket('https://g/unioss/AdminPage/-/work_items/1862', cwd, deps);
  assert.equal(res.prefix, 'AP');
  assert.equal(res.iid, '1862');
  assert.ok(res.needsReport);
  assert.match(res.path, /ticket-AP-1862\.evidence\.json$/);
  const ev = JSON.parse(readFileSync(res.path, 'utf8'));
  assert.equal(ev.description, '# 内容\nサイネックス用（返礼品2割用）の種別を追加');
  assert.deepEqual(ev.notes, [{ author: 'U', at: '2026-07-23T01:00:00Z', body: 'note body' }]);
});

test('runTicket rejects a non-ticket URL', async () => {
  await assert.rejects(() => runTicket('https://example.com/nope', mkdtempSync(join(tmpdir(), 'kticket-')), { getToken: () => 'tok' }), /Invalid GitLab ticket URL/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/ticket.test.mjs`
Expected: FAIL — current `runTicket` returns `{ prefix, iid, markdown }`, writes nothing.

- [ ] **Step 3: Implement**

Replace the entire contents of `plugins/unioss-knowledge/scripts/ticket.mjs` with:

```js
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken, apiGet as realApiGet, listNotes as realListNotes } from './gitlab.mjs';
import { toTicketEvidence } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite } from './store.mjs';

const URL_RE = /https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/;

export async function runTicket(url, cwd = process.cwd(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const get = deps.apiGet ?? realApiGet;
  const listNotes = deps.listNotes ?? realListNotes;
  const m = String(url).match(URL_RE);
  if (!m) throw new Error('Invalid GitLab ticket URL');
  const [, host, ns, repo, , iid] = m;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const project = encodeURIComponent(`${ns}/${repo}`);
  const issue = await get(host, `projects/${project}/issues/${iid}`, token);
  const notes = await listNotes(host, token, issue.project_id, iid);
  // Reports are the agent's job (unioss-knowledge-report skill) — emit evidence only.
  const [ticket] = toTicketEvidence([{ issue, notes: Array.isArray(notes) ? notes : [] }]);
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  const path = join(dir, 'digests', `ticket-${ticket.prefix}-${iid}.evidence.json`);
  atomicWrite(path, JSON.stringify(ticket, null, 2) + '\n');
  return { path, prefix: ticket.prefix, iid, needsReport: true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runTicket(process.argv[2]).then((r) => {
    console.log(r.path);
    console.log(`Write the report per the unioss-knowledge-report skill → digests/ticket-${r.prefix}-${r.iid}.md`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
```

In `plugins/unioss-knowledge/scripts/wwwh.mjs`, change line 15 `export function renderWwwh(issue) {` to `function renderWwwh(issue) {` (internal helper for `renderDailyDigest` only).

In `plugins/unioss-knowledge/scripts/wwwh.test.mjs`: remove `renderWwwh` from the import line and delete the `renderWwwh includes prefix, title, and all four Ws` test block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/` → 64 pass (63 + 2 ticket − 1 wwwh). Verify no references: `grep -rn "renderWwwh" plugins/unioss-knowledge/scripts/ | grep -v wwwh.mjs` → empty.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/ticket.mjs plugins/unioss-knowledge/scripts/ticket.test.mjs plugins/unioss-knowledge/scripts/wwwh.mjs plugins/unioss-knowledge/scripts/wwwh.test.mjs
git commit -m "feat(unioss-knowledge): ticket emits evidence; renderWwwh internal-only"
```

---

### Task 6: Report skill + command rewrites + Part B guidance

**Files:**
- Create: `plugins/unioss-knowledge/skills/unioss-knowledge-report/SKILL.md`
- Modify: `plugins/unioss-knowledge/commands/unioss-knowledge-today.md` (full rewrite)
- Modify: `plugins/unioss-knowledge/commands/unioss-knowledge-ticket.md` (full rewrite)
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md` (daily section + classify step)
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md` (classify step)

- [ ] **Step 1: Create the report skill**

Create `plugins/unioss-knowledge/skills/unioss-knowledge-report/SKILL.md`:

````markdown
---
name: unioss-knowledge-report
description: How to write a valuable English ticket report from ticket evidence — structure, method, and depth modes. Read before writing any today/ticket/daily report.
---

# UNIOSS Knowledge — Ticket Report

The single definition of a valuable ticket report. Both digest flows read this before writing.

## Method

- Read the ticket's FULL description and ALL notes from the evidence file — never summarize from the title alone.
- Translate Japanese titles/content; the report is always **English**.
- Derive acceptance criteria from concrete statements in the ticket — never invent requirements.
- Mark uncertainty explicitly in Open questions rather than guessing.
- Never drop a ticket from a multi-ticket digest.

## Depth modes

- **daily** (today / refresh daily): ticket-content depth — no codebase reading; omit Suggested direction or keep it ticket-content-level.
- **single-ticket** (`/unioss-knowledge-ticket`): full depth — read the codebase before Suggested direction. Module path comes from `.walkthrough/.config/unioss.config.json` → `source.modules.admin-page` for AP tickets, `source.modules.front-end` for FE. Locate the screens/controllers/models the ticket touches and ground the direction in what exists.

## Report structure (one section per ticket)

```markdown
## AP#<iid> — <English one-line title translation>

**Summary** — one sentence: what this ticket is.

| | |
|---|---|
| **Who/When** | <author> · created <date> · state <opened/closed> |
| **Ticket** | <web_url> |

**What** — the actual requirement, synthesized from description + notes. Never raw template slices.

**Why** — business reason / customer impact. Relayed municipality context counts.

**Acceptance criteria**
- [ ] testable criterion derived from ticket content
- [ ] ...

**Suggested direction** — solution sketch. (Single-ticket mode: codebase-informed. Daily mode: omit or ticket-content-level.)

**Open questions**
- ambiguity a developer must clarify before starting (omit section when none)
```
````

- [ ] **Step 2: Rewrite the today command**

Replace the entire contents of `plugins/unioss-knowledge/commands/unioss-knowledge-today.md` with:

````markdown
---
description: Report today's new UNIOSS 3 tickets — evidence out, agent-written English reports.
---

# UNIOSS Knowledge — Today

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/today.mjs"
   ```

2. `0 ticket(s)` → relay `No new UNIOSS 3 tickets today.` Done.
3. Otherwise: read the printed evidence file, invoke the `unioss-knowledge-report` skill, and write one report section per ticket (**daily** depth) to `digests/<date>-daily.md` (same folder as the evidence). Never drop a ticket.
4. Relay the digest path and the reports.
````

- [ ] **Step 3: Rewrite the ticket command**

Replace the entire contents of `plugins/unioss-knowledge/commands/unioss-knowledge-ticket.md` with:

````markdown
---
description: Full English report for one GitLab ticket — evidence out, agent analysis (ticket + codebase) in.
argument-hint: <gitlab-url>
---

# UNIOSS Knowledge — Ticket

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ticket.mjs" "<TICKET_URL>"
   ```

2. Read the printed evidence file, invoke the `unioss-knowledge-report` skill, and write the report at **single-ticket** depth (read the codebase per the skill) to `digests/ticket-<PREFIX>-<IID>.md` (path printed by the script).
3. Relay the report path and the report.
````

- [ ] **Step 4: Update the refresh skill (daily two-step + Part B classify guidance)**

In `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md`:

Replace the `## Workflow — daily` section with:

````markdown
## Workflow — daily

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" daily
   ```

2. If it prints a `.md` path (zero tickets), relay it. Done.
3. Otherwise: read the printed evidence file, invoke the `unioss-knowledge-report` skill, and write one report section per ticket (**daily** depth) to `digests/<date>-daily.md`. Relay the path.
````

Replace step `2. **Classify** — …` (the whole classify block up to but not including `3. **Finalize**`) with:

````markdown
2. **Classify** — read the evidence file. Customer sentiment on this GitLab is **relayed**: customers (municipalities) never comment directly — team members carry their voice. Extract **customer-impacting signal**, whoever typed it:
   - **Criticism** — bugs reported from municipalities/production, complaints, repeated requests, dissatisfaction, urgent escalations relayed in comments.
   - **Praise** — relayed thanks, satisfaction, positive confirmations from the customer side.
   - Still ignore: pure dev/PM process chatter (review approvals, merge/deploy notices, refactor debates, CI/test logs) with no customer-impacting content.
   - Read Japanese natively; one concise English line + source URL per item; ≤20 per list; ≤200 chars per body; empty arrays are honest — never pad with noise.
   - **Coverage:** the evidence file carries `totalObservations`, `sampled`, `covered`. If `sampled < totalObservations`, your final answer MUST say so (e.g. "classified 300 of 794, sampled across 2026-01-05 – 2026-07-23"). For full coverage you MAY classify `sentiment/observations.jsonl` in period-filtered batches and merge before writing the classified file.

   Write the result as `sentiment/classified-<period>.json` next to the evidence file:

   ```json
   { "praise": [{ "body": "...", "source": "..." }], "criticism": [{ "body": "...", "source": "..." }] }
   ```
````

- [ ] **Step 5: Update the ask skill's classify step (Part B)**

In `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md`, replace step `b. Classify: …` (the sentence-paragraph and its JSON block) with:

````markdown
   b. Classify: read the evidence. Customer sentiment on this GitLab is **relayed** — customers (municipalities) never comment directly; team members carry their voice. Extract **customer-impacting signal**, whoever typed it: criticism = bugs from municipalities/production, complaints, repeated requests, dissatisfaction relayed in comments; praise = relayed thanks/satisfaction/positive confirmations. Ignore pure dev/PM process chatter. Read Japanese natively; one concise English line + source URL per item; ≤20 per list; ≤200 chars per body; empty arrays are honest. If the evidence shows `sampled < totalObservations`, your answer MUST state the coverage (e.g. "classified 300 of 794, sampled across the period"); for full coverage you MAY classify `sentiment/observations.jsonl` in period-filtered batches and merge. Write `sentiment/classified-<period>.json`:

   ```json
   { "praise": [{ "body": "...", "source": "..." }], "criticism": [{ "body": "...", "source": "..." }] }
   ```
````

- [ ] **Step 6: Verify + commit**

Run: `cd plugins/unioss-knowledge && node --test scripts/` → 64 pass (docs-only step) and `node --test hooks/` → 4 pass.

```bash
git add plugins/unioss-knowledge/skills/unioss-knowledge-report/SKILL.md plugins/unioss-knowledge/commands/unioss-knowledge-today.md plugins/unioss-knowledge/commands/unioss-knowledge-ticket.md plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md
git commit -m "feat(unioss-knowledge): report skill + relayed-voice guidance + coverage disclosure"
```
