---
name: unioss-plan
description: UNIOSS planner. Reads an investigation and produces an implementation plan with exact per-file code changes, estimate points per task, and per-step verification. Use as the planner stage of unioss-pipeline.
---

# UNIOSS Planner (read-only)

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source access, clickable links, standalone use).

## Modes

The pipeline dispatches this skill in one of two modes; the dispatch prompt states which. A standalone invocation has no mode.

- **spec mode** → `<PREFIX>#[IID]_SPEC.md` (the _what/why_ — no code).
- **plan mode** → `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md` from the **approved** spec (the _how_ — exact code).

## Spec mode

- **Input:** `round-<N>/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications` section.
- **Output:** `round-<N>/<PREFIX>#[IID]_SPEC.md` — no code. Mandatory sections:
  - **Goal** — one paragraph.
  - **Scope** — In-Scope / Out-of-Scope bullets.
  - **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
  - **Acceptance Criteria** — numbered, verifiable statements the tester can check.
  - **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot empty it, say so in your return so the orchestrator reopens GATE 0.
  - **Related** — links to the investigation and any related issues.
- If a prior version exists, increment `_SPEC_V2`, `_SPEC_V3`, … (GATE 1 edit loop).
- **Return:** the spec path (clickable `file://` link) + a one-line scope summary. Do not paste the body.

## Plan mode

- **Input:** the **approved** `<PREFIX>#[IID]_SPEC.md` plus the investigation.

1. **Draft with writing-plans discipline.** Invoke `unioss-writing-plans` to structure the plan: bite-sized tasks, exact file paths, a verification per task.
2. **Apply the UNIOSS template.** Fill `create-implementation-plan.md` (this dir). All sections mandatory; **zero `TBD`**. Key requirements:
   - **Exact code:** every change shows the concrete before/after snippet + absolute path — the coder applies, not re-derives.
   - **Estimate points:** set the `story_points` front-matter and a per-task estimate.
   - **Phased steps:** Phase 1 DB migration · Phase 2 model/controller · Phase 3 views · Phase 4 tests.
   - **Manual testing:** normal + abnormal cases incl. DB verification.
3. **Save** `round-<N>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md`. If a prior version exists, increment `_V2`, `_V3`, … (GATE 2 edit loop).
4. **Return** the plan path (clickable `file://` link), total estimate points, and a one-line scope summary. Do not paste the full plan.
