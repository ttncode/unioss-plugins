---
name: unioss-mr-feedback
description: Analyze open review comments on a GitLab merge request, verify each against the current code, and — on approval — apply the fixes, run the full test suite, commit, and push. Use as /unioss-mr-feedback <mr-url> [mr-url...] when a ticket's merge request(s) received feedback from another developer.
---

# UNIOSS MR Feedback (main thread — writer)

Turn another developer's merge-request review comments into verified, tested, pushed fixes. Standalone: no ticket, no round, no gates, no `.walkthrough/` artifacts.

Follow `../unioss-pipeline/REFERENCE.md` — its Branches, Protected-branch, Submodule, and Commit-message rules are binding. This skill is the second (and only other) place GitLab writes are permitted — see REFERENCE → GitLab: it may `git push` a feature branch; it must never create or merge an MR.

## Input

- One or more GitLab merge-request URLs (`https://<host>/<namespace>/<repo>/-/merge_requests/<iid>`), extracted from the user's message. **Zero URLs found → ask the user for at least one before doing anything else.**

## Workflow (per MR URL)

### 1 — Fetch

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs" "<MR_URL>"
```

Prints the MR's state/branches/title, every non-system discussion thread (author, file:line, body, resolved/unresolved/not-resolvable), and the list of files the MR's diff touches. MR `state != opened` → report and skip this URL, continue with the rest.

### 2 — Resolve identity

- Repo → module key via REFERENCE → Repos (`AdminPage`→`admin-page`, `FrontEnd`→`front-end`, `common-helper`→`common-helper`, `common-models`→`common-models`). This decides whether Step 8 (PHPUnit) applies.
- Ticket ID = the digits after `#` in `source_branch` (`feature/v3/#[IID]` or `feature/v3/[ORIGIN]#[IID]`). If `source_branch` doesn't match either shape, ask the user for the ID instead of guessing.

### 3 — Get on the branch

If the repo's current branch isn't `source_branch`: `git fetch origin && git checkout <source_branch>`. `source_branch` is a feature branch by construction — never protected.

### 4 — Analyze

For every thread **not** marked resolved (status `unresolved` or `not resolvable` from Step 1's output — `resolved` threads are already handled, skip them): read the file at the given path/line and check whether the comment's premise still holds against the code **as it stands now**, not just at review time. Classify each as:
- **Valid** — the claim holds and the suggested fix is technically sound.
- **Invalid/stale** — the claim no longer holds, or the fix is wrong.
- **Unclear** — can't be verified with confidence.

Invoke `unioss-pipeline:unioss-receiving-code-review` and apply it to every thread — verify against current code, don't rubber-stamp a reviewer's suggestion just because another developer left it.

### 5 — Sweep

For every **valid** finding, check the MR's other touched files (the list Step 1 printed — never repo-wide) for the same pattern where no comment was left.

### 6 — Summarize and confirm

Print one summary: what will be applied (valid comments + sweep finds — file, change, why) and what's being skipped (resolved threads by count; invalid/unclear threads with a one-line reason). End with **"Does that look right?"** and wait. A correction goes back to Step 4/5 with the user's input folded in.

### 7 — Apply

Standard project conventions apply (the target project's `CLAUDE.md`, its per-language clean-code rules, PSR-12). If a valid fix lives in an app's `application/{models,helpers}/common` path, it is `common-models`/`common-helper` territory — follow REFERENCE → Submodules: branch off `v3-master` in the canonical submodule source, edit, commit, push the submodule branch, then move the app's working-tree pointer only (never commit/push the app-side gitlink bump).

### 8 — Test

If `admin-page` is among the touched repos this run: full PHPUnit, fresh DB —

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" apply --import
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
docker exec -i "$US_PHP" sh -lc "cd /var/www/html/AdminPage && ./vendor/phpunit/phpunit/phpunit -c application/tests/phpunit.xml --testdox"
node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" restore
```

A failure stops here — show it, do not commit. `front-end` never runs PHPUnit (no suite exists).

### 9 — Commit + push

Per touched repo (including a submodule branch not already pushed in Step 7):

```bash
git commit -m "#<ID> - Optimize code"
git push -u origin <branch>
```

No MR is created, nothing is merged — that stays `/unioss-ship`'s job.

## Multiple URLs

Run Steps 1–9 per URL. If two URLs resolve to the same repo+branch, fold their approved fixes into **one** commit for that repo (not one per URL) — committing twice against the same uncommitted changes would just be noise.

## Edge cases

- Zero unresolved threads and the sweep finds nothing → report "nothing to optimize on this MR", skip commit/push/test for that repo entirely.
- `source_branch` doesn't match either branch-name shape → ask the user for the ticket ID rather than guessing.

## Standalone use

This skill is **never** part of `/unioss-pipeline`. It writes nothing under `.walkthrough/` — no round folder, no artifacts — regardless of context.

## Related files

- `./scripts/fetch-mr-feedback.mjs` — the fetcher + formatter.
- `skills/unioss-pipeline/REFERENCE.md` — branches, protected branches, submodules, commit format, the GitLab write policy this skill is named in.
- `skills/unioss-implement/SKILL.md` — the coder; shares the submodule edit flow and the PHPUnit full-mode invocation shape.
