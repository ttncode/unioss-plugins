# unioss-knowledge — Evidence Honesty + Relayed Voice + Agent-Written Reports — Design

**Date:** 2026-07-23
**Status:** Approved
**Amends:** `2026-07-23-unioss-knowledge-agent-sentiment-design.md` (evidence + guidance), `2026-07-21-unioss-knowledge-design.md` (WWWH digests)

## Problems (field-verified)

1. **Silent truncation.** Yearly evidence kept the 300 *newest* observations: the "2026" answer actually covered Jun 2–Jul 23. 490 of 794 observations (Jan–May) never reached the classifier — including 33/33 notes of two known complaint tickets (1728, 1683). Neither the agent nor the user was told.
2. **"Customer voice only" guarantees empty.** All 794 notes come from 9 team members — customers (municipalities) never comment on this GitLab. Customer sentiment exists only *relayed* through team comments (49 notes mention 自治体/問い合わせ/指摘/要望…). The current guidance filters out the only channel it travels through.
3. **Worthless digests.** `renderWwwh` slices the raw description's first line ("What: `# 内容*`" — the ticket template's own header), dumps labels as "Why" and the URL as "How", in mixed language. No synthesis, no value.

## Part A — Evidence coverage honesty + even sampling

### Evidence file additions

`buildEvidence` output gains coverage fields:

```json
{
  "periodKey": "2026",
  "focus": ["..."],
  "totalObservations": 794,
  "sampled": 300,
  "covered": { "from": "<oldest sampled at>", "to": "<newest sampled at>" },
  "observations": [ ... ]
}
```

### Sampling change

Over-cap windows sample **evenly across the sorted range** (every k-th observation, newest kept) instead of newest-300 — a year's evidence spans the year. Cap stays 300.

### Skill obligations (refresh + ask sentiment steps)

- The agent MUST state coverage in its answer when `sampled < totalObservations`: "classified 300 of 794 observations, sampled across Jan 5–Jul 23".
- For full coverage the agent MAY classify in chunks: re-read `observations.jsonl` directly (filter by period), classify in batches, merge before writing the classified file. Offered, not forced.

## Part B — Relayed-customer-voice guidance

The classification guidance in both skills (refresh step 2, ask step b) is rewritten. Core redefinition:

> Customer sentiment on this GitLab is **relayed**: customers (municipalities) never comment directly — team members carry their voice. Extract **customer-impacting signal**, whoever typed it:
> - **Criticism** — bugs reported from municipalities/production, complaints, repeated requests, dissatisfaction, urgent escalations relayed in comments.
> - **Praise** — relayed thanks, satisfaction, positive confirmations from the customer side.
> - Still ignore: pure dev/PM process chatter (review approvals, merge/deploy notices, refactor debates, CI/test logs) with no customer-impacting content.

Same output contract as today: one concise line in the user's language + source URL per item, ≤20/list, ≤200 chars, empty is honest.

## Part C — Report skill + agent-written digests

### New skill `skills/unioss-knowledge-report/SKILL.md`

The single definition of a valuable ticket report. Both digest flows read it before writing. Report structure (user's current conversation language — never fixed; tables and list items as shown):

```markdown
## AP#<iid> — <one-line title translated to the user's language>

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

**Suggested direction** — solution sketch. (Single-ticket mode only: codebase-informed. Daily mode: omit or ticket-content-level.)

**Open questions**
- ambiguity a developer must clarify before starting (omit section when none)
```

Skill body also carries the method: read the FULL description and ALL non-system notes; translate titles; derive AC from concrete statements, not invention; mark uncertainty explicitly rather than guessing.

### `today` flow (two-step, like sentiment)

- `today.mjs` becomes an evidence emitter: crawls today's created tickets, writes `digests/<date>-daily.evidence.json` — per ticket: iid, title, web_url, state, author, created_at, labels, FULL description, all non-system notes (author/at/body). Prints path + ticket count. No rendered digest.
- today SKILL: run script → read evidence → read `unioss-knowledge-report` skill → write one report section per ticket (daily depth: no codebase reading) → save to `digests/<date>-daily.md` → relay path. Zero tickets → script writes the "(no tickets)" digest itself, no agent step.

### `ticket <url>` flow (full depth)

- `ticket.mjs` becomes an evidence emitter for one ticket (same per-ticket shape). 
- ticket SKILL: run script → read evidence → read report skill → **also read the codebase** (module paths from shared config; locate the screens/controllers/models the ticket touches) → write the full report incl. codebase-informed Suggested direction → save to the existing ticket digest path → relay.

### `refresh.mjs daily` and `wwwh.mjs`

- `refresh.mjs daily` aligns with `today`: emits the same per-ticket evidence file (shared helper with `today.mjs`); the refresh skill's daily section gains the same two-step (agent writes the digest via the report skill).
- `wwwh.mjs` stays: `ask.mjs` tickets/general intents keep `renderDailyDigest` (a mechanical ticket list is acceptable there; the empty-block guard stays).
- `renderWwwh` becomes unused after the switch — deleted with its tests.

## Testing (TDD)

- A: `buildEvidence` even sampling (span check: first/last of sampled ≈ first/last of input), coverage fields correct (`totalObservations`, `sampled`, `covered`), under-cap unchanged.
- C: `today.mjs`/`ticket.mjs` emit evidence with FULL description + all non-system notes; no `.md` digest written by scripts (except zero-ticket daily); `renderWwwh` deleted, `renderDailyDigest` retained for ask; empty-block guard preserved.
- B is prose-only (skill text) — verified by review, not unit tests.
- Full suites green (scripts + hooks + pipeline untouched).

## Out of scope

- Author-role metadata from GitLab (relayed-voice guidance makes it unnecessary).
- Backfilling old digests.
- Chunked-classification tooling (agent uses existing files; no new script).
