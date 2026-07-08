# UNIOSS Pipeline Spec-Before-Plan Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a spec stage + approval gate (GATE 1) between investigation and the implementation plan in the UNIOSS pipeline, authored by the existing planner subagent in a new "spec mode", and renumber the downstream gates.

**Architecture:** Docs/skill-instruction change only — no scripts, no code, no automated tests. The planner (`unioss-plan`) gains two orchestrator-driven modes (spec / plan). The orchestrator (`unioss-pipeline`) dispatches the planner twice, adds GATE 1 (SPEC approval), and renumbers the old GATE 1→2 (plan) and GATE 2→3 (review). Supporting docs (`REFERENCE.md`, stage skills that cite gate numbers, `plugin.json`) are updated for consistency.

**Tech Stack:** Markdown skill definitions for a Claude Code plugin. No runtime code.

## Global Constraints

- Docs-only: touch only `.md` skill/reference files and `plugin.json`. No `.mjs`/`.js`/`.json` logic changes except the version bump.
- Gate renumber mapping (apply everywhere): old **GATE 1 (plan)** → **GATE 2**; old **GATE 2 (review)** → **GATE 3**; **GATE 0** unchanged; new **GATE 1 = SPEC approval**.
- The spec is the *what/why* only — **no code**. The plan remains the *how* with exact before/after code.
- The spec is written for every ticket once clarity is reached (after GATE 0 if it ran); GATE 1 is a hard gate.
- Spec + plan are round-scoped: `.walkthrough/<PREFIX>#[IID]/round-<N>/`.
- `plugin.json` version: `1.3.0` → `1.4.0`.
- The `## Standalone use` section of `unioss-plan` must stay unchanged (mode is orchestrator-only).
- Existing test suite must still pass unchanged (33/33) — this change touches no tested code, so it is a sanity check, not a deliverable.

---

### Task 1: Planner two-phase modes (`unioss-plan/SKILL.md`)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-plan/SKILL.md`

**Interfaces:**
- Consumes: `<PREFIX>#[IID]_INVESTIGATION.md` (spec mode input); approved `<PREFIX>#[IID]_SPEC.md` (plan mode input).
- Produces: the spec-mode / plan-mode contract the orchestrator (Task 2) dispatches against — spec mode writes `<PREFIX>#[IID]_SPEC.md`, plan mode writes `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`.

- [ ] **Step 1: Insert the Modes section**

In `skills/unioss-plan/SKILL.md`, find the intro line that ends the header block (the line starting `To read module source, resolve host paths first:` … ending `(see REFERENCE → Source paths).`). Immediately AFTER that line, insert:

```md

## Modes (the orchestrator tells you which)

The pipeline dispatches this skill in one of two modes; the dispatch prompt states which. A direct standalone invocation (see **Standalone use**) has no mode.

- **spec mode** → produce `<PREFIX>#[IID]_SPEC.md` (the *what/why* — no code). See **Spec mode**.
- **plan mode** → produce `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md` from the **approved** spec (the *how* — exact code). See **Plan mode**.
```

- [ ] **Step 2: Replace the Inputs + Steps block with Spec mode / Plan mode**

Replace this exact block:

```md
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
```

with:

```md
## Spec mode

**Input:** `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_INVESTIGATION.md`, including any `## Clarifications` section the orchestrator appended.

Write `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_SPEC.md` — the *what/why*, **no code**. Mandatory sections:
- **Goal** — one paragraph.
- **Scope** — In-Scope / Out-of-Scope bullet lists.
- **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
- **Acceptance Criteria** — numbered, verifiable statements the tester can check.
- **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot make it empty, say so in your return so the orchestrator reopens GATE 0.
- **Related** — links to the investigation and any related issues.

If a prior version exists, increment `_SPEC_V2`, `_SPEC_V3`, … (GATE 1 edit loop). **Return:** the spec path + a one-line scope summary; do not paste the body.

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
Return the plan path, total estimate points, and a one-line scope summary. Do not paste the full plan body.
```

- [ ] **Step 3: Verify the modes are present and the old GATE 1 loop ref is gone**

Run: `cd plugins/unioss-pipeline && grep -n "## Spec mode\|## Plan mode\|_SPEC.md\|GATE 2 edit loop" skills/unioss-plan/SKILL.md; echo "---stale check---"; grep -n "GATE 1 edit loop" skills/unioss-plan/SKILL.md || echo "CLEAN: no stale GATE 1 edit loop"`
Expected: the four positive matches present; `CLEAN` for the stale check. Also confirm `## Standalone use` still exists: `grep -c "## Standalone use" skills/unioss-plan/SKILL.md` → `1`.

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-plan/SKILL.md
git commit -m "feat(unioss-pipeline): planner spec/plan two-phase modes"
```

---

### Task 2: Orchestrator flow, gate renumber, state (`unioss-pipeline/SKILL.md`)

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md`

**Interfaces:**
- Consumes: the spec/plan modes defined in Task 1.
- Produces: the flow other stage-skill docs (Task 3) reference by gate number.

- [ ] **Step 1: Update the state-shape doc line**

Replace:

```md
`{ current_round, rounds: { "<n>": { stage, gate_decisions, plan_version, review_counts, test_status } } }`.
```

with:

```md
`{ current_round, rounds: { "<n>": { stage, gate_decisions, spec_version, spec_approved, plan_version, review_counts, test_status } } }`.
```

- [ ] **Step 2: Add the spec-resume rule**

Replace:

```md
Update the current round's entry after every stage.
```

with:

```md
Update the current round's entry after every stage. On resume within a round: if `spec_approved` is true, skip the spec stage + GATE 1 and continue at the plan phase; otherwise resume at the spec stage.
```

- [ ] **Step 3: Insert the Spec + GATE 1 rows into the stage table**

Replace this exact 3-line slice of the ASCII table:

```
│ 🛑 GATE 0   │ main thread          │ only if unclear — brainstorms open questions with you        │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Plan        │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md             │
```

with:

```
│ 🛑 GATE 0   │ main thread          │ only if unclear — brainstorms open questions with you        │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Spec        │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_SPEC.md (what/why — no code)     │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ 🛑 GATE 1   │ you                  │ approve the spec or request edits (→ V2/V3)                  │
├─────────────┼──────────────────────┼──────────────────────────────────────────────────────────────┤
│ Plan        │ subagent (opus)      │ writes .walkthrough/<PREFIX>#[IID]/round-<current_round>/<PREFIX>#[IID]_IMPLEMENTATION_V1.md             │
```

- [ ] **Step 4: Renumber the plan gate row in the table**

Replace:

```
│ 🛑 GATE 1   │ you                  │ approve the plan or request edits (→ V2/V3)                  │
```

with:

```
│ 🛑 GATE 2   │ you                  │ approve the plan or request edits (→ V2/V3)                  │
```

- [ ] **Step 5: Renumber the review gate row in the table**

Replace:

```
│ 🛑 GATE 2   │ you                  │ fix (loop) or accept (→ full PHPUnit → UT_#[IID]_…)          │
```

with:

```
│ 🛑 GATE 3   │ you                  │ fix (loop) or accept (→ full PHPUnit → UT_#[IID]_…)          │
```

- [ ] **Step 6: Replace the Flow steps (3 → 10) with the renumbered 3 → 12**

Replace this exact block (from step 3 through the end of step 10):

```md
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
```

with:

```md
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

12. **Finalize** — for every repo the coder touched, commit on its feature branch using the REFERENCE commit format `#[IID] - [Message]`. Per REFERENCE: AdminPage/FrontEnd app branches are committed locally only (no push, no MR); common-models/common-helper submodule branches are pushed and the consuming apps' pointers updated. Never touch a protected branch. Present a final summary: branch names per repo, spec, plan, changes, review status, test status, links. If UI verification was SKIPPED, surface "UI verification: SKIPPED — no browser MCP configured" prominently. STOP.
```

- [ ] **Step 7: Update the Rules gate list**

Replace:

```md
- Honor the gates — never run past Step 0, GATE 1, or GATE 2 without an explicit user decision.
```

with:

```md
- Honor the gates — never run past Step 0, GATE 1, GATE 2, or GATE 3 without an explicit user decision.
```

- [ ] **Step 8: Update the description frontmatter to mention the spec gate**

Replace:

```md
description: UNIOSS A→Z ticket pipeline orchestrator. Given a GitLab ticket URL, drives investigator → (clarify) → planner → GATE → coder → reviewer → GATE → tester → branch+commit, stopping for human approval at the gates. Use when the user runs /unioss-pipeline <URL> or asks to run the full UNIOSS ticket pipeline.
```

with:

```md
description: UNIOSS A→Z ticket pipeline orchestrator. Given a GitLab ticket URL, drives investigator → (clarify) → spec → GATE → planner → GATE → coder → reviewer → GATE → tester → branch+commit, stopping for human approval at the gates. Use when the user runs /unioss-pipeline <URL> or asks to run the full UNIOSS ticket pipeline.
```

- [ ] **Step 9: Verify the gate sequence and state shape**

Run: `cd plugins/unioss-pipeline && grep -n "GATE 0\|GATE 1\|GATE 2\|GATE 3\|spec_version\|spec_approved" skills/unioss-pipeline/SKILL.md`
Expected, in order: GATE 0 (table + step 3); **GATE 1 = SPEC** (table row "approve the spec" + step 5 "SPEC approval"); **GATE 2 = Plan** (table "approve the plan" + step 7 "Plan approval"); **GATE 3 = Review** (table "fix (loop) or accept" + step 10 "Review fix/accept"); Rules line lists GATE 1/2/3; `spec_version` + `spec_approved` in the state line and the resume rule. No occurrence of "GATE 1 — Plan" or "GATE 2 — Review".

- [ ] **Step 10: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md
git commit -m "feat(unioss-pipeline): add SPEC approval gate (GATE 1); renumber downstream gates"
```

---

### Task 3: Downstream doc consistency + version bump

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-implement/SKILL.md`
- Modify: `plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md`
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json`

**Interfaces:**
- Consumes: the new gate numbering from Task 2.
- Produces: the final, internally consistent v1.4.0 doc set.

- [ ] **Step 1: Add SPEC.md to the REFERENCE artifact layout**

In `skills/unioss-pipeline/REFERENCE.md`, replace:

```md
- `<PREFIX>#[IID]_INVESTIGATION.md`, `<PREFIX>#[IID]_REPORT.md` (vi)
- `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`
```

with:

```md
- `<PREFIX>#[IID]_INVESTIGATION.md`, `<PREFIX>#[IID]_REPORT.md` (vi)
- `<PREFIX>#[IID]_SPEC.md` (what/why — scope, requirements, acceptance criteria; `_SPEC_V{n}` on edits)
- `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`
```

- [ ] **Step 2: Renumber the gate refs in `unioss-implement/SKILL.md`**

Replace `## Step 4 — On GATE 2 fix` with `## Step 4 — On GATE 3 fix`.
Then replace `## Step 5 — On GATE 2 accept (AdminPage only)` with `## Step 5 — On GATE 3 accept (AdminPage only)`.

- [ ] **Step 3: Renumber the gate ref in `unioss-phpunit-test/SKILL.md`**

Replace `### Full mode — all tests with a fresh DB (on GATE 2 accept)` with `### Full mode — all tests with a fresh DB (on GATE 3 accept)`.

- [ ] **Step 4: Bump the plugin version**

In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, change `"version": "1.3.0"` to `"version": "1.4.0"`.

- [ ] **Step 5: Whole-plugin gate-consistency sweep**

Run: `cd plugins/unioss-pipeline && grep -rn "GATE 2\|GATE 1\|GATE 3\|GATE 0" skills`
Expected: the ONLY places that mention a gate number are `unioss-pipeline/SKILL.md` (the canonical flow) and `unioss-plan/SKILL.md` (spec = GATE 1 edit loop, plan = GATE 2 edit loop). No stray "GATE 2" remains in `unioss-implement` or `unioss-phpunit-test` (they must now read GATE 3). Confirm: `grep -rn "GATE 2" skills/unioss-implement skills/unioss-phpunit-test || echo "CLEAN"` → `CLEAN`.

- [ ] **Step 6: Sanity — existing suite unaffected**

Run: `cd plugins/unioss-pipeline && timeout 60 node --test scripts/*.test.mjs hooks/*.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"`
Expected: `# tests 33`, `# pass 33`, `# fail 0` (this task changed no tested code).

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md plugins/unioss-pipeline/skills/unioss-implement/SKILL.md plugins/unioss-pipeline/skills/unioss-phpunit-test/SKILL.md plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "chore(unioss-pipeline): SPEC in artifact layout; gate-number consistency; bump to 1.4.0"
```

---

## Self-review notes

- **Spec coverage:** AC1 → Task 1; AC2 + AC3 → Task 2 (steps 3–9); AC4 → Task 1 Step 2 (spec section list); AC5 → Task 3 Step 1; AC6 → Task 2 Steps 1–2; AC7 → Task 3 Step 4. Downstream gate-number consistency (implied by AC2's "no lingering references") → Task 3 Steps 2–3, 5.
- **No placeholders:** every edit shows exact old/new markdown.
- **Naming consistency:** GATE 1 = SPEC, GATE 2 = Plan, GATE 3 = Review used identically across the orchestrator flow, table, rules, and the stage skills. `spec_version` / `spec_approved` match between the state line and the resume rule.
- **Ordering note (Task 2):** Steps 3–5 edit the table; Step 3 introduces a new `🛑 GATE 1` line while the old plan gate is still `🛑 GATE 1`, but Step 4's old-string includes "approve the plan" so it targets the plan row uniquely. Apply Steps 3→4→5 in order.
