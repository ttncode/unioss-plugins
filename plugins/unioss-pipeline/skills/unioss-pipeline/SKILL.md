---
name: unioss-pipeline
description: UNIOSS A→Z ticket pipeline orchestrator. Given a GitLab ticket URL, drives investigator → (clarify) → spec → GATE → planner → GATE → coder → reviewer → GATE → tester → branch+commit, stopping for human approval at the gates. Use when the user runs /unioss-pipeline <URL> or asks to run the full UNIOSS ticket pipeline.
---

# UNIOSS Pipeline Orchestrator (main thread)

Read `REFERENCE.md` (this dir) first — it holds the branch, protected-branch, submodule, and commit-message rules you must follow. You run in the MAIN thread. Dispatch read-only stages as subagents; run the coder yourself; own the gates.

## State & resume

State file: `.walkthrough/.pipeline/<PREFIX>#[IID]/pipeline-state.json` —
`{ current_round, rounds: { "<n>": { stage, gate_decisions, spec_version, spec_approved, plan_version, review_counts, test_status } } }`.

On start, determine the round:
- No state, or no `round-*` dirs → this is **round 1**. Set `current_round = 1`.
- Latest round is **incomplete** (its `stage` is not `finalized`) → resume that round; do not open a new one.
- Latest round is **sealed** (`stage = finalized`) **and** there is new requested work (ticket changed since the round, or the user gives an instruction) → open **round N+1**: set `current_round = N+1`.

Update the current round's entry after every stage. On resume within a round: if `spec_approved` is true, skip the spec stage + GATE 1 and continue at the plan phase; otherwise resume at the spec stage.

## Step 0 — Show the plan and get the go-ahead

Parse the URL first (REFERENCE regex) → IID + origin repo → prefix `AP`/`FE`. Then print this table (substitute `<PREFIX>`, `[IID]`, and the origin repo into the branch row per REFERENCE branch naming) and **stop — ask the user to confirm before proceeding**:

```
╭─ UNIOSS Pipeline · <PREFIX>#[IID] · round-<current_round> ─────────────╮
│                                                                        │
│   #    Stage         Runs as            Output                         │
│  ─────────────────────────────────────────────────────────────────     │
│   1    Investigate   subagent · opus    INVESTIGATION + REPORT         │
│   ⛔   GATE 0        you                clarify (only if unclear)       │
│   2    Spec          subagent · opus    SPEC.md                        │
│   ⛔   GATE 1        you                approve spec / edit             │
│   3    Plan          subagent · opus    IMPLEMENTATION_V1              │
│   ⛔   GATE 2        you                approve plan / edit             │
│   4    Code          main · sonnet      CHANGES.md + fast tests        │
│   5    Review        subagent · opus    REVIEW.md                      │
│   ⛔   GATE 3        you                fix / accept                    │
│   6    Verify        subagent · sonnet  TEST_RESULTS.md (DB+UI)        │
│   7    Finalize      main               branch + commit (no push/MR)   │
│                                                                        │
│   Gates stop for approval. Nothing runs until you confirm.             │
╰────────────────────────────────────────────────────────────────────────╯
```

Substitute the real `<PREFIX>#[IID]` and `<current_round>` into the title bar, then re-pad the title bar's `─` fill and the right border of every row so the box stays flush after substitution; keep the Finalize wording (branch + commit, no push/MR) per REFERENCE.

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

3. **GATE 0 — Clarify (conditional).** If verdict is `NEEDS_CLARIFICATION`: invoke the **`unioss-brainstorming` skill** in THIS thread and work the numbered Open Questions with the user through it; then append a `## Clarifications` section to INVESTIGATION.md capturing the resolutions. If `CLEAR`: skip. Either way, proceed to the spec once the ticket is clear.

4. **Planner — spec mode.** Dispatch `unioss-planner` in **spec mode** with the investigation path. It writes `<PREFIX>#[IID]_SPEC.md` (the *what/why* — scope, requirements, acceptance criteria; no code) and returns the spec path + a one-line scope summary. Set `spec_version` in state.

5. **GATE 1 — SPEC approval.** Present the spec summary + link. **approve** → set `spec_approved = true`, go to step 6. **edit** → re-dispatch spec mode with the feedback (produces `_SPEC_V2/V3`) and re-present until approved. Never proceed to the plan without approval.

6. **Planner — plan mode.** Dispatch `unioss-planner` in **plan mode** with the approved SPEC path. It writes IMPLEMENTATION_V1.md (exact per-file code) and returns the path + estimate points.

7. **GATE 2 — Plan approval.** Present the plan summary + links. The plan contains exact code, so this is a real code approval. If the user requests edits, re-dispatch the planner (plan mode) with the feedback (produces _V2/_V3) and re-present until approved.

8. **Coder (in this thread)** — invoke the `unioss-implement` skill: apply the approved plan, run migrations if required, fast-verify new PHPUnit tests (AdminPage), write CHANGES.md. The coder creates the correct feature branch off `v3-master` per the REFERENCE branch rules **before** its first edit in each repo, and follows the REFERENCE submodule flow for any common-models/common-helper change.

9. **Reviewer** — dispatch `unioss-reviewer` with the CHANGES.md path. It writes REVIEW.md and returns severity counts + top findings.

10. **GATE 3 — Review fix/accept.** Present findings by severity.
   - **fix** → invoke `unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 9.
   - **accept** → (AdminPage) invoke `unioss-implement` full mode: uncomment the dump-import line, run the full suite → `.walkthrough/<PREFIX>#[IID]/round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.

11. **Tester** — dispatch `unioss-tester` with the CHANGES.md path + acceptance criteria. It writes TEST_RESULTS.md and returns pass/fail. (Both repos.) If the tester reports any UI criteria as SKIPPED (no browser MCP), note that explicitly — do NOT treat SKIPPED as a pass.

12. **Finalize** — for every repo the coder touched, commit on its feature branch using the REFERENCE commit format `#[IID] - [Message]`. Per REFERENCE: AdminPage/FrontEnd app branches are committed locally only (no push, no MR); common-models/common-helper submodule branches are pushed and the consuming apps' pointers updated. Never touch a protected branch. Present a final summary: branch names per repo, spec, plan, changes, review status, test status, and clickable `file://` links to every artifact (REFERENCE → Clickable links — run `scripts/link.mjs` per path; never print a bare `.walkthrough/<PREFIX>#[IID]/…` path). If UI verification was SKIPPED, surface "UI verification: SKIPPED — no browser MCP configured" prominently. STOP.

## Rules
- Never edit source except via the `unioss-implement` coder step.
- Honor the gates — never run past Step 0, GATE 1, GATE 2, or GATE 3 without an explicit user decision.
- **Protected branches** (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`) are read-only — never commit, push, or modify them. All work happens on `feature/v3/...` branches cut from `v3-master`. Verify the current branch before any commit/push.
- Keep main context lean: rely on subagents' returned summaries; read full artifacts only when needed for a gate.
- When surfacing any artifact path to the human, emit a clickable `file://` link (REFERENCE → Clickable links), never a bare path — a bare `#` breaks the terminal link.
