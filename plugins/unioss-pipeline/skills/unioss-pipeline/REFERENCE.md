---
name: unioss-pipeline reference
---

# UNIOSS Pipeline — Shared Reference

Single source of truth for every stage. When a skill says "follow REFERENCE → Shared stage rules", apply the block below.

## Shared stage rules

Every stage skill (investigator, planner, coder, reviewer, tester, ship, api-spec, gitlab-context) follows these:

- **Read this file first.** Its Branch, Protected-branch, Submodule, and Commit rules are binding.
- **Read-only by default.** Never edit project source. `Write` only under `.walkthrough/`. The only writers are the coder (`unioss-implement`) and ship (push + MR).
- **Round path.** The orchestrator passes the round folder `.walkthrough/<PREFIX>#[IID]/round-<N>/` in your prompt. Write all artifacts there — never into a different round.
- **Resolve config before shell/DB/source access.** Run `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` first; never hardcode hosts, containers, paths, or the protected-branch list.
- **Clickable links.** Surface every artifact path by running `scripts/link.mjs` (see Clickable links) — never hand-write a `file://` URL or emit a bare path.
- **Return summaries, not bodies.** Return counts, verdicts, and links; never paste full artifact contents back to the orchestrator.

### Standalone use

Any stage skill can be invoked directly (e.g. `/unioss-review Review this controller …`) with no orchestrator context — no ticket, no round path. When that happens:

- Do the task on the named file(s) using this skill's rules and domain knowledge.
- Write nothing under `.walkthrough/` (no round folders, no artifacts, no state) unless the user explicitly asks for a written file.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections describe.

## Configuration (resolved at runtime)

All per-machine values come from `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs"` (resolution: env → `.walkthrough/.config/unioss.config.json` → built-in default). Do not hardcode these — resolve them.

| Key                                        | Default                                                                            | Used for                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `gitlab.host`                              | `gitlab.unioss.jp`                                                                 | API + image URLs                          |
| `repos.adminPage.id` / `.path`             | `32` / `AdminPage/`                                                                | project id, repo path                     |
| `repos.frontEnd.id` / `.path`              | `31` / `FrontEnd/`                                                                 | project id, repo path                     |
| `docker.mysql` / `docker.php`              | `mysql-unioss3` / `php-unioss3`                                                    | container names                           |
| `db.name` / `db.user` / `db.password`      | `_unioss` / `root` / `ProotW`                                                      | DB access                                 |
| `git.baseBranch`                           | `v3-master`                                                                        | base for feature branches                 |
| `git.protected`                            | `master, v3-master, develop, v3-develop, v3-develop-tps`                           | never-commit list                         |
| `ship.assignee`                            | `nghia.truong`                                                                     | MR assignee (both modes)                  |
| `ship.label`                               | `UNIOSS 3`                                                                         | MR label if it exists on the project      |
| `ship.staging.targetBranch` / `.reviewer`  | `v3-develop-tps` / `dat.pham`                                                      | internal-staging MR target + reviewer     |
| `ship.customer.targetBranch` / `.reviewer` | `v3-develop` / `r.yosimura`                                                        | customer-staging MR target + reviewer     |
| `artifactRoot`                             | `.walkthrough`                                                                     | output dir                                |
| `source.root`                              | current workspace (cwd)                                                            | host root that holds the module checkouts |
| `source.modules.*`                         | `admin-page`→`AdminPage`, `front-end`→`FrontEnd`, `common-helper`, `common-models` | on-disk subdir per module                 |

- **Secrets:** `GITLAB_TOKEN` is env-only (required). `db.password` resolves env `DB_PASSWORD` → file → default.
- `testing_DB` is a fixed codebase constant — not configurable.
- **Scaffold / inspect:** `config.mjs init` → `.walkthrough/.config/unioss.config.json`; `config.mjs print`; `config.mjs check` (run by `/unioss-doctor`).

## Repos & prefixes

| Repo      | Path (under project root) | GitLab Project ID | Ticket prefix |
| --------- | ------------------------- | ----------------- | ------------- |
| AdminPage | `AdminPage/`              | 32                | `AP#[IID]`    |
| FrontEnd  | `FrontEnd/`               | 31                | `FE#[IID]`    |

Both are CodeIgniter 3 / PHP 8.1. Only divergence: FrontEnd skips PHPUnit unit tests. `<PREFIX>` (`AP`/`FE`) is decided from the ticket URL.

## Artifact layout (project root `.walkthrough/`)

- **Invariant:** artifacts always live in `<cwd>/.walkthrough/` — the workspace you opened Claude in — never under the plugin install dir.
- Each run is a **round**. `round-1` is the initial run; each re-run opens the next round and never modifies a prior one.

Visible artifacts (the human reads these), under `.walkthrough/<PREFIX>#[IID]/round-<N>/`:

- `ROUND_BRIEF.md` (round 2+: what this round must do)
- `<PREFIX>#[IID]_INVESTIGATION.md`, `<PREFIX>#[IID]_REPORT.md` (vi)
- `<PREFIX>#[IID]_SPEC.md` (what/why; `_SPEC_V{n}` on edits)
- `<PREFIX>#[IID]_IMPLEMENTATION_V{n}.md`
- `<PREFIX>#[IID]_CHANGES.md`, `_REVIEW.md`, `_TEST_RESULTS.md`
- `<PREFIX>#[IID]_API_SPEC.md` (only when a new endpoint is added)
- `UT_#[IID]_[YYYYMMDD]_V{n}.txt` (full PHPUnit run, AdminPage only)
- `screenshots/` (tester UI screenshots)

Hidden tracking, under `.walkthrough/.pipeline/<PREFIX>#[IID]/`: `RAW_TICKET_DATA.json`, `TICKET_SUMMARY.md`, `pipeline-state.json` (holds `current_round`).

## Clickable links

- **Always run `link.mjs` — never hand-write a `file://` URL or emit a bare path.** The script handles the two things a hand-written link gets wrong: a bare `#` in a ticket dir (`AP#1583`) is mangled by the terminal linkifier (`#`→`%23`, spaces→`%20`), and under WSL a `file:///home/...` path won't open from a Windows-side editor.

  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/link.mjs" ".walkthrough/AP#1583/round-1/AP#1583_REVIEW.md"
  ```

- Output — native emits `file://`; under WSL it emits `file://wsl.localhost/<distro>/...` so a Windows editor resolves it:

      [AP#1583_REVIEW.md](file:///abs/workspace/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)

## GitLab (read-only except ship)

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`.
- URL regex: `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`.
- ⛔ The **only** permitted GitLab writes are inside `/unioss-ship` (push a feature branch + `POST …/merge_requests`). Never POST/PUT/DELETE during any read stage. Never merge. Never print the token. MR creation needs the `api` scope; read stages need only `read_api`.

## Database (read-only; non-interactive `-i`, not `-it`)

Resolve config first, then query:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# Production-shaped data
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; SHOW TABLES;"
# Testing data (fixed name, imported during PHPUnit runs)
docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE testing_DB; SHOW TABLES;"
```

## Source paths (read the real code)

`config.mjs env` exports absolute host paths to each module. Resolve them before reading source — never assume cwd is a repo checkout:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_SRC_ROOT, $US_SRC_ADMIN_PAGE, $US_SRC_FRONT_END, $US_SRC_COMMON_HELPER, $US_SRC_COMMON_MODELS
grep -rn "some_symbol" "$US_SRC_ADMIN_PAGE/application"
```

`source.root` defaults to the workspace you opened Claude in; override with the `SOURCE_ROOT` env var or `source.root` in local config.

## MCP (tester)

- Browser verification uses the Playwright and/or chrome-devtools MCP servers. The tester drives the affected UI flow and snapshots when useful.
- Tester env access resolves from config: `US_TESTER_ECSITE_LOGIN` (`http://localhost:2380/storetax/login`), `US_TESTER_MAILHOG` (`http://localhost:8225`). Login credentials are ticket/seed-specific. See `../unioss-verify/tester-access.md`.

## Branches, base & protected

- **Base branch:** always cut feature branches from `v3-master`. Fetch first: `git fetch origin && git checkout v3-master && git pull`.
- **⛔ Protected — NEVER commit, push, force-push, rebase, or modify (local or remote):** `master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`. Before any commit/push, verify the current branch is NOT one of these — abort if it is.
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

| Submodule     | Canonical source (EDIT HERE) | Consumed in apps (do NOT edit here)                                          |
| ------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| common-models | `submodules/common-models/`  | `AdminPage/application/models/common`, `FrontEnd/application/models/common`   |
| common-helper | `submodules/common-helper/`  | `AdminPage/application/helpers/common`, `FrontEnd/application/helpers/common` |

Edit flow (common code is edited ONLY in the canonical source, never inside the apps):

1. In the canonical source: `git fetch origin && git checkout v3-master && git pull && git checkout -b feature/v3/[ORIGIN]#[IID]`.
2. Edit there; commit with the `#[IID] - …` message.
3. **Push** the submodule feature branch (required so the apps can pull it).
4. In each consuming app, cd into the consuming path (`application/models/common` or `application/helpers/common`) and `git fetch origin && git checkout feature/v3/[ORIGIN]#[IID] && git pull` — moves the pointer in the **working tree only**.

**Never commit or push the pointer bump** in AdminPage/FrontEnd: do not `git add` the submodule gitlink, do not commit it, do not push the app repo for the pointer change. The pushed submodule branch alone carries the common-code change; whoever merges wires the pointer. Only submodule feature branches are pushed; app branches are committed locally only and exclude the gitlink.

Human helpers (zsh, from inside an app repo; the agent runs the equivalent plain `git`):

- `ussub` — show submodule branch status.
- `ussub_gp` — fetch + pull the current branch of both submodules.
- `ussub_gbf` — fzf-pick a submodule + branch, then checkout + pull.

## Rules & reference files

- Clean-code: `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md`, `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.
- Reference screens: `../unioss-investigate/ecsite-screens.md` (verify ECSite user-facing impact).
