---
name: unioss-pipeline reference
---

# UNIOSS Pipeline — Shared Reference (core)

Single source of truth for every stage. When a skill says "follow REFERENCE → Shared stage rules", apply the block below.

**Read only what your stage needs.** This file is the core every stage reads. Two satellites hold the rest — pull them only when your stage touches that surface:

| File                       | Contents                                                                               | Read by                              |
| -------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| `REFERENCE.md` (this file) | Shared stage rules, output style, config, repos, artifact layout + paths, GitLab reads | **every** stage                      |
| `REFERENCE-git.md`         | Branches, protected branches, commits, submodules, GitLab writes                       | coder, ship, mr-feedback             |
| `REFERENCE-data.md`        | Database access, source paths on disk, browser MCP                                     | investigator, planner, coder, tester |

## Philosophy

You are working for a Japanese client.

- Quality over speed.
- Think before every action.
- Earn trust through consistency.

## Shared stage rules

Every stage skill (investigator, planner, coder, reviewer, tester, ship, api-spec, gitlab-context) follows these:

- **Read this file first.** Its Artifact-layout and Artifact-path rules are binding. If your stage writes git (coder, ship, mr-feedback), `REFERENCE-git.md` is binding too.
- **Read-only by default.** Never edit project source. `Write` only under `.walkthrough/`. The only writers are the coder (`unioss-pipeline:unioss-implement`), ship (push + MR), and the standalone `unioss-mr-feedback` (edit + push, never MR — see `REFERENCE-git.md`).
- **Round path.** The orchestrator passes the round folder `.walkthrough/<PREFIX>-[IID]/round-<N>/` in your prompt. Write all artifacts there — never into a different round.
- **Resolve config before shell/DB/source access.** Run `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` first; never hardcode hosts, containers, paths, or the protected-branch list.
- **Artifact paths.** Surface every artifact as an absolute path in backticks, on its own line, the moment it is written (see Artifact paths) — never a `file://` URL or a relative path.
- **Return summaries, not bodies.** Return counts, verdicts, and links; never paste full artifact contents back to the orchestrator.
- **Asking the user:** when a stage must ask a question, present it as **multiple-choice** options (2–4 concrete choices, a recommended one first) rather than open-ended prose — one question at a time.
- **Ending a run — never stop on a bare result.** A finished artifact is not a finished conversation. Whenever work remains possible, close with a numbered next-action menu instead of leaving the user to guess what comes next. Skip the menu only when the work is genuinely complete and nothing sensible follows. **Subagents never ask** — return your summary and let the main thread own every question. Use this shape, recommended option first:

  ```
  <what just finished>. What would you like to do?

  1. <recommended next action>
  2. <alternative>
  3. <stop / defer>

  Which option?
  ```
- **Task tracking:** For multi-step workflows (≥3 sequential steps), use native `Todo` tools if supported; otherwise create `task-progress.md` via `write_to_file` (`- [ ]`) and mark steps done via `replace_file_content` (`- [x]`). Skip for short or single-step tasks.

### Output & Style Rules

- **Format:** Scannable, structured output (tables for summaries/metrics, bulleted lists for key details).
- **Tone:** Concise, objective, technical prose. Avoid fluff, filler phrases, or redundant intros/outros.
- **Paths:** Always surface files as backticked absolute paths (`/abs/path/file.md`), one per line.

### Standalone use

Any stage skill can be invoked directly (e.g. `/unioss-review Review this controller …`) with no orchestrator context — no ticket, no round path. When that happens:

- Do the task on the named file(s) using this skill's rules and domain knowledge.
- Write nothing under `.walkthrough/` (no round folders, no artifacts, no state) unless the user explicitly asks for a written file.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections describe.

## Configuration (resolved at runtime)

All per-machine values come from `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs"` (resolution: env → `.walkthrough/.config/unioss.config.json` → built-in default). Do not hardcode these — resolve them.

- **Per-machine overrides** (source paths, container names, DB password, ship identities) live in `.walkthrough/.config/unioss.config.json` or environment variables — never edit `config.mjs` DEFAULTS on a shared machine. Run `/unioss-doctor` to detect and fix mismatches.

A **module key** (`admin-page`, `front-end`, `common-helper`, `common-models`) is the one vocabulary: `source.modules` gives its path on disk, `gitlab.projects` gives its project id. Keys are ordered by how likely they are to need changing — per-machine first, project-wide last.

| Key                                        | Default                                                   | Used for                                                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source.root`                              | current workspace (cwd)                                   | host root that holds the module checkouts                                                                                                                     |
| `source.modules.<key>`                     | `AdminPage`, `FrontEnd`, `common-helper`, `common-models` | **the** on-disk path per module                                                                                                                               |
| `docker.mysql` / `docker.php`              | `mysql-unioss3` / `php-unioss3`                           | container names                                                                                                                                               |
| `db.name` / `db.user` / `db.password`      | `_unioss` / `root` / `ProotW`                             | DB access for investigation/read-only stages (production dump) — tester queries the app's own configured schema instead, see `unioss-verify/tester-access.md` |
| `ship.assignee`                            | `null` → auto (the `GITLAB_TOKEN` owner)                  | MR assignee (both modes); set a username to override                                                                                                          |
| `ship.label`                               | `UNIOSS 3`                                                | MR label if it exists on the project                                                                                                                          |
| `ship.staging.targetBranch` / `.reviewer`  | `v3-develop-tps` / `dat.pham`                             | internal-staging MR target + reviewer                                                                                                                         |
| `ship.customer.targetBranch` / `.reviewer` | `v3-develop` / `r.yosimura`                               | customer-staging MR target + reviewer                                                                                                                         |
| `gitlab.host`                              | `gitlab.unioss.jp`                                        | API + image URLs                                                                                                                                              |
| `gitlab.projects.<key>`                    | `32`, `31`, `18`, `19`                                    | GitLab project id per module                                                                                                                                  |
| `gitlab.baseBranch`                        | `v3-master`                                               | base for feature branches                                                                                                                                     |
| `gitlab.protected`                         | `master, v3-master, develop, v3-develop, v3-develop-tps`  | never-write list (enforced by a hook)                                                                                                                         |
| `artifactRoot`                             | `.walkthrough`                                            | output dir                                                                                                                                                    |

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

## GitLab (reads)

Every stage may read GitLab. **Writes are a different surface — see `REFERENCE-git.md` → GitLab writes.**

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`. Never print the token. Read stages need only the `read_api` scope.
- URL regex (tickets): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- URL regex (merge requests): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/` → groups: host, namespace, repo, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`, `.../merge_requests/:iid`, `.../merge_requests/:iid/discussions?per_page=100`, `.../merge_requests/:iid/changes`.
- ⛔ Never POST/PUT/DELETE during any read stage. Never merge, anywhere, ever.

## Rules & reference files

- Clean-code: `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md`, `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.
- Reference screens: `../unioss-investigate/ecsite-screens.md` (verify ECSite user-facing impact).
- Git surface: `./REFERENCE-git.md`. Data + MCP surface: `./REFERENCE-data.md`.
