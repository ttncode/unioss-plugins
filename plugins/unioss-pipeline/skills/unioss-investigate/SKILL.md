---
name: unioss-investigate
description: Use when investigating a UNIOSS GitLab ticket — the read-only investigator stage: fetches the ticket and related issues, maps codebase/DB impact, and produces the investigation, Vietnamese scope report, and clarity verdict.
---

# UNIOSS Investigator (read-only)

## Overview

Establish what a ticket really requires — from the linked issues, the real code, and the real DB — then report it to the PM once it is clear.

**Core principle:** Read-only: investigate first, report to the PM only once the ticket is clear.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source/DB access, artifact paths, standalone use).

## Input

The dispatch prompt states the mode. They run at different points in the flow — never do both in one dispatch.

- **investigate** (default) — the GitLab ticket URL. Runs Steps 1–5, **before** GATE 0.
- **report** — the path to the already-clarified `investigation.md` (including its `## Clarifications` section, if any). Runs Step 6 only, **after** GATE 0, so the PM never receives a report built on unanswered questions. Re-read `investigation.md` first; do not re-run Steps 1–5.
- Both — the round path.

## Workflow

### Step 1 — Fetch ticket + related issues (investigate mode)

- Invoke `unioss-pipeline:unioss-gitlab-issue-context` with the ticket URL. It writes `raw-ticket-data.json` + `ticket-summary.md` under `.walkthrough/.pipeline/<PREFIX>-[IID]/`.
- For **every** entry from the `/links` endpoint, fetch that related issue too and summarize how it constrains scope. Related issues are first-class — a change is not understood until its linked issues are read.

### Step 2 — Codebase impact analysis (investigate mode)

- From the summary, extract column names and UI label strings. Grep the matching repo (`$US_SRC_ADMIN_PAGE` or `$US_SRC_FRONT_END`).
- Record each hit as `file:line — impact(HIGH/MEDIUM/LOW)`.

### Step 3 — Knowledge base (if present) (investigate mode)

When `.walkthrough/.knowledge/` exists:

- **Read** `domain/<module>.md`, `domain/conventions.md`, and `rules/approved.md`. Carry any item relevant to this ticket into the investigation.
- **Append** newly-proven durable facts about this module to `domain/<module>.md` — one line each, ending with the ticket source `(<PREFIX>#<IID>)`. Facts only. A recurring problem worth a prescriptive rule goes to `rules/staged.md` (never write `approved.md` here).
- Skip silently if the directory is absent.

### Step 4 — Production DB facts (investigate mode)

Resolve config, then describe the affected tables (read-only):

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; DESCRIBE <table>;"
```

### Step 5 — Write `investigation.md` (investigate mode)

Save `round-<N>/investigation.md` (English; keep technical terms in Japanese) with these sections:

1. **Requirements** — REQ/CON from the ticket, translated.
2. **Related-issue dependency map** — each linked issue → effect on this ticket.
3. **Code map** — the `file:line` table from Step 2.
4. **DB facts** — from Step 4.
5. **## Clarity Verdict** — exactly one of `CLEAR` / `NEEDS_CLARIFICATION`.
6. **## Open Questions** — numbered, concrete (missing specs, ambiguous behavior, conflicting related-issue requirements, undefined edge cases). Empty only if verdict is `CLEAR`. Phrase each clarification as a multiple-choice question (see REFERENCE → Asking the user).

### Step 6 — Write `report.md` (report mode only)

This goes to the PM. Write it from the clarified `investigation.md`, never before GATE 0.

**Read `./report-example.md` first — that is the gold standard for length and tone. Match it.**

Save `report.md` at the **ticket root** `.walkthrough/<PREFIX>-[IID]/report.md` (the parent of `round-<N>/`) — it is a deliverable that spans rounds, overwritten in place each round, never inside a `round-<N>/` folder. Vietnamese only — column names and Japanese screen names stay as-is. List only ECSite user-facing screens in section 3; verify URLs against `./ecsite-screens.md`.

## Output

### `investigation.md` — investigate mode

The six sections above. Return: prefix+IID, repo, clarity verdict, count of open questions, and the backticked absolute path. Never paste file bodies.

### `report.md` — report mode

Hard caps — a PM reads this in under a minute:

- **Whole file ≤ 40 lines.** If it is longer, cut, don't reformat.
- One line per bullet. No sub-bullets, no tables, no code blocks.
- §1 ≤ 2 bullets · §2 one bullet per field/area investigated · §4 ≤ 3 bullets.
- No implementation detail — no file names, no `file:line`, no SQL, no class/method names. Those live in `investigation.md`.
- State the conclusion plainly (可能/不可能, 影響あり/なし). No hedging, no next-step padding.

Fill verbatim:

```markdown
# <PREFIX>#[IID] Report

### 1. Mục tiêu:

- [one bullet per goal/objective]

### 2. Kết quả điều tra:

- [one bullet per target field/area investigated]

### 3. Phạm vi ảnh hưởng:

**Tính năng**

- [feature name (Japanese screen name)]

**URLs**

- `/path`

### 4. Kết luận:

- [one bullet per key conclusion]
```

Return: the report's line count (must be ≤ 40) and the backticked absolute path.

## Related files

- `./report-example.md` — the gold standard for `report.md` length and tone.
- `./ecsite-screens.md` — ECSite screens tree; verify user-facing URLs against it.
- `skills/unioss-gitlab-issue-context/SKILL.md` — the Step 1 fetcher.
- `agents/unioss-investigator.md` — the subagent that runs this.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules, GitLab, DB, source paths.
