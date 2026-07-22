# unioss-knowledge — Activity-Window Crawl (updated_after) — Design

**Date:** 2026-07-22
**Status:** Approved
**Amends:** `2026-07-21-unioss-knowledge-design.md` (ticket-source decision)

## Problem

The crawl windows on `created_after`/`created_before` — only tickets **created** inside the period are seen. But knowledge lives in ticket *activity*: a ticket created three weeks ago and closed yesterday (with resolution notes, customer feedback, praise/criticism) never enters this week's refresh or ask. Open tickets are new and unprocessed — they carry nothing for the knowledge base yet.

The original spec also said `state=opened`; the code already fetches `state=all`. The spec was wrong, the code right — closed tickets are the primary knowledge source.

## Decision

| Point | Decision |
|---|---|
| State filter | `state=all` everywhere (open, closed, …). Spec aligned to code; now explicit. |
| Window field | New `dateField: 'created' \| 'updated'` option on `listIssues` and `crawl`. Default `'created'` (backward-compatible). |
| `today` + `refresh daily` | `'created'` — unchanged. Digest answers "what new tickets arrived". |
| `refresh weekly\|monthly` + `ask` | `'updated'` — activity view. Catches closures, re-opens, comments on any-age tickets. |
| Note filtering | When `dateField='updated'`: keep only notes with `created_at` within `[from, to]` inclusive. Prevents a ticket's full history from re-entering every period's sentiment. When `'created'`: all notes kept (ticket is new; history is the period). |
| Store | No schema change. `observations.jsonl` dedupe by `sha1(project:iid:noteId)` absorbs re-crawls; digests stay date-keyed. |

## Changes

### 1. `scripts/gitlab.mjs` — `listIssues`

- New opt `dateField` (default `'created'`).
- `'created'` → `created_after` / `created_before` query params (as today).
- `'updated'` → `updated_after` / `updated_before`.
- `state: 'all'` default unchanged.

### 2. `scripts/crawl.mjs` — `crawl`

- Accepts `dateField`, forwards to `listIssues`.
- `toObservations` gains the note-window filter: with `'updated'`, drop notes whose `created_at` falls outside `[from, to]`; with `'created'`, keep all (current behavior).
- System notes still skipped in both modes.

### 3. Callers

| Caller | dateField |
|---|---|
| `today.mjs` | `'created'` |
| `refresh.mjs` daily | `'created'` |
| `refresh.mjs` weekly / monthly | `'updated'` |
| `ask.mjs` | `'updated'` |

### 4. Docs

- Original spec ticket-source row: `state=opened` → `state=all`, note the dateField split.
- Plugin README + ask/refresh skill docs: weekly/monthly/ask cover any ticket **active** in the period, not only newly created.

## Testing (TDD)

- `listIssues` emits `updated_after`/`updated_before` when `dateField:'updated'`; `created_*` by default.
- `crawl` with `'updated'` drops out-of-window notes, keeps in-window (boundary inclusive); `'created'` keeps all.
- `refresh weekly` and `ask` pass `'updated'`; `today` and `refresh daily` pass `'created'` — asserted via injected deps.
- Existing 43 knowledge tests stay green (default `'created'` keeps old call sites intact).

## Out of scope

- Dual-window merge (created ∪ updated) — rejected, extra API cost, blurs `today` semantics.
- Changing `today` to activity view — rejected; "what came in today" is creation-based by intent.
