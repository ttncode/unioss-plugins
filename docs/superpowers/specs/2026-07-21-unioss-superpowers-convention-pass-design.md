# UNIOSS Pipeline — Superpowers Convention + Cleanup Pass — Design

Date: 2026-07-21
Scope: bring the `unioss-pipeline` plugin's docs (skills, commands, agents) into
line with the `superpowers` plugin's house-style, de-hardcode remaining
device/team specifics, dedupe review rigor, and fix one typo'd skill id — so the
plugin can be shared with the UNIOSS team and run on a fresh machine.

## Goal

Improve the quality and behavior of the plugin's AI agents (input, behavior,
response, output) by making every doc consistent, terse, and superpowers-shaped,
**without changing any pipeline behavior** — flow, gates, hook logic, and script
logic stay identical.

## Guardrail (binding for every item)

- **No behavior changes.** Pipeline flow, gate conditions, hook logic, and script
  logic are untouched. Changes are limited to: house-style, de-hardcode, dedupe,
  and typo/id fix.
- **Self-contained.** The plugin does **not** depend on superpowers. Skills cloned
  from superpowers (`unioss-brainstorming`, `unioss-writing-plans`, and the new
  `unioss-receiving-code-review`) are vendored copies.
- **Traceability.** Every changed line traces to one of the items below. No
  unrelated refactoring.

## Decisions locked with the user

- Scope = **convention + cleanup pass only** (not a full behavior rewrite).
- Plugin stays **self-contained**; forks are kept and refreshed, not replaced by a
  dependency.
- `unioss-mr-feedback` is based on `receiving-code-review` by **vendoring** that
  skill and having mr-feedback + the reviewer stage invoke it.
- **Config identities stay as-is** — no DEFAULTS neutralization:
  - `ship.assignee` is already `null` (auto-detects to the `GITLAB_TOKEN` owner via
    `GET /api/v4/user`). Nothing to change.
  - `ship.staging.reviewer` / `ship.customer.reviewer` stay **hardcoded** (fixed
    team reviewers) — user's call; already file-overridable.
  - `db.password` (`ProotW`) stays — a **shared local-docker** dev password, same
    for the whole team, already env/file-overridable.
  - Therefore **no `config.test.mjs` change** and **no test change** in this pass.
- `unioss-plan` and `unioss-writing-plans` are **distinct, both in use** — not a
  dedup target (recorded so neither is deleted later).
- The typo'd skill id `codeignitor3-simplifier` is **renamed** to
  `codeigniter3-simplifier`; its one inbound reference is updated.
- **Trim rule (explicit):** trimming a bloated skill means **only** removing
  duplicated text, combining identical rules, or rewriting a rule shorter. **No
  rule's substance is ever dropped.**

## Audit findings (ground truth)

- **No orphaned skills/commands/agents.** Every skill has ≥1 inbound reference
  (`unioss-pipeline` 22, `unioss-implement` 12, … lowest is 1). So "remove dead
  items" produces **no deletions** — reported honestly, not invented.
- **No absolute-home hardcoding** in the plugin. `config.mjs` already resolves
  env > local file > default, so per-machine values (source paths, container
  names) are overridable.
- **`ship.assignee` already `null`** (auto-detects to token owner); reviewers and
  `db.password` are intentional team-shared defaults — kept, not neutralized.
- **Residual wording to fix:** doctor/REFERENCE text references "the unioss3
  project root" — machine-specific phrasing, made generic.
- **Duplication to fix:** review rigor is described ad hoc in `unioss-mr-feedback`
  and `unioss-review` instead of sharing one vendored `receiving-code-review`.
- **`unioss-plan` vs `unioss-writing-plans`:** distinct and both used —
  `unioss-plan` is the planner stage skill; it *invokes* the vendored
  `unioss-writing-plans` for task-structuring discipline. Neither is removed.

---

## Item-by-item

### 1 — House-style standardization (all skills, commands, agents)

Adopt the superpowers **elements** while keeping the procedural steps coders rely
on (procedures are not rewritten into principle-only prose).

Per doc:
- **Frontmatter:** `description` begins `Use when …` (several don't today). `name`
  matches the directory/id.
- **Body skeleton:** `# Title` → `## Overview` (1–2 lines) with a bold
  **Core principle:** line → the existing numbered `## Workflow` kept intact →
  `## Common Mistakes` table **only where it earns its place** → `## Related files`.
- **Flowcharts:** add a `dot` flow diagram **only** where a real branch/decision
  exists (the `unioss-pipeline` orchestrator, `unioss-mr-feedback`). Not on linear
  procedures.
- **Terseness / trim:** for the longest skills (e.g. `unioss-review` ~390 lines),
  apply the trim rule above — dedupe, combine identical rules, shorten phrasing.
  Every distinct rule survives; only repetition dies.

Success check: every SKILL/command/agent frontmatter `description` starts
`Use when`; each body has Overview + Related files; no procedural step lost.

### 2 — Vendor `receiving-code-review`

Create `skills/unioss-receiving-code-review/SKILL.md`, cloned from the superpowers
skill, adapted:
- GitLab MR thread replies instead of GitHub PR thread replies.
- House vocabulary in place of superpowers-specific phrasing.
- One-line "vendored from superpowers, adapted for UNIOSS" note.

Wire-up (doc-only, no logic change):
- `unioss-mr-feedback` Analyze step invokes it instead of restating rigor inline.
- `unioss-review` references it as the reception-rigor source.

### 3 — De-machine-ify doc wording (docs only, no code/DEFAULTS change)

Config DEFAULTS are **left unchanged** (see Decisions): assignee auto-detects,
reviewers + `db.password` are intentional team-shared defaults, all overridable
via `.walkthrough/.config/unioss.config.json` or env.

- Replace machine-specific doctor/REFERENCE phrasing ("the unioss3 project root")
  with generic wording ("your UNIOSS project root").
- Add one line in `REFERENCE.md` noting per-machine overrides live in
  `.walkthrough/.config/unioss.config.json` / env (documents the existing path).

No `config.mjs` or test change.

### 4 — Refresh the vendored forks

Re-sync `unioss-brainstorming` and `unioss-writing-plans` text against the current
superpowers 6.1.1 versions; add a one-line "vendored from superpowers 6.1.1,
adapted" note to each. Behavior of the forks is unchanged beyond text alignment.

### 5 — Rename the typo'd skill id

Rename `skills/codeignitor3-simplifier/` → `skills/codeigniter3-simplifier/` and
update its `name:` frontmatter, then update the single inbound reference in
`unioss-implement`. This changes a public invocation string — accepted by the
user.

---

## Non-goals

- No pipeline flow / gate / orchestration redesign.
- No new features or commands.
- No hook or script **logic** changes; no `config.mjs`/DEFAULTS changes.
- No deletions of skills/commands/agents (none are orphaned).
- **No `*.test.mjs` changes at all** (unless the item-5 rename touches a test ref).

## Verification

- `node --test` passes for all `*.test.mjs`, unchanged from before the pass.
- `grep` proves no `/home/`, `/Users/`, or "unioss3 project root" strings remain
  in shipped docs/scripts.
- Every SKILL/command/agent `description` starts `Use when`.
- Every touched skill still contains each rule it had before (spot-check the
  trimmed `unioss-review` against its pre-trim rule list).
