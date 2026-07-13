---
name: unioss-ship
description: UNIOSS shipper. Pushes the finalized feature branch and prepares GitLab merge requests into staging (v3-develop-tps) or customer staging (v3-develop). Prints pre-filled MR URLs + the settings the URL can't carry; never merges, never POSTs. Use as /unioss-ship <staging|customer>.
---

# UNIOSS Shipper (main thread)

Read `../unioss-pipeline/REFERENCE.md` first — follow its Branches, Protected-branch, and Submodule rules exactly. Argument: `staging` or `customer`.

MR creation is a **human click**: this skill generates a pre-filled "new MR" URL per touched repo and prints the assignee/reviewer/label/merge-option settings to apply on the page. It never POSTs to GitLab and never merges.

## Preconditions
- Determine the touched repos + their feature branches from the latest round's `CHANGES.md` (per REFERENCE branch naming: origin repo `feature/v3/#[IID]`, others `feature/v3/[ORIGIN]#[IID]`).
- Verify every branch to ship is a `feature/v3/…` branch. **Abort** if any is a protected branch (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`).

## Mode: staging
1. For each touched repo, ensure its feature branch is current, then **push** it: `git push -u origin <branch>` (the MR source must exist on the remote; app branches were local-only until now, submodule branches are already pushed).
2. For each touched repo, resolve its GitLab web path (`<namespace>/<Repo>`, e.g. `unioss/AdminPage`) and print the MR link + settings:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" staging <repoWebPath> "<branch>"
   ```
3. Present all MR URLs together (one per repo). Remind the user MR creation + merge are manual. STOP.

## Mode: customer
1. **Sync with base.** On each touched repo's feature branch: `git fetch origin && git merge origin/v3-master`. On a merge conflict → **stop**, tell the user to resolve it manually, do not continue.
2. **Re-run tests.** AdminPage: invoke `unioss-implement` full mode (full PHPUnit with a fresh DB) → save `UT_#[IID]_[YYYYMMDD]_V{n}.txt`. FrontEnd: no unit tests. If tests fail → find the root cause, propose a fix plan, **ask the user to approve** it, apply via `unioss-implement`, re-run; loop until green.
3. **Push** each feature branch: `git push -u origin <branch>`.
4. For each touched repo, print the MR link + settings targeting `v3-develop`:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/ship.mjs" customer <repoWebPath> "<branch>"
   ```
5. Present all MR URLs together. STOP.

## Rules
- Never merge, never POST to GitLab, never touch a protected branch except as an MR **target**.
- Emit every artifact/URL as-is from `ship.mjs`; emit artifact file paths as clickable links (`scripts/link.mjs`, REFERENCE → Clickable links).
- All config (targets, reviewers, assignee, label, merge options) comes from `ship.*` in config — never hardcode.
