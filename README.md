<div align="center">
  <h1>🛠️ UNIOSS Plugin</h1>
  <p>
    <strong>An A→Z, human-gated ticket pipeline for the UNIOSS team.</strong><br>
    A GitLab ticket in — an investigated, planned, coded, reviewed, tested, ship-ready change out.
  </p>

[![version](https://img.shields.io/badge/version-1.11.1-blue)](./plugins/unioss-pipeline/.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-94%20passing-brightgreen)](#)
[![PHP](https://img.shields.io/badge/PHP-8.1-777bb4)](#)
[![CodeIgniter](https://img.shields.io/badge/CodeIgniter-3.x-ee4323)](#)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](#)
[![license](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

<sub>A Claude Code plugin by <strong>ttncode</strong>.</sub>

</div>

---

## Why use it

**⚡ Fast setup**

- Two commands to install; `/unioss-doctor` checks deps.
- **Zero config** on a standard UNIOSS environment.
- Every setting in one file `config.mjs`.

**🤖 Automation (A→Z)**

- Reads the GitLab ticket **+ linked issues**, analyzes the dumped production DB and codebase.
- Runs all the stages automatically: **Investigate → Spec → Plan → Code → Review → Verify → Ship**.
- **Rounds** — customer feedback continues with new rounds on the same ticket.
- **One command** opens the staging / customer MRs with the right branch, reviewers, and options.

**✅ Quality & safety**

- **Human-gated** — stops at 4 gates (spec, plan, review, ship). No runaway edits.
- Review enforces the UNIOSS **CI3 + PHP 8.1 clean-code + security** checklist.
- **Real tests** — PHPUnit in Docker; UI driven in a real browser (Playwright) with screenshots.
- Never commits or pushes a **protected branch** — a hook blocks it, not just a rule in a doc.

**🧠 Team knowledge**

- Every ticket auto-summarized (WWWH) — ask what happened today, this week, or on any past ticket without digging through GitLab.
- Ask free-form questions like "what did customers complain about this week?" and get an answer, not a search.
- Facts and rules learned from past tickets carry forward automatically into new investigations, so the pipeline gets sharper over time.

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

Artifacts land in `.walkthrough/<PREFIX>#<IID>/round-<N>/`, surfaced as Ctrl+Click-able paths.

## Commands

**Pipeline** (`unioss-pipeline` plugin)

| Command                                   | What                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/unioss-pipeline <gitlab-url>`           | New ticket — e.g. `/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834`          |
| `/unioss-feedback <gitlab-url>`           | Customer feedback — continues in a new round, not a restart                                               |
| `/unioss-task "<description>"`            | No ticket — e.g. `/unioss-task "Add a CSV export button to the sales-ledger screen"`                      |
| `/unioss-mr-feedback <mr-url> [...]`      | Verifies and applies another developer's review comments — standalone, not part of the A→Z pipeline       |
| `/unioss-ship staging`                    | MR into `v3-develop-tps` — previews the plan and waits for "Proceed?" first                               |
| `/unioss-ship customer`                   | MR into `v3-develop` — syncs `v3-master`, re-runs tests, previews the plan and waits for "Proceed?" first |
| `/unioss-api-spec <endpoint\|controller>` | Write the house-template API spec for a new/changed endpoint                                              |
| `/unioss-doctor`                          | Check deps, containers, token, browser                                                                    |

**Knowledge** (`unioss-knowledge` plugin)

| Command                                              | What                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/unioss-knowledge-today`                            | Today's new tickets, summarized (WWWH)                                                     |
| `/unioss-knowledge-ticket <gitlab-url>`              | Summarize one ticket                                                                       |
| `/unioss-knowledge-ask "<question>" [period]`        | Ask anything — e.g. `/unioss-knowledge-ask "What did customers complain about this week?"` |
| `/unioss-knowledge-refresh [daily\|weekly\|monthly]` | Refresh from tickets — run `/unioss-knowledge-approve` after                               |
| `/unioss-knowledge-approve`                          | Approve staged rules — only then injected into the agents' brain                           |
| `/unioss-knowledge`                                  | Status — freshness of the knowledge base                                                   |

## Install

- `/plugin marketplace add https://github.com/ttncode/ttnplugins`
- `/plugin install unioss-pipeline` · `/plugin install unioss-knowledge`
- `/unioss-doctor` — verify the environment.

## Usage

Typical working combos:

**A ticket, start to ship**

1. `/unioss-knowledge-ticket <gitlab-url>` — quick WWWH read before committing to it _(optional)_
2. `/unioss-pipeline <gitlab-url>` — full A→Z run, approve at each gate
3. `/unioss-ship staging` — open the staging MR

**Customer feedback on a shipped ticket**

1. `/unioss-feedback <gitlab-url>` — new round on the same ticket
2. `/unioss-ship staging` — re-ship
3. `/unioss-ship customer` — when staging is confirmed OK

**Morning catch-up**

1. `/unioss-knowledge-today` — what came in today, WWWH per ticket
2. `/unioss-knowledge-ask "What did customers complain about this week?"` — dig into anything

**Weekly knowledge upkeep** (keeps agents sharp)

1. `/unioss-knowledge-refresh weekly` — distill sentiment, rebuild the global brief, stage rules
2. `/unioss-knowledge-approve` — review staged rules; approved ones are injected into every agent session
3. `/unioss-knowledge` — confirm freshness

**Something broke?** — `/unioss-doctor` first.

## Configuration

One file holds everything: `.walkthrough/.config/unioss.config.json` (gitignored, shared by both plugins). `/unioss-doctor` creates it for you.

- **Scaffold:** `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init` — writes every key, grouped per-machine → per-team → project-wide.
- **Resolution:** env → file → default, deep-merged.
- **Module keys** (`admin-page`, `front-end`, `common-helper`, `common-models`) are the one vocabulary: `source.modules.<key>` is its path on disk, `gitlab.projects.<key>` is its GitLab project id.
- **Inspect / validate:** `config.mjs print` · `config.mjs check` (`/unioss-doctor` runs check).
- **Wrong module paths:** `config.mjs scan` locates them; `scan --write` repairs the file (`/unioss-doctor` offers this).
- **Secrets (env only):** `GITLAB_TOKEN` (required) · `DB_PASSWORD` (optional).
- **Tester browser:** `! npx playwright install --with-deps chrome` if Chrome is missing.
- **Tester URLs/credentials** are not config — they live in `skills/unioss-verify/tester-access.md`.

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
