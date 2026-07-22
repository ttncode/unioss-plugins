---
name: unioss-plan
description: Use when turning a UNIOSS investigation into an implementation plan with exact per-file changes, estimate points, and per-step verification — the planner stage.
---

# UNIOSS Planner (read-only)

## Overview

Decide **what** to build (spec), then **how** to build it (plan) in enough detail that the coder applies rather than re-derives.

**Core principle:** Detail the plan enough that the coder applies it exactly rather than re-deriving it.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source access, artifact paths, standalone use).

## Input

The dispatch prompt states the mode. A standalone invocation has no mode.

- **spec mode** — `round-<N>/investigation.md`, including any `## Clarifications`.
- **plan mode** — the **approved** `spec.md`, plus the investigation.
- Both — the round path.
- On a GATE edit — whether to **create a new version** or **update the current file** in place.

## Workflow

### Spec mode — the what/why, no code

Write `round-<N>/spec.md`. Mandatory sections:

- **Goal** — one paragraph.
- **Scope** — In-Scope / Out-of-Scope bullets.
- **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
- **Acceptance Criteria** — numbered, verifiable statements the tester can check.
- **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot empty it, say so in your return so the orchestrator reopens GATE 0.
- **Related** — the investigation and any related issues.

### Plan mode — the how, exact code

1. **Draft and structure the plan in writing-plans format.** Invoke `unioss-pipeline:unioss-writing-plans` to structure the plan with writing-plans discipline: the plan header (Goal / Architecture / Tech Stack / Global Constraints), then `### Task N` blocks with **Files**, **Interfaces**, bite-sized steps, a verification per task, and a commit per task. Use UNIOSS-specific examples throughout — absolute PHP/CI3 paths, `docker exec -i "$US_PHP" …` commands (resolve `$US_PHP` via `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"`), and migration phases — not generic pytest/JS examples.
   Add exactly one UNIOSS section on top of that structure:
   - **Story points** — a `**Story points:** <N>` line in the plan header and a
     per-task estimate on each `### Task N`.

   No `## Manual Testing` section — test-case coverage is derived at the tester
   stage by `unioss-pipeline:unioss-test-evidence` (changes call sites × spec
   ACs × scope surfaces); the human's manual checklist is the tester's
   `## Manual Testing (run these yourself)` hand-off in `test-results.md`.
2. **Save** `round-<N>/implementation.v1.md`.

### Versioning on a GATE edit

- **new version** → write the next `spec.v{n}.md` / `implementation.v{n}.md` (same round).
- **update current** → edit the existing file in place. No new file, no version bump.

## Output

Never paste the spec or plan body.

- **spec mode:** the spec path (backticked, absolute) + a one-line scope summary.
- **plan mode:** the plan path (backticked, absolute), total estimate points, and a one-line scope summary.

## Related files

- `skills/unioss-writing-plans/SKILL.md` — the plan structure this stage produces (plus Story points).
- `agents/unioss-planner.md` — the subagent that runs this.
- `skills/unioss-implement/SKILL.md` — the coder that applies the plan.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules.
