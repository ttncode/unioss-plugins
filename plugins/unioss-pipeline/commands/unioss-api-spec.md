---
description: Write a UNIOSS API specification for a new/changed endpoint following the house template.
argument-hint: <endpoint|controller>
---

# /unioss-api-spec

Write the house-template API spec for a new or changed endpoint.

## Input

- `$ARGUMENTS` — the endpoint or controller to specify.

## Workflow

1. Use the `unioss-pipeline:unioss-api-spec` skill and follow it exactly.
2. Read the real controller before writing — the spec documents what the endpoint does, not what it should do.

## Output

Per the skill: the filled house template (URL, method, auth, request params + rules, request example, success/error/401 shapes, HTTP error-code table).

Standalone (no round path): present the spec inline. Write a file only if the user asks.

## Related files

- `skills/unioss-api-spec/SKILL.md` — the procedure.
- `skills/unioss-api-spec/api-spec-template.md` — the house template.
