# UNIOSS Pipeline — Spec-Before-Plan Gate — Design

- **Date:** 2026-07-08
- **Plugin:** `unioss-pipeline`
- **Version target:** 1.3.0 → **1.4.0**
- **Status:** Approved (pending spec review)

## Goal

Insert a **spec stage and approval gate** into the UNIOSS ticket pipeline, between investigation and the implementation plan. Today the pipeline jumps from `INVESTIGATION.md` straight to `IMPLEMENTATION_V1.md`; the only pre-plan gate (GATE 0) is a *conditional* clarify step, and the user's first real review is of the plan itself. This adds an explicit **SPEC.md** — the *what/why* (scope, requirements, acceptance criteria) — that the user approves **before** any implementation plan (the *how*, with exact code) is written.

The spec is authored by the existing planner subagent running in a new "spec mode", so no new stage skill or agent file is introduced.

## Motivation

- The plan contains exact before/after code; reviewing scope and requirements *at the same time as* code is the wrong altitude. A cheap spec gate catches scope/requirement errors before code is drafted.
- The standalone `unioss-brainstorming` skill already follows spec → user-review → plan. This brings the *pipeline* into line with that discipline.

## Current vs. new flow

**Current** (`skills/unioss-pipeline/SKILL.md`):
```
Investigator → GATE 0 (clarify, conditional) → Planner → GATE 1 (plan) → Coder → Reviewer → GATE 2 → Tester → Finalize
```

**New:**
```
Investigator
  → GATE 0 (clarify, conditional)
  → Planner[spec mode]  → SPEC.md
  → 🛑 GATE 1 — SPEC approval          (NEW)
  → Planner[plan mode]  → IMPLEMENTATION_V1.md
  → 🛑 GATE 2 — Plan approval          (was GATE 1)
  → Coder
  → Reviewer
  → 🛑 GATE 3 — Review fix/accept       (was GATE 2)
  → Tester → Finalize
```

The spec is **always** written once the ticket is clear (i.e. after GATE 0 clarify if that ran; immediately if the investigation verdict was already `CLEAR`). GATE 1 is a hard gate — the orchestrator never proceeds to the plan phase without an explicit user approval.

## Design

### Planner two-phase (spec mode / plan mode)

`skills/unioss-plan/SKILL.md` gains a **mode** parameter that the orchestrator passes in the dispatch prompt:

- **spec mode** — input: `<PREFIX>#[IID]_INVESTIGATION.md` (including any `## Clarifications` the orchestrator appended). Output: `<PREFIX>#[IID]_SPEC.md`. Contains the *what/why* only — **no code**. Required sections:
  - **Goal** — one paragraph.
  - **Scope** — In-Scope / Out-of-Scope bullet lists.
  - **Requirements & Constraints** — identifier-prefixed, reusing the plan template's convention: `REQ-`, `CON-`, `SEC-`, `GUD-`.
  - **Acceptance Criteria** — numbered, verifiable statements the tester can check.
  - **Open Questions** — must be empty (post-clarify); if non-empty the spec is not ready and the orchestrator returns to GATE 0.
  - **Related** — links to the investigation and any related issues.
  - Returns: the spec path + a one-line scope summary (does not paste the full body).

- **plan mode** — input: the **approved** `<PREFIX>#[IID]_SPEC.md` plus the investigation. Output: `IMPLEMENTATION_V1.md`, exactly as today (exact before/after code per file, estimate points, phased steps, manual testing). Behaviour unchanged except that its requirements now come from the approved spec rather than the raw investigation.

The orchestrator dispatches the planner **twice**: once in spec mode (before GATE 1), once in plan mode (after GATE 1 approval).

### Gates

- **GATE 1 — SPEC approval (new):** the orchestrator presents the spec summary + link. On **approve** → dispatch planner in plan mode. On **edit request** → re-dispatch spec mode with the feedback, producing `SPEC_V2`, `SPEC_V3`, … and re-present until approved. Mirrors the existing plan-edit loop.
- **GATE 2 (was GATE 1) — Plan approval:** unchanged behaviour; renumbered. Plan edits produce `IMPLEMENTATION_V2/V3`.
- **GATE 3 (was GATE 2) — Review fix/accept:** unchanged behaviour; renumbered.

All references to the old gate numbers in `SKILL.md` (flow steps, the stage table, the Rules section "never run past … GATE 1, or GATE 2") are updated to the new numbering.

### Artifacts & rounds

- New artifact: `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_SPEC.md` (and `_SPEC_V2`, … on edits). Round-scoped like every other artifact — each round specs its own delta and treats prior rounds as frozen.
- `REFERENCE.md` Artifact Layout adds the SPEC.md entry (placed before the implementation plan in the list).

### State & resume

`pipeline-state.json` round object gains spec tracking so a resumed run does not re-author or re-gate an already-approved spec:
```jsonc
"rounds": { "<n>": {
  "stage": "...",
  "spec_version": 1,          // NEW — latest SPEC_V<n> written
  "spec_approved": true,      // NEW — GATE 1 outcome
  "plan_version": 1,
  "gate_decisions": { ... },
  "review_counts": { ... },
  "test_status": "..."
} }
```
On resume: if `spec_approved` is true for the current round, skip spec mode + GATE 1 and continue at the plan phase; otherwise resume at the spec stage.

### Standalone use unchanged

The `## Standalone use` section of `unioss-plan` is unaffected: `mode` is an orchestrator-only dispatch parameter. A direct `/unioss-plan <task>` invocation still does the requested task and writes nothing under `.walkthrough/` unless asked.

## Acceptance criteria

1. `skills/unioss-plan/SKILL.md` documents two orchestrator modes (spec / plan) with the spec's required section list; plan mode reads the approved SPEC.md.
2. `skills/unioss-pipeline/SKILL.md` flow shows: investigator → GATE 0 → planner[spec] → **GATE 1 SPEC approval** → planner[plan] → GATE 2 plan → coder → reviewer → GATE 3 → tester → finalize. The stage table and the Rules gate list match the new numbering with no lingering references to the old GATE 1/GATE 2 meanings.
3. The spec is written for every ticket once clarity is reached (not conditional); GATE 1 blocks progression to the plan without explicit user approval; the spec-edit loop produces `SPEC_V2/V3`.
4. `SPEC.md` contains Goal, Scope (in/out), Requirements (`REQ-/CON-/SEC-/GUD-`), Acceptance Criteria, Open Questions (empty), Related — and no code.
5. `REFERENCE.md` Artifact Layout lists `<PREFIX>#[IID]_SPEC.md` under the round folder.
6. `pipeline-state.json` documentation includes `spec_version` + `spec_approved`; resume logic skips an already-approved spec.
7. `plugin.json` version = `1.4.0`.

## Out of scope

- No new stage skill or agent file (planner is reused).
- No change to investigator, coder, reviewer, tester behaviour beyond gate renumbering references.
- No scripts or automated tests (this is a docs/skill-instruction change); verification is a walkthrough of the updated flow.
- No change to the standalone `unioss-brainstorming` skill.
