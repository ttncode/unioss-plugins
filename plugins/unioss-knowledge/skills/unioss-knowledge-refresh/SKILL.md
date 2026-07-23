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
