---
name: unioss-ship
description: UNIOSS shipper. Pushes the finalized feature branch and creates GitLab merge requests (via API) into staging (v3-develop-tps) or customer staging (v3-develop), with a pre-filled-URL fallback. Never merges. Use as /unioss-ship <staging|customer>.
---

# UNIOSS Shipper (main thread)

Follow `../unioss-pipeline/REFERENCE.md` → its Branches, Protected-branch, and Submodule rules are binding. Argument: `staging` or `customer`.

This skill pushes each feature branch and **creates the MR via the GitLab API** (`ship.mjs create`), setting assignee/reviewer/label/merge-options from config. If create fails (token lacks `api` scope, or you decline the write), it falls back to a pre-filled "new MR" URL you click. It **never merges**.

## Repo keys

Every touched repo gets its own MR — including the submodules.

| Repo key       | GitLab project  | Ship it when                       |
| -------------- | --------------- | ---------------------------------- |
| `adminPage`    | `unioss/AdminPage`     | the coder changed AdminPage        |
| `frontEnd`     | `unioss/FrontEnd`      | the coder changed FrontEnd         |
| `commonHelper` | `unioss/common-helper` | the coder changed the common helper |
| `commonModels` | `unioss/common-models` | the coder changed the common models |

## MR title (fixed)

`ship.mjs` derives it — never pass or invent one:

- staging → `Merge <branch> into v3-develop-tps`
- customer → `Merge <branch> into v3-develop`

## Preconditions

- Determine the touched repos + their feature branches from the latest round's `CHANGES.md` (REFERENCE branch naming). Include any submodule the coder edited.
- Verify every branch to ship is a `feature/v3/…` branch. **Abort** if any is a protected branch.

## Mode: staging

1. For each touched repo, ensure its feature branch is current, then **push** it: `git push -u origin <branch>` (app branches were local-only until now; submodule branches are already pushed — pushing again is a no-op).
2. Create one MR per touched repo:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" create staging <repoKey> "<branch>"
   ```
   On failure, fall back to the printed pre-filled URL + manual settings:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" staging <repoWebPath> "<branch>"
   ```
3. Present the created MR URL(s) (or fallback links). Creation sets assignee/reviewer/label/options from config; **merge stays a human action**. STOP.

## Mode: customer

1. **Sync with base.** On each feature branch: `git fetch origin && git merge origin/v3-master`. On conflict → **stop**, tell the user to resolve manually, do not continue.
2. **Re-run tests.** AdminPage: invoke `unioss-pipeline:unioss-implement` full mode (full PHPUnit, fresh DB) → save `UT_#[IID]_[YYYYMMDD]_V{n}.txt`. FrontEnd: no unit tests. If tests fail → find the root cause, propose a fix plan, **ask the user to approve**, apply via `unioss-pipeline:unioss-implement`, re-run until green.
3. **Push** each feature branch: `git push -u origin <branch>`.
4. Create one MR per touched repo, targeting `v3-develop`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" create customer <repoKey> "<branch>"
   ```
   Fallback on failure: `node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" customer <repoWebPath> "<branch>"`.
5. Present all MR URLs together. STOP.

## Rules

- Pushing the feature branch and creating the MR (`ship.mjs create`) are the two permitted GitLab writes — perform them. The push is required; if the environment blocks it, tell the user and retry rather than skipping.
- **Never merge**, never write any other GitLab endpoint, never touch a protected branch except as an MR **target**.
- Emit every URL as-is from `ship.mjs`; emit artifact paths as clickable links.
- All config (targets, reviewers, assignee, label, merge options) comes from `ship.*` in config — never hardcode.
