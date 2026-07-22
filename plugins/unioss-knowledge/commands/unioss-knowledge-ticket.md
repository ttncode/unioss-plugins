---
description: Summarize one GitLab ticket by URL using WWWH.
---

# UNIOSS Knowledge — Ticket

## Input

- A GitLab ticket URL.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ticket.mjs" "<TICKET_URL>"
   ```

2. Relay the printed WWWH block verbatim.

## Output

- The WWWH block: What / Why / Who / How.
