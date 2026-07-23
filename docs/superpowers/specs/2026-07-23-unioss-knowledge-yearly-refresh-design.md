# unioss-knowledge — Yearly Refresh — Design

**Date:** 2026-07-23
**Status:** Approved
**Amends:** `2026-07-21-unioss-knowledge-design.md` (refresh kinds)

## Problem

`/unioss-knowledge-refresh` accepts only `daily | weekly | monthly`. No way to run a year-scale refresh.

## Decision

`yearly` becomes a fourth refresh kind, behaving exactly like `weekly`/`monthly` at year scale: crawl the current year by **update** date (`state=all`), append observations, rewrite `sentiment/current.md` and `GLOBAL.md`. Chosen over a report-only year digest for symmetry — one distill path, no special cases. Accepted trade-off: running `yearly` aggregates a year of criticism into "current" sentiment (recency diluted until the next weekly/monthly run overwrites it).

## Changes

### 1. `scripts/refresh.mjs`

- `WINDOW` gains `yearly: 'year'` — `parsePeriod('year')` already exists.
- Distill condition `kind === 'weekly' || kind === 'monthly'` → `kind !== 'daily'`.
- Everything else falls out automatically: `dateField` is already `kind === 'daily' ? 'created' : 'updated'`; `touchLayer(dir, kind, now)` records the `yearly` layer.

### 2. Docs

- `commands/unioss-knowledge-refresh.md`, `skills/unioss-knowledge-refresh/SKILL.md` input line, root `README.md` refresh rows: `[daily|weekly|monthly]` → `[daily|weekly|monthly|yearly]`.
- One doc line in the refresh skill: a yearly run can be slow — year × updated window may hit the pagination cap (50 pages × 100 = 5000 issues) plus one notes call per issue.

## Testing (TDD)

- `runRefresh('yearly')` writes `sentiment/current.md` + `GLOBAL.md` and crawls with `dateField: 'updated'` (spy crawl).
- Unknown kind still throws (existing test untouched).
- Full knowledge suite stays green.

## Out of scope

- Report-only year digest (option rejected).
- Raising `MAX_PAGES` or batching the notes calls — revisit only if a real yearly run truncates.
