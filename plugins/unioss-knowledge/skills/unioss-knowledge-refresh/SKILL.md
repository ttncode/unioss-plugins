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

2. If it prints a `.md` path (zero tickets), relay it. Done.
3. Otherwise: read the printed evidence file, invoke the `unioss-knowledge-report` skill, and write one report section per ticket (**daily** depth) to `digests/<date>-daily.md`. Relay the path.

## Workflow — weekly | monthly | yearly (two phases)

1. **Crawl** — run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <weekly|monthly|yearly> --phase=crawl
   ```

   It prints the evidence path (`sentiment/evidence-<period>.json`) and observation count.

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
