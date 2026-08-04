---
name: unioss-test-evidence
description: Use when the tester stage builds its test-case set — derives black-box cases mechanically from changes.md + spec ACs + scope.md across three layers, enforces the risk-gated exception taxonomy, per-case evidence, failure severity, and an honest PASS/PARTIAL/FAIL verdict.
---

# UNIOSS Test-Case Derivation & Evidence Contract

## Overview

The tester derives its own complete case set **mechanically** — coverage never depends on the dispatch prompt happening to name a scenario. Then the evidence contract makes every claim traceable: no pass without this-run proof, no case silently dropped.

**Core principle:** derive the full case table before driving anything; a case is either RAN with evidence or SKIPPED out loud.

## Black-box mandate

You are the customer's last line of defence, not the author's second opinion. You test the running system, never the source.

- **Never open source or test code** to decide what to test or whether it works. `changes.md` is read as a **list of affected surfaces** (screens, flows, tables) — not as an implementation to inspect.
- **A green PHPUnit suite is not evidence.** Never cite `UT_*.txt`, a PHPUnit count, or the coder's fast-verify result on any row. Unit tests prove the code does what its author expected; they say nothing about what the end user sees. The coder owns them, and their result never raises or lowers your verdict.
- **Nobody's claim substitutes for your observation** — not the plan's, not the reviewer's, not the coder's "this works now".

## Derivation — build the case table first

### Three sources, all mandatory

1. **`changes.md`** — every changed flow / screen / table → **≥1 Normal + the mandatory exception classes below**. Four changed surfaces can never yield two test cases.
2. **Spec acceptance criteria** — every AC → ≥1 case, or an explicit SKIPPED row with a reason. No AC unmapped.
3. **`scope.md`** (ticket root, written by the scope stage just before this one) — every listed affected feature/URL → ≥1 case. Round 2+: prior-round surfaces in the cumulative scope become regression cases.

### Three layers, per affected surface

| Layer   | What it isolates                                                     | Minimum per changed surface        |
| ------- | -------------------------------------------------------------------- | ---------------------------------- |
| `FIELD` | One input, control, or rule on one screen — the smallest observable behaviour | every rule named in the ACs + the DATA class probes |
| `FLOW`  | One complete user journey end-to-end, **plus its DB effect**          | ≥1 per changed surface             |
| `CROSS` | Multi-module, cross-app, or prior-round regression                   | ≥1 when a shared submodule or a second app is in the diff |

A `FLOW` case that only checks the screen is incomplete — the persisted result is half the behaviour. A `FIELD` case that needs a full journey to reach it is still `FIELD`; the layer names what is being judged, not how far you clicked to get there.

### Exception taxonomy — risk-gated

Five classes. Which are mandatory depends on what the change does; the rest are declared `N/A` **with a reason**, never silently omitted.

| Class         | Probes                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `DATA`        | empty required field · wrong type/format · max length + 1 · unicode & emoji · leading/trailing space · quote and `<script>` in a text field (value integrity, not a pentest) · boundary values (0, negative, max) |
| `AUTHZ`       | no session (hit the URL directly) · wrong role · another company's / another user's record ID · disabled account |
| `STATE`       | target already deleted · already in a terminal state (approved, closed, paid) · stale form (record changed after load) · non-existent ID |
| `CONCURRENCY` | double-submit the same form · the same action from two tabs                                          |
| `SYSTEM`      | external dependency unreachable or slow                                                             |

Mandatory classes by change type — apply every row that matches:

| The change touches…                                | Mandatory                                     |
| -------------------------------------------------- | --------------------------------------------- |
| a write flow (create / update / delete / approve / import) | `DATA` + `AUTHZ` + `STATE`             |
| a read flow (list / search / filter / export)      | `DATA` (empty result + boundary) + `AUTHZ`     |
| a calculated or aggregated value (money, tax, quantity, total) | `DATA` boundary + the **recompute rule** below |
| file upload / download                             | `DATA` (type + size) + `AUTHZ`                 |
| a multi-record or multi-step submit                | `CONCURRENCY` + `STATE`                        |
| a schema migration                                 | `STATE` **legacy-row case** — a row that existed before the migration, without the new value |
| an external service call                           | `SYSTEM`                                       |

`SYSTEM` on a flow with no external dependency is declared `N/A — no external dependency`. That line is required; its absence is a coverage gap.

### The error-path contract

Every exception case asserts **three** things. Two out of three is `RAN-FAIL`.

1. **The user is told** — a clear message on the right screen. Blank page, stack trace, raw SQL, or a silent no-op fails.
2. **The status is honest** — a user error returns `4xx`, not `500`, and not `200` with an error buried in the body.
3. **The data is untouched** — before/after query proves zero partial writes. A rejected save that left a header row, a sequence bump, or a log row is a **blocker**, however good the message was.

### The recompute rule

Never accept a calculated number by reading it off the screen. Recompute it independently in SQL from the source rows and compare. A wrong-but-plausible total is exactly the defect that ships.

### Additional rules

- **Deletion refactor → sibling-survival cases:** exercise the remaining flows around each affected surface (logout, guards, redirects) — proves the deletions didn't break neighbours.
- **Shared submodule in the diff → `CROSS` regression case in the other app.** Mandatory, or handed off explicitly — never silently deferred.
- **Dedupe:** one case may satisfy several sources — tag it with every source it covers.
- The tester may **add** discovered cases (`EXTRA-nn`); it may never subtract a derived one.

### Case schema

One row per case:

| ID | Layer | Category | Source | Precondition (incl. fixture) | Steps | Expected | Actual | Status | Severity | Evidence |
| -- | ----- | -------- | ------ | ---------------------------- | ----- | -------- | ------ | ------ | -------- | -------- |

`Layer` = FIELD / FLOW / CROSS · `Category` = normal | DATA | AUTHZ | STATE | CONCURRENCY | SYSTEM | edge | regression · `Source` = CHG / AC / SCOPE (one or more) · `Status` = RAN-PASS | RAN-FAIL | SKIPPED (+reason) · `Severity` = blank unless RAN-FAIL.

## Fixture check — before any UI run

`SELECT` the documented credential (`tester-access.md`) against the DB first. Missing → locate a substitute by query, record it in the case's Precondition, and **flag `tester-access.md` stale** in the report and in the returned `open_issues`. Never burn browser time discovering a dead fixture.

## Test-data ledger

You write into a shared local schema through the UI. Leaving junk behind rots the next round's fixtures.

- Log every record you create or mutate: table · key · the screen that did it → a `## Test Data Touched` section in the report.
- Prefer a recognisable marker in created records (e.g. a `QA-<IID>-` name prefix) so they are findable later.
- **Never delete or mutate seed rows from the production dump** to make a case pass — pick a different fixture and say so in the Precondition.

## Evidence contract

```
NO RAN-PASS WITHOUT FRESH EVIDENCE CAPTURED IN THIS RUN
```

- **`FIELD` case:** screenshot at the assertion moment + console error count (+ network `method · URL · status` when the rule round-trips).
- **`FLOW` / `CROSS` case:** screenshot at the assertion moment + network `method · URL · status` + console error count + **before/after query output**.
- **Exception case:** the message screenshot + the status + the before/after query proving nothing was written.
- **Calculated value:** the screen figure and the independent SQL recomputation, side by side.
- **Screenshot naming:** `NN-<case-id>-<slug>.png` — evidence must trace back to its case ID.
- "should", "probably", "seems", a previous run, a PHPUnit result, or another artifact's claim = **not evidence**. Not run in this session → it is SKIPPED.

## Failure severity

Every `RAN-FAIL` carries one, so the orchestrator can tell a wrong number from a wrong label:

- 🔴 **blocker** — data loss or corruption, a partial write on a failed path, a wrong money/quantity value, an authorization bypass, or a flow the user cannot complete.
- 🟡 **major** — an acceptance criterion not met, a wrong or missing error message, a dishonest status code; a workaround exists.
- 🟢 **minor** — cosmetic: label, format, alignment, ordering with no data consequence.

## Skips & verdict

- Every SKIPPED case: reason on the row, copied into `## Manual Testing (run these yourself)`, and returned to the orchestrator for state `open_issues` / `carry_over`.
- **Verdict:** all rows RAN-PASS → `PASS` · any SKIPPED → `PARTIAL` · any RAN-FAIL → `FAIL`. A bare `PASS` with hidden skips is forbidden.
- Report severity counts with the verdict (`🔴 n · 🟡 n · 🟢 n`). One 🔴 is a stop-ship signal even when the rest of the table is green — say so in the returned summary.

## Related files

- `../unioss-verify/SKILL.md` — the tester stage that invokes this contract.
- `../unioss-scope/SKILL.md` — writes `scope.md` (runs before the tester).
- `../unioss-verify/tester-access.md` — documented credentials the fixture check validates.
