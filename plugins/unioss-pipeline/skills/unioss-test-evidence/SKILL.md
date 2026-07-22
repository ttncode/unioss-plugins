---
name: unioss-test-evidence
description: Use when the tester stage builds its test-case set — derives cases mechanically from changes.md + spec ACs + scope.md, and enforces per-case evidence and an honest PASS/PARTIAL/FAIL verdict.
---

# UNIOSS Test-Case Derivation & Evidence Contract

## Overview

The tester derives its own complete case set **mechanically** — coverage never depends on the dispatch prompt happening to name a scenario. Then the evidence contract makes every claim traceable: no pass without this-run proof, no case silently dropped.

**Core principle:** derive the full case table before driving anything; a case is either RAN with evidence or SKIPPED out loud.

## Derivation — build the case table first

Three sources, all mandatory:

1. **`changes.md`** — every changed call site / flow → **≥1 Normal + ≥1 Abnormal case**. Four modified call sites can never yield two test cases.
2. **Spec acceptance criteria** — every AC → ≥1 case, or an explicit SKIPPED row with a reason. No AC unmapped.
3. **`scope.md`** (ticket root, written by the scope stage just before this one) — every listed affected feature/URL → ≥1 case. Round 2+: prior-round surfaces in the cumulative scope become regression cases.

Additional rules:

- **Deletion refactor → sibling-survival cases:** exercise the remaining public methods of each edited file's flow (logout, guards, redirects) — proves the deletions didn't break neighbors.
- **Shared submodule in the diff → cross-app regression case.** Mandatory, or handed off explicitly — never silently deferred.
- **Abnormal floor per flow:** wrong input + missing entity (+ boundary where applicable).
- **Dedupe:** one case may satisfy several sources — tag it with every source it covers.
- The tester may **add** discovered cases (`EXTRA-nn`); it may never subtract a derived one.

Case schema — one row per case:

| ID | Category | Source | Precondition (incl. fixture) | Steps | Expected | Actual | Status | Evidence |
| -- | -------- | ------ | ---------------------------- | ----- | -------- | ------ | ------ | -------- |

`Category` = normal | abnormal | edge | regression · `Source` = CHG / AC / SCOPE (one or more) · `Status` = RAN-PASS | RAN-FAIL | SKIPPED (+reason).

## Fixture check — before any UI run

`SELECT` the documented credential (`tester-access.md`) against the DB first. Missing → locate a substitute by query, record it in the case's Precondition, and **flag `tester-access.md` stale** in the report and in the returned `open_issues`. Never burn browser time discovering a dead fixture.

## Evidence contract

```
NO RAN-PASS WITHOUT FRESH EVIDENCE CAPTURED IN THIS RUN
```

- **UI case:** screenshot at the assertion moment + network `method · URL · status` + console error count.
- **Data case:** before/after query output.
- **Screenshot naming:** `NN-<case-id>-<slug>.png` — evidence must trace back to its case ID.
- "should", "probably", "seems", a previous run, or another artifact's claim = **not evidence**. Not run in this session → it is SKIPPED.

## Skips & verdict

- Every SKIPPED case: reason on the row, copied into `## Manual Testing (run these yourself)`, and returned to the orchestrator for state `open_issues` / `carry_over`.
- **Verdict:** all rows RAN-PASS → `PASS` · any SKIPPED → `PARTIAL` · any RAN-FAIL → `FAIL`. A bare `PASS` with hidden skips is forbidden.

## Related files

- `../unioss-verify/SKILL.md` — the tester stage that invokes this contract.
- `../unioss-scope/SKILL.md` — writes `scope.md` (runs before the tester).
- `../unioss-verify/tester-access.md` — documented credentials the fixture check validates.
