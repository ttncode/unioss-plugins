---
name: unioss-knowledge-refresh
description: Crawl + distill the current window into the knowledge base (daily WWWH, weekly/monthly sentiment + GLOBAL).
---

# UNIOSS Knowledge — Refresh

## Input

- One of `daily` (default), `weekly`, `monthly`.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/refresh.mjs" <daily|weekly|monthly>
   ```

2. Relay the written file paths. For weekly/monthly, note that `sentiment/current.md` and `GLOBAL.md` were updated.

## Notes

- Mutates the current-window KB. Historical queries belong to `/unioss-knowledge-ask`.
- Lock-guarded; on a GitLab error nothing is written.
