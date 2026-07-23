---
name: unioss-knowledge-refresh
description: Crawl + distill the current window into the knowledge base (daily WWWH; weekly/monthly/yearly sentiment + GLOBAL).
---

# UNIOSS Knowledge — Refresh

## Input

- One of `daily` (default), `weekly`, `monthly`, `yearly`.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <daily|weekly|monthly|yearly>
   ```

2. Relay the written file paths. For weekly/monthly/yearly, note that `sentiment/current.md` and `GLOBAL.md` were updated.

## Notes

- `daily` windows on **creation** date — the digest answers "what new tickets arrived today".
- `weekly`/`monthly`/`yearly` window on **update** date, all states — any ticket active in the period (closed, commented, re-opened) counts, not only newly created ones.
- `yearly` can be slow — a year-wide updated window may hit the pagination cap (50 pages × 100 = 5000 issues) plus one notes call per issue.
- Mutates the current-window KB. Historical queries belong to `/unioss-knowledge-ask`.
- Lock-guarded; on a GitLab error nothing is written.
