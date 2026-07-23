---
name: unioss-knowledge-report
description: How to write a valuable English ticket report from ticket evidence — structure, method, and depth modes. Read before writing any today/ticket/daily report.
---

# UNIOSS Knowledge — Ticket Report

The single definition of a valuable ticket report. Both digest flows read this before writing.

## Method

- Read the ticket's FULL description and ALL notes from the evidence file — never summarize from the title alone.
- Translate Japanese titles/content; the report is always **English**.
- Derive acceptance criteria from concrete statements in the ticket — never invent requirements.
- Mark uncertainty explicitly in Open questions rather than guessing.
- Never drop a ticket from a multi-ticket digest.

## Depth modes

- **daily** (today / refresh daily): ticket-content depth — no codebase reading; omit Suggested direction or keep it ticket-content-level.
- **single-ticket** (`/unioss-knowledge-ticket`): full depth — read the codebase before Suggested direction. Module path comes from `.walkthrough/.config/unioss.config.json` → `source.modules.admin-page` for AP tickets, `source.modules.front-end` for FE. Locate the screens/controllers/models the ticket touches and ground the direction in what exists.

## Report structure (one section per ticket)

```markdown
## AP#<iid> — <English one-line title translation>

**Summary** — one sentence: what this ticket is.

| | |
|---|---|
| **Who/When** | <author> · created <date> · state <opened/closed> |
| **Ticket** | <web_url> |

**What** — the actual requirement, synthesized from description + notes. Never raw template slices.

**Why** — business reason / customer impact. Relayed municipality context counts.

**Acceptance criteria**
- [ ] testable criterion derived from ticket content
- [ ] ...

**Suggested direction** — solution sketch. (Single-ticket mode: codebase-informed. Daily mode: omit or ticket-content-level.)

**Open questions**
- ambiguity a developer must clarify before starting (omit section when none)
```
