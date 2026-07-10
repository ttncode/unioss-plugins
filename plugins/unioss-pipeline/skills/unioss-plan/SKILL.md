---
name: unioss-plan
description: UNIOSS planner. Reads an investigation and produces an implementation plan with exact per-file code changes, estimate points per task, and per-step verification. Use as the planner stage of unioss-pipeline.
---

# UNIOSS Planner (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**
Write all artifacts under the round folder the orchestrator gives you (`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.
To read module source, resolve host paths first: `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` then Grep/Read under `$US_SRC_ADMIN_PAGE`, `$US_SRC_FRONT_END`, `$US_SRC_COMMON_HELPER`, `$US_SRC_COMMON_MODELS` — do not assume cwd is a repo (see REFERENCE → Source paths).

## Modes (the orchestrator tells you which)

The pipeline dispatches this skill in one of two modes; the dispatch prompt states which. A direct standalone invocation (see **Standalone use**) has no mode.

- **spec mode** → produce `<PREFIX>#[IID]_SPEC.md` (the *what/why* — no code). See **Spec mode**.
- **plan mode** → produce `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md` from the **approved** spec (the *how* — exact code). See **Plan mode**.

## Spec mode

**Input:** `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications` section the orchestrator appended.

Write `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_SPEC.md` — the *what/why*, **no code**. Mandatory sections:
- **Goal** — one paragraph.
- **Scope** — In-Scope / Out-of-Scope bullet lists.
- **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
- **Acceptance Criteria** — numbered, verifiable statements the tester can check.
- **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot make it empty, say so in your return so the orchestrator reopens GATE 0.
- **Related** — links to the investigation and any related issues.

If a prior version exists, increment `_SPEC_V2`, `_SPEC_V3`, … (GATE 1 edit loop). **Return:** the spec path (as a clickable `file://` link — REFERENCE → Clickable links) + a one-line scope summary; do not paste the body.

## Plan mode

**Input:** the **approved** `<PREFIX>#[IID]_SPEC.md` plus the investigation.

### Step 1 — Draft with writing-plans discipline
Invoke `unioss-writing-plans` to structure the plan: bite-sized tasks, exact file paths, and a verification per task.

### Step 2 — Apply the UNIOSS template
Fill `create-implementation-plan.md` (this skill dir). All sections mandatory; **zero `TBD`**. Key requirements:
- **Exact code:** every change shows the concrete before/after snippet and absolute file path — the coder applies, not re-derives.
- **Estimate points:** set the `story_points` front-matter and a per-task point estimate.
- **Phased steps:** Phase 1 DB migration · Phase 2 model/controller · Phase 3 views · Phase 4 tests.
- **Manual testing:** normal + abnormal cases incl. DB verification.

### Step 3 — Save
Write `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md`. If a prior version exists, increment to `_V2`, `_V3`, … (GATE 2 edit loop).

### Step 4 — Return
Return the plan path (as a clickable `file://` link — REFERENCE → Clickable links), total estimate points, and a one-line scope summary. Do not paste the full plan body.

## Standalone use

You can be invoked directly on a free-form task (e.g. `/unioss-plan Draft a plan to add field X …`), outside the orchestrated pipeline. When **no orchestrator context** was handed to you — no ticket, no round path:

- Do the requested task on the file(s) named, using this skill's rules and domain knowledge.
- **Write nothing under `.walkthrough/`** — no round folders, no INVESTIGATION / PLAN / CHANGES / REVIEW / TEST / UT artifacts, no state files — **unless the user explicitly asks** for a written artifact.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections above describe.
