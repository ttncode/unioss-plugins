---
name: unioss-gitlab-issue-context
description: Fetch or re-fetch a GitLab ticket's latest data. Writes RAW_TICKET_DATA.json and TICKET_SUMMARY.md to .walkthrough/.pipeline/<PREFIX>#[IID]/. Use standalone to refresh context mid-session, or as the ticket-fetch step of unioss-investigate.
---

# UNIOSS GitLab Issue Context (read-only)

Pull a ticket's current state from GitLab, and say what changed since last time.

Read-only: never edit project source. Writes only to `.walkthrough/.pipeline/<PREFIX>#[IID]/` (hidden tracking files).

## Input

- The GitLab ticket URL.

## Workflow

1. **Note the previous state.** If `RAW_TICKET_DATA.json` already exists, read and record its `updated_at` + note count first — you need them for step 3.
2. **Fetch:**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js" "<TICKET_URL>"
   ```

   This writes (or overwrites) under `.walkthrough/.pipeline/<PREFIX>#[IID]/`:
   - `RAW_TICKET_DATA.json` — the full API response.
   - `TICKET_SUMMARY.md` — a structured markdown summary.

3. **Diff it.** If a previous `RAW_TICKET_DATA.json` existed, compare `updated_at`, note count, `labels`, and `assignees`.

## Output

- prefix+IID.
- The backticked relative path to `TICKET_SUMMARY.md`.
- A one-paragraph change summary — or `No changes since last fetch` when identical.

## Related files

- `./scripts/fetch-ticket.js` — the fetcher.
- `skills/unioss-investigate/SKILL.md` — invokes this as its Step 1.
- `skills/unioss-pipeline/REFERENCE.md` — GitLab endpoints, URL regex, read-only rule.
