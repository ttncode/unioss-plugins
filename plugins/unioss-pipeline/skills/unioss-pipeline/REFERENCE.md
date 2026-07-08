---
name: unioss-pipeline reference
---

# UNIOSS Pipeline — Shared Reference

## Configuration (resolved at runtime)

All per-machine values come from `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs"`
(resolution: env → `.walkthrough/config/unioss.config.json` → built-in default).
Do not hardcode these in commands — resolve them.

| Key | Default | Used for |
| --- | --- | --- |
| `gitlab.host` | `gitlab.unioss.jp` | API + image URLs |
| `repos.adminPage.id` / `.path` | `32` / `AdminPage/` | project id, repo path |
| `repos.frontEnd.id` / `.path` | `31` / `FrontEnd/` | project id, repo path |
| `docker.mysql` / `docker.php` | `mysql-unioss3` / `php-unioss3` | container names |
| `db.name` / `db.user` / `db.password` | `_unioss` / `root` / `ProotW` | DB access |
| `git.baseBranch` | `v3-master` | base for feature branches |
| `git.protected` | `master, v3-master, develop, v3-develop, v3-develop-tps` | never-commit list |
| `artifactRoot` | `.walkthrough` | output dir |
| `source.root` | current workspace (cwd) | host root that holds the module checkouts |
| `source.modules.*` | `admin-page`→`AdminPage`, `front-end`→`FrontEnd`, `common-helper`, `common-models` | on-disk subdir per module |

Secrets: `GITLAB_TOKEN` is env-only (required). `db.password` resolves env `DB_PASSWORD`
→ file → default. `testing_DB` is a fixed codebase constant — not configurable.

To run a DB query in a skill, resolve config into shell vars first:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; SHOW TABLES;"
```

## Repos & Prefixes

| Repo        | Path (under project root) | GitLab Project ID | Ticket prefix |
| ----------- | ------------------------- | ----------------- | ------------- |
| AdminPage   | `AdminPage/`              | 32                | `AP#[IID]`    |
| FrontEnd    | `FrontEnd/`               | 31                | `FE#[IID]`    |

Both are CodeIgniter 3 / PHP 8.1. The only divergence: FrontEnd skips PHPUnit unit tests.

## Artifact Layout (project root `.walkthrough/`)

Each run is a **round**. Visible artifacts live under
`.walkthrough/<PREFIX>#[IID]/round-<N>/` (the human reads these):
- `ROUND_BRIEF.md` (round 2+: what this round must do)
- `<PREFIX>#[IID]_INVESTIGATION.md`, `<PREFIX>#[IID]_REPORT.md` (vi)
- `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`
- `<PREFIX>#[IID]_CHANGES.md`, `<PREFIX>#[IID]_REVIEW.md`, `<PREFIX>#[IID]_TEST_RESULTS.md`
- `UT_#[IID]_[YYYYMMDD]_V1.txt` (full PHPUnit run, AdminPage only)
- `screenshots/` (tester UI screenshots)

`round-1` is the initial run; each re-run opens the next round and **never modifies a prior
round**. Hidden tracking lives in `.walkthrough/.pipeline/<PREFIX>#[IID]/`
(`RAW_TICKET_DATA.json`, `TICKET_SUMMARY.md`, `pipeline-state.json` with `current_round`).

`<PREFIX>` is `AP` or `FE`, decided from the ticket URL.

## GitLab (read-only)

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`.
- URL regex: `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`.
- ⛔ Never POST/PUT/DELETE. Never print the token.

## Database (non-interactive: `-i`, not `-it`)

Resolve config first, then query (read-only):

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# Production data
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; SHOW TABLES;"
# Testing data (fixed name, imported during PHPUnit runs)
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE testing_DB; SHOW TABLES;"
```

### Source paths (read the real code)

`config.mjs env` also exports absolute host paths to each module. Resolve them before reading source; never assume cwd is a repo checkout:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_SRC_ROOT, $US_SRC_ADMIN_PAGE, $US_SRC_FRONT_END, $US_SRC_COMMON_HELPER, $US_SRC_COMMON_MODELS
grep -rn "some_symbol" "$US_SRC_ADMIN_PAGE/application"
```

`source.root` defaults to the workspace you opened Claude in; override with the `SOURCE_ROOT` env var or `source.root` in the local config.

## MCP (tester)

Browser verification uses the Playwright and/or chrome-devtools MCP servers. The tester drives the affected UI flow and snapshots when useful.

## Branches, Base & Protected Branches

- **Base branch:** always create feature branches from `v3-master`. Fetch first: `git fetch origin && git checkout v3-master && git pull`.
- **⛔ Protected — NEVER commit, push, force-push, rebase, or otherwise modify these branches (local or remote):** `master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`. Before any `git commit`/`git push`, verify the current branch is NOT one of these — abort if it is.
- **Branch naming.** The *origin repo* is the repo the ticket URL belongs to (`AdminPage` or `FrontEnd`).
  - Origin repo: `feature/v3/#[IID]`
  - Every OTHER repo that is changed: `feature/v3/[ORIGIN_REPO]#[IID]`

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

## Commit Message

Format: `#[IID] - [Message]` — single imperative subject line, English.
Example: `#1834 - Remove the price form from the product editing screen`.

## Submodules (common-models / common-helper)

| Submodule     | Canonical source (EDIT HERE) | Consumed in apps (do NOT edit here)                                          |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| common-models | `submodules/common-models/`  | `AdminPage/application/models/common`, `FrontEnd/application/models/common`   |
| common-helper | `submodules/common-helper/`  | `AdminPage/application/helpers/common`, `FrontEnd/application/helpers/common` |

**Edit flow (common code is edited ONLY in the canonical source, never inside the apps):**
1. In the canonical source (`submodules/common-models` or `submodules/common-helper`): `git fetch origin && git checkout v3-master && git pull && git checkout -b feature/v3/[ORIGIN]#[IID]`.
2. Edit the files there; commit with the `#[IID] - …` message.
3. **Push** the submodule feature branch to remote (required so the apps can pull it).
4. In each consuming app that needs the change, cd into the consuming path (`application/models/common` or `application/helpers/common`) and run `git fetch origin && git checkout feature/v3/[ORIGIN]#[IID] && git pull` — this moves the app's submodule pointer to the updated branch.

Only common-submodule feature branches are pushed; AdminPage/FrontEnd app branches are committed locally only (no push, no MR).

**Human helpers (zsh, run from inside an app repo)** — interactive; the agent runs the equivalent plain `git` commands instead, but these document the intended paths/ops:
- `ussub` — show submodule branch status (`application/models/common`, `application/helpers/common`).
- `ussub_gp` — fetch + pull the current branch of both submodules.
- `ussub_gbf` — fzf-pick a submodule + branch, then checkout + pull (interactive → agent uses plain `git checkout`/`git pull`).

## Rules

- `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md`, `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.
- Reference screens: `_docs/ECSITE_SCREENS.md` (verify ECSite user-facing impact).
