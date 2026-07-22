# unioss-knowledge Activity-Window Crawl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Weekly/monthly refresh and ask crawl tickets by **update** date (any state), so closed/commented tickets enter the knowledge base; today/daily keep crawling by **creation** date.

**Architecture:** One new `dateField: 'created' | 'updated'` option threaded through `listIssues` → `crawl` → callers. When `'updated'`, crawl also filters each issue's notes to the period window so old comments don't pollute period sentiment. No store/schema change.

**Tech Stack:** Node ESM (`.mjs`), built-ins only, `node --test` + `node:assert/strict`, tests beside source as `*.test.mjs`.

**Spec:** `docs/superpowers/specs/2026-07-22-unioss-knowledge-updated-window-design.md`

## Global Constraints

- Node built-ins only — no npm dependencies; global `fetch`.
- GitLab access is READ-ONLY (GET). Never print the token.
- `state: 'all'` stays the default in `listIssues` — do not narrow it.
- Default `dateField` is `'created'` (backward compatible).
- Note-window boundaries are **inclusive** (`[from, to]`).
- Run the full knowledge suite from `plugins/unioss-knowledge/`: `node --test scripts/`.

---

### Task 1: `listIssues` — `dateField` + `after`/`before` window opts

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/gitlab.mjs:26-41`
- Test: `plugins/unioss-knowledge/scripts/gitlab.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `listIssues(host, token, { label, after, before, dateField = 'created', state = 'all' }, fetchImpl)` — `after`/`before` are ISO strings; `dateField: 'created'` emits `created_after`/`created_before` query params, `'updated'` emits `updated_after`/`updated_before`; any other value throws `Unknown dateField: <value>`. (The old `createdAfter`/`createdBefore` opt names are **renamed** to `after`/`before`; `crawl.mjs` is the only production caller and is updated in Task 2.)

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/gitlab.test.mjs`:

```js
function captureFetch(urls) {
  return async (url) => { urls.push(url); return { ok: true, status: 200, json: async () => [] }; };
}

test('listIssues windows on created_* by default', async () => {
  const urls = [];
  await listIssues('h', 't', { after: '2026-07-14T00:00:00.000Z', before: '2026-07-21T00:00:00.000Z' }, captureFetch(urls));
  assert.match(urls[0], /created_after=/);
  assert.match(urls[0], /created_before=/);
  assert.doesNotMatch(urls[0], /updated_after=/);
});

test('listIssues windows on updated_* when dateField is updated', async () => {
  const urls = [];
  await listIssues('h', 't', { after: '2026-07-14T00:00:00.000Z', before: '2026-07-21T00:00:00.000Z', dateField: 'updated' }, captureFetch(urls));
  assert.match(urls[0], /updated_after=/);
  assert.match(urls[0], /updated_before=/);
  assert.doesNotMatch(urls[0], /created_after=/);
  assert.match(urls[0], /state=all/);
});

test('listIssues rejects an unknown dateField', async () => {
  await assert.rejects(() => listIssues('h', 't', { dateField: 'closed' }, captureFetch([])), /Unknown dateField/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/gitlab.test.mjs`
Expected: 3 new tests FAIL (`created_after` not emitted from `after`, no `updated_*` support, no throw).

- [ ] **Step 3: Implement**

Replace `listIssues` in `plugins/unioss-knowledge/scripts/gitlab.mjs`:

```js
export async function listIssues(host, token, opts = {}, fetchImpl = fetch) {
  const { label, after, before, dateField = 'created', state = 'all' } = opts;
  if (dateField !== 'created' && dateField !== 'updated') throw new Error(`Unknown dateField: ${dateField}`);
  const params = new URLSearchParams({ scope: 'all', per_page: '100', order_by: 'created_at', sort: 'desc', state });
  if (label) params.set('labels', label);
  if (after) params.set(`${dateField}_after`, after);
  if (before) params.set(`${dateField}_before`, before);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/gitlab.test.mjs`
Expected: all gitlab tests PASS (3 old + 3 new).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/gitlab.mjs plugins/unioss-knowledge/scripts/gitlab.test.mjs
git commit -m "feat(unioss-knowledge): listIssues dateField created|updated window"
```

---

### Task 2: `crawl` — pass `dateField` through, filter notes to window when `'updated'`

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/crawl.mjs:8-18`
- Test: `plugins/unioss-knowledge/scripts/crawl.test.mjs`

**Interfaces:**
- Consumes: `listIssues(host, token, { label, after, before, dateField })` from Task 1.
- Produces: `crawl({ host, token, label, from, to, dateField = 'created' }, deps)` — `from`/`to` are `Date`s. With `'updated'`: each issue's `notes` array contains only notes whose `created_at` is within `[from, to]` inclusive (notes missing `created_at` are dropped). With `'created'`: all notes kept (current behavior). `toObservations` unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/crawl.test.mjs`:

```js
test('crawl with dateField updated forwards it and filters notes to the window', async () => {
  let captured;
  const from = new Date('2026-07-14T00:00:00Z');
  const to = new Date('2026-07-21T00:00:00Z');
  const deps = {
    listIssues: async (h, t, opts) => { captured = opts; return [issue()]; },
    listNotes: async () => [
      { id: 1, body: 'old comment', system: false, created_at: '2026-06-01T00:00:00Z', author: { name: 'U' } },
      { id: 2, body: 'in window', system: false, created_at: '2026-07-15T00:00:00Z', author: { name: 'U' } },
      { id: 3, body: 'boundary', system: false, created_at: '2026-07-21T00:00:00Z', author: { name: 'U' } },
      { id: 4, body: 'no date', system: false, author: { name: 'U' } },
    ],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3', from, to, dateField: 'updated' }, deps);
  assert.equal(captured.dateField, 'updated');
  assert.equal(captured.after, from.toISOString());
  assert.equal(captured.before, to.toISOString());
  assert.deepEqual(out[0].notes.map((n) => n.body), ['in window', 'boundary']);
});

test('crawl with default dateField keeps all notes', async () => {
  const deps = {
    listIssues: async () => [issue()],
    listNotes: async () => [
      { id: 1, body: 'old comment', system: false, created_at: '2026-06-01T00:00:00Z', author: { name: 'U' } },
    ],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3', from: new Date('2026-07-14T00:00:00Z'), to: new Date('2026-07-21T00:00:00Z') }, deps);
  assert.equal(out[0].notes.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/crawl.test.mjs`
Expected: first new test FAILS (`captured.after` undefined — crawl still sends `createdAfter`; notes unfiltered).

- [ ] **Step 3: Implement**

Replace `crawl` in `plugins/unioss-knowledge/scripts/crawl.mjs` (leave `moduleOf`, `toObservations` untouched):

```js
function noteInWindow(note, from, to) {
  if (!note.created_at) return false;
  const at = new Date(note.created_at);
  if (from && at < from) return false;
  if (to && at > to) return false;
  return true;
}

export async function crawl({ host, token, label, from, to, dateField = 'created' }, deps = { listIssues, listNotes }) {
  const after = from ? from.toISOString() : undefined;
  const before = to ? to.toISOString() : undefined;
  const issues = await deps.listIssues(host, token, { label, after, before, dateField });
  const out = [];
  for (const issue of issues) {
    const notes = await deps.listNotes(host, token, issue.project_id, issue.iid);
    const all = Array.isArray(notes) ? notes : [];
    // 'updated' windows on activity — an old ticket's full history must not re-enter every period.
    out.push({ issue, notes: dateField === 'updated' ? all.filter((n) => noteInWindow(n, from, to)) : all });
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-knowledge && node --test scripts/crawl.test.mjs`
Expected: all crawl tests PASS (3 old + 2 new).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/crawl.mjs plugins/unioss-knowledge/scripts/crawl.test.mjs
git commit -m "feat(unioss-knowledge): crawl dateField passthrough + note window filter"
```

---

### Task 3: Callers — weekly/monthly/ask crawl by `'updated'`, today/daily by `'created'`

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/refresh.mjs:30`
- Modify: `plugins/unioss-knowledge/scripts/ask.mjs:27`
- Modify: `plugins/unioss-knowledge/scripts/today.mjs:17`
- Test: `plugins/unioss-knowledge/scripts/refresh.test.mjs`, `plugins/unioss-knowledge/scripts/ask.test.mjs`, `plugins/unioss-knowledge/scripts/today.test.mjs`

**Interfaces:**
- Consumes: `crawl({ …, dateField })` from Task 2.
- Produces: no signature changes — `runRefresh`, `runAsk`, `runToday` unchanged externally; they now pass `dateField` internally: refresh daily → `'created'`, refresh weekly/monthly → `'updated'`, ask → `'updated'`, today → `'created'`.

- [ ] **Step 1: Write the failing tests**

Append to `plugins/unioss-knowledge/scripts/refresh.test.mjs`:

```js
test('daily refresh crawls by created window; weekly by updated', async () => {
  const fields = [];
  const spyCrawl = async (opts) => { fields.push(opts.dateField); return crawlStub(); };
  const spyDeps = { getToken: () => 'tok', crawl: spyCrawl };
  await runRefresh('daily', mkdtempSync(join(tmpdir(), 'krefresh-')), new Date('2026-07-21T00:00:00Z'), spyDeps);
  await runRefresh('weekly', mkdtempSync(join(tmpdir(), 'krefresh-')), new Date('2026-07-21T00:00:00Z'), spyDeps);
  assert.deepEqual(fields, ['created', 'updated']);
});
```

Append to `plugins/unioss-knowledge/scripts/ask.test.mjs`:

```js
test('ask crawls by updated window (activity view)', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  await runAsk({ intent: 'focus', period, mutate: false }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
});
```

Append to `plugins/unioss-knowledge/scripts/today.test.mjs` (reuse that file's existing crawl stub if one exists; otherwise this is self-contained — it only needs `runToday` and imports already present in the file: `mkdtempSync`, `tmpdir`, `join`):

```js
test('today crawls by created window', async () => {
  let captured;
  const spyCrawl = async (opts) => {
    captured = opts;
    return [{
      issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T00:00:00Z', labels: [], author: { name: 'A' } },
      notes: [],
    }];
  };
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await runToday(cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'created');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs scripts/ask.test.mjs scripts/today.test.mjs`
Expected: 3 new tests FAIL (`dateField` undefined in captured opts).

- [ ] **Step 3: Implement**

`plugins/unioss-knowledge/scripts/refresh.mjs` — replace the crawl line inside `runRefresh` (currently line 30):

```js
    // daily digest = tickets that arrived today; weekly/monthly = any ticket active in the window.
    const dateField = kind === 'daily' ? 'created' : 'updated';
    const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField });
```

`plugins/unioss-knowledge/scripts/ask.mjs` — replace the crawl line inside `runAsk` (currently line 27):

```js
  // Activity view: any ticket updated in the period counts, not only newly created ones.
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'updated' });
```

`plugins/unioss-knowledge/scripts/today.mjs` — replace the crawl line inside `runToday` (currently line 17):

```js
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'created' });
```

- [ ] **Step 4: Run the full knowledge suite**

Run: `cd plugins/unioss-knowledge && node --test scripts/`
Expected: ALL tests PASS (43 existing + 8 new = 51). No pipeline files touched.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/refresh.mjs plugins/unioss-knowledge/scripts/ask.mjs plugins/unioss-knowledge/scripts/today.mjs plugins/unioss-knowledge/scripts/refresh.test.mjs plugins/unioss-knowledge/scripts/ask.test.mjs plugins/unioss-knowledge/scripts/today.test.mjs
git commit -m "feat(unioss-knowledge): weekly/monthly/ask window on updated date, all states"
```

---

### Task 4: Docs — align original spec + skill notes

**Files:**
- Modify: `docs/superpowers/specs/2026-07-21-unioss-knowledge-design.md:31` and `:68`
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md:22-25`
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md:8`

(No plugin README edit — `plugins/unioss-knowledge/README.md` was removed from the repo.)

- [ ] **Step 1: Update the original spec's ticket-source row**

In `docs/superpowers/specs/2026-07-21-unioss-knowledge-design.md` line 31, replace:

```
| Ticket source | The dashboard label filter, not per-project crawl: `labels=UNIOSS 3 · state=opened · sort=created_date`, spanning all projects that carry the label. Label configurable (`gitlab.workLabel`, default `UNIOSS 3`). |
```

with:

```
| Ticket source | The dashboard label filter, not per-project crawl: `labels=UNIOSS 3 · state=all`, spanning all projects that carry the label. Window: today/daily by `created_*`, weekly/monthly/ask by `updated_*` (see 2026-07-22 amendment). Label configurable (`gitlab.workLabel`, default `UNIOSS 3`). |
```

- [ ] **Step 2: Update the original spec's crawl bullet**

In the same file, line 68, replace:

```
- **Crawl** = one shared `crawl.mjs`. Given a date window, lists issues via the dashboard label filter (`GET /api/v4/issues?labels=<workLabel>&state=…&created_after=…`, paginated) across every project carrying the label, then pulls each issue's notes. Reuses `fetch-ticket.js`'s token/host logic and pipeline config. Reference (human view): `https://gitlab.unioss.jp/dashboard/issues?sort=created_date&state=opened&label_name[]=UNIOSS+3`.
```

with:

```
- **Crawl** = one shared `crawl.mjs`. Given a date window and a `dateField` (`created` for today/daily, `updated` for weekly/monthly/ask), lists issues via the dashboard label filter (`GET /api/v4/issues?labels=<workLabel>&state=all&<dateField>_after=…`, paginated) across every project carrying the label, then pulls each issue's notes (filtered to the window when `dateField=updated`). Reuses `fetch-ticket.js`'s token/host logic and pipeline config. Reference (human view): `https://gitlab.unioss.jp/dashboard/issues?sort=created_date&label_name[]=UNIOSS+3`.
```

- [ ] **Step 3: Update the refresh skill notes**

In `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md`, replace the `## Notes` section:

```markdown
## Notes

- `daily` windows on **creation** date — the digest answers "what new tickets arrived today".
- `weekly`/`monthly` window on **update** date, all states — any ticket active in the period (closed, commented, re-opened) counts, not only newly created ones.
- Mutates the current-window KB. Historical queries belong to `/unioss-knowledge-ask`.
- Lock-guarded; on a GitLab error nothing is written.
```

- [ ] **Step 4: Update the ask skill intro**

In `plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md`, replace line 8:

```
Answer from the most-recently-stored knowledge. Crawl only on an opted-in refresh.
```

with:

```
Answer from the most-recently-stored knowledge. Crawl only on an opted-in refresh. Crawls cover any ticket **active** (updated) in the period, all states — not only newly created ones.
```

- [ ] **Step 5: Verify + commit**

Run: `cd plugins/unioss-knowledge && node --test scripts/` (docs-only change — suite must stay green.)

```bash
git add docs/superpowers/specs/2026-07-21-unioss-knowledge-design.md plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md plugins/unioss-knowledge/skills/unioss-knowledge-ask/SKILL.md
git commit -m "docs(unioss-knowledge): state=all + updated-window semantics"
```
