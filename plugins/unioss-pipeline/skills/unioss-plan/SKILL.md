---
name: unioss-plan
description: UNIOSS planner. Reads an investigation and produces an implementation plan with exact per-file code changes, estimate points per task, and per-step verification. Use as the planner stage of unioss-pipeline.
---

# UNIOSS Planner (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**
Write all artifacts under the round folder the orchestrator gives you (`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.
To read module source, resolve host paths first: `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` then Grep/Read under `$US_SRC_ADMIN_PAGE`, `$US_SRC_FRONT_END`, `$US_SRC_COMMON_HELPER`, `$US_SRC_COMMON_MODELS` — do not assume cwd is a repo (see REFERENCE → Source paths).

## Inputs
- `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications` section the orchestrator appended.

## Step 1 — Draft with writing-plans discipline
Invoke `unioss-writing-plans` to structure the plan: bite-sized tasks, exact file paths, and a verification per task.

## Step 2 — Apply the UNIOSS template
Fill `create-implementation-plan.md` (this skill dir). All sections mandatory; **zero `TBD`**. Key requirements:
- **Exact code:** every change shows the concrete before/after snippet and absolute file path — the coder applies, not re-derives.
- **Estimate points:** set the `story_points` front-matter and a per-task point estimate.
- **Phased steps:** Phase 1 DB migration · Phase 2 model/controller · Phase 3 views · Phase 4 tests.
- **Manual testing:** normal + abnormal cases incl. DB verification.

## Step 3 — Save
Write `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md`. If a prior version exists, increment to `_V2`, `_V3`, … (used by the GATE 1 edit loop).

## Step 4 — Return
Return the plan path, total estimate points, and a one-line scope summary. Do not paste the full plan body.

## Standalone use

You can be invoked directly on a free-form task (e.g. `/unioss-plan Draft a plan to add field X …`), outside the orchestrated pipeline. When **no orchestrator context** was handed to you — no ticket, no round path:

- Do the requested task on the file(s) named, using this skill's rules and domain knowledge.
- **Write nothing under `.walkthrough/`** — no round folders, no INVESTIGATION / PLAN / CHANGES / REVIEW / TEST / UT artifacts, no state files — **unless the user explicitly asks** for a written artifact.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections above describe.
