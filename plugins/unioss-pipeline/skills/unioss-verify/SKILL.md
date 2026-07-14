---
name: unioss-verify
description: UNIOSS functional verifier. Confirms DB changes landed, drives the browser through the affected UI flow via MCP, snapshots, and reports against acceptance criteria. Functional/UI only (unit tests belong to the coder). Use as the tester stage of unioss-pipeline.
---

# UNIOSS Verifier (read-only)

- Read `./tester-access.md` first — login URLs + credentials to reach the affected screens fast.
- Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before DB access, clickable links, standalone use).

## Step 1 — Identify what to verify

From `round-<N>/<PREFIX>#[IID]_CHANGES.md` and the ticket acceptance criteria, build a checklist — one row per acceptance criterion. Every criterion must map to a concrete screen + action before you drive anything. List the DB effects to check separately.

| Criterion | Screen (URL) | Action to perform | Expected on-screen result |
| --------- | ------------ | ----------------- | ------------------------- |

## Step 2 — Verify DB changes

Query the relevant DB (read-only). Post-PHPUnit data lives in `testing_DB`; production-shaped data in `$US_DB`:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE <db>; SELECT ...;"
```

## Step 3 — Verify UI flow

- If any `mcp__playwright__browser_*` call fails (distribution error, connection refused, MCP not configured), **skip all UI test cases**: mark each `SKIPPED (MCP unavailable — verify manually)` in `TEST_RESULTS.md` and list the exact flows the user must verify manually. DB verification (Step 2) always runs regardless.
- When MCP is available, drive the affected screen(s): navigate, perform the ticket's action, assert the expected on-screen result.
- Capture a screenshot at **each** moment per UI flow (mandatory): (1) after navigation, (2) after the ticket action, (3) after asserting the result. Save to `round-<N>/screenshots/<step-name>.png`.

## Step 4 — Write `TEST_RESULTS.md`

Save `round-<N>/<PREFIX>#[IID]_TEST_RESULTS.md` containing: (a) DB verification results, and (b) a per-criterion pass/fail table (Criterion · Screen · Action · Expected · Result · Screenshot link) — every Step 1 criterion gets a row. `SKIPPED (MCP unavailable)` is never counted as a pass. Link each screenshot right after the step it documents:

```markdown
📸 [Description of what is shown](screenshots/step-name.png)
```

## Step 5 — Return

Return overall pass/fail, the count of failed criteria, and a `link.mjs` link to `TEST_RESULTS.md`. Do not paste the full report.
