---
name: unioss-pipeline
description: UNIOSS A→Z ticket pipeline orchestrator. Given a GitLab ticket URL, drives investigator → (clarify) → spec → GATE → planner → GATE → coder → reviewer → GATE → tester → branch+commit, stopping for human approval at the gates. Use when the user runs /unioss-pipeline <URL> or asks to run the full UNIOSS ticket pipeline.
---

# UNIOSS Pipeline Orchestrator (main thread)

Read `REFERENCE.md` (this dir) first — its branch, protected-branch, submodule, and commit rules are binding. You run in the MAIN thread: dispatch read-only stages as subagents, run the coder yourself, own the gates.

## Entry modes

Three ways in. All share the same gates, rounds, and stages; they differ only in what starts the run and which early steps are skipped.

- **ticket mode** — `/unioss-pipeline <url>` (default). New GitLab ticket, full flow from Investigate. `<PREFIX>` is `AP`/`FE` from the URL.
- **feedback mode** — `/unioss-feedback <url>`. Ticket already has ≥1 sealed round. Open round N+1 (never restart):
  1. Run Parse/round-setup (Flow step 1) to open round N+1.
  2. Re-fetch the ticket (`unioss-gitlab-issue-context`); read only the **new comments since the last round**.
  3. Write `round-<N+1>/ROUND_BRIEF.md` from that comment delta; invoke `unioss-brainstorming` on the feedback.
  4. Continue from the **spec** stage (Flow step 4) onward. Investigator (step 2) + GATE 0 (step 3) are skipped — the ticket was investigated in round 1. Prior rounds stay frozen.
- **task mode** — `/unioss-task <description>`. No GitLab ticket:
  1. Run Parse (Flow step 1): derive artifact identity `TASK#<short-slug>` (kebab-case of a few keywords); create `round-1/` + `.walkthrough/.pipeline/TASK#<slug>/`; write `round-1/ROUND_BRIEF.md` from the request.
  2. Run the normal Flow **from the investigator (step 2)**, but skip its GitLab fetch + DB-from-ticket steps — map impact from the request text + code only. No GitLab links in artifacts.

## State & resume

State file: `.walkthrough/.pipeline/<PREFIX>#[IID]/pipeline-state.json` —
`{ current_round, rounds: { "<n>": { stage, gate_decisions, spec_version, spec_approved, plan_version, review_counts, test_status } } }`.

On start, determine the round:

- No state / no `round-*` dirs → **round 1**. Set `current_round = 1`.
- Latest round **incomplete** (`stage` ≠ `finalized`) → resume it; do not open a new one.
- Latest round **sealed** (`stage = finalized`) **and** new work exists (ticket changed, or user instruction) → open **round N+1**.

Update the current round's entry after every stage. On resume within a round: if `spec_approved` is true, skip the spec stage + GATE 1 and continue at the plan phase; otherwise resume at the spec stage.

## Step 0 — Show the plan, get the go-ahead

Parse the URL (REFERENCE regex) → IID + origin repo → prefix `AP`/`FE`. Print this table (substitute `<PREFIX>`, `[IID]`, `<current_round>`; re-pad the title `─` fill and every row's right border so the box stays flush) and **stop — ask the user to confirm before any stage runs**:

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

- Wait for the user to say to proceed. Run no stage until they confirm.
- **Rounds.** All artifacts go under `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`. On a re-run (a sealed round exists), first write `round-<current_round>/ROUND_BRIEF.md` capturing exactly what this round must do (ticket delta since last round and/or user instruction), and state that all prior rounds stay frozen. Every stage is scoped to the brief and treats prior rounds as an immutable baseline. Never write outside the current round (sealed-round guard enforces this).

## Flow

1. **Parse** the URL → IID + origin repo → prefix. Determine `current_round`. Create `.walkthrough/.pipeline/<PREFIX>#[IID]/` and `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`. Pass that round path to every subagent.
2. **Investigator** — dispatch `unioss-investigator` with the URL. Writes INVESTIGATION.md + REPORT.md; returns a clarity verdict + open-question count.
3. **GATE 0 — Clarify (conditional).** If verdict is `NEEDS_CLARIFICATION`: invoke `unioss-brainstorming` in THIS thread, work the numbered Open Questions with the user, then append a `## Clarifications` section to INVESTIGATION.md. If `CLEAR`: skip.
4. **Planner — spec mode.** Dispatch `unioss-planner` (spec mode) with the investigation path. Writes `<PREFIX>#[IID]_SPEC.md` (what/why — scope, requirements, acceptance criteria; no code); returns path + one-line scope. Set `spec_version`.
5. **GATE 1 — Spec approval.** Present spec summary + link. **approve** → set `spec_approved = true`, go to step 6. **edit** → re-dispatch spec mode with feedback (`_SPEC_V2/V3`) and re-present. Never proceed without approval.
6. **Planner — plan mode.** Dispatch `unioss-planner` (plan mode) with the approved SPEC path. Writes IMPLEMENTATION_V1.md (exact per-file code); returns path + estimate points.
7. **GATE 2 — Plan approval.** Present plan summary + links. The plan holds exact code, so this is a real code approval. On edits, re-dispatch (plan mode) with feedback (`_V2/_V3`) and re-present until approved.
8. **Coder (this thread)** — invoke `unioss-implement`: apply the approved plan, run migrations if required, fast-verify new PHPUnit tests (AdminPage), write CHANGES.md. It creates the correct feature branch off `v3-master` before its first edit per repo (REFERENCE branch rules) and follows the REFERENCE submodule flow for any common-code change.
9. **Reviewer** — dispatch `unioss-reviewer` with the CHANGES.md path. Writes REVIEW.md; returns severity counts + top findings.
10. **GATE 3 — Review fix/accept.** Present findings by severity.
    - **fix** → invoke `unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 9.
    - **accept** → (AdminPage) invoke `unioss-implement` full mode: full suite with a fresh DB (`phpunit-config apply --import`) → `round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.
11. **Tester** — dispatch `unioss-tester` with the CHANGES.md path + acceptance criteria. Writes TEST_RESULTS.md; returns pass/fail. If any UI criterion is SKIPPED (no browser MCP), note it explicitly — never treat SKIPPED as a pass.
12. **Finalize** — for every repo the coder touched, commit on its feature branch using `#[IID] - [Message]`. Per REFERENCE: app branches (AdminPage/FrontEnd) are committed locally only (no push, no MR) and exclude the submodule gitlink; submodule branches are pushed. Never touch a protected branch. Present a final summary: branch per repo, spec, plan, changes, review status, test status, and clickable `file://` links to every artifact. If UI verification was SKIPPED, surface "UI verification: SKIPPED — no browser MCP configured" prominently. STOP.

## Rules

- Never edit source except via the `unioss-implement` coder step.
- Honor the gates — never run past Step 0, GATE 1, GATE 2, or GATE 3 without an explicit user decision.
- Protected branches are read-only (REFERENCE → Branches). Verify the current branch before any commit/push.
- Keep main context lean: rely on subagents' returned summaries; read full artifacts only when a gate needs it.
- Emit every artifact path as a clickable `file://` link (REFERENCE → Clickable links), never a bare path.
