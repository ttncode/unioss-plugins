---
name: unioss-plan
description: Use when turning a UNIOSS investigation into an implementation plan with exact per-file changes, estimate points, and per-step verification — the planner stage.
---

# UNIOSS Planner (read-only)

## Overview

Decide **what** to build (spec), then **how** to build it (plan) in enough detail that the coder applies rather than re-derives.

**Core principle:** Detail the plan enough that the coder applies it exactly rather than re-deriving it.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source access, artifact paths, standalone use).

## Input

The dispatch prompt states the mode, and each mode has its own agent — `unioss-spec` runs spec mode, `unioss-planner` runs plan mode. Never run both in one dispatch. A standalone invocation has no mode.

- **spec mode** — `round-<N>/investigation.md`, including any `## Clarifications` and its **approved** `## Spec Outline`.
- **plan mode** — the **approved** `spec.md`, plus the investigation.
- Both — the round path.
- On a GATE edit — whether to **create a new version** or **update the current file** in place.

## Workflow

### Spec mode — the what/why, no code

**Expand the approved `## Spec Outline` from `investigation.md`** — the user already approved that shape at Flow step 3c. It is your skeleton: write the bodies the outline's headlines promise. Do not re-derive scope from the raw ticket, and do not add a requirement the outline does not carry — a requirement the user never saw is a scope change smuggled past its gate. If the outline is wrong or incomplete, say so in your return rather than silently widening it.

An outline line tagged `(from Q<n>)` is a **decision the user made at GATE 0** — read the matching answer in `## Clarifications` and honour it exactly. Never re-open it, never hedge it back into an alternative the user already rejected. Drop the tag itself from `spec.md`; the decision belongs in the requirement, not its provenance.

Write `round-<N>/spec.md`. Mandatory sections:

- **Goal** — one paragraph.
- **Scope** — In-Scope / Out-of-Scope bullets.
- **Requirements & Constraints** — identifier-prefixed: `REQ-`, `CON-`, `SEC-`, `GUD-`.
- **Acceptance Criteria** — numbered, verifiable statements the tester can check.
- **Open Questions** — must be empty (clarify happened at GATE 0). If you cannot empty it, say so in your return so the orchestrator reopens GATE 0.
- **Related** — the investigation and any related issues.

### Plan mode — the how, exact code

1. **Draft and structure the plan in writing-plans format.** Invoke `unioss-pipeline:unioss-writing-plans` to structure the plan with writing-plans discipline: the plan header (Goal / Architecture / Tech Stack / Global Constraints), then `### Task N` blocks with **Files**, **Interfaces**, bite-sized steps, a verification per task, and a commit per task. Use UNIOSS-specific examples throughout — absolute PHP/CI3 paths, `docker exec -i "$US_PHP" …` commands (resolve `$US_PHP` via `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"`), and migration phases — not generic pytest/JS examples.
   Add exactly one UNIOSS section on top of that structure:
   - **Story points** — a `**Story points:** <N>` line in the plan header and a
     per-task estimate on each `### Task N`.

   No `## Manual Testing` section — test-case coverage is derived at the tester
   stage by `unioss-pipeline:unioss-test-evidence` (changes call sites × spec
   ACs × scope surfaces); the human's manual checklist is the tester's
   `## Manual Testing (run these yourself)` hand-off in `test-results.md`.

2. **House rules the plan's code must already satisfy.** The coder applies your code verbatim, so a violation here ships. Read `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md` (and `clean-code-javascript.md` for JS) and bake its rules into the code you write rather than leaving them to review. The three the reviewer rejects most often:
   - **Booleans are prefixed `is` / `has` / `can`** — see Variables. Never rename a pre-existing name to comply.
   - **Every `ADD COLUMN` on an existing table names its position** — see Database migrations. Resolve the position from the live table via `DESCRIBE`, never from a model or an older migration.
   - **No spec, plan, or ticket identifiers in comments** — see Comments. Trace requirements to tasks in the plan's prose, never in a code comment.

3. **Name every touched file explicitly.** The orchestrator renders the GATE 2 change preview from your plan — file paths (created / modified / deleted), the methods each modification touches, and one line per DDL effect in the form `<table>: + <column> <type> AFTER <column>`. A file the plan does not name is a file the human never sees coming, so leave nothing implicit.

4. **Save** `round-<N>/implementation.v1.md`.

### Versioning on a GATE edit

- **new version** → write the next `spec.v{n}.md` / `implementation.v{n}.md` (same round).
- **update current** → edit the existing file in place. No new file, no version bump.

## Output

Never paste the spec or plan body.

- **spec mode:** the spec path (backticked, absolute) + a one-line scope summary + whether `Open Questions` came out empty.
- **plan mode:** the plan path (backticked, absolute), total estimate points, a one-line scope summary, and the counts the GATE 2 preview needs — files created / modified / deleted, and migrations.

### Standalone — offer the next action

Dispatched by the orchestrator, return your summary and stop; the gates own the questions. Invoked directly, close with a menu (REFERENCE → Ending a run):

```
Plan complete — <n> tasks, <p> points. What would you like to do?

1. Apply the plan
2. Revise the plan
3. Stop here

Which option?
```

`1` → `unioss-pipeline:unioss-implement`. In spec mode, offer *"Write the implementation plan"* as `1.` instead.

## Related files

- `skills/unioss-writing-plans/SKILL.md` — the plan structure this stage produces (plus Story points).
- `agents/unioss-spec.md` — runs spec mode. `agents/unioss-planner.md` — runs plan mode.
- `skills/unioss-implement/SKILL.md` — the coder that applies the plan.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules.
