<div align="center">
  <h1>🛠️ unioss-pipeline</h1>
  <p>
    <strong>An A→Z, human-gated ticket pipeline for the UNIOSS team.</strong><br>
    A GitLab ticket in — an investigated, planned, coded, reviewed, tested, ship-ready change out.
  </p>

[![version](https://img.shields.io/badge/version-1.6.0-blue)](./plugins/unioss-pipeline/.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-82%20passing-brightgreen)](#)
[![PHP](https://img.shields.io/badge/PHP-8.1-777bb4)](#)
[![CodeIgniter](https://img.shields.io/badge/CodeIgniter-3.x-ee4323)](#)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](#)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

<sub>A Claude Code plugin by <strong>ttncode</strong>.</sub>

</div>

---

## Why use it

**⚡ Fast setup**

- Two commands to install; `/unioss-doctor` checks deps, containers, token, and browser.
- **Zero config** on a standard UNIOSS box — defaults for containers, GitLab host, project IDs, repos, branches, and DB.
- Override only what differs, in one gitignored file.

**🤖 Automation (A→Z)**

- Reads the GitLab ticket **+ linked issues**, the production DB, and real module source.
- Runs every stage for you: Investigate → Spec → Plan → Code → Review → Verify → Ship.
- **Rounds** — customer feedback continues on the same ticket; prior work stays frozen.
- **One command** opens the staging / customer MRs with the right branch, reviewers, and options.

**✅ Quality & safety**

- **Human-gated** — stops at 4 gates (spec, plan, review, ship). No runaway edits.
- Review enforces the UNIOSS **CI3 + PHP 8.1 clean-code + security** checklist.
- **Real tests** — PHPUnit in Docker; UI driven in a real browser (Playwright) with screenshots.
- Never commits or pushes a **protected branch**.

## Pipeline

```
╭─ UNIOSS Pipeline · AP#1834 · round-1 ────────────────────────────────╮
│                                                                      │
│  #   Stage        Runs as            Output                          │
│  ───────────────────────────────────────────────────────────────     │
│  1   Investigate  subagent · opus    INVESTIGATION + REPORT          │
│  ⛔  GATE 0       you                clarify (only if unclear)       │
│  2   Spec         subagent · opus    SPEC.md                         │
│  ⛔  GATE 1       you                approve spec / edit             │
│  3   Plan         subagent · opus    IMPLEMENTATION_V1               │
│  ⛔  GATE 2       you                approve plan / edit             │
│  4   Code         main · sonnet      CHANGES.md + fast tests         │
│  5   Review       subagent · opus    REVIEW.md                       │
│  ⛔  GATE 3       you                fix / accept                    │
│  6   Verify       subagent · sonnet  TEST_RESULTS.md (DB+UI)         │
│  7   Finalize     main               branch + commit (no push/MR)    │
│                                                                      │
│  Gates stop for approval. Nothing runs until you confirm.            │
╰──────────────────────────────────────────────────────────────────────╯
```

Artifacts land in `.walkthrough/<PREFIX>#<IID>/round-<N>/` as clickable links.

## Commands

| Command                                   | Use it when                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `/unioss-pipeline <gitlab-url>`           | A **new ticket** — run the full A→Z pipeline.                            |
| `/unioss-feedback <gitlab-url>`           | **Customer feedback** — continue in a new round, not a restart.          |
| `/unioss-task <description>`              | An **ad-hoc task** with no GitLab ticket.                                |
| `/unioss-ship staging \| customer`        | **Ship** — open the MR into `v3-develop-tps` / `v3-develop`.             |
| `/unioss-api-spec <endpoint\|controller>` | **API spec** — write the house-template spec for a new/changed endpoint. |
| `/unioss-doctor`                          | **Check** deps, containers, token, browser.                              |

## Skills

Grouped by pipeline stage. Each stage skill also runs standalone (`/skill-name <args>`).

| Stage       | Skill                                          | Does                                                                |
| ----------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Orchestrate | `unioss-pipeline`                              | Proceed a ticket from A to Z (6 stages + 3 gates).                  |
| Fetch       | `unioss-gitlab-issue-context`                  | Fetch GitLab ticket + linked issues into `.walkthrough/.pipeline/`. |
| Investigate | `unioss-investigate`                           | Investigate ticket + linked issues                                  |
| Plan        | `unioss-plan`                                  | Plan mode (exact per-file code + points).                           |
| Code        | `unioss-implement`                             | Implement code changes                                              |
| Review      | `unioss-review`                                | Review code changes against the CI3 + PHP 8.1 + security checklist. |
| Verify      | `unioss-verify`                                | DB checks + browser-driven UI verification with screenshots.        |
| Ship        | `unioss-ship`                                  | Open an MR per touched repo (apps + submodules). Never merges.      |
| Clarify     | `unioss-brainstorming`, `unioss-writing-plans` | GATE-0 clarify + plan structuring (superpowers-style).              |

## Install

- `/plugin marketplace add https://github.com/ttncode/ttnplugins`
- `/plugin install unioss-pipeline`
- `/unioss-doctor` — verify the environment.

## Usage

- New ticket — `/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834`
- Feedback (new round) — `/unioss-feedback <gitlab-url>`
- No ticket — `/unioss-task "Add a CSV export button to the sales-ledger screen"`
- Ship — `/unioss-ship staging` → `v3-develop-tps`; `/unioss-ship customer` (syncs `v3-master`, re-runs tests) → `v3-develop`

## Configuration

- **Scaffold:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init` → `.walkthrough/.config/unioss.config.json`
- **Resolution:** env → file → default, deep-merged — set only the keys you change.
- **Inspect / validate:** `config.mjs print` · `config.mjs check` (`/unioss-doctor` runs check).
- **Wrong module paths:** `config.mjs scan` locates them; `scan --write` repairs the config (`/unioss-doctor` offers this).
- **Secrets (env only):** `GITLAB_TOKEN` (required) · `DB_PASSWORD` (optional).
- **Tester browser:** `! npx playwright install --with-deps chrome` if Chrome is missing.

## Requirements

| Dependency                               | Required | Notes                  |
| ---------------------------------------- | :------: | ---------------------- |
| Node.js                                  |    ✅    | Hooks and scripts      |
| jq                                       |    ✅    | JSON processing        |
| Docker + `mysql-unioss3` + `php-unioss3` |    ✅    | DB + PHP runtime       |
| `GITLAB_TOKEN` env var                   |    ✅    | GitLab API access      |
| Google Chrome                            |    ⭐    | Tester UI verification |

Run `/unioss-doctor` to check them all at once.

## License

[MIT](LICENSE)
