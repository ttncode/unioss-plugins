---
description: Write or update the PM/QC-facing SCOPE.md for a finished UNIOSS ticket.
argument-hint: [ticket-number]
---

# /unioss-scope

Write the business-level scope summary a PM/QC reads to know what changed and what to retest.

## Input

- `$ARGUMENTS` — the ticket number, if not obvious from the current branch.

## Workflow

1. Use the `unioss-pipeline:unioss-scope` skill and follow it exactly.
2. If a pipeline round exists for this ticket, use its `CHANGES.md` as the starting diff; otherwise derive the change set from `git diff`/`git log` against the base branch.

## Output

Per the skill: `.walkthrough/<PREFIX>#[IID]/<PREFIX>#[IID]_SCOPE.md` (ticket folder, not a `round-<N>/` subfolder), created or updated in place (never versioned).

## Related files

- `skills/unioss-scope/SKILL.md` — the procedure.
- `skills/unioss-scope/scope-template.md` — the required structure.
- `skills/unioss-scope/scope-examples.md` — accepted real examples.
