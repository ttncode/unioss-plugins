---
name: unioss-plan
description: UNIOSS planner. Reads an investigation and produces an implementation plan with exact per-file code changes, estimate points per task, and per-step verification. Use as the planner stage of unioss-pipeline.
---

# UNIOSS Planner (read-only)

Decide **what** to build (spec), then **how** to build it (plan) in enough detail that the coder applies rather than re-derives.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source access, artifact paths, standalone use).

## Input

The dispatch prompt states the mode. A standalone invocation has no mode.

- **spec mode** — `round-<N>/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications`.
- **plan mode** — the **approved** `<PREFIX>#[IID]_SPEC.md`, plus the investigation.
- Both — the round path.
- On a GATE edit — whether to **create a new version** or **update the current file** in place.

## Workflow

### Spec mode — the what/why, no code

Write `round-<N>/<PREFIX>#[IID]_SPEC.md`. Mandatory sections:

- **Goal** — one paragraph.
- **Scope** — In-Scope / Out-of-Scope bullets.
- **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
- **Acceptance Criteria** — numbered, verifiable statements the tester can check.
- **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot empty it, say so in your return so the orchestrator reopens GATE 0.
- **Related** — the investigation and any related issues.

### Plan mode — the how, exact code

1. **Draft with writing-plans discipline.** Invoke `unioss-pipeline:unioss-writing-plans` to structure the plan: bite-sized tasks, exact file paths, a verification per task.
2. **Apply the UNIOSS template.** Fill `./create-implementation-plan.md`. All sections mandatory; **zero `TBD`**:
   - **Exact code** — every change shows the concrete before/after snippet + absolute path.
   - **Estimate points** — set the `story_points` front-matter and a per-task estimate.
   - **Phased steps** — Phase 1 DB migration · Phase 2 model/controller · Phase 3 views · Phase 4 tests.
   - **Manual testing** — normal + abnormal cases, including DB verification.
3. **Save** `round-<N>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md`.

### Versioning on a GATE edit

- **new version** → increment `_SPEC_V2` / `_V2`, `_V3`, …
- **update current** → edit the existing file in place. No new file, no version bump.

## Output

Never paste the spec or plan body.

- **spec mode:** the spec path (backticked, relative) + a one-line scope summary.
- **plan mode:** the plan path (backticked, relative), total estimate points, and a one-line scope summary.

## Related files

- `./create-implementation-plan.md` — the mandatory plan template.
- `agents/unioss-planner.md` — the subagent that runs this.
- `skills/unioss-implement/SKILL.md` — the coder that applies the plan.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules.
