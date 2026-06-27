---
name: unioss-plan
description: UNIOSS planner. Reads an investigation and produces an implementation plan with exact per-file code changes, estimate points per task, and per-step verification. Use as the planner stage of unioss-pipeline.
---

# UNIOSS Planner (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**

## Inputs
- `.walkthrough/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications` section the orchestrator appended.

## Step 1 — Draft with writing-plans discipline
Invoke `unioss-writing-plans` to structure the plan: bite-sized tasks, exact file paths, and a verification per task.

## Step 2 — Apply the UNIOSS template
Fill `create-implementation-plan.md` (this skill dir). All sections mandatory; **zero `TBD`**. Key requirements:
- **Exact code:** every change shows the concrete before/after snippet and absolute file path — the coder applies, not re-derives.
- **Estimate points:** set the `story_points` front-matter and a per-task point estimate.
- **Phased steps:** Phase 1 DB migration · Phase 2 model/controller · Phase 3 views · Phase 4 tests.
- **Manual testing:** normal + abnormal cases incl. DB verification.

## Step 3 — Save
Write `.walkthrough/<PREFIX>#[IID]_IMPLEMENTATION_V1.md`. If a prior version exists, increment to `_V2`, `_V3`, … (used by the GATE 1 edit loop).

## Step 4 — Return
Return the plan path, total estimate points, and a one-line scope summary. Do not paste the full plan body.
