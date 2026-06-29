---
name: unioss-pipeline
description: UNIOSS A→Z ticket pipeline orchestrator. Given a GitLab ticket URL, drives investigator → (clarify) → planner → GATE → coder → reviewer → GATE → tester → branch+commit, stopping for human approval at the gates. Use when the user runs /unioss-pipeline <URL> or asks to run the full UNIOSS ticket pipeline.
---

# UNIOSS Pipeline Orchestrator (main thread)

Read `REFERENCE.md` (this dir) first — it holds the branch, protected-branch, submodule, and commit-message rules you must follow. You run in the MAIN thread. Dispatch read-only stages as subagents; run the coder yourself; own the gates.

## State & resume

State file: `.walkthrough/.pipeline/<PREFIX>#[IID]/pipeline-state.json` —
`{ current_round, rounds: { "<n>": { stage, gate_decisions, plan_version, review_counts, test_status } } }`.

On start, determine the round:
- No state, or no `round-*` dirs → this is **round 1**. Set `current_round = 1`.
- Latest round is **incomplete** (its `stage` is not `finalized`) → resume that round; do not open a new one.
- Latest round is **sealed** (`stage = finalized`) **and** there is new requested work (ticket changed since the round, or the user gives an instruction) → open **round N+1**: set `current_round = N+1`.

Update the current round's entry after every stage.

## Step 0 — Show the plan and get the go-ahead

Parse the URL first (REFERENCE regex) → IID + origin repo → prefix `AP`/`FE`. Then print this table (substitute `<PREFIX>`, `[IID]`, and the origin repo into the branch row per REFERENCE branch naming) and **stop — ask the user to confirm before proceeding**:

```
┌─────────────┬──────────────────────┬──────────────────────────────────────────────────────────────┐
│    Step     │         Who          │                            You do                            │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Investigate │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_INVESTIGATION.md + _REPORT.md    │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ 🛑 GATE 0   │ main thread          │ only if unclear — brainstorms open questions with you        │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Plan        │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md             │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ 🛑 GATE 1   │ you                  │ approve the plan or request edits (→ V2/V3)                  │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Code        │ main thread (sonnet) │ applies plan + fast PHPUnit → .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_CHANGES.md│
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Review      │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_REVIEW.md (severity-indexed)     │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ 🛑 GATE 2   │ you                  │ fix (loop) or accept (→ full PHPUnit → UT_#[IID]_…)          │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Verify      │ subagent (sonnet)    │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_TEST_RESULTS.md (DB + UI)        │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Finalize    │ main thread          │ branch feature/v3/#[IID] + commit (no push/MR)               │
└─────────────┴──────────────────────┴──────────────────────────────────────────────────────────────┘
```

Wait for the user to say to proceed. Do not run any stage until they confirm.

**Rounds.** All artifacts for this run go under `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`.
If this is a re-run (a sealed round already exists), first write
`round-<current_round>/ROUND_BRIEF.md` capturing exactly what this round must do — from the
ticket delta since the last round and/or the user's instruction — and state in Step 0 that
all prior rounds stay frozen. Every stage this round is scoped to the brief and treats prior
rounds as an immutable, already-delivered baseline. Never write outside the current round
(the sealed-round guard enforces this).

## Flow

1. **Parse** the URL → IID + origin repo → prefix `AP`/`FE`. Determine `current_round` (see State & resume). Create `.walkthrough/.pipeline/<PREFIX>#[IID]/` and `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`. In every stage below, write artifacts under `.walkthrough/<PREFIX>#[IID]/round-<current_round>/` and pass that round path to each subagent in its prompt.

2. **Investigator** — dispatch the `unioss-investigator` subagent with the URL. It writes INVESTIGATION.md + REPORT.md and returns a clarity verdict + open-question count.

3. **GATE 0 — Clarify (conditional).** If verdict is `NEEDS_CLARIFICATION`: invoke the **`unioss-brainstorming` skill** in THIS thread and work the numbered Open Questions with the user through it; then append a `## Clarifications` section to INVESTIGATION.md capturing the resolutions. If `CLEAR`: skip.

4. **Planner** — dispatch `unioss-planner` with the investigation path. It writes IMPLEMENTATION_V1.md and returns the path + estimate points.

5. **GATE 1 — Plan approval.** Present the plan summary + links. The plan contains exact code, so this is a real code approval. If the user requests edits, re-dispatch the planner with the feedback (produces _V2/_V3) and re-present until approved.

6. **Coder (in this thread)** — invoke the `unioss-implement` skill: apply the approved plan, run migrations if required, fast-verify new PHPUnit tests (AdminPage), write CHANGES.md. The coder creates the correct feature branch off `v3-master` per the REFERENCE branch rules **before** its first edit in each repo, and follows the REFERENCE submodule flow for any common-models/common-helper change.

7. **Reviewer** — dispatch `unioss-reviewer` with the CHANGES.md path. It writes REVIEW.md and returns severity counts + top findings.

8. **GATE 2 — Review fix/accept.** Present findings by severity.
   - **fix** → invoke `unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 7.
   - **accept** → (AdminPage) invoke `unioss-implement` full mode: uncomment the dump-import line, run the full suite → `.walkthrough/<PREFIX>#[IID]/round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.

9. **Tester** — dispatch `unioss-tester` with the CHANGES.md path + acceptance criteria. It writes TEST_RESULTS.md and returns pass/fail. (Both repos.) If the tester reports any UI criteria as SKIPPED (no browser MCP), note that explicitly — do NOT treat SKIPPED as a pass.

10. **Finalize** — for every repo the coder touched, commit on its feature branch using the REFERENCE commit format `#[IID] - [Message]`. Per REFERENCE: AdminPage/FrontEnd app branches are committed locally only (no push, no MR); common-models/common-helper submodule branches are pushed and the consuming apps' pointers updated. Never touch a protected branch. Present a final summary: branch names per repo, plan, changes, review status, test status, links. If UI verification was SKIPPED, surface "UI verification: SKIPPED — no browser MCP configured" prominently. STOP.

## Rules
- Never edit source except via the `unioss-implement` coder step.
- Honor the gates — never run past Step 0, GATE 1, or GATE 2 without an explicit user decision.
- **Protected branches** (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`) are read-only — never commit, push, or modify them. All work happens on `feature/v3/...` branches cut from `v3-master`. Verify the current branch before any commit/push.
- Keep main context lean: rely on subagents' returned summaries; read full artifacts only when needed for a gate.
