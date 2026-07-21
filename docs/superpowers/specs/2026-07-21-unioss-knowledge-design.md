# unioss-knowledge — Design Spec

**Date:** 2026-07-21
**Status:** Approved (brainstorming), pending implementation plan
**Author:** ttncode

## Goals

1. **Human understanding** — the human can understand every new ticket (WWWH), summarize one ticket by URL, and read weekly/monthly customer signal.
2. **Increasingly-informed agents** — a knowledge base that grows from real work and customer signal, injected before every ticket so agent #50 knows what agents #1–49 learned.
3. **"Enough, not all" memory** — bounded, token-budgeted injection via progressive disclosure. Inject the best thin slice, keep the comprehensive backing on disk.

## Non-goals

- No scheduled/cron generation — refresh is manual, staleness-nudged.
- No harvesting of pipeline REVIEW.md / feedback rounds as a lesson source (deferred).
- No standalone domain-scan command — domain facts auto-harvest inside the pipeline's investigate stage.
- No separate free-form manual-authoring feature — the gated `rules/staged.md` doubles as the hand-add path.
- Digests do not replace the pipeline; they inform it.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Packaging | One new plugin `unioss-knowledge`, shared crawl layer feeding both digests and KB. |
| Injection | Layered: SessionStart hook (tiny always-on `GLOBAL.md`) + pipeline GATE-0 (deep, ticket-scoped). |
| Curation | Tiered — observational **facts auto-write**; prescriptive **rules gated** behind human approval. |
| Trigger | Manual commands + SessionStart staleness nudge. No cron. |
| Lesson sources | Customer signal (GitLab comments) + domain/codebase facts. |
| Language | Both digests and KB in English. |

## Architecture

New plugin `plugins/unioss-knowledge/`, added to `.claude-plugin/marketplace.json`. Three layers, filesystem-coupled to `unioss-pipeline` (no code dependency — both operate on the same `.walkthrough/` checkout).

```
                 ┌─────────────────────────────────────────┐
   GitLab  ──▶   │  CRAWL (shared)   crawl.mjs              │
  AP + FE        │  window + project ids → issues + notes    │
  comments       │  reuses token/host resolution + config    │
                 └───────────────┬───────────────────────────┘
                                 │ raw JSON
           ┌─────────────────────┴──────────────────────┐
           ▼                                             ▼
  ┌──────────────────┐                        ┌────────────────────────┐
  │ DIGEST renderer   │  human, English        │ KB distiller            │
  │ daily WWWH        │  digests/*.md          │ facts → auto-write      │
  │ weekly praise/    │                        │ rules → staged (gated)  │
  │ complaints        │                        │                         │
  │ monthly focus     │                        │                         │
  └──────────────────┘                        └───────────┬────────────┘
                                                           │
  Domain facts (auto-harvested by pipeline investigate) ───┤
                                                           ▼
                                              ┌────────────────────────┐
                                              │  KNOWLEDGE STORE         │
                                              │  GLOBAL.md (tiny)        │
                                              │  domain/  rules/         │
                                              │  sentiment/  digests/    │
                                              └───────────┬────────────┘
                        ┌──────────────────────────────────┴───────┐
             SessionStart hook                          Pipeline GATE-0
             injects GLOBAL.md (token-capped)           reads domain/<module> +
             + staleness nudge                          rules/approved.md
```

- **Crawl** = one shared `crawl.mjs`. Given a date window + the two project ids, pulls issues + notes across AP + FE. Reuses `fetch-ticket.js`'s token/host logic and pipeline config (project ids, gitlab host).
- **Digest renderer** and **KB distiller** both consume crawl output — no duplicated ingestion.
- **Store** is progressive-disclosure (below).
- **Injection** is layered: hook = tiny always-on `GLOBAL.md`; pipeline = deep ticket-scoped read.
- The only edit to the existing pipeline: a KB read + domain-fact append step in `unioss-investigate` / GATE-0.

## Storage format ("enough, not all")

Tiered progressive disclosure — three tiers by read-frequency vs. cost.

```
.walkthrough/.knowledge/
  GLOBAL.md              ← TIER 1 · always injected · HARD CAP ~40 lines / ~1.2k tokens
  index.json             ← manifest: per-layer last-run, counts, staleness
  domain/                ← TIER 2 · read on demand, per ticket module
    admin-page.md          durable AP facts, gotchas
    front-end.md           durable FE facts, gotchas
    conventions.md         CI3 quirks, migration ordering, naming
    data-model.md          key tables, business rules
  rules/                 ← TIER 2 · prescriptive
    approved.md            LIVE rules — each: statement + evidence link + date
    staged.md              PROPOSED rules awaiting approval (gated)
  sentiment/             ← TIER 3 · raw, rarely read whole
    current.md             latest distilled praise/complaints (auto)
    observations.jsonl     append-only mined signals w/ source links (dedupe source)
  digests/               ← human-facing, dated
    YYYY-MM-DD-daily.md    YYYY-Www-weekly.md    YYYY-MM-monthly.md
```

**"Enough, not all" enforcement:**
- **Tier 1 (`GLOBAL.md`)** — the only thing every agent gets. Hard token cap. Distiller keeps top-N by recency + severity (customer focus this month, top active pitfalls, current friction). Overflow dropped from GLOBAL, never lost (still Tier 2/3). Writer enforces the cap; hook re-checks defensively.
- **Tier 2** — pulled selectively by the pipeline: only the touched module's `domain/*.md` + `rules/approved.md`. An FE ticket never loads AP facts.
- **Tier 3** — append-only evidence trail; agents almost never read it whole. Backs the "comprehensive" behind the "concise" GLOBAL, and is the dedupe source.

**Increasingly informed:** every refresh appends to `observations.jsonl` and re-distills Tiers 1–3; every approved rule is permanent; investigate appends domain facts. The store accumulates monotonically; GLOBAL.md always shows the current best slice.

### `GLOBAL.md` shape (example, within cap)

```markdown
# UNIOSS Knowledge — read before any ticket
_Updated 2026-07-21 · sentiment 2d old_

## Customer focus this month
- Sales-ledger month-end close accuracy (AP#1834, AP#1840)
- FE performance on the order-search screen (FE#391)

## Top active pitfalls (approved rules)
- [R-012] Never hard-delete t_sales_detail; soft-delete via deleted_at. (AP#1834)
- [R-008] Bump migration timestamp before generating; AP shares the table. (AP#1801)

## Current friction (this week)
- Repeated complaint: CSV export drops trailing-zero product codes. (FE#402, FE#405)
```

### `domain/admin-page.md` shape (auto-harvested example)

```markdown
# Domain — AdminPage (AP)
_Auto-harvested from investigations. Facts carry a source._

## Data model
- t_sales_header / t_sales_detail — 1:N; detail soft-deleted via deleted_at. (AP#1834)
- Money stored as integer yen; format at view only. (AP#1712)

## Gotchas
- Migrations timestamp-ordered; AP shares migration table with common-models. (AP#1801)
```

## Commands

| Command | Does | Mutates KB? |
|---|---|---|
| `/unioss-knowledge-ticket <gitlab-url>` | Summarize one ticket (WWWH: What/Why/Who/How) from issue + notes. Reuses the pipeline fetcher. | no |
| `/unioss-knowledge-today` | Summarize all tickets created today across AP + FE → WWWH, one block per ticket, none dropped → `digests/<date>-daily.md`. | facts only |
| `/unioss-knowledge-ask "<question>" [period]` | **Free-form read-only query.** Answers focus / praise-criticism / ticket-overview for any period. Writes a dated report under `digests/`; **never** touches `GLOBAL.md` / `rules/` / `sentiment/current.md`. See flow below. | no |
| `/unioss-knowledge-refresh [daily\|weekly\|monthly]` | Crawl + distill the **current** window. `daily`=new-ticket WWWH; `weekly`=praise/complaints → `sentiment/current.md` (auto) + propose rules → `rules/staged.md` (gated); `monthly`=customer focus → `GLOBAL.md` + monthly digest. | yes |
| `/unioss-knowledge-approve` | Show `rules/staged.md`; promote approved → `rules/approved.md`, fold top into `GLOBAL.md`. | yes (rules) |
| `/unioss-knowledge` | Status: staleness per layer, entry counts, pending staged-rule count (reads `index.json`). | no |

**Ask vs. refresh:** `ask` answers questions (read-only, any period, historical safe). `refresh` feeds agents (mutates curated KB, current window only). A historical query must never overwrite the live GLOBAL/sentiment, which describe *now*.

### `/unioss-knowledge-ask` flow

1. **Parse** the question for (a) intent — `focus` | `sentiment` | `tickets` | general — and (b) period.
2. **Period clarification.** If the period is missing or ambiguous, present a multi-option picker before crawling:

   ```
   Which period?
   1. Current month (07/2026)
   2. Previous month (06/2026)
   3. This week
   4. A specific month/year   (e.g. 2026-03)
   5. A custom date range     (e.g. 2026-06-01..2026-06-30)
   ```

   Options 4–5 accept free-text entry. The picker is rendered via `AskUserQuestion` (its "Other" branch covers 4–5).
3. **Crawl** the resolved window across AP + FE.
4. **Answer** in the requested shape (focus bullets / praise+criticism split / WWWH ticket list).
5. **Write** a dated read-only report → `digests/<period>-<intent>.md`. Append raw signals to `observations.jsonl` (deduped). **No** mutation of `GLOBAL.md` / `rules/` / `sentiment/current.md`.

Example phrasings → resolution:
- `/unioss-knowledge-ask "what is the customer focusing on this month"` → intent `focus`, period current month → answer + `digests/2026-07-focus.md`.
- `/unioss-knowledge-ask "what did customers praise or criticize in June 2026"` → intent `sentiment`, period `2026-06` → answer + `digests/2026-06-sentiment.md`.
- `/unioss-knowledge-ask "customer focus"` (no period) → picker → user picks → resolve.

### `/unioss-knowledge-today` flow (human sees all new tickets)

1. `crawl.mjs --created-after=<today 00:00 local> --projects=ap,fe` → issues + notes.
2. Render a WWWH block per issue (What changed / Why / Who asked / How to approach).
3. Assert count-in == count-out (every new ticket has a block).
4. Write `digests/<date>-daily.md`; append raw signals to `observations.jsonl`; update `index.json`.

`/unioss-knowledge-ticket` is the same WWWH renderer over one fetched issue, no crawl window.

## Injection wiring

**Tier 1 — SessionStart hook** (`hooks/inject-knowledge.mjs`, mirrors `detect-app-env.mjs`):
- Reads `index.json` + `GLOBAL.md`.
- Prints `GLOBAL.md` into context if present and under the token cap (defensive re-truncate).
- Appends a one-line staleness nudge from `index.json` (e.g. `⚠ sentiment 9d old · run /unioss-knowledge-refresh weekly`). No nudge when fresh.
- Silent no-op when the store doesn't exist (fresh install) — never errors a session.

**Tier 2 — Pipeline GATE-0 read** (edit to `unioss-investigate` SKILL.md):
- Once the ticket's module (AP/FE) is known, read `domain/<module>.md`, `domain/conventions.md`, `rules/approved.md`; carry relevant items into the investigation.
- Append newly-proven durable facts to `domain/<module>.md` (facts only — never writes rules; a recurring problem goes to `rules/staged.md`).
- Guard: skip if `.walkthrough/.knowledge/` absent.

**Coupling** is filesystem-only. If `unioss-knowledge` isn't installed, the pipeline step finds nothing and proceeds.

## Curation (tiered)

- **Auto-write (facts):** daily/monthly digests, `sentiment/current.md`, `observations.jsonl`, domain facts. Each carries a source link (ticket IID or `file:line`).
- **Gated (rules):** any prescriptive "always/never" statement → `rules/staged.md` with evidence. Nothing steers a future agent until `/unioss-knowledge-approve`. `GLOBAL.md` pitfalls come only from `rules/approved.md`.

## Idempotency & abnormal cases

The store must survive re-runs, partial runs, and duplicate source data. Every writer is idempotent.

- **Repeated `refresh daily` (same day, many times):** date-keyed digest files are **overwritten**, not appended — `digests/<date>-daily.md` is regenerated in full each run. No accumulation from re-running.
- **`observations.jsonl` dedupe:** each observation has a stable id `sha1(project:issue_iid:note_id)` (or `sha1(project:issue_iid:'issue')` for the issue body). Appends skip ids already present. Re-crawling the same window adds nothing new.
- **Staged-rule dedupe:** each staged rule has a fingerprint `sha1(normalized_statement)`. A rule already in `staged.md` or `approved.md` is not re-proposed. Approving is idempotent — promoting an already-approved rule is a no-op.
- **`ask` is read-only & idempotent:** re-running the same question/period overwrites its date-keyed report; never mutates `GLOBAL.md` / `rules/` / `sentiment/current.md`. A historical query can never corrupt the live "now" KB.
- **`GLOBAL.md` / `sentiment/current.md` are pure renders:** fully regenerated from the store each distill — running twice yields byte-identical output (idempotent), no drift.
- **Domain-fact append dedupe:** investigate appends a fact only if its normalized line isn't already in `domain/<module>.md`.
- **Partial/failed crawl:** GitLab 401/429/5xx or network error → abort before any write; the store is left exactly as it was (no half-written digest, no partial jsonl). Writers stage to a temp file and atomic-rename on success.
- **Empty window:** "no new tickets" digest, not a crash; `index.json` timestamp still updated so staleness resets.
- **Pagination:** crawl follows `per_page=100` + page cursor to completion; a hard page cap guards against runaway loops.
- **Concurrent runs:** a lockfile under `.walkthrough/.knowledge/.lock` prevents two refreshes from interleaving writes; second run exits with a clear message.

## Testing

Node scripts get `*.test.mjs` (repo convention):
- crawl window math + pagination termination
- `observations.jsonl` dedupe (re-run adds zero)
- staleness calculation
- `GLOBAL.md` token-cap truncation
- WWWH count-in == count-out for `-today`
- staged-rule fingerprint dedupe
- atomic-write / abort-on-error leaves store unchanged
- `ask` intent + period parsing (incl. `YYYY-MM`, range, and missing-period → picker path)
- `ask` never writes `GLOBAL.md` / `rules/` / `sentiment/current.md`

## Failure modes (degrade safe)

- Missing `GITLAB_TOKEN` → same message as the fetcher.
- GitLab 401/429/5xx → abort, store untouched.
- Empty window → "no new tickets".
- Store absent → hook + GATE-0 no-op.

## Files (new unless noted)

```
plugins/unioss-knowledge/
  .claude-plugin/plugin.json
  commands/  unioss-knowledge.md  -ticket.md  -today.md  -ask.md  -refresh.md  -approve.md
  skills/    unioss-knowledge-*/SKILL.md   (per command flow)
  hooks/     inject-knowledge.mjs  hooks.json  (+ *.test.mjs)
  scripts/   crawl.mjs  distill.mjs  wwwh.mjs  store.mjs  period.mjs  (+ *.test.mjs)
.claude-plugin/marketplace.json            (edit: register plugin)
plugins/unioss-pipeline/skills/unioss-investigate/SKILL.md   (edit: KB read + domain append)
```

## Open questions

None blocking. Reuse of `fetch-ticket.js` token/config logic vs. extracting a shared module is an implementation-plan detail.
