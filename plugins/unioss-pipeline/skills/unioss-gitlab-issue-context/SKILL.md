---
name: unioss-gitlab-issue-context
description: Fetch or re-fetch a GitLab ticket's latest data. Writes RAW_TICKET_DATA.json and TICKET_SUMMARY.md to .walkthrough/.pipeline/<PREFIX>#[IID]/. Use standalone to refresh context mid-session, or as the ticket-fetch step of unioss-investigate.
---

# UNIOSS GitLab Issue Context (read-only)

**Read-only rule:** Never edit project source. Writes only to `.walkthrough/.pipeline/<PREFIX>#[IID]/` (hidden tracking files).

## Step 1 — Fetch ticket data

Before running the fetch, if `RAW_TICKET_DATA.json` already exists, read and record its `updated_at` and note count for comparison in Step 2.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js" "<TICKET_URL>"
```

This writes (or overwrites):

- `.walkthrough/.pipeline/<PREFIX>#[IID]/RAW_TICKET_DATA.json` — full API response
- `.walkthrough/.pipeline/<PREFIX>#[IID]/TICKET_SUMMARY.md` — structured markdown summary

## Step 2 — Report changes since last fetch

If a previous `RAW_TICKET_DATA.json` existed before this run, compare:

- `updated_at` — did the issue description change?
- note count — were new comments added?
- `labels`, `assignees` — any changes?

Report a one-paragraph diff summary, or "No changes since last fetch" if identical.

## Step 3 — Return

Return: prefix+IID, absolute path to `TICKET_SUMMARY.md`, change summary from Step 2.
