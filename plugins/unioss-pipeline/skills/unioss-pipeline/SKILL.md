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
  2. Re-fetch the ticket (`unioss-pipeline:unioss-gitlab-issue-context`); read only the **new comments since the last round**.
  3. Write `round-<N+1>/ROUND_BRIEF.md` from that comment delta; invoke `unioss-pipeline:unioss-brainstorming` on the feedback.
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

Parse the URL (REFERENCE regex) → IID + origin repo → prefix `AP`/`FE`. Render the plan table by running the script (it stays flush on its own — never hand-draw or re-pad it), print the output, then **stop — ask the user to confirm before any stage runs**:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/plan-table.mjs" <PREFIX> [IID] <current_round>
```

- Wait for the user to say to proceed. Run no stage until they confirm.
- **Rounds.** All artifacts go under `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`. On a re-run (a sealed round exists), first write `round-<current_round>/ROUND_BRIEF.md` capturing exactly what this round must do (ticket delta since last round and/or user instruction), and state that all prior rounds stay frozen. Every stage is scoped to the brief and treats prior rounds as an immutable baseline. Never write outside the current round (sealed-round guard enforces this).

## Flow

1. **Parse** the URL → IID + origin repo → prefix. Determine `current_round`. Create `.walkthrough/.pipeline/<PREFIX>#[IID]/` and `.walkthrough/<PREFIX>#[IID]/round-<current_round>/`. Pass that round path to every subagent.
2. **Investigator** — dispatch the `unioss-pipeline:unioss-investigator` agent (**investigate mode**) with the URL. Writes INVESTIGATION.md only; returns a clarity verdict + open-question count.
3. **GATE 0 — Clarify (conditional).** If verdict is `NEEDS_CLARIFICATION`: invoke the `unioss-pipeline:unioss-brainstorming` skill in THIS thread, work the numbered Open Questions with the user, then append a `## Clarifications` section to INVESTIGATION.md. If `CLEAR`: skip.
   - **Step 3b — Reporter.** Dispatch the `unioss-pipeline:unioss-investigator` agent (**report mode**) with the INVESTIGATION.md path. Writes the PM-facing REPORT.md from the now-clarified investigation. Always runs, whether or not GATE 0 clarified anything — the report must never be built on unanswered questions.
4. **Planner — spec mode.** Dispatch the `unioss-pipeline:unioss-planner` agent (spec mode) with the investigation path. Writes `<PREFIX>#[IID]_SPEC.md` (what/why — scope, requirements, acceptance criteria; no code); returns path + one-line scope. Set `spec_version`.
5. **GATE 1 — Spec approval.** Present spec summary + path. **approve** → set `spec_approved = true`, go to step 6. **edit** → ask Decision prompt **(a)**, then re-dispatch spec mode with the feedback and re-present. Never proceed without approval.
6. **Planner — plan mode.** Dispatch the `unioss-pipeline:unioss-planner` agent (plan mode) with the approved SPEC path. Writes IMPLEMENTATION_V1.md (exact per-file code); returns path + estimate points.
7. **GATE 2 — Plan approval.** Present plan summary + paths. The plan holds exact code, so this is a real code approval. On edits, ask Decision prompt **(a)**, then re-dispatch (plan mode) with the feedback and re-present until approved.
8. **Coder (this thread)** — invoke the `unioss-pipeline:unioss-implement` skill: apply the approved plan, run migrations if required, fast-verify new PHPUnit tests (AdminPage), write CHANGES.md. It creates the correct feature branch off `v3-master` before its first edit per repo (REFERENCE branch rules) and follows the REFERENCE submodule flow for any common-code change.
9. **Reviewer** — dispatch the `unioss-pipeline:unioss-reviewer` agent with the CHANGES.md path. Writes REVIEW.md; returns severity counts + top findings.
10. **GATE 3 — Review fix/accept.** Present findings by severity.
    - **fix** → invoke `unioss-pipeline:unioss-implement` to apply fixes + re-run filtered tests → ask "re-review or proceed?"; if re-review, go to step 9.
    - **accept** → (AdminPage) invoke `unioss-pipeline:unioss-implement` full mode: full suite with a fresh DB (`phpunit-config apply --import`) → `round-<current_round>/UT_#[IID]_[YYYYMMDD]_V1.txt`.
11. **Tester** — dispatch the `unioss-pipeline:unioss-tester` agent with the CHANGES.md path + acceptance criteria. Writes TEST_RESULTS.md; returns pass/fail. If any UI criterion is SKIPPED (no browser MCP), note it explicitly — never treat SKIPPED as a pass.
12. **Finalize** — for every repo the coder touched, commit on its feature branch using `#[IID] - [Message]`. Per REFERENCE: app branches (AdminPage/FrontEnd) are committed locally only (no push, no MR) and exclude the submodule gitlink; submodule branches are pushed. Never touch a protected branch. Present a final summary: branch per repo, spec, plan, changes, review status, test status, and the backticked relative path to every artifact. If UI verification was SKIPPED, surface "UI verification: SKIPPED — no browser MCP configured" prominently. Then ask Decision prompt **(b)**.

## Decision prompts

Print these **verbatim** — exact wording, exact option order. Add no explanation, no extra options, no commentary before or after. Wait for the user's number.

**(a) Spec/plan change** — at GATE 1 or GATE 2, whenever the user wants the spec or plan changed:

```
Change requirement. What would you like to do?

1. Create a new version (V2, V3...)
2. Update current version

Which option?
```

- `1` → write the next version (`_SPEC_V{n+1}.md` / `_IMPLEMENTATION_V{n+1}.md`); bump `spec_version` / `plan_version`.
- `2` → edit the current spec/plan file in place. No new file, no version bump.

**(b) Pipeline complete** — at the end of Flow step 12:

```
Implementation complete. What would you like to do?

1. Push and create a Merge to Staging
2. Keep work as-is (I'll handle it later)

Which option?
```

- `1` → invoke the `unioss-pipeline:unioss-ship` skill in `staging` mode.
- `2` → STOP. Nothing is pushed.

## Rules

- Never edit source except via the `unioss-pipeline:unioss-implement` coder step.
- Honor the gates — never run past Step 0, GATE 1, GATE 2, or GATE 3 without an explicit user decision.
- Protected branches are read-only (REFERENCE → Branches). Verify the current branch before any commit/push.
- Keep main context lean: rely on subagents' returned summaries; read full artifacts only when a gate needs it.
- Emit every artifact as a workspace-relative path in backticks (REFERENCE → Artifact paths) — never a `file://` URL.
