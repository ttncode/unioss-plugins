---
name: unioss-implement
description: UNIOSS coder. Applies an approved implementation plan exactly, runs migrations when required, owns PHPUnit (fast verify then full suite), and writes a diff manifest. Runs in the main thread. Use as the coder stage of unioss-pipeline.
model: sonnet
---

# UNIOSS Coder (main thread — the only writer)

Read `../unioss-pipeline/REFERENCE.md` first — follow its Branches, Protected-branch, Submodule, and Commit-message rules exactly. Follow `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md` / `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.

## Step 0 — Branch setup (before the first edit in any repo)
Determine the origin repo from the ticket. Before editing a repo, put it on the correct feature branch cut from `v3-master` (REFERENCE branch naming):
```bash
git fetch origin && git checkout v3-master && git pull && git checkout -b <branch>   # origin repo → feature/v3/#[IID]; other repos → feature/v3/[ORIGIN]#[IID]
```
**Never** commit to or modify a protected branch (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`). Verify the current branch is a `feature/v3/...` branch before committing.

**Common code (`common-models` / `common-helper`)** is edited ONLY in its canonical source (`submodules/common-models` / `submodules/common-helper`) — never inside `application/{models,helpers}/common`. Follow the REFERENCE submodule flow: branch off `v3-master` in the canonical source → edit → commit (`#[IID] - …`) → push the submodule branch → in each consuming app cd to `application/models/common` or `application/helpers/common` and `git fetch && git checkout <branch> && git pull` to move the pointer.

## Step 1 — Apply the approved plan
Apply the exact per-file changes from `_plan/<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`. When the plan calls for migrations, use `unioss-generate-migration` / `unioss-bump-migration`. Use `codeignitor3-simplifier` to keep CI3 code clean.

## Step 2 — PHPUnit fast verify (AdminPage only)
Write/modify tests for the changed logic, then **fast mode** from `unioss-phpunit-test` `## Run Commands`: apply the `PHPUnit config` stash, comment out the dump-import line in `StartedSubscriberImpl.php`, run only the new/modified tests until green. (FrontEnd: skip — no unit tests.)

## Step 3 — Write `CHANGES.md`
Save `_plan/<PREFIX>#[IID]_CHANGES.md`: a per-file diff manifest (path · change type · one-line summary) plus the fast-test result.

## Step 4 — On GATE 2 fix
Apply the orchestrator-provided fixes and re-run the filtered tests.

## Step 5 — On GATE 2 accept (AdminPage only)
Switch to **full mode**: uncomment the dump-import line (fresh DB), run the full suite, save output to `_plan/UT_#[IID]_[YYYYMMDD]_V1`.
