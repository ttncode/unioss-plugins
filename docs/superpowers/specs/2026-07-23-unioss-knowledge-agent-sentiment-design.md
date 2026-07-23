# unioss-knowledge — Agent-Side Sentiment Classification — Design

**Date:** 2026-07-23
**Status:** Approved
**Amends:** `2026-07-21-unioss-knowledge-design.md` (sentiment distillation)

## Problem

`splitSentiment` classifies sentiment with English keyword regexes over raw GitLab note bodies (code snippets, diffs, PHPUnit output included). Field evidence (yearly ask run): praise was 100% false positives (dev phrasing like "resolved", "works now"), criticism mostly technical noise with real complaints buried. Two structural misses regex cannot overcome: it cannot read tone, and it is English-only while customer comments on `gitlab.unioss.jp` are largely Japanese. The bad text flows into `GLOBAL.md` → injected into every agent session.

## Decision

Classification moves to the agent (the only classifier in the loop that reads tone and Japanese). Scripts keep the deterministic plumbing: crawl, dedupe, window, validate, render, atomic write. The regex classifier is **deleted** — no fallback path may fabricate sentiment (decided over keeping regex as headless fallback: known-bad output would persist exactly where nobody reviews it).

## Flow

### 1. Evidence out — `refresh.mjs <weekly|monthly|yearly> --phase=crawl`

- Crawl + `appendObservations` unchanged.
- Writes `sentiment/evidence-<periodKey>.json`:

```json
{
  "periodKey": "2026-W30",
  "focus": ["<title> (<web_url>)", "..."],
  "observations": [{ "author": "...", "at": "...", "body": "...", "source": "..." }]
}
```

- `focus` = first 5 crawled issue titles (same as today's GLOBAL focus source).
- `observations` capped at the most recent **300** by `at` (token bound for yearly).
- Prints the evidence path + observation count. Does **not** touch `sentiment/current.md` or `GLOBAL.md`.
- `daily` unchanged — no phases, digest only.
- Plain `refresh.mjs weekly` (no `--phase`) behaves as `--phase=crawl` — old habit stays safe, never writes garbage.

### 2. Agent classifies — skill step

Refresh skill directs the agent: read the evidence file, extract **customer voice only** — ignore dev chatter, code, logs, test output; read Japanese natively; each finding = one concise English line + source URL. Write `sentiment/classified-<periodKey>.json`:

```json
{ "praise": [{ "body": "...", "source": "..." }], "criticism": [{ "body": "...", "source": "..." }] }
```

### 3. Finalize — `refresh.mjs <kind> --phase=finalize --classified=<path>`

- Validates shape: object with `praise`/`criticism` arrays of `{ body: string, source: string }`, ≤20 items each, `body` ≤200 chars. Invalid or missing file → error, nothing written.
- Derives `periodKey` from kind + now (same as crawl phase) and reads `sentiment/evidence-<periodKey>.json` for focus. Missing evidence file → error naming the crawl phase (run phases on the same day; a week/month boundary between phases surfaces as this error, not silent misalignment).
- `renderSentiment(classified, periodKey)` → `sentiment/current.md`.
- `renderGlobal` — friction = top-5 classified criticism; focus read from the evidence file; rules from `rules/approved.md` as today → `GLOBAL.md`.
- `touchLayer(dir, kind)` + `touchLayer(dir, 'sentiment')`.
- Lock held within each phase, not across (agent thinks between phases).

### 4. Ask sentiment intent — same two steps

- `ask.mjs --intent=sentiment --period=<token>` → writes `sentiment/evidence-<periodKey>.json` for the period, prints the path, **no digest**.
- Agent classifies (step 2 guidance) → `ask.mjs --intent=sentiment --period=<token> --classified=<path>` → validates, renders the digest to `digests/<periodKey>-sentiment.md`; when `--refresh` AND `periodOverlapsPresent`, also writes `sentiment/current.md` + `touchLayer('sentiment')` (mutate gate unchanged).
- Other intents (focus/tickets/general) untouched — single call as today.

### 5. Deletions

- `PRAISE`, `CRITICISM`, `splitSentiment` and their tests removed from `distill.mjs`.
- `renderSentiment` stays — renders classified arrays; empty arrays → "(none yet)".

## Docs

- Refresh + ask SKILL.md: two-step workflow with the classification guidance verbatim (customer voice only, ignore dev/technical noise, Japanese OK, one English line + source each).
- Root README knowledge blurb unchanged (behavior description still accurate).

## Testing (TDD)

- Crawl phase writes evidence with correct shape, focus top-5, 300-cap (301 observations → 300 most recent).
- Crawl phase does not write `sentiment/current.md`/`GLOBAL.md`.
- Finalize validates: missing file, non-array praise, >20 items, >200-char body → error, no writes.
- Finalize renders classified into `sentiment/current.md` + GLOBAL friction/focus.
- Ask sentiment: evidence step writes no digest; classified step writes digest; historical period + `--refresh` still never touches `current.md`.
- `splitSentiment` tests deleted; suite green.

## Out of scope

- Classifying inside the ask/refresh *scripts* via API calls — the agent session is the classifier.
- Author-role detection (customer vs dev) from GitLab metadata — the agent judges from content.
- Backfilling old `sentiment/current.md` content.
