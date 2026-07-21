---
name: unioss-api-spec
description: Use when a change adds or alters a UNIOSS API endpoint and you need a house-format API spec, or standalone via /unioss-api-spec.
---

# UNIOSS API Spec Writer

## Overview

Document what an endpoint actually does, straight from its controller. **Core principle:** never invent a field — every parameter, rule, and response shape comes from the real code.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

## Input

- The endpoint or controller — named in the request, or the one the approved change adds.
- **Pipeline:** the round path.

## Workflow

Read the controller action plus its validation and model, and fill every section of `./api-spec-template.md` from the real code. **Never invent a field.**

1. **URL / method / Content-Type** — from the route + controller.
2. **Authentication** — the header(s) checked and the 401 behavior.
3. **Request parameters** — per field: type, required flag, validation rule (max length, numeric range, allowed enum values, format).
4. **Request example** — a working `curl` with a realistic body.
5. **Responses** — the success 200 shape (with `data`), the error shape (`data: null`, per-index messages), and the 401 shape. Copy real response messages (including Japanese) verbatim from the code.
6. **Error codes** — the HTTP → cause table.

## Output

Structure must match `./api-spec-template.md` exactly.

- **Coder-integrated (pipeline):** the coder invokes this skill when the approved change adds an endpoint → write `round-<N>/<PREFIX>#[IID]_API_SPEC.md`, return its backticked absolute path.
- **Standalone** (`/unioss-api-spec <endpoint|controller>`): print the spec. Write nothing under `.walkthrough/` unless the user asks for a file (REFERENCE → Standalone use).

## Related files

- `./api-spec-template.md` — the house template; structure is mandatory.
- `skills/unioss-implement/SKILL.md` — the coder that invokes this.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules.
