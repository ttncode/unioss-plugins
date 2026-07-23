---
name: unioss-knowledge-ticket
description: Full report (user's language) for one GitLab ticket — evidence out, agent analysis (ticket + codebase) in.
---

# UNIOSS Knowledge — Ticket

## Input

`<gitlab-url>` — the GitLab work-item or issue URL.

## Workflow

1. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ticket.mjs" "<TICKET_URL>"
   ```

2. Read the printed evidence file, invoke the `unioss-knowledge-report` skill, and write the report at **single-ticket** depth (read the codebase per the skill) to `digests/ticket-<PREFIX>-<IID>.md` (path printed by the script).
3. Relay the report path and the report.
