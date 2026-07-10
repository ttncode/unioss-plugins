---
name: unioss-verify
description: UNIOSS functional verifier. Confirms DB changes landed, drives the browser through the affected UI flow via MCP, snapshots, and reports against acceptance criteria. Functional/UI only (unit tests belong to the coder). Use as the tester stage of unioss-pipeline.
---

# UNIOSS Verifier (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**
Write all artifacts under the round folder the orchestrator gives you (`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.

## Step 1 — Identify what to verify
From `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_CHANGES.md` and the ticket acceptance criteria, build an explicit verification checklist — one row per acceptance criterion:

| Criterion | Screen (URL) | Action to perform | Expected on-screen result |
|-----------|--------------|-------------------|---------------------------|

List the DB effects to check separately. Every criterion must map to a concrete screen + action before you drive anything.

## Step 2 — Verify DB changes
Query the relevant DB (read-only). Testing data after a PHPUnit run lives in `testing_DB`; production-shaped data in `$US_DB`:
`eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE <db>; SELECT ...;"`  (use `$US_DB` for production data; `testing_DB` for post-PHPUnit data)

## Step 3 — Verify UI flow

Need login/URLs fast? See `tester-access.md` (this skill dir) for the local DB target, control-data SQL, AdminPage login, and the ECSite top URL.

If any `mcp__playwright__browser_*` call fails (distribution error, connection refused, or MCP not configured), **skip all UI verification test cases**. Mark each as `SKIPPED (MCP unavailable — verify manually)` in `TEST_RESULTS.md` and list the exact UI flows the user must verify manually. DB verification (Step 2) always runs regardless.

When MCP is available, drive the affected screen(s): navigate, perform the ticket's action, assert the expected on-screen result.

Capture a screenshot at **each** of these moments per UI flow (mandatory, not optional): (1) after navigation to the screen, (2) after performing the ticket action, (3) after asserting the expected result. Save to `.walkthrough/<PREFIX>#[IID]/round-<N>/screenshots/<step-name>.png`.

## Step 4 — Write `TEST_RESULTS.md`
Save `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_TEST_RESULTS.md`. It must contain: (a) the DB verification results, and (b) a per-criterion pass/fail table (Criterion · Screen · Action · Expected · Result · Screenshot link) — every criterion from Step 1 gets a row. `SKIPPED (MCP unavailable)` is never counted as a pass.

Link each screenshot as a relative markdown link immediately after the step it documents:

```markdown
📸 [Description of what is shown](screenshots/step-name.png)
```

## Step 5 — Return
Return overall pass/fail, the count of failed criteria, and a clickable `file://` link to `TEST_RESULTS.md` (REFERENCE → Clickable links). Do not paste the full report.

## Standalone use

You can be invoked directly on a free-form task (e.g. `/unioss-verify Check the login flow …`), outside the orchestrated pipeline. When **no orchestrator context** was handed to you — no ticket, no round path:

- Do the requested task on the file(s) named, using this skill's rules and domain knowledge.
- **Write nothing under `.walkthrough/`** — no round folders, no INVESTIGATION / PLAN / CHANGES / REVIEW / TEST / UT artifacts, no state files — **unless the user explicitly asks** for a written artifact.
- Skip pipeline gates and round bookkeeping.

When the orchestrator dispatches you with a round path, behave exactly as the pipeline sections above describe.
