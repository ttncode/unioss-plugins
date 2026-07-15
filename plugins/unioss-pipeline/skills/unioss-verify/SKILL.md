---
name: unioss-verify
description: UNIOSS functional verifier. Confirms DB changes landed, drives the browser through the affected UI flow via MCP, snapshots, and reports against acceptance criteria. Functional/UI only (unit tests belong to the coder). Use as the tester stage of unioss-pipeline.
---

# UNIOSS Verifier (read-only)

Prove each acceptance criterion against the real DB and the real screen. Functional/UI only — unit tests belong to the coder.

- Read `./tester-access.md` first — login URLs + credentials to reach the affected screens fast.
- Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before DB access, artifact paths, standalone use).

## Input

- `round-<N>/<PREFIX>#[IID]_CHANGES.md` — what changed.
- The ticket's acceptance criteria.
- The round path.

## Workflow

1. **Identify what to verify.** Build a checklist — one row per acceptance criterion. Every criterion maps to a concrete screen + action **before** you drive anything. List DB effects separately.

   | Criterion | Screen (URL) | Action to perform | Expected on-screen result |
   | --------- | ------------ | ----------------- | ------------------------- |

2. **Verify DB changes** (read-only). Post-PHPUnit data lives in `testing_DB`; production-shaped data in `$US_DB`:

   ```bash
   eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE <db>; SELECT ...;"
   ```

3. **Verify the UI flow.**
   - If any `mcp__plugin_unioss-pipeline_playwright__browser_*` call fails (distribution error, connection refused, MCP not configured), **skip all UI test cases**: mark each `SKIPPED (MCP unavailable — verify manually)` and list the exact flows the user must verify by hand. DB verification always runs regardless.
   - When MCP is available, drive the affected screen(s): navigate, perform the ticket's action, assert the expected on-screen result.
   - Capture a screenshot at **each** moment per UI flow (mandatory): (1) after navigation, (2) after the ticket action, (3) after asserting the result → `round-<N>/screenshots/<step-name>.png`.

4. **Write the report** to `round-<N>/<PREFIX>#[IID]_TEST_RESULTS.md`.

## Output

`TEST_RESULTS.md` contains:

- DB verification results.
- A per-criterion table — Criterion · Screen · Action · Expected · Result · Screenshot. **Every** Step 1 criterion gets a row.
- Each screenshot linked right after the step it documents:

  ```markdown
  📸 [Description of what is shown](screenshots/step-name.png)
  ```

Return: overall pass/fail, the count of failed criteria, and the backticked relative path to `TEST_RESULTS.md`. Never paste the full report.

**`SKIPPED (MCP unavailable)` is never counted as a pass** — surface it explicitly.

## Related files

- `./tester-access.md` — login URLs + credentials.
- `agents/unioss-tester.md` — the subagent that runs this.
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules, DB access, MCP naming.
