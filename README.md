<div align="center">
  <h1>🛠️ unioss-pipeline</h1>
  <p>
    <strong>An A→Z, human-gated ticket pipeline for the UNIOSS team.</strong><br>
    Turn a GitLab ticket into an investigated, planned, coded, reviewed, tested, and ship-ready change —
    without ever losing control of what the agent does.
  </p>

  [![version](https://img.shields.io/badge/version-1.5.0-blue)](./plugins/unioss-pipeline/.claude-plugin/plugin.json)
  [![tests](https://img.shields.io/badge/tests-49%20passing-brightgreen)](#)
  [![PHP](https://img.shields.io/badge/PHP-8.1-777bb4)](#)
  [![CodeIgniter](https://img.shields.io/badge/CodeIgniter-3.x-ee4323)](#)
  [![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](#)
  [![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

  <sub>A Claude Code plugin by <strong>ttncode</strong>.</sub>
</div>

---

## Table of Contents

- [Why use it](#why-use-it)
- [The pipeline at a glance](#the-pipeline-at-a-glance)
- [Commands](#commands)
- [What each stage does](#what-each-stage-does)
- [Install](#install)
- [Usage](#usage)
- [Configuration](#configuration)
- [Re-running a ticket (rounds)](#re-running-a-ticket-rounds)
- [Requirements](#requirements)
- [License](#license)

## Why use it

You already do investigation, planning, coding, review, testing, and shipping by hand for every UNIOSS ticket. This plugin does the mechanical parts for you and **stops at every decision point so you stay in charge**.

**TL;DR — what you get**

- **You approve every step.** The pipeline halts at four gates (spec, plan, review, ship). Nothing runs past a gate without your explicit go-ahead — no runaway edits, no surprise commits.
- **It reads the real world, not guesses.** Pulls the GitLab ticket *and its linked issues*, describes the affected production tables, and greps the actual AdminPage / FrontEnd / common-models / common-helper source on disk.
- **It knows UNIOSS rules.** Review enforces the team's CodeIgniter 3 + PHP 8.1 clean-code and security checklist — XSS filtering, CSRF, `SELECT *`, migration conventions, language files, and more — automatically.
- **Real verification, not vibes.** PHPUnit runs inside the UNIOSS Docker containers; the affected UI flow is driven in a real browser via the bundled Playwright MCP, with screenshots.
- **Iterate without starting over.** Customer feedback opens a new **round** on the same ticket — prior work is frozen, never overwritten.
- **One command to ship.** Generates the exact staging / customer-staging merge-request links with the right branch names, reviewers, and merge options — and never touches a protected branch.
- **Zero config on a standard setup.** Sensible built-in defaults for containers, GitLab host, project IDs, repos, branches, and the local DB. Override only what differs on your machine.

## The pipeline at a glance

```
╭─ UNIOSS Pipeline · AP#1834 · round-1 ─────────────────────────────────╮
│                                                                       │
│   #    Stage         Runs as            Output                        │
│  ─────────────────────────────────────────────────────────────────    │
│   1    Investigate   subagent · opus    INVESTIGATION + REPORT        │
│   ⛔   GATE 0        you                clarify (only if unclear)     │
│   2    Spec          subagent · opus    SPEC.md                       │
│   ⛔   GATE 1        you                approve spec / edit           │
│   3    Plan          subagent · opus    IMPLEMENTATION_V1             │
│   ⛔   GATE 2        you                approve plan / edit           │
│   4    Code          main · sonnet      CHANGES.md + fast tests       │
│   5    Review        subagent · opus    REVIEW.md                     │
│   ⛔   GATE 3        you                fix / accept                  │
│   6    Verify        subagent · sonnet  TEST_RESULTS.md (DB+UI)       │
│   7    Finalize      main               branch + commit (no push/MR)  │
│                                                                       │
│   Gates stop for approval. Nothing runs until you confirm.            │
╰───────────────────────────────────────────────────────────────────────╯
```

Every artifact is written under `.walkthrough/<PREFIX>#<IID>/round-<N>/` and surfaced as a clickable link you can open straight from the terminal.

## Commands

| Command | Use it when |
| ------- | ----------- |
| `/unioss-pipeline <gitlab-url>` | A **new ticket** lands — run the full A→Z pipeline. |
| `/unioss-feedback <gitlab-url>` | **Customer feedback** on a shipped ticket — continue in a new round from the GitLab comments, not a restart. |
| `/unioss-task <description>` | An **ad-hoc task** with no GitLab ticket — a direct request, minor fix, or spike. |
| `/unioss-ship staging \| customer` | **Ship it** — open the merge request into `v3-develop-tps` (staging) or `v3-develop` (customer staging). |
| `/unioss-doctor` | **Check your environment** — dependencies, containers, token, browser. |

## What each stage does

| Stage | Status | Description |
| ----- | :----: | ----------- |
| **Investigate** | 🔎 | Fetches the ticket + all linked issues, maps code impact (`file:line`), describes affected DB tables, and writes an English investigation plus a Vietnamese scope report. |
| **Spec** | 📋 | Distills the *what/why* — scope, requirements, acceptance criteria — with **no code**, for a fast approval before any implementation detail exists. |
| **Plan** | 🧭 | Produces an implementation plan with **exact per-file code**, phased steps, and story-point estimates. |
| **Code** | ⌨️ | The only writer. Applies the approved plan, runs migrations when needed, and fast-verifies new PHPUnit tests. |
| **Review** | 🛡️ | Diff-scoped review against the UNIOSS CI3 + PHP clean-code and **security** checklist, severity-indexed. |
| **Verify** | ✅ | Confirms DB changes landed and drives the affected UI flow in a real browser, with a per-criterion pass/fail table and screenshots. |
| **Ship** | 🚀 | Pushes the feature branch and opens pre-filled merge requests with the correct reviewers and options — never merging, never touching a protected branch. |

## Install

```
/plugin marketplace add https://github.com/ttncode/ttnplugins
/plugin install unioss-pipeline
/unioss-doctor
```

`/unioss-doctor` checks your environment and guides you through any missing dependencies.

## Usage

```
/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834
```

The pipeline prints the plan above and **stops for your approval at each gate**. Continue an existing ticket from feedback, or run a ticket-less task:

```
/unioss-feedback https://gitlab.unioss.jp/unioss/FrontEnd/-/issues/391
/unioss-task "Add a CSV export button to the sales-ledger screen"
```

When the work is accepted, ship it:

```
/unioss-ship staging      # → merge request into v3-develop-tps
/unioss-ship customer     # sync v3-master, re-run tests, → merge request into v3-develop
```

## Configuration

Works with **zero configuration** on a standard UNIOSS setup — built-in defaults cover container names, GitLab host, project IDs, repo paths, branches, ship targets/reviewers, and the local DB.

To override anything for your machine, scaffold a local (gitignored) file at the UNIOSS workspace root:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init   # creates .walkthrough/.config/unioss.config.json
```

Resolution order is **env → this file → built-in default**, deep-merged, so the file only needs the keys you change:

```json
{ "docker": { "mysql": "unioss-db-local", "php": "unioss-php-81" } }
```

Inspect what is resolved (secrets redacted) and validate your setup:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" print
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" check
```

`/unioss-doctor` runs `check` for you.

**Secrets stay in the environment, never committed:**

- `GITLAB_TOKEN` — **required**, env only (`export GITLAB_TOKEN=…`).
- `DB_PASSWORD` — optional; defaults to the local-DB password. Since the config file is gitignored, you may instead set `db.password` in it.

`testing_DB` is a fixed name in the UNIOSS codebase and is intentionally not configurable.

### Source paths

Agents read module source from host paths resolved by `scripts/config.mjs`: `source.root` (defaults to the workspace you open Claude in) plus one subdir per module — `admin-page`, `front-end`, `common-helper`, `common-models`. Override `source.root` with the `SOURCE_ROOT` env var or in the local `.walkthrough/.config/unioss.config.json`. Resolved paths are exported as `US_SRC_ROOT`, `US_SRC_ADMIN_PAGE`, `US_SRC_FRONT_END`, `US_SRC_COMMON_HELPER`, `US_SRC_COMMON_MODELS`.

### Browser for the tester

The tester drives a real browser through the bundled Playwright MCP (branded Chrome). If `unioss-doctor` reports Chrome missing, install it in a real terminal (the password prompt needs a TTY):

    ! npx playwright install --with-deps chrome

## Re-running a ticket (rounds)

Re-running a ticket that already has outputs — or continuing from customer feedback via `/unioss-feedback` — opens a new **round**. The full investigate → plan → implement → review → verify process runs again, but each round only does the work requested for it, and **every prior round is frozen** — nothing is overwritten.

```
.walkthrough/AP#1834/
  round-1/   first run's investigation, plan, changes, review, test results
  round-2/   a later requirement — round-1 untouched
```

Round 2+ starts from a `ROUND_BRIEF.md` describing just that round's change (from the updated ticket and/or your instruction). All rounds share the ticket's one feature branch; later rounds add commits on top.

## Requirements

| Dependency                | Required | Notes                         |
| ------------------------- | :------: | ----------------------------- |
| Node.js                   | ✅       | Runtime for hooks and scripts |
| jq                        | ✅       | JSON processing               |
| Docker                    | ✅       | Container runtime             |
| `mysql-unioss3` container | ✅       | Database                      |
| `php-unioss3` container   | ✅       | PHP runtime                   |
| `GITLAB_TOKEN` env var    | ✅       | GitLab API access             |
| Google Chrome             | ⭐       | Tester UI verification (Playwright MCP) |

Run `/unioss-doctor` to check all dependencies at once.

## License

[MIT](LICENSE)
