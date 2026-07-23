# unioss-knowledge Yearly Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/unioss-knowledge-refresh yearly` runs the weekly/monthly distill pipeline at year scale.

**Architecture:** `refresh.mjs` gains `yearly: 'year'` in its `WINDOW` map and the distill branch widens from `weekly || monthly` to `kind !== 'daily'`. Everything else (updated-date window, `touchLayer`, lock, observations) falls out of existing code. Docs list the fourth kind.

**Tech Stack:** Node ESM (`.mjs`), built-ins only, `node --test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-07-23-unioss-knowledge-yearly-refresh-design.md`

## Global Constraints

- Node built-ins only — no npm dependencies.
- `runRefresh` external signature unchanged; unknown kind still throws `Unknown refresh kind: <kind>`.
- Yearly crawls by **update** date (`dateField: 'updated'`) — already implied by the existing `kind === 'daily' ? 'created' : 'updated'` line; do not change that line.
- Run the suite from `plugins/unioss-knowledge/`: `node --test scripts/` (currently 47 passing).

---

### Task 1: `refresh.mjs` — yearly kind

**Files:**
- Modify: `plugins/unioss-knowledge/scripts/refresh.mjs:15,30,41`
- Test: `plugins/unioss-knowledge/scripts/refresh.test.mjs`

**Interfaces:**
- Consumes: `parsePeriod('year', now)` (exists), `crawl({ …, dateField })` (exists).
- Produces: `runRefresh('yearly', cwd, now, deps)` — writes `sentiment/current.md` + `GLOBAL.md`, records the `yearly` layer in the index.

- [ ] **Step 1: Write the failing test**

Append to `plugins/unioss-knowledge/scripts/refresh.test.mjs`:

```js
test('yearly refresh writes sentiment + GLOBAL and crawls by updated window', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('yearly', cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
  assert.ok(res.written.some((p) => p.endsWith('current.md')));
  assert.ok(res.written.some((p) => p.endsWith('GLOBAL.md')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs`
Expected: new test FAILS with `Unknown refresh kind: yearly`.

- [ ] **Step 3: Implement**

In `plugins/unioss-knowledge/scripts/refresh.mjs`, three line edits:

Line 15 — add yearly to the window map:

```js
const WINDOW = { daily: 'today', weekly: 'week', monthly: 'month', yearly: 'year' };
```

Line 30 — update the comment:

```js
    // daily digest = tickets that arrived today; weekly/monthly/yearly = any ticket active in the window.
```

Line 41 — widen the distill branch:

```js
    if (kind !== 'daily') {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd plugins/unioss-knowledge && node --test scripts/refresh.test.mjs`
Expected: all refresh tests PASS (4 total). Then run the full suite: `node --test scripts/` — 48 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-knowledge/scripts/refresh.mjs plugins/unioss-knowledge/scripts/refresh.test.mjs
git commit -m "feat(unioss-knowledge): yearly refresh kind"
```

---

### Task 2: Docs — list the yearly kind

**Files:**
- Modify: `plugins/unioss-knowledge/commands/unioss-knowledge-refresh.md:2`
- Modify: `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md:3,10,17,20,24-25`
- Modify: `README.md:96`

(Line numbers approximate — locate the quoted text.)

- [ ] **Step 1: Command description**

In `plugins/unioss-knowledge/commands/unioss-knowledge-refresh.md`, replace:

```
description: Crawl + distill the current window (daily|weekly|monthly) into the knowledge base.
```

with:

```
description: Crawl + distill the current window (daily|weekly|monthly|yearly) into the knowledge base.
```

- [ ] **Step 2: Refresh skill**

In `plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md`:

Frontmatter description, replace:

```
description: Crawl + distill the current window into the knowledge base (daily WWWH, weekly/monthly sentiment + GLOBAL).
```

with:

```
description: Crawl + distill the current window into the knowledge base (daily WWWH; weekly/monthly/yearly sentiment + GLOBAL).
```

Input line, replace:

```
- One of `daily` (default), `weekly`, `monthly`.
```

with:

```
- One of `daily` (default), `weekly`, `monthly`, `yearly`.
```

Run command, replace:

```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <daily|weekly|monthly>
```

with:

```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <daily|weekly|monthly|yearly>
```

Relay line, replace:

```
2. Relay the written file paths. For weekly/monthly, note that `sentiment/current.md` and `GLOBAL.md` were updated.
```

with:

```
2. Relay the written file paths. For weekly/monthly/yearly, note that `sentiment/current.md` and `GLOBAL.md` were updated.
```

Notes bullet, replace:

```
- `weekly`/`monthly` window on **update** date, all states — any ticket active in the period (closed, commented, re-opened) counts, not only newly created ones.
```

with:

```
- `weekly`/`monthly`/`yearly` window on **update** date, all states — any ticket active in the period (closed, commented, re-opened) counts, not only newly created ones.
- `yearly` can be slow — a year-wide updated window may hit the pagination cap (50 pages × 100 = 5000 issues) plus one notes call per issue.
```

- [ ] **Step 3: Root README**

In `README.md`, replace:

```
| `/unioss-knowledge-refresh [daily\|weekly\|monthly]` | Refresh from tickets — run `/unioss-knowledge-approve` after                               |
```

with:

```
| `/unioss-knowledge-refresh [daily\|weekly\|monthly\|yearly]` | Refresh from tickets — run `/unioss-knowledge-approve` after                       |
```

**Caution:** `README.md` has unrelated uncommitted user changes — stage it with `git add README.md` only after confirming `git diff README.md` shows ONLY this one-row change beyond what was already modified; stage the file as-is (the user's other README edits ride along intentionally — they are part of the user's working tree and this task must not revert them). If in doubt, stage only the two plugin doc files and report the README hunk as left unstaged.

- [ ] **Step 4: Verify + commit**

Run: `cd plugins/unioss-knowledge && node --test scripts/` — 48 pass (docs-only step, suite unchanged).

```bash
git add plugins/unioss-knowledge/commands/unioss-knowledge-refresh.md plugins/unioss-knowledge/skills/unioss-knowledge-refresh/SKILL.md
git commit -m "docs(unioss-knowledge): yearly refresh kind"
```

(Include `README.md` in the same commit only under Step 3's caution; otherwise leave it and note it in the report.)
