---
name: unioss-scope
description: Writes/updates a business-level SCOPE.md for a finished UNIOSS ticket — objectives, content, and the affected features/URLs a PM or QC needs to track and retest. Use at the end of a ticket (pipeline Step 12, after the tester stage and before Finalize) or standalone via /unioss-scope, whenever a ticket needs a PM/QC-facing scope summary distinct from the coder's file-level CHANGES.md.
---

# UNIOSS Scope Writer

Tell a PM/QC reader what changed and what to retest — in business language, not a diff.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules, with one deliberate exception: **this skill writes to the ticket folder `.walkthrough/<PREFIX>#[IID]/`, not into a `round-<N>/` subfolder.** `SCOPE.md` spans rounds — one file per ticket, overwritten in place every round so it always reflects the current cumulative scope. Never version it (no `_V2`).

## Philosophy

- Never assume anything is certainly correct.
- When code changes, all related areas should be considered potentially affected.
- The entire related feature should be retested, not just the touched line.

## Input

- **Pipeline:** invoked at Step 12 of `unioss-pipeline`, right after the tester stage and before Finalize (Step 13) — the diff is final by then (GATE 3 already accepted). Reads the round's `CHANGES.md` (+ `API_SPEC.md` if present) as the starting source of truth, plus every repo the coder touched.
- **Standalone** (`/unioss-scope [ticket-number]`): if no round context exists, derive the change set from `git diff` / `git log` against the base branch (`gitlab.baseBranch`, see REFERENCE → Configuration) in whichever repo(s) the current branch touches.
- Both: the ticket `<PREFIX>#[IID]` (`AP` for AdminPage, `FE` for FrontEnd — see REFERENCE → Repos & prefixes).

## Workflow

1. **Check for an existing file.** If `.walkthrough/<PREFIX>#[IID]/<PREFIX>#[IID]_SCOPE.md` exists, read it first — you are updating it, not starting fresh. Keep objectives/content that are still true; only add/remove what this round actually changed.
2. **Gather the real final diff**, per repo touched: `CHANGES.md` gives the file list, but confirm against `git diff <base>...HEAD` — CHANGES.md was written before any GATE 3 fixes.
3. **Trace ripple effects — do not stop at the file the ticket named.** For every changed model/library/helper method, grep for its callers across the WHOLE app (`grep -rn "method_name" application/`), not just the controller the ticket mentions. Philosophy: never assume a change is contained; treat every caller as potentially affected.
4. **Cross-app check.** If any change touched `submodules/common-models` or `submodules/common-helper`, its consumers exist in **both** `AdminPage` and `FrontEnd` — map affected features/URLs in both, even if this round only tested one. This is the single most common mistake: see `./scope-examples.md`.
5. **Map changed code to URLs.** Controller action → route. Check `config/routes.php` for overrides before assuming the default CI3 `/controller/method/params` shape.
6. **Write Objectives** — 1–3 bullets, the business problem this ticket solves. No file names, no class/method names, no SQL.
7. **Write Content** — one bullet per discrete change, business/functional level. Name a symbol only when the ticket itself IS a refactor of that symbol (moving/renaming code) — see the ❌/✅ comparison in `./scope-examples.md`.
8. **Write Scope** (Affected Features + Affected URLs) per `./scope-template.md`. Err toward including a feature/URL, not excluding one — this list is QA's retest checklist, and the entire related feature should be retested, not just the exact lines touched.
9. Save (overwrite) `.walkthrough/<PREFIX>#[IID]/<PREFIX>#[IID]_SCOPE.md`.

## Output

Structure must match `./scope-template.md` exactly — read `./scope-examples.md` first, that is the gold standard for tone and level of detail; match it.

Return: the backticked absolute path (workspace root + `.walkthrough/<PREFIX>#[IID]/<PREFIX>#[IID]_SCOPE.md`), whether it was created or updated, and one line noting if a common-code change forced a multi-app scope.

## Related files

- `./scope-template.md` — the required structure + fill-in rules.
- `./scope-examples.md` — three accepted real examples (multi-app, single-app, brand-new-feature) plus the Content-bullet good/bad comparison.
- `skills/unioss-implement/SKILL.md` — writes `CHANGES.md`, this skill's primary input.
- `skills/unioss-pipeline/SKILL.md` — Step 12 is where this runs in the full pipeline, right before Finalize (Step 13).
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules, repo prefixes, base branch.
