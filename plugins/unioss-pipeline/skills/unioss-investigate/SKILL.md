---
name: unioss-investigate
description: Read-only UNIOSS investigator. Fetches a GitLab ticket plus all related/linked issues, maps codebase impact, queries the production DB, and produces an English investigation, a Vietnamese scope report, and a clarity verdict. Use as the investigator stage of unioss-pipeline.
---

# UNIOSS Investigator (read-only)

Read `../unioss-pipeline/REFERENCE.md` first. **Never edit source. Write only under `.walkthrough/`.**
Write all artifacts under the round folder the orchestrator gives you (`.walkthrough/<PREFIX>#[IID]/round-<N>/`); never write into a different round.
To read module source, resolve host paths first: `eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"` then Grep/Read under `$US_SRC_ADMIN_PAGE`, `$US_SRC_FRONT_END`, `$US_SRC_COMMON_HELPER`, `$US_SRC_COMMON_MODELS` — do not assume cwd is a repo (see REFERENCE → Source paths).

## Step 1 — Fetch ticket + related issues

Invoke `unioss-gitlab-issue-context` with the ticket URL. It writes `.walkthrough/.pipeline/<PREFIX>#[IID]/RAW_TICKET_DATA.json` and `TICKET_SUMMARY.md`. Then, for **every** entry returned by the `/links` endpoint, fetch that related issue too and summarize how it constrains scope. Related issues are first-class — a change is not understood until its linked issues are read.

## Step 2 — Codebase impact analysis

From the summary, extract column names and UI label strings. Grep the matching repo (`AdminPage/` or `FrontEnd/`). Record each hit as `file:line — impact(HIGH/MEDIUM/LOW)`.

## Step 3 — Production DB facts

Resolve config, then describe the affected tables (read-only):
`eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; DESCRIBE <table>;"`

## Step 4 — Write `INVESTIGATION.md`

Save `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_INVESTIGATION.md` (English; keep technical terms in Japanese):
1. **Requirements** (REQ/CON from the ticket, translated)
2. **Related-issue dependency map** (each linked issue → effect on this ticket)
3. **Code map** (`file:line` table from Step 2)
4. **DB facts** (from Step 3)
5. **## Clarity Verdict** — exactly one of `CLEAR` / `NEEDS_CLARIFICATION`
6. **## Open Questions** — numbered, concrete (missing specs, ambiguous behavior, conflicting related-issue requirements, undefined edge cases). Empty only if verdict is `CLEAR`.

## Step 5 — Write `REPORT.md` (Vietnamese)

Save `.walkthrough/<PREFIX>#[IID]/round-<N>/<PREFIX>#[IID]_REPORT.md`. Vietnamese only — column names and Japanese screen names stay as-is. No tables. No implementation detail. Fill this template verbatim:

```markdown
# <PREFIX>#[IID] Report

### 1. Mục tiêu:
- [one bullet per goal/objective]

### 2. Kết quả điều tra:
- [one bullet per target field/area investigated]

### 3. Phạm vi ảnh hưởng:
**Tính năng**
- [feature name (Japanese screen name)]

**URLs**
- `/path`

### 4. Kết luận:
- [one bullet per key conclusion]
```

List only ECSite user-facing screens in section 3; verify URLs against `_docs/ECSITE_SCREENS.md`.

## Step 6 — Return summary

Return: prefix+IID, repo, clarity verdict, count of open questions, and absolute links to the two visible files. Do not paste full file bodies.
