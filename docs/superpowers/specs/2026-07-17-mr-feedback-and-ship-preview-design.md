# UNIOSS Pipeline — MR Feedback Command + Ship Preview Gate — Design

Date: 2026-07-17
Scope: two independent additions to the `unioss-pipeline` plugin — a new
standalone command that applies external code-review feedback from a GitLab
MR, and a preview-before-proceed gate added to `/unioss-ship`.

## Goal

Give the user a way to point at one or more merge requests and have their
open review comments analyzed, verified against the real code, and (on
approval) applied, tested, committed, and pushed — without going through the
full A→Z pipeline. Separately, make `/unioss-ship` show what it's about to do
and let the user skip specific steps before any write happens.

A third item from the original request — auto-syncing `v3-develop-tps` with
`v3-master` before opening a staging MR — was dropped by the user after
discovering it requires writing to a protected branch, which
`guard-protected-branch` hard-blocks with no bypass. Not pursued.

## Decisions locked with the user

- **Command name:** `/unioss-mr-feedback <URL1> [URL2 ...]` (not
  `/unioss-optimize`, even though the commit message is `Optimize code`).
- **Architecture:** new skill runs in the **main thread**, same pattern as
  `unioss-implement` / `unioss-ship` (the two existing main-thread writers).
  Not a subagent, not folded into `unioss-review` (that skill is read-only and
  reviews the coder's own diff — different concern and permissions).
- **Standalone, not pipeline-integrated:** no `.walkthrough/` artifacts, no
  gates, no round folder — matches REFERENCE's existing "Standalone use" rule.
- **Ticket ID:** parsed from the MR's `source_branch`
  (`feature/v3/#[IID]` or `feature/v3/[ORIGIN]#[IID]`) — never asked.
- **Branch checkout:** if the local repo isn't already on that branch, fetch
  and check it out automatically before editing.
- **Scope of "unresolved":** only threads where `resolved: false` are
  analyzed. Already-resolved threads are treated as handled and skipped.
- **Confirmation gate:** one batch summary (valid comments to apply + sweep
  findings + anything rejected/skipped and why), then a single **"Does that
  look right?"** — not per-comment prompts, not silent auto-apply.
- **Sweep scope:** looking for the same unmentioned pattern is scoped to the
  files the MR already touches — never repo-wide.
- **Test suite:** always the **full** PHPUnit suite (fresh DB), never the fast
  filtered mode — this command has no gates to defer to, so "full" is the only
  correct signal before pushing.
- **Commit message:** fixed, `#<ID> - Optimize code`, one commit per touched
  repo.
- **Ship preview:** both staging and customer mode get a plan-then-confirm
  step. Skips are expressed in the user's free-text reply to the prompt, not
  via per-step y/n prompts.

---

## Item 1 — `/unioss-mr-feedback`

### Command

`commands/unioss-mr-feedback.md`, `argument-hint: <mr-url> [mr-url...]`.
Extracts every GitLab MR URL from `$ARGUMENTS`. Zero URLs found → ask the user
to provide at least one; do not proceed.

### New skill `skills/unioss-mr-feedback/SKILL.md`

Runs once per MR URL, main thread, no orchestrator context assumed.

**1. Resolve identity.** Parse `host/namespace/repo/merge_requests/:iid` from
the URL (same shape as REFERENCE's ticket-URL regex). Map `repo` → module key
via REFERENCE's Repos table (`AdminPage`→`admin-page`, etc.) — this also
determines whether the full-PHPUnit step applies later.

**2. Fetch.** New read-only script
`skills/unioss-mr-feedback/scripts/fetch-mr-feedback.js`, same shape as
`unioss-gitlab-issue-context/scripts/fetch-ticket.js` (same token resolution,
same `PRIVATE-TOKEN` GET pattern):
- `GET /projects/:id/merge_requests/:iid` → `source_branch`, `target_branch`,
  `state`, `title`.
- `GET /projects/:id/merge_requests/:iid/discussions?per_page=100` → threads
  with `resolved` + `notes[].position.{new_path,new_line}`.

This is a **read**, so it doesn't touch the "GitLab writes only inside
ship" rule — see the REFERENCE update below for the two writes this skill
*does* perform later (commit is local; push is a write).

**3. Parse ticket ID.** Regex the digits out of `source_branch` per the
`feature/v3/#[IID]` / `feature/v3/[ORIGIN]#[IID]` shapes in REFERENCE →
Branches. If the branch doesn't match either shape, stop and ask the user for
the ID — this is the one fallback case, since a non-conforming branch name
means the parse genuinely can't be trusted.

**4. Get on the branch.** If the repo's current branch != `source_branch`:
`git fetch origin && git checkout <source_branch>`. `source_branch` is by
construction never a protected branch (it's someone's feature branch), so
this never trips the protected-branch guard.

**5. Analyze unresolved threads.** For each thread with `resolved: false`:
read the file at `position.new_path` around `position.new_line`, and check
whether the comment's premise still holds against the *current* code (not
just the diff at review time — code may have moved since). Classify:
- **Valid** — the claim holds, the suggested fix is technically sound.
- **Invalid/stale** — the claim no longer holds, or the suggested fix is
  wrong/harmful.
- **Unclear** — can't be verified confidently (missing context, genuinely
  ambiguous ask).

This reasoning follows the same discipline as
`superpowers:receiving-code-review` — verify, don't rubber-stamp.

**6. Sweep.** Across the files the MR's diff touches (`GET
merge_requests/:iid/changes` for the path list), look for the same pattern as
each **valid** finding, even where the reviewer didn't leave a comment
(e.g. one comment flags a redundant `load->model()` call — check the same
file for other redundant loads, not just the exact line commented on).

**7. Summarize and confirm.** One printed summary:
- Will apply: N items (valid comments + sweep finds), one line each — file,
  what changes, why.
- Skipping: resolved threads (count only), invalid/unclear threads with the
  one-line reason.
- Ends with: **"Does that look right?"**

Wait for the reply. A rejection or correction goes back to step 5/6 with the
user's input folded in — no silent reinterpretation.

**8. Apply.** Standard edit rules apply (project CLAUDE.md, clean-code rules
per language, PSR-12). If a valid fix is in `common-models`/`common-helper`
territory (i.e. it lives under an app's `application/{models,helpers}/common`
path), it is **not** edited there — follow REFERENCE → Submodules: branch off
`v3-master` in the canonical submodule source, edit, commit, push the
submodule branch, then move the app's working-tree pointer (never commit the
app-side gitlink bump).

**9. Test.** If `admin-page` is among the touched repos: full PHPUnit, fresh
DB (`phpunit-config.mjs apply --import` → run → `restore`), same invocation
shape as `unioss-ship`'s customer-mode test step. Failure → stop, show the
failure, do not commit. `front-end` never runs PHPUnit (no suite exists).

**10. Commit + push.** Per touched repo (including any submodule branch not
already pushed in step 8): `git commit -m "#<ID> - Optimize code"`, then
`git push -u origin <branch>`. No MR is created and nothing is merged — MR
creation stays `/unioss-ship`'s job.

### REFERENCE.md update

The line "The only permitted GitLab writes are inside `/unioss-ship`" is
narrowed to describe *why* (push + MR creation are ship's job) and a new
sentence added: `unioss-mr-feedback` may also `git push` a feature branch
after committing approved fixes — it must never create or merge an MR. This
keeps the "no MR/no merge outside ship" invariant explicit while acknowledging
the second legitimate push path.

### Error handling

- MR already merged/closed (`state != opened`) → report and skip that URL,
  continue with the rest.
- Zero unresolved threads and sweep finds nothing → report "nothing to
  optimize" for that MR, skip commit/push/test entirely for that repo.
- Multiple URLs resolve to the same repo+branch → process sequentially,
  one combined commit for that repo (not one per URL) since they'd otherwise
  conflict on the same file.

---

## Item 2 — `/unioss-ship` preview gate

### Behavior change

Before any write (push, sync, test-run, MR-create), `unioss-ship` renders a
plan and stops for one reply. The plan is **generated from the actual
touched-repo list** (from `CHANGES.md`, as today) — it only lists steps that
apply (e.g. no test line when only `front-end` was touched).

**Staging:**
```
Staging mode plan:

1. Push each touched branch.
2. Create one MR per repo into v3-develop-tps.

No merge, ever — MR only. Proceed?
```

**Customer:**
```
Customer mode plan:

1. Sync each branch with origin/v3-master → stop on conflict.
2. Re-run full test suite (AdminPage only) → stop on failure.
3. Push each touched branch.
4. Create one MR per repo into v3-develop.

No merge, ever — MR only. Proceed?
```

### Skip semantics

The user's reply is free text, parsed against the numbered steps (e.g.
"proceed, skip step 2"). Steps 1/2 in customer mode (sync, test) are the ones
worth skipping deliberately (re-shipping after a very recent successful run,
say); skipping either is **echoed back once** — "Skipping the test run —
confirm?" — before continuing, since both gate whether what gets pushed is
known-good. Push and MR-creation are never offered as skippable: skipping
either leaves nothing for the command to do.

A plain "proceed" / "yes" / "go ahead" with no skip mentioned runs every
listed step as-is — this is the common case and stays a single round-trip.

### Files touched

`skills/unioss-ship/SKILL.md` (add the preview-render + confirm step ahead of
today's "Preconditions"), `commands/unioss-ship.md` (mention the preview in
Workflow). No new script needed — the plan text is built inline from the
already-resolved touched-repo list; no state persists across the confirm.

---

## Non-goals

- No auto-sync of `v3-develop-tps` (dropped, see above).
- No change to `unioss-pipeline`'s A→Z flow, gates, or round bookkeeping —
  `unioss-mr-feedback` is fully standalone.
- No MR creation or merge from `unioss-mr-feedback`.
- No per-step y/n prompting in the ship preview (single free-text reply only).

## Version

`plugin.json` 1.8.4 → **1.9.0**.

## Testing

- `fetch-mr-feedback.test.mjs` (new, mirrors any existing fetch-ticket test
  shape if one exists): URL parsing, discussion-shape handling.
- Manual run against a real MR (e.g. re-run against AP#1585 !3763, now with
  only resolved/no-remaining-feedback, to confirm the "nothing to optimize"
  path) as part of implementation verification — this command talks to a real
  GitLab instance and a real repo checkout, so it is exercised end-to-end
  rather than fully mocked.
- Ship preview: unit-testable plan-text generation (given a touched-repo list
  → expected plan string) plus a skip-parsing unit test (`"skip step 2"` →
  which step index).
