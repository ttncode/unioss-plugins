# UNIOSS Pipeline Optimization v2 — Design

**Date:** 2026-07-10
**Plugin:** `plugins/unioss-pipeline` (currently v1.4.0)
**Status:** Approved for planning

Seven independent improvements to the UNIOSS pipeline plugin. Each is self-contained; they share no runtime state and can be implemented and verified in isolation.

---

## 1. Rename `.walkthrough/config` → `.walkthrough/.config`

**Why:** the config dir should sit with the other hidden tracking siblings (`.pipeline`), not beside the human-facing round folders.

**Changes:**
- `scripts/config.mjs` — `configPath()` joins `'.walkthrough', '.config', 'unioss.config.json'`.
- `scripts/doctor.mjs` — the "To override locally…" message prints `.walkthrough/.config/unioss.config.json`.
- `skills/unioss-pipeline/REFERENCE.md` — the resolution-order line references `.walkthrough/.config/unioss.config.json`.
- Any test that asserts the path (`scripts/config.test.mjs`, `scripts/config-cli.test.mjs`) — update the expected path.
- `.gitignore` — if it lists `.walkthrough/config`, update it.

**Verify:** `node scripts/config.mjs init` creates `.walkthrough/.config/unioss.config.json`; `config.mjs print` reports `source=file` when that file exists; all config tests pass.

**Out of scope:** migrating an existing `.walkthrough/config/` dir on disk. Users re-run `init`.

---

## 2. Unified box UI for doctor output + pipeline plan table

**Why:** the current doctor output and the Step-0 plan grid look ad-hoc and the plan grid's right edge is ragged. Both should share one clean visual language.

**Shared visual language:**
- Rounded box: `╭ ╮ ╰ ╯`, horizontal `─`, vertical `│`.
- Title bar: `╭─ UNIOSS Pipeline · <context> ───…───╮`.
- Section headers inside the box (`Dependencies`, `Configuration`, column header row).
- Status glyphs: `✓` pass, `✗` fail, `⛔` gate.
- **Fixed inner width** so the right `│` column is flush on every line.

**A — doctor (`scripts/doctor.mjs`):** render the dependency checklist + resolved-config block inside one box. Right border aligned by padding each line to the fixed inner width programmatically. Failing checks show a `└ <fix>` sub-line. Ends with a `Status` line summarizing pass/issue count. (Target mockup: see design chat — "Environment Check" box.)

**B — plan table (`skills/unioss-pipeline/SKILL.md`, Step 0):** replace the multi-column ASCII grid with the same box style: a compact `# / Stage / Runs as / Output` layout, gate rows marked `⛔`, hand-aligned to a fixed inner width. Finalize row output reads `branch + commit (no push/MR)`. Title bar shows `<PREFIX>#[IID] · round-<N>`. (Target mockup: see design chat — plan-table box.)

**Verify:** run `node scripts/doctor.mjs` — every line's right `│` is column-aligned; box renders with a failing check present and absent. Render the SKILL Step-0 box — right edge flush.

**Constraint:** box-drawing + emoji glyphs occupy display cells; alignment math must count display width, not byte length, for the doctor script.

---

## 3. Clickable artifact links

**Why:** stages emit artifact paths like `.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md`. The bare `#` is mangled by the terminal linkifier (`AP#1583` → `AP:1583`), so the link opens the wrong path or fails. Only some paths survive today — behavior is inconsistent.

**Canonical link format:** an absolute `file://` URI with `#` percent-encoded as `%23`, wrapped in a markdown link:
```
[AP#1583_REVIEW.md](file:///abs/workspace/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)
```

**Changes:**
- New helper `scripts/link.mjs <path>` — resolves the path to absolute, percent-encodes `#` (and other unsafe chars) in the path segment, prints the `[label](file://…)` markdown link. `label` defaults to the basename. Deterministic, unit-testable.
- `skills/unioss-pipeline/REFERENCE.md` — add a short "Clickable links" rule: whenever a stage or the orchestrator surfaces an artifact path to the human, emit it via this format (or `link.mjs`).
- Each stage skill "Return" section (`unioss-investigate`, `unioss-plan`, `unioss-review`, `unioss-verify`, `unioss-implement`) + the orchestrator's gate presentations and final summary — reference the canonical format.

**Verify:** `node scripts/link.mjs '.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md'` prints a `file://` link with `%23` and no bare `#`; clicking the emitted link in the terminal opens the exact file. Unit test covers `#` encoding + absolute resolution.

---

## 4. New entry commands: `/unioss-feedback` and `/unioss-task`

**Why:** two workflows beyond a brand-new ticket — (a) customer feedback on a shipped ticket (continue in a new round, not restart A→Z), (b) an ad-hoc request with no GitLab issue.

**Structure:** thin command wrappers over the existing `unioss-pipeline` skill, which gains two new entry modes. No separate flow docs — reuse the gates, rounds, and stages already defined.

- **`/unioss-feedback <url>`** (`commands/unioss-feedback.md`): open a **new round** on an existing ticket. Re-fetch the ticket, read the **new GitLab comments** since the last round, brainstorm the feedback into scope, then enter spec → GATE 1 → plan → GATE 2 → code → review → GATE 3 → verify → finalize. Prior rounds stay frozen (existing sealed-round guard applies). Seeds `ROUND_BRIEF.md` from the comment delta.
- **`/unioss-task <description>`** (`commands/unioss-task.md`): no GitLab ticket. Take the user's free-form request, brainstorm it, then spec → gates → plan → … . Needs a ticket-less artifact identity (no IID). Use a `TASK` prefix + a short slug/sequence: `.walkthrough/TASK#<slug>/round-1/…`. Investigator's GitLab-fetch step is skipped; investigation is derived from the request + codebase only.

**`unioss-pipeline` skill changes:** add an "Entry modes" section documenting the three entry points (new ticket / feedback / task), what seeds the round, and which early steps are skipped. The investigator + gitlab-context skills learn to no-op the fetch when there is no ticket (task mode).

**Open item resolved:** `/unioss-task` chosen over `/unioss-feature`.

**Verify:** `/unioss-feedback <url>` on a ticket with a sealed round opens round N+1 seeded from new comments and does not touch prior rounds. `/unioss-task "add X"` runs the pipeline with no GitLab fetch and writes under a `TASK#…` artifact dir.

---

## 5. `/unioss-ship staging|customer`

**Why:** after a ticket is finalized (branch + commit, no push), the human ships it — first to internal staging, later to customer staging — by opening merge requests. Automate everything up to MR creation; the human clicks the pre-filled MR URL to create it, and the customer triggers the actual merge.

**New skill `unioss-ship`** (main thread — does git writes, tests, URL generation) + command `commands/unioss-ship.md` taking arg `staging` or `customer`.

**MR mechanism:** pre-filled GitLab "new MR" URL. Same-project MRs need only the repo web-path + `source_branch` + `target_branch` (no numeric project IDs). URL params cannot set assignee/reviewer/labels/merge-options, so the skill also prints those exact settings for the human to apply on the MR page.

**New helper `scripts/ship.mjs <staging|customer> <repoWebPath> <sourceBranch>`:** resolves ship config for the mode, builds the percent-encoded MR URL into the configured target branch, and prints the settings block (assignee, reviewer, label, delete-source, squash). Unit-testable.

**Config additions** (`config.mjs` DEFAULTS + REFERENCE config table):
```json
"ship": {
  "assignee": "nghia.truong",
  "label": "UNIOSS 3",
  "staging":  { "targetBranch": "v3-develop-tps", "reviewer": "dat.pham",   "deleteSourceBranch": false, "squash": false },
  "customer": { "targetBranch": "v3-develop",     "reviewer": "r.yosimura", "deleteSourceBranch": true,  "squash": false }
}
```
Target branch, assignee, and reviewer are all overridable per mode via `.walkthrough/.config/unioss.config.json`.

**`staging` flow:**
1. Verify current branch is a `feature/v3/…` branch (never a protected branch).
2. For every repo the ticket touched, push its feature branch to `origin` (MR source must exist on remote). Submodule branches are already pushed per the finalize rules; app branches (AdminPage/FrontEnd) are pushed here.
3. For each touched repo, run `ship.mjs staging <repoWebPath> <branch>` and present the MR URL + settings block. Target: `v3-develop-tps`.

**`customer` flow:**
1. Sync: `git fetch origin && git merge origin/v3-master` on the feature branch. On conflict → **stop**, tell the user to resolve manually, do not proceed.
2. Re-run the full test suite (AdminPage: `unioss-implement` full-mode PHPUnit; FrontEnd: skip unit tests). On failure → diagnose root cause, propose a fix plan, **GATE** for user approval, apply, re-run; loop until green.
3. Push the feature branch.
4. For each touched repo, run `ship.mjs customer …` and present the MR URL + settings block. Target: `v3-develop`, delete-source ON.

**Security note:** ship pushes feature branches (non-protected — allowed) and never commits/pushes/merges a protected branch. It never POSTs to the GitLab API — MR creation is a human click. `v3-develop` / `v3-develop-tps` remain protected as commit targets; receiving an MR is not a direct write.

**Verify:** `node scripts/ship.mjs staging unioss/FrontEnd 'feature/v3/#391'` prints a valid `…/FrontEnd/-/merge_requests/new?…source_branch=feature%2Fv3%2F%23391&…target_branch=v3-develop-tps` URL plus the staging settings; customer mode prints the `v3-develop` URL with delete-source ON. `/unioss-ship customer` aborts on a simulated merge conflict.

---

## 6. Tester quick-access guide

**Why:** the tester (human or subagent) wastes time rediscovering how to log in and point at the right DB.

**New file `skills/unioss-verify/tester-access.md`** capturing:
- **Data control:** `unioss_control_data.sql` — resets known accounts (e.g. sets password to `password`).
- **DB target (production clone):** `AdminPage/application/config/development/database.php` → `'database' => 'db_unioss_local'`.
- **AdminPage login:** `http://localhost:2380/admin/login` — user `kagi-25`, password `password`.
- **ECSite top:** `http://localhost:2380/storetax/top/vm:2500005/st:1?QRhome=true&QR=true&products=vmonly`.

`skills/unioss-verify/SKILL.md` links this file from Step 3 (UI flow). These are **local development** credentials only — no production secrets committed.

**Verify:** verify SKILL references `tester-access.md`; the file lists login + ECSite URL + DB target + control SQL.

---

## 7. Tester: explicit per-screen verification + mandatory screenshots

**Why:** the tester should not improvise what "verified" means; it must derive concrete checks from the acceptance criteria and always capture evidence.

**`skills/unioss-verify/SKILL.md` changes:**
- **Step 1** — build an explicit verification checklist: map each acceptance criterion to the exact screen(s), the action to perform, and the expected on-screen result.
- **Step 3** — mandatory screenshots at three moments per UI flow: after navigation, after performing the ticket action, after asserting the result. (Reinforces the existing "meaningful moments" guidance as a requirement.)
- **Step 4** — `TEST_RESULTS.md` must include a per-criterion pass/fail table, each row linking its screenshot(s). SKIPPED (MCP unavailable) is never a pass.

**Verify:** a verify run produces `TEST_RESULTS.md` with a criterion→screen→action→result table and at least the three required screenshots per driven flow.

---

## Cross-cutting

- **Version bump:** `plugin.json` → next minor (v1.5.0) once implemented.
- **Tests:** every new helper (`link.mjs`, `ship.mjs`) ships with a `*.test.mjs` beside it, matching the existing `config.test.mjs` / `rounds.test.mjs` pattern. Renamed config path updates existing tests.
- **No behavior change** to the gates, rounds model, or protected-branch rules beyond what each item states.

## Implementation order (suggested)

1. Item 1 (rename) — smallest, unblocks config tests.
2. Item 3 (`link.mjs`) + Item 5 (`ship.mjs`, config) — new helpers, isolated.
3. Item 2 (box UI) — doctor + SKILL table.
4. Item 4 (feedback/task commands + entry modes).
5. Item 6 + Item 7 (tester guide + verify enhancements).
