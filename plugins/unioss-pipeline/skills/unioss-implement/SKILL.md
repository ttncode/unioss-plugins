---
name: unioss-implement
description: UNIOSS coder. Applies an approved implementation plan exactly, runs migrations when required, owns PHPUnit (fast verify then full suite), and writes a diff manifest. Runs in the main thread. Use as the coder stage of unioss-pipeline.
model: sonnet
---

# UNIOSS Coder (main thread — the only writer)

Read `../unioss-pipeline/REFERENCE.md` first — follow its Branches, Protected-branch, Submodule, and Commit-message rules exactly. Follow `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md` / `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.
Write all artifacts under the round folder the orchestrator gives you (`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.

## Step 0 — Branch setup (before the first edit in any repo)

Determine the origin repo from the ticket. Before editing a repo, put it on the correct feature branch cut from `v3-master` (REFERENCE branch naming):

```bash
git fetch origin && git checkout v3-master && git pull && git checkout -b <branch>   # origin repo → feature/v3/#[IID]; other repos → feature/v3/[ORIGIN]#[IID]
```

**Never** commit to or modify a protected branch (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`). Verify the current branch is a `feature/v3/...` branch before committing.

**Common code (`common-models` / `common-helper`)** is edited ONLY in its canonical source (`submodules/common-models` / `submodules/common-helper`) — never inside `application/{models,helpers}/common`. Follow the REFERENCE submodule flow: branch off `v3-master` in the canonical source → edit → commit (`#[IID] - …`) → push the submodule branch → in each consuming app cd to `application/models/common` or `application/helpers/common` and `git fetch && git checkout <branch> && git pull` to move the pointer **in the working tree only — never `git add`/commit/push the pointer bump in the app repo**.

## Step 1 — Apply the approved plan

Apply the exact per-file changes from `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`. When the plan calls for migrations, use `unioss-generate-migration` / `unioss-bump-migration`. Use `codeignitor3-simplifier` to keep CI3 code clean.

## Step 1b — Verify the migration (only if the plan added one)

If the approved plan added a migration, verify it per `migration-verify.md` (this skill dir): on `development` by default, run up → down → re-up and confirm the version + DB effect at each step. **STOP and ask the user for explicit go-ahead before running `up()` or `down()`** whenever either destroys data that existed before the migration and the other side can't restore it (name the table, environment, and recoverability). Pure create-then-drop migrations proceed without asking.

## Step 2 — PHPUnit fast verify (AdminPage only)

Write/modify tests for the changed logic, then **fast mode** from `unioss-phpunit-test` `## Run Commands`: run `phpunit-config.mjs apply --skip-import`, run only the new/modified tests until green, then `phpunit-config.mjs restore`. (FrontEnd: skip — no unit tests.)

## Step 3 — Write `CHANGES.md`

Save `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_CHANGES.md`: a per-file diff manifest (path · change type · one-line summary) plus the fast-test result.

## Step 3b — API spec (only if a new API endpoint was added)

If the change adds a new API endpoint, invoke `unioss-api-spec` to write `<PREFIX>#[IID]_API_SPEC.md` into the round dir `.walkthrough/<PREFIX>#[IID]/round-<N>/`.

## Step 4 — On GATE 3 fix

Apply the orchestrator-provided fixes and re-run the filtered tests.

## Step 5 — On GATE 3 accept (AdminPage only)

Switch to **full mode**: `phpunit-config.mjs apply --import` (fresh DB), run the full suite, save output to `.walkthrough/<PREFIX>#[IID]/round-<N>/UT_#[IID]_[YYYYMMDD]_V1.txt`, then `phpunit-config.mjs restore`.

## Standalone use

You can be invoked directly on a free-form task (e.g. `/unioss-implement Optimize this function …`), outside the orchestrated pipeline. When **no orchestrator context** was handed to you — no ticket, no round path:

- Do the requested task on the file(s) named, using this skill's rules and domain knowledge.
- **Write nothing under `.walkthrough/`** — no round folders, no INVESTIGATION / PLAN / CHANGES / REVIEW / TEST / UT artifacts, no state files — **unless the user explicitly asks** for a written artifact.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections above describe.
