---
name: unioss-pipeline reference — git
---

# UNIOSS Pipeline — Git Surface

Branches, commits, submodules, and the two places GitLab writes are legal.

**Read this only if your stage writes git:** the coder (`unioss-implement`), ship (`unioss-ship`), and `unioss-mr-feedback`. Read-only stages (investigator, planner, reviewer, scope, tester) never need this file — `REFERENCE.md` alone is enough for them.

Resolve config before any git work: `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"`.

## Branches, base & protected

- **Base branch:** always cut feature branches from `gitlab.baseBranch` (`v3-master`). Fetch first: `git fetch origin && git checkout v3-master && git pull` — checkout/fetch/pull on the base branch are fine; it is _writes_ that are forbidden.
- **⛔ Protected — NEVER commit, push, force-push, rebase, reset, revert, cherry-pick, or merge into (local or remote):** every branch in `gitlab.protected` — `master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`. Before any write, verify the current branch is NOT one of these — abort if it is.
- This is **enforced**, not merely documented: the `guard-protected-branch` PreToolUse hook blocks any such `git` command and exits non-zero. Resolve the list with `US_PROTECTED` (from `config.mjs env`); never hardcode it. Protected branches are legal only as an MR **target**.
- **Naming.** The _origin repo_ is the repo the ticket URL belongs to (`AdminPage` or `FrontEnd`).
  - Origin repo: `feature/v3/#[IID]`
  - Every OTHER repo changed: `feature/v3/[ORIGIN_REPO]#[IID]`

  Example — `…/AdminPage/-/work_items/1834` (origin = AdminPage):

  | Repo changed  | Branch                      |
  | ------------- | --------------------------- |
  | AdminPage     | `feature/v3/#1834`          |
  | FrontEnd      | `feature/v3/AdminPage#1834` |
  | common-models | `feature/v3/AdminPage#1834` |
  | common-helper | `feature/v3/AdminPage#1834` |

  Example — `…/FrontEnd/-/work_items/391` (origin = FrontEnd):

  | Repo changed  | Branch                    |
  | ------------- | ------------------------- |
  | FrontEnd      | `feature/v3/#391`         |
  | AdminPage     | `feature/v3/FrontEnd#391` |
  | common-models | `feature/v3/FrontEnd#391` |
  | common-helper | `feature/v3/FrontEnd#391` |

## Commit message

- Format: `#[IID] - [Message]` — single imperative subject line, English.
- Example: `#1834 - Remove the price form from the product editing screen`.

## Submodules (common-models / common-helper)

| Submodule     | Canonical source (EDIT HERE) | Consumed in apps (do NOT edit here)                                           |
| ------------- | ---------------------------- | ----------------------------------------------------------------------------- |
| common-models | `submodules/common-models/`  | `AdminPage/application/models/common`, `FrontEnd/application/models/common`   |
| common-helper | `submodules/common-helper/`  | `AdminPage/application/helpers/common`, `FrontEnd/application/helpers/common` |

Edit flow (common code is edited ONLY in the canonical source, never inside the apps):

1. In the canonical source: `git fetch origin && git checkout v3-master && git pull && git checkout -b feature/v3/[ORIGIN_REPO]#[IID]`.
2. Edit there; commit with the `#[IID] - …` message.
3. **Push** the submodule feature branch (required so the apps can pull it).
4. In each consuming app, cd into the consuming path (`application/models/common` or `application/helpers/common`) and `git fetch origin && git checkout feature/v3/[ORIGIN_REPO]#[IID] && git pull` — moves the pointer in the **working tree only**.

**Never commit or push the pointer bump** in AdminPage/FrontEnd: do not `git add` the submodule gitlink, do not commit it, do not push the app repo for the pointer change. The pushed submodule branch alone carries the common-code change; whoever merges wires the pointer. Only submodule feature branches are pushed; app branches are committed locally only and exclude the gitlink.

## GitLab writes

⛔ GitLab **writes** are permitted in exactly two places:

- `/unioss-ship` — push a feature branch + `POST …/merge_requests`. Needs the `api` scope.
- `/unioss-mr-feedback` — push a feature branch only, after the user approves the analyzed fixes. **Never** creates or merges an MR. Needs `write_repository`.

Never POST/PUT/DELETE during any read stage. Never merge, anywhere, ever. Never print the token.

Read endpoints and URL regexes live in `REFERENCE.md` → GitLab (reads).
