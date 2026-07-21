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
- Team identities and secrets are **neutralized** in shipped code DEFAULTS;
  `config.test.mjs` is updated to match — the only test change in this pass.
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
- **Residual hardcoding to fix:** `config.mjs` DEFAULTS bake team usernames
  (`nghia.truong`, `dat.pham`, `r.yosimura`) and a DB password (`ProotW`); doctor
  text references "the unioss3 project root".
- **Duplication to fix:** review rigor is described ad hoc in `unioss-mr-feedback`
  and `unioss-review` instead of sharing one vendored `receiving-code-review`.

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

### 3 — De-hardcode shipped defaults (`config.mjs` + docs)

- Neutralize DEFAULTS: `ship.assignee`, `ship.staging.reviewer`,
  `ship.customer.reviewer`, and `db.password` → empty string / placeholder.
- `runCheck` already errors when these resolve empty, so `/unioss-doctor` flags
  them on a fresh machine — new-machine setup path already works.
- Update `config.test.mjs` to assert the neutralized DEFAULTS (only test change).
- Replace machine-specific doctor/REFERENCE phrasing ("the unioss3 project root")
  with generic wording ("your UNIOSS project root").
- Document in `REFERENCE.md` that identities/secrets are set per-machine in
  `.walkthrough/.config/unioss.config.json` or env.

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
- No hook or script **logic** changes (only DEFAULTS values + wording in item 3).
- No deletions of skills/commands/agents (none are orphaned).
- No changes to `*.test.mjs` other than `config.test.mjs` (item 3).

## Verification

- `node --test` (or the repo's test runner) passes for all `*.test.mjs`, including
  the updated `config.test.mjs`.
- `grep` proves no baked team identities/secrets remain in code (`nghia.truong`,
  `dat.pham`, `r.yosimura`, `ProotW`).
- `grep` proves no `/home/`, `/Users/`, or "unioss3 project root" strings remain
  in shipped docs/scripts.
- Every SKILL/command/agent `description` starts `Use when`.
- Every touched skill still contains each rule it had before (spot-check the
  trimmed `unioss-review` against its pre-trim rule list).
