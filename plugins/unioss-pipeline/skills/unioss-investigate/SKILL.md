---
name: unioss-investigate
description: Read-only UNIOSS investigator. Fetches a GitLab ticket plus all related/linked issues, maps codebase impact, queries the production DB, and produces an English investigation, a Vietnamese scope report, and a clarity verdict. Use as the investigator stage of unioss-pipeline.
---

# UNIOSS Investigator (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**

## Step 1 — Fetch ticket + related issues

```
node <skill_dir>/scripts/fetch-ticket.js "<TICKET_URL>"
```

This writes `.walkthrough/.pipeline/<PREFIX>#[IID]/RAW_TICKET_DATA.json` and `TICKET_SUMMARY.md`. Then, for **every** entry returned by the `/links` endpoint, fetch that related issue too and summarize how it constrains scope. Related issues are first-class — a change is not understood until its linked issues are read.

## Step 2 — Codebase impact analysis

From the summary, extract column names and UI label strings. Grep the matching repo (`AdminPage/` or `FrontEnd/`). Record each hit as `file:line — impact(HIGH/MEDIUM/LOW)`.

## Step 3 — Production DB facts

Query production for the affected tables/columns (read-only):
`docker exec -i mysql-unioss3 mysql -u root -pProotW -e "USE _unioss; DESCRIBE <table>;"`

## Step 4 — Write `INVESTIGATION.md`

Save `.walkthrough/<PREFIX>#[IID]_INVESTIGATION.md` (English; keep technical terms in Japanese):
1. **Requirements** (REQ/CON from the ticket, translated)
2. **Related-issue dependency map** (each linked issue → effect on this ticket)
3. **Code map** (`file:line` table from Step 2)
4. **DB facts** (from Step 3)
5. **## Clarity Verdict** — exactly one of `CLEAR` / `NEEDS_CLARIFICATION`
6. **## Open Questions** — numbered, concrete (missing specs, ambiguous behavior, conflicting related-issue requirements, undefined edge cases). Empty only if verdict is `CLEAR`.

## Step 5 — Write `REPORT.md` (Vietnamese)

Save `.walkthrough/<PREFIX>#[IID]_REPORT.md`, Vietnamese only (column names + Japanese screen names stay as-is). Sections: `1. Mục tiêu`, `2. Kết quả điều tra` (one bullet per target field), `3. Phạm vi ảnh hưởng` (Tính năng + URLs; list only ECSite user-facing screens, verify against `_docs/ECSITE_SCREENS.md`), `4. Kết luận`. Short — no tables, no implementation detail.

## Step 6 — Return summary

Return: prefix+IID, repo, clarity verdict, count of open questions, and absolute links to the two visible files. Do not paste full file bodies.
