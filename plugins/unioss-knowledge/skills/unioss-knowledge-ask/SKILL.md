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
