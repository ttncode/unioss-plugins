---
name: unioss-gitlab-issue-context
description: Use when you need to fetch or refresh a GitLab ticket's data (writes raw-ticket-data.json + ticket-summary.md) — standalone or as the investigator's ticket-fetch step.
---

# UNIOSS GitLab Issue Context (read-only)

## Overview

Pull a ticket's current state from GitLab, and say what changed since last time. **Core principle:** read-only — never edit project source, only refresh the cached ticket data.

Writes only to `.walkthrough/.pipeline/<PREFIX>-[IID]/` (hidden tracking files).

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

## Input

- The GitLab ticket URL.

## Workflow

1. **Note the previous state.** If `raw-ticket-data.json` already exists, read and record its `updated_at` + note count first — you need them for step 3.
2. **Fetch:**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js" "<TICKET_URL>"
   ```

   This writes (or overwrites) under `.walkthrough/.pipeline/<PREFIX>-[IID]/`:
   - `raw-ticket-data.json` — the full API response.
   - `ticket-summary.md` — a structured markdown summary.

3. **Diff it.** If a previous `raw-ticket-data.json` existed, compare `updated_at`, note count, `labels`, and `assignees`.

## Output

- prefix+IID.
- The backticked absolute path to `ticket-summary.md`.
- A one-paragraph change summary — or `No changes since last fetch` when identical.

## Related files

- `./scripts/fetch-ticket.js` — the fetcher.
- `skills/unioss-investigate/SKILL.md` — invokes this as its Step 1.
- `skills/unioss-pipeline/REFERENCE.md` — GitLab endpoints, URL regex, read-only rule.
