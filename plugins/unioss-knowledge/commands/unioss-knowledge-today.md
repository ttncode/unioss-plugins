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
