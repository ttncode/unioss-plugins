---
name: unioss-gitlab-issue-context
description: Fetch or re-fetch a GitLab ticket's latest data. Writes RAW_TICKET_DATA.json and TICKET_SUMMARY.md to .walkthrough/.pipeline/<PREFIX>#[IID]/. Use standalone to refresh context mid-session, or as the ticket-fetch step of unioss-investigate.
---

# UNIOSS GitLab Issue Context (read-only)

Read-only: never edit project source. Writes only to `.walkthrough/.pipeline/<PREFIX>#[IID]/` (hidden tracking files).

## Step 1 — Fetch ticket data

If `RAW_TICKET_DATA.json` already exists, first read and record its `updated_at` + note count for the Step 2 comparison. Then fetch:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js" "<TICKET_URL>"
```

This writes (or overwrites) under `.walkthrough/.pipeline/<PREFIX>#[IID]/`:

- `RAW_TICKET_DATA.json` — full API response.
- `TICKET_SUMMARY.md` — structured markdown summary.

## Step 2 — Report changes since last fetch

If a previous `RAW_TICKET_DATA.json` existed, compare `updated_at`, note count, `labels`, `assignees`. Report a one-paragraph diff summary, or "No changes since last fetch" if identical.

## Step 3 — Return

Return: prefix+IID, absolute path to `TICKET_SUMMARY.md`, and the Step 2 change summary.
