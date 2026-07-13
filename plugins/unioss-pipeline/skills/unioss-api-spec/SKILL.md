---
name: unioss-api-spec
description: Writes a UNIOSS API specification for a new/changed endpoint following the house template (URL, method, auth, request params + rules, request example, success/error/401 shapes, HTTP error-code table). Use when a change adds an API endpoint, or standalone via /unioss-api-spec.
---

# UNIOSS API Spec Writer

Read `../unioss-pipeline/REFERENCE.md` first. Produce an API spec that matches `api-spec-template.md` (this skill dir) exactly in structure.

## Inputs
Identify the endpoint from the request or the changed controller. Read the controller action + its validation/model to fill every section — never invent fields:
- **URL / method / Content-Type** — from the route + controller.
- **Authentication** — the header(s) checked and the 401 behavior.
- **Request parameters** — each field's type, required flag, and validation rule (max length, numeric ranges, allowed enum values, format).
- **Request example** — a working `curl` with a realistic body.
- **Responses** — the success 200 shape (with `data`), the error shape (`data: null`, per-index messages), and the 401 shape. Copy real response messages (including Japanese) from the code.
- **Error codes** — the HTTP → cause table.

## Output
- **Coder-integrated (pipeline):** when the approved change adds a new API endpoint, the orchestrator's coder invokes this skill and writes `<PREFIX>#[IID]_API_SPEC.md` into the current round dir `.walkthrough/<PREFIX>#[IID]/round-<N>/`.
- **Standalone** (`/unioss-api-spec <endpoint|controller>`): print the spec. **Write nothing under `.walkthrough/`** unless the user explicitly asks for a file.

## Standalone use
When no orchestrator context (no ticket, no round path) is handed to you: do the task on the named endpoint, skip round bookkeeping, and write nothing under `.walkthrough/` unless asked.
