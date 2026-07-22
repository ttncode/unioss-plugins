---
description: Summarize today's new UNIOSS 3 tickets (WWWH) across all projects.
---

# UNIOSS Knowledge — Today

Summarize every `UNIOSS 3` ticket created today, one WWWH block each.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/today.mjs"
   ```

2. Read the printed digest path and open it. Relay the WWWH blocks to the user, unchanged.

## Output

- The backticked digest path.
- The WWWH blocks (What / Why / Who / How), one per ticket. Never drop a ticket.
- If the count is 0: `No new UNIOSS 3 tickets today.`
