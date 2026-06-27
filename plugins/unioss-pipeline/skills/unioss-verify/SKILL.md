---
name: unioss-verify
description: UNIOSS functional verifier. Confirms DB changes landed, drives the browser through the affected UI flow via MCP, snapshots, and reports against acceptance criteria. Functional/UI only (unit tests belong to the coder). Use as the tester stage of unioss-pipeline.
---

# UNIOSS Verifier (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**

## Step 1 — Identify what to verify
From `.walkthrough/<PREFIX>#[IID]_CHANGES.md` and the ticket acceptance criteria, list the DB effects and UI flows to check.

## Step 2 — Verify DB changes
Query the relevant DB (read-only). Testing data after a PHPUnit run lives in `testing_DB`; production-shaped data in `_unioss`:
`docker exec -i mysql-unioss3 mysql -u root -pProotW -e "USE <db>; SELECT ...;"`

## Step 3 — Verify UI flow
Drive the affected screen(s) with the Playwright / chrome-devtools MCP server: navigate, perform the ticket's action, assert the expected on-screen result. Capture a snapshot when it aids the report.

## Step 4 — Write `TEST_RESULTS.md`
Save `.walkthrough/<PREFIX>#[IID]_TEST_RESULTS.md`: DB verification results, UI flow steps, snapshot references, and pass/fail per acceptance criterion.

## Step 5 — Return
Return overall pass/fail and the count of failed criteria. Do not paste the full report.
