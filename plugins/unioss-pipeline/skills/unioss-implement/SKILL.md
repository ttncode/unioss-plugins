---
name: unioss-implement
description: Use when applying an approved UNIOSS implementation plan exactly — the coder stage: edits code, runs migrations, owns PHPUnit, and writes a diff manifest.
---

# UNIOSS Coder (main thread — the only writer)

## Overview

Apply an approved plan exactly. This is the only stage that edits project source.

**Core principle:** This is the only stage that edits project source — apply the approved plan exactly, never re-derive it.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules, and `../unioss-pipeline/REFERENCE-git.md` → its Branches, Protected-branch, Submodule, and Commit rules are binding. Read `../unioss-pipeline/REFERENCE-data.md` when the plan touches the DB. Follow `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md` / `clean-code-javascript.md`. Write artifacts only under the round folder the orchestrator gives you.

## Input

- The approved `round-<N>/implementation.v{n}.md`.
- The round path.
- **On GATE 3 fix:** the orchestrator's list of fixes to apply.
- **On GATE 3 accept:** the instruction to run the full suite.

## Workflow

### Step 0 — Branch setup (before the first edit in any repo)

Determine the origin repo from the ticket. Put each repo on its correct feature branch cut from `v3-master` (REFERENCE-git → Branches):

```bash
git fetch origin && git checkout v3-master && git pull && git checkout -b <branch>   # origin repo → feature/v3/#[IID]; other repos → feature/v3/[ORIGIN]#[IID]
```

- Never commit to or modify a protected branch. Verify the current branch is a `feature/v3/...` branch before committing.
- **Common code (`common-models` / `common-helper`)** is edited ONLY in its canonical source (`submodules/…`), never inside `application/{models,helpers}/common`. Follow REFERENCE-git → Submodules (branch → edit → commit → push submodule → move each app's pointer in the working tree only; never `git add`/commit/push the pointer bump).

### Step 1 — Apply the approved plan

Apply the exact per-file changes from the plan. For migrations use `unioss-pipeline:unioss-generate-migration` / `unioss-pipeline:unioss-bump-migration`. Use `unioss-pipeline:codeigniter3-simplifier` to keep CI3 code clean.

**`rules/clean-code-php.md` overrides the plan wherever the plan violates it** — apply the corrected form and note the deviation in `changes.md`. The three the planner most often gets wrong:

- **Booleans are prefixed `is` / `has` / `can`** (rules → Variables). Never rename a pre-existing name to comply.
- **Every `ADD COLUMN` on an existing table names its position** (rules → Database migrations). If the plan omits it, `DESCRIBE` the table, place the column per that rule, and record the position you chose.
- **No spec, plan, or ticket identifiers in source comments** (rules → Comments). If the plan's code carries such a comment, rewrite it as you apply it.

### Step 1b — Verify the migration (only if the plan added one)

Verify per `./migration-verify.md`: on `development` by default, run up → down → re-up and confirm the version + DB effect at each step.

**STOP and ask the user for explicit go-ahead before running `up()` or `down()`** whenever either destroys data that existed before the migration and the other side cannot restore it — name the table, the environment, and the recoverability. Pure create-then-drop migrations proceed without asking.

### Step 2 — PHPUnit fast verify (AdminPage only)

Write/modify tests for the changed logic, then run **fast mode** from `unioss-phpunit-test` → Run Commands: `phpunit-config.mjs apply --skip-import`, run only the new/modified tests until green, then `phpunit-config.mjs restore`. FrontEnd: skip — no unit tests.

### Step 3 — Write `changes.md`, and the API spec if needed

- Save `round-<N>/changes.md` following `./changes-template.md`.
- If the change adds a new API endpoint, invoke `unioss-pipeline:unioss-api-spec` → `round-<N>/api-spec.md`.

### Step 4 — On GATE 3 fix

Apply the orchestrator-provided fixes, update `changes.md` with a `## GATE 3 Fixes` section detailing applied fixes, and re-run the filtered tests.

### Step 5 — On GATE 3 accept (AdminPage only)

Switch to **full mode**: `phpunit-config.mjs apply --import` (fresh DB), run the full suite, save output to `round-<N>/UT_#[IID]_[YYYYMMDD]_V1.txt`, then `phpunit-config.mjs restore`.

## Output

- `changes.md` — a per-file diff manifest (path · change type · one-line summary) plus the fast-test result.
- `api-spec.md` — only when a new endpoint was added.
- `UT_#[IID]_[YYYYMMDD]_V{n}.txt` — only on GATE 3 accept.
- Return the backticked absolute path to each file written, the branch per repo, and the test result.

### Standalone — offer the next action

Inside the pipeline the orchestrator runs the reviewer next, so return your summary and stop. Invoked directly, close with a menu (REFERENCE → Ending a run):

```
Changes applied — <n> files, tests <passed>/<total>. What would you like to do?

1. Review the changes
2. Run the full test suite
3. Stop here, leave the work uncommitted

Which option?
```

`1` → `unioss-pipeline:unioss-review`. If any test failed, make `1.` *"Fix the failing tests"* — never offer review over a red suite.

## Related files

- `./migration-verify.md` — the up/down/re-up verification procedure.
- `skills/unioss-phpunit-test/SKILL.md` — fast vs full mode run commands.
- `skills/unioss-generate-migration/SKILL.md`, `skills/unioss-bump-migration/SKILL.md`.
- `rules/clean-code-php.md`, `rules/clean-code-javascript.md` — the standards the reviewer enforces.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules, artifact layout.
- `skills/unioss-pipeline/REFERENCE-git.md` — branches, protected branches, submodules, commits.
- `skills/unioss-pipeline/REFERENCE-data.md` — DB access for migration work.
