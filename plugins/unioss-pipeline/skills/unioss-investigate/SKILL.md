---
name: unioss-investigate
description: Read-only UNIOSS investigator. Fetches a GitLab ticket plus all related/linked issues, maps codebase impact, queries the production DB, and produces an English investigation, a Vietnamese scope report, and a clarity verdict. Use as the investigator stage of unioss-pipeline.
---

# UNIOSS Investigator (read-only)

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, resolve config before source/DB access, clickable links, standalone use).

## Step 1 — Fetch ticket + related issues

- Invoke `unioss-gitlab-issue-context` with the ticket URL. It writes `RAW_TICKET_DATA.json` + `TICKET_SUMMARY.md` under `.walkthrough/.pipeline/<PREFIX>#[IID]/`.
- For **every** entry from the `/links` endpoint, fetch that related issue too and summarize how it constrains scope. Related issues are first-class — a change is not understood until its linked issues are read.

## Step 2 — Codebase impact analysis

- From the summary, extract column names and UI label strings. Grep the matching repo (`$US_SRC_ADMIN_PAGE` or `$US_SRC_FRONT_END`).
- Record each hit as `file:line — impact(HIGH/MEDIUM/LOW)`.

## Step 3 — Production DB facts

Resolve config, then describe the affected tables (read-only):

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)" && docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE $US_DB; DESCRIBE <table>;"
```

## Step 4 — Write `INVESTIGATION.md`

Save `round-<N>/<PREFIX>#[IID]_INVESTIGATION.md` (English; keep technical terms in Japanese) with these sections:

1. **Requirements** — REQ/CON from the ticket, translated.
2. **Related-issue dependency map** — each linked issue → effect on this ticket.
3. **Code map** — the `file:line` table from Step 2.
4. **DB facts** — from Step 3.
5. **## Clarity Verdict** — exactly one of `CLEAR` / `NEEDS_CLARIFICATION`.
6. **## Open Questions** — numbered, concrete (missing specs, ambiguous behavior, conflicting related-issue requirements, undefined edge cases). Empty only if verdict is `CLEAR`.

## Step 5 — Write `REPORT.md` (Vietnamese)

Save `round-<N>/<PREFIX>#[IID]_REPORT.md`. Vietnamese only — column names and Japanese screen names stay as-is. No tables, no implementation detail. List only ECSite user-facing screens in section 3; verify URLs against `./ecsite-screens.md`. Fill verbatim:

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

## Step 6 — Return

Return: prefix+IID, repo, clarity verdict, count of open questions, and clickable `file://` links to the two visible files. Do not paste file bodies.

## Related files

- `./ecsite-screens.md` — ECSite screens tree.
