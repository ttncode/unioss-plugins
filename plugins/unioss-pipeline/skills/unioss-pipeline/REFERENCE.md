---
name: unioss-pipeline reference
---

# UNIOSS Pipeline — Shared Reference

Single source of truth for every stage. When a skill says "follow REFERENCE → Shared stage rules", apply the block below.

## Shared stage rules

Every stage skill (investigator, planner, coder, reviewer, tester, ship, api-spec, gitlab-context) follows these:

- **Read this file first.** Its Branch, Protected-branch, Submodule, and Commit rules are binding.
- **Read-only by default.** Never edit project source. `Write` only under `.walkthrough/`. The only writers are the coder (`unioss-pipeline:unioss-implement`), ship (push + MR), and the standalone `unioss-mr-feedback` (edit + push, never MR — see GitLab below).
- **Round path.** The orchestrator passes the round folder `.walkthrough/<PREFIX>-[IID]/round-<N>/` in your prompt. Write all artifacts there — never into a different round.
- **Resolve config before shell/DB/source access.** Run `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` first; never hardcode hosts, containers, paths, or the protected-branch list.
- **Artifact paths.** Surface every artifact as an absolute path in backticks, on its own line, the moment it is written (see Artifact paths) — never a `file://` URL or a relative path.
- **Return summaries, not bodies.** Return counts, verdicts, and links; never paste full artifact contents back to the orchestrator.
- **Asking the user:** when a stage must ask a question, present it as superpowers-style **multiple-choice** options (2–4 concrete choices, a recommended one first) rather than open-ended prose — one question at a time.

### Standalone use

Any stage skill can be invoked directly (e.g. `/unioss-review Review this controller …`) with no orchestrator context — no ticket, no round path. When that happens:

- Do the task on the named file(s) using this skill's rules and domain knowledge.
- Write nothing under `.walkthrough/` (no round folders, no artifacts, no state) unless the user explicitly asks for a written file.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections describe.

## Configuration (resolved at runtime)

All per-machine values come from `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs"` (resolution: env → `.walkthrough/.config/unioss.config.json` → built-in default). Do not hardcode these — resolve them.

- **Per-machine overrides** (source paths, container names, DB password, ship identities) live in `.walkthrough/.config/unioss.config.json` or environment variables — never edit `config.mjs` DEFAULTS on a shared machine. Run `/unioss-doctor` to detect and fix mismatches.
- **Progress tracking:** when a skill has a numbered Workflow, create a todo per step and check each off as you go — the visible checklist keeps long gated runs auditable.

A **module key** (`admin-page`, `front-end`, `common-helper`, `common-models`) is the one vocabulary: `source.modules` gives its path on disk, `gitlab.projects` gives its project id. Keys are ordered by how likely they are to need changing — per-machine first, project-wide last.

| Key                                        | Default                                                   | Used for                                             |
| ------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------- |
| `source.root`                              | current workspace (cwd)                                   | host root that holds the module checkouts            |
| `source.modules.<key>`                     | `AdminPage`, `FrontEnd`, `common-helper`, `common-models` | **the** on-disk path per module                      |
| `docker.mysql` / `docker.php`              | `mysql-unioss3` / `php-unioss3`                           | container names                                      |
| `db.name` / `db.user` / `db.password`      | `_unioss` / `root` / `ProotW`                             | DB access for investigation/read-only stages (production dump) — tester queries the app's own configured schema instead, see `unioss-verify/tester-access.md` |
| `ship.assignee`                            | `null` → auto (the `GITLAB_TOKEN` owner)                  | MR assignee (both modes); set a username to override |
| `ship.label`                               | `UNIOSS 3`                                                | MR label if it exists on the project                 |
| `ship.staging.targetBranch` / `.reviewer`  | `v3-develop-tps` / `dat.pham`                             | internal-staging MR target + reviewer                |
| `ship.customer.targetBranch` / `.reviewer` | `v3-develop` / `r.yosimura`                               | customer-staging MR target + reviewer                |
| `gitlab.host`                              | `gitlab.unioss.jp`                                        | API + image URLs                                     |
| `gitlab.projects.<key>`                    | `32`, `31`, `18`, `19`                                    | GitLab project id per module                         |
| `gitlab.baseBranch`                        | `v3-master`                                               | base for feature branches                            |
| `gitlab.protected`                         | `master, v3-master, develop, v3-develop, v3-develop-tps`  | never-write list (enforced by a hook)                |
| `artifactRoot`                             | `.walkthrough`                                            | output dir                                           |

- **Secrets:** `GITLAB_TOKEN` is env-only (required). `db.password` resolves env `DB_PASSWORD` → file → default.
- `testing_DB` is a fixed codebase constant — not configurable.
- **Missing config → init it first.** If `.walkthrough/.config/unioss.config.json` does not exist, run `config.mjs init` before anything else (no-op when it already exists).
- **Scaffold / inspect:** `config.mjs init` → `.walkthrough/.config/unioss.config.json`; `config.mjs print`; `config.mjs check` (run by `/unioss-doctor`); `config.mjs scan [--write]` locates source modules when the configured paths are wrong.

## Repos & prefixes

| Module key      | Repo          | GitLab Project ID | Ticket prefix |
| --------------- | ------------- | ----------------- | ------------- |
| `admin-page`    | AdminPage     | 32                | `AP#[IID]`    |
| `front-end`     | FrontEnd      | 31                | `FE#[IID]`    |
| `common-helper` | common-helper | 18                | —             |
| `common-models` | common-models | 19                | —             |

Paths are **not** listed here — they are per-machine and live only in `source.modules.<key>` (run `/unioss-doctor` to see the resolved value, or `config.mjs scan --write` to repair them).

The two apps are CodeIgniter 3 / PHP 8.1. Only divergence: FrontEnd skips PHPUnit unit tests. `<PREFIX>` (`AP`/`FE`) is decided from the ticket URL — the submodules never own a ticket, but they do get their own MR when changed (`/unioss-ship`). The `AP#[IID]`/`FE#[IID]` form is the **display label**; the on-disk artifact folder swaps `#` for `-` (`AP-[IID]`), while branches and commit messages keep the `#` (git/GitLab convention).

## Artifact layout (project root `.walkthrough/`)

- **Invariant:** artifacts always live in `<cwd>/.walkthrough/` — the workspace you opened Claude in — never under the plugin install dir.
- **On-disk ticket folder uses a hyphen: `<PREFIX>-[IID]/` (e.g. `AP-1583`, `FE-347`) — never `#`.** `<PREFIX>#[IID]` is the display label only (reports, banners, GitLab refs); a `#` in a path breaks the shell, breaks URLs, and breaks the IDE's click-to-open. Branch names and commit messages keep their `#` — that is git/GitLab convention, not an artifact path.
- **Filenames are lower-kebab and carry no ticket prefix.** The path already identifies the ticket, so the file states only its role: `changes.md`, never `AP-1583_CHANGES.md`.
- Each run is a **round**. `round-1` is the initial run; each re-run opens the next round and never modifies a prior one.

**Deliverables** — the human reads these. Ticket root, span rounds, overwritten in place every round (never versioned), under `.walkthrough/<PREFIX>-[IID]/`:

- `report.md` (vi; PM-facing — the current rolled-up findings, latest round wins)
- `scope.md` (PM/QC-facing scope summary)

**Work + evidence** — the engineering trail; immutable once a round is sealed, under `.walkthrough/<PREFIX>-[IID]/round-<N>/`:

- `round-brief.md` (round 2+: what this round must do)
- `investigation.md` (detailed findings; feeds the `report.md` rollup)
- `spec.md` (what/why; `spec.v{n}.md` on an in-round revision)
- `implementation.v{n}.md`
- `changes.md`, `review.md`, `test-results.md`
- `api-spec.md` (only when a new endpoint is added)
- `UT_#[IID]_[YYYYMMDD]_V{n}.txt` (full PHPUnit run, AdminPage only)
- `screenshots/` (tester UI screenshots, `NN-*.png`, numbered for order)

**Versioning has exactly two axes:**

- `round-<N>` — one full pipeline re-run per ticket delta; prior rounds are frozen.
- `.v{n}` — the same `spec`/`implementation` re-issued _within_ a round on a gate reject (`spec.md` → `spec.v2.md`; `implementation.v1.md` → `implementation.v2.md`). Everything else overwrites in place; the round folder is the version boundary.

Hidden tracking + input, under `.walkthrough/.pipeline/<PREFIX>-[IID]/`:

- `raw-ticket-data.json`, `ticket-summary.md` (immutable ticket input)
- `pipeline-state.json` — the machine-readable **source of truth** for task state, current round, artifact map, and result. Agents read state here rather than inferring it from filenames (schema: orchestrator SKILL → State file).

## Artifact paths

- **Announce every file the moment its stage writes it — never wait for the final summary.** The instant a stage (investigator, reporter, spec, plan, coder, reviewer, scope, tester) finishes a file, print one standalone line per file so the human gets a clickable link immediately:

      📄 `/home/me/unioss/.walkthrough/AP-1583/round-1/review.md`

- **Use the ABSOLUTE path** — prefix the workspace-relative path with the workspace root (the dir that holds `.walkthrough/`; run `pwd` once if unsure). An absolute path opens directly in the IDE.
- **One file per line, each on its own line, wrapped in backticks.** Never wrap the path in a `file://` URL, a markdown link, or a table cell — those break the terminal's linkifier. On-disk paths are `#`-free (hyphenated ticket folder, lower-kebab files), so they resolve cleanly with no special handling.

## GitLab (read-only except ship + mr-feedback)

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`.
- URL regex (tickets): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- URL regex (merge requests): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/` → groups: host, namespace, repo, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`, `.../merge_requests/:iid`, `.../merge_requests/:iid/discussions?per_page=100`, `.../merge_requests/:iid/changes`.
- ⛔ GitLab **writes** are permitted in exactly two places: `/unioss-ship` (push a feature branch + `POST …/merge_requests`) and `/unioss-mr-feedback` (push a feature branch only, after the user approves the analyzed fixes — never creates or merges an MR). Never POST/PUT/DELETE during any read stage. Never merge, anywhere, ever. Never print the token. MR creation needs the `api` scope; a plain push needs `write_repository`; read stages need only `read_api`.

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
- The plugin's Playwright server is namespaced by the harness: its tools are `mcp__plugin_unioss-pipeline_playwright__browser_*` — **not** `mcp__playwright__*`. Permission rule: `mcp__plugin_unioss-pipeline_playwright` (`/unioss-doctor` offers to grant it).
- Tester URLs and credentials live in `../unioss-verify/tester-access.md` — that file is the single source. They are not config.

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
