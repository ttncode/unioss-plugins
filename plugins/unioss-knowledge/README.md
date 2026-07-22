# unioss-knowledge

Human digests + an agent knowledge base for UNIOSS 3 tickets.

## Commands

| Command | Does |
|---|---|
| `/unioss-knowledge-today` | Summarize today's new UNIOSS 3 tickets (WWWH). |
| `/unioss-knowledge-ticket <url>` | Summarize one ticket (WWWH). |
| `/unioss-knowledge-ask "<question>" [period]` | Free-form query for any period; refreshes only when stale. |
| `/unioss-knowledge-refresh [daily\|weekly\|monthly]` | Crawl + distill the current window into the KB. |
| `/unioss-knowledge-approve` | Promote staged rules into the live KB. |
| `/unioss-knowledge` | Status + staleness. |

## Store

`.walkthrough/.knowledge/` — `GLOBAL.md` (injected each session, ≤1200 tokens), `domain/`, `rules/` (staged→approved), `sentiment/`, `digests/`.

## Injection

- SessionStart hook injects `GLOBAL.md` + a staleness nudge.
- The pipeline's investigate stage reads `domain/<module>.md` + `rules/approved.md` per ticket and appends new facts.

## Config

Reuses `.walkthrough/.config/unioss.config.json`: `gitlab.host`, `gitlab.workLabel` (falls back to `ship.label`, default `UNIOSS 3`), `artifactRoot`. Token via `GITLAB_TOKEN` (env or `~/.zshrc.local`).
