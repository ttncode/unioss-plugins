# MR Feedback Command + Ship Preview Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/unioss-mr-feedback <mr-url>...` — a standalone command that analyzes a GitLab MR's open review comments, verifies each against the current code, and on approval applies fixes, runs the full test suite, commits, and pushes. Add a preview-before-proceed gate to `/unioss-ship` (both modes).

**Architecture:** Node ESM scripts (`node:test`, builtins only) hold the pure logic; markdown skills orchestrate. Machine-specific values always resolve through `scripts/config.mjs`. Pure transform/parse/format functions are unit-tested; file/network/git I/O sits at the CLI edge and in skill instructions, matching every existing script in this plugin.

**Tech Stack:** Node ≥18 (global `fetch`), `node:test`, `node:assert/strict`. Plugin root: `plugins/unioss-pipeline/`.

## Global Constraints

- Node builtins only. No `package.json`, no dependencies. ESM (`.mjs`) for anything with unit-testable logic; the one exception (`fetch-ticket.js`, unmodified) stays CommonJS `.js` — do not touch it.
- All machine-specific values (docker names, DB creds, hosts, source paths) resolve via `scripts/config.mjs` — never hardcode in skills.
- `GITLAB_TOKEN` is env-only: never written to a file, never committed, never printed.
- Protected branches (`master`, `v3-master`, `develop`, `v3-develop`, `v3-develop-tps`) are never committed/pushed/modified — only valid as an MR **target**. This is hook-enforced (`guard-protected-branch.mjs`); no task in this plan touches that hook.
- GitLab writes are permitted in exactly two places after this plan: `/unioss-ship` (push + create MR) and `/unioss-mr-feedback` (push only — never create or merge an MR). Never merge, anywhere, ever.
- Commit message format: `#[IID] - [Message]`, single imperative line. `/unioss-mr-feedback`'s commits use the fixed message `#<ID> - Optimize code`.
- Branch naming and the submodule edit-only-in-canonical-source flow (`REFERENCE.md` → Branches, Submodules) are binding wherever this plan touches a branch or a `common-models`/`common-helper` file.
- Version target: `plugin.json` → `1.9.0` (from `1.8.4`).
- Test baseline: `cd plugins/unioss-pipeline/scripts && node --test` → **99 passing** before this plan (per `README.md`'s badge). This plan adds 7 there (`ship-plan.test.mjs`) → **106**. A second, separate suite lives at `plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/` (skill-scoped, same pattern as the untested `unioss-gitlab-issue-context/scripts/`) and adds 9 tests there — run with `cd plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts && node --test`. Combined total for the README badge: **115**.
- Dropped from the original request: auto-syncing `v3-develop-tps` with `v3-master`. The user withdrew this after learning it requires a write to a protected branch, which the hook cannot permit. No task in this plan touches `v3-develop-tps`.

---

### Task 1: `fetch-mr-feedback.mjs` — URL/branch parsing + discussion formatting (pure functions)

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs`
- Test: `plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.test.mjs`

**Interfaces:**
- Produces: `parseMrUrl(url: string): { host, namespace, repo, projectPath, iid: number }` — throws on a non-MR GitLab URL.
- Produces: `moduleKeyForRepo(repo: string): string` — `'AdminPage'→'admin-page'`, `'FrontEnd'→'front-end'`, `'common-helper'→'common-helper'`, `'common-models'→'common-models'`; throws on anything else.
- Produces: `parseTicketId(sourceBranch: string): string | null` — the digits after the trailing `#` in `feature/v3/#1585` or `feature/v3/AdminPage#1585`; `null` if the branch has no `#digits` suffix.
- Produces: `formatDiscussions(mr: { iid, projectPath, source_branch, target_branch, state, title }, discussions: Array<{ notes: Array<{ system, author, resolvable, resolved, position, body }> }>, changedFiles: string[]): string` — human-readable summary consumed directly by the skill (no JSON parsing step).
- Task 2 (same file) consumes all four of the above.

- [ ] **Step 1: Write the failing tests** — create `fetch-mr-feedback.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMrUrl, moduleKeyForRepo, parseTicketId, formatDiscussions } from './fetch-mr-feedback.mjs';

test('parseMrUrl extracts host, project path, and iid', () => {
  const r = parseMrUrl('https://gitlab.unioss.jp/unioss/AdminPage/-/merge_requests/3763');
  assert.deepEqual(r, {
    host: 'gitlab.unioss.jp',
    namespace: 'unioss',
    repo: 'AdminPage',
    projectPath: 'unioss/AdminPage',
    iid: 3763,
  });
});

test('parseMrUrl throws on a non-MR GitLab URL', () => {
  assert.throws(
    () => parseMrUrl('https://gitlab.unioss.jp/unioss/AdminPage/-/issues/1585'),
    /Not a GitLab merge request URL/,
  );
});

test('moduleKeyForRepo maps repo names to config module keys', () => {
  assert.equal(moduleKeyForRepo('AdminPage'), 'admin-page');
  assert.equal(moduleKeyForRepo('FrontEnd'), 'front-end');
  assert.equal(moduleKeyForRepo('common-helper'), 'common-helper');
  assert.equal(moduleKeyForRepo('common-models'), 'common-models');
});

test('moduleKeyForRepo throws on an unknown repo', () => {
  assert.throws(() => moduleKeyForRepo('SomethingElse'), /Unknown repo in MR URL/);
});

test('parseTicketId reads the digits after # in origin and non-origin branch shapes', () => {
  assert.equal(parseTicketId('feature/v3/#1585'), '1585');
  assert.equal(parseTicketId('feature/v3/AdminPage#1585'), '1585');
});

test('parseTicketId returns null when the branch has no ticket id', () => {
  assert.equal(parseTicketId('v3-master'), null);
});

test('formatDiscussions lists unresolved and resolved threads with file:line and author', () => {
  const mr = {
    iid: 3763, projectPath: 'unioss/AdminPage',
    source_branch: 'feature/v3/#1585', target_branch: 'v3-develop-tps',
    state: 'opened', title: 'Merge feature/v3/#1585 into v3-develop-tps',
  };
  const discussions = [
    { notes: [{ system: false, author: { name: 'Dat Pham' }, resolvable: true, resolved: true, position: { new_path: 'a.php', new_line: 10 }, body: 'fixed already' }] },
    { notes: [{ system: false, author: { name: 'Dat Pham' }, resolvable: true, resolved: false, position: { new_path: 'b.php', new_line: 20 }, body: 'still open' }] },
    { notes: [{ system: true, body: 'changed the description' }] },
  ];
  const out = formatDiscussions(mr, discussions, ['a.php', 'b.php']);
  assert.match(out, /MR !3763 · unioss\/AdminPage · feature\/v3\/#1585 -> v3-develop-tps · state: opened/);
  assert.match(out, /THREAD 1 \[resolved\]/);
  assert.match(out, /file: a\.php:10/);
  assert.match(out, /THREAD 2 \[unresolved\]/);
  assert.match(out, /file: b\.php:20/);
  assert.doesNotMatch(out, /changed the description/);
  assert.match(out, /CHANGED FILES:\na\.php\nb\.php/);
});

test('formatDiscussions marks a non-resolvable (general) comment as not resolvable', () => {
  const mr = { iid: 1, projectPath: 'x/y', source_branch: 'feature/v3/#1', target_branch: 'v3-develop-tps', state: 'opened', title: 't' };
  const discussions = [{ notes: [{ system: false, author: { name: 'A' }, resolvable: false, resolved: false, position: null, body: 'general note' }] }];
  const out = formatDiscussions(mr, discussions, []);
  assert.match(out, /THREAD 1 \[not resolvable\]/);
  assert.match(out, /file: \(no file position\)/);
});

test('formatDiscussions reports no comments when every thread is system-only', () => {
  const mr = { iid: 1, projectPath: 'x/y', source_branch: 'feature/v3/#1', target_branch: 'v3-develop-tps', state: 'opened', title: 't' };
  const out = formatDiscussions(mr, [{ notes: [{ system: true, body: 'x' }] }], []);
  assert.match(out, /No review comments on this MR\./);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts && node --test fetch-mr-feedback.test.mjs`
Expected: FAIL — `Cannot find module '.../fetch-mr-feedback.mjs'`.

- [ ] **Step 3: Implement the pure functions** — create `fetch-mr-feedback.mjs`:

```js
#!/usr/bin/env node
// Fetch a GitLab MR's discussions and print a formatted summary for
// /unioss-mr-feedback to reason over directly (no JSON parsing step).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const REPO_KEY_BY_NAME = {
  AdminPage: 'admin-page',
  FrontEnd: 'front-end',
  'common-helper': 'common-helper',
  'common-models': 'common-models',
};

const MR_URL_RE = /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/;

export function parseMrUrl(url) {
  const m = MR_URL_RE.exec(url);
  if (!m) throw new Error(`Not a GitLab merge request URL: ${url}`);
  const [, host, namespace, repo, iid] = m;
  return { host, namespace, repo, projectPath: `${namespace}/${repo}`, iid: Number(iid) };
}

export function moduleKeyForRepo(repo) {
  const key = REPO_KEY_BY_NAME[repo];
  if (!key) throw new Error(`Unknown repo in MR URL: ${repo} (expected one of ${Object.keys(REPO_KEY_BY_NAME).join(', ')})`);
  return key;
}

const TICKET_ID_RE = /#(\d+)$/;

export function parseTicketId(sourceBranch) {
  const m = TICKET_ID_RE.exec(sourceBranch);
  return m ? m[1] : null;
}

function threadStatus(firstNote) {
  if (!firstNote.resolvable) return 'not resolvable';
  return firstNote.resolved ? 'resolved' : 'unresolved';
}

export function formatDiscussions(mr, discussions, changedFiles) {
  const lines = [
    `MR !${mr.iid} · ${mr.projectPath} · ${mr.source_branch} -> ${mr.target_branch} · state: ${mr.state}`,
    `title: ${mr.title}`,
    '',
  ];

  const threads = discussions
    .map((d) => d.notes.filter((n) => !n.system))
    .filter((notes) => notes.length > 0);

  if (threads.length === 0) {
    lines.push('No review comments on this MR.');
  }

  threads.forEach((notes, i) => {
    lines.push(`-- THREAD ${i + 1} [${threadStatus(notes[0])}] --`);
    for (const n of notes) {
      const loc = n.position ? `${n.position.new_path}:${n.position.new_line ?? n.position.old_line}` : '(no file position)';
      lines.push(`author: ${n.author?.name ?? 'Unknown'}`);
      lines.push(`file: ${loc}`);
      lines.push(`body: ${n.body}`);
      lines.push('');
    }
  });

  lines.push('CHANGED FILES:');
  for (const f of changedFiles) lines.push(f);

  return lines.join('\n');
}
```

(Network fetch + CLI wiring is added in Task 2 — this step's exports must be complete and standalone-importable first.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts && node --test fetch-mr-feedback.test.mjs`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.test.mjs
git commit -m "feat(unioss-pipeline): add MR URL/branch parsing + discussion formatting (item 1)"
```

---

### Task 2: `fetch-mr-feedback.mjs` — network fetch + CLI

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs` (append below Task 1's exports)

**Interfaces:**
- Consumes: `parseMrUrl`, `formatDiscussions` from Task 1 (same file).
- Produces: `fetchMrFeedback(mrUrlStr: string): Promise<{ mr, discussions, changedFiles }>` — not unit-tested (network I/O), matching every other GitLab-fetching script in this plugin (`fetch-ticket.js` has no test either).
- CLI: `node fetch-mr-feedback.mjs <MR_URL>` prints `formatDiscussions(...)` to stdout — this is what Task 3's SKILL.md instructs the agent to run.

- [ ] **Step 1: Append the token resolver, fetch orchestration, and CLI** to `fetch-mr-feedback.mjs`:

```js

function resolveToken() {
  const home = homedir();
  if (home) {
    const p = join(home, '.zshrc.local');
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/export GITLAB_TOKEN=(.+)/);
      if (m) return m[1].trim();
    }
  }
  return process.env.GITLAB_TOKEN;
}

async function apiGet(host, token, path) {
  const res = await fetch(`https://${host}/api/v4/${path}`, { headers: { 'PRIVATE-TOKEN': token } });
  if (!res.ok) throw new Error(`GitLab GET ${path} failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchMrFeedback(mrUrlStr) {
  const { host, projectPath, iid } = parseMrUrl(mrUrlStr);
  const token = resolveToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const encoded = encodeURIComponent(projectPath);
  const mr = await apiGet(host, token, `projects/${encoded}/merge_requests/${iid}`);
  const discussions = await apiGet(host, token, `projects/${encoded}/merge_requests/${iid}/discussions?per_page=100`);
  const changes = await apiGet(host, token, `projects/${encoded}/merge_requests/${iid}/changes`);
  const changedFiles = (changes.changes ?? []).map((c) => c.new_path);
  return { mr: { ...mr, projectPath }, discussions, changedFiles };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const url = process.argv[2];
  if (!url) { process.stderr.write('Usage: fetch-mr-feedback.mjs <MR_URL>\n'); process.exit(1); }
  fetchMrFeedback(url)
    .then(({ mr, discussions, changedFiles }) => {
      process.stdout.write(formatDiscussions(mr, discussions, changedFiles) + '\n');
    })
    .catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
}
```

- [ ] **Step 2: Syntax-check and re-run Task 1's tests (must still pass — nothing in Task 1 changed)**

Run: `cd plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts && node --check fetch-mr-feedback.mjs && node --test fetch-mr-feedback.test.mjs`
Expected: no syntax error; PASS (9 tests, unchanged from Task 1).

- [ ] **Step 3: Manual smoke test against a real MR**

Run: `eval "$(node "$(git rev-parse --show-toplevel)/plugins/unioss-pipeline/scripts/config.mjs" env 2>/dev/null)"; node plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs "https://gitlab.unioss.jp/unioss/AdminPage/-/merge_requests/3763"` (run from a directory where `GITLAB_TOKEN` is set)
Expected: prints the MR header line, its threads (if any are still unresolved — this MR's known threads were addressed in a prior session, so it may print "No review comments on this MR." plus the changed-files list — either output is a pass, a thrown error is not).

- [ ] **Step 4: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts/fetch-mr-feedback.mjs
git commit -m "feat(unioss-pipeline): add MR discussion fetch + CLI (item 1)"
```

---

### Task 3: `unioss-mr-feedback` skill

**Files:**
- Create: `plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md`

**Interfaces:**
- Consumes: `fetch-mr-feedback.mjs` CLI (Task 2), `scripts/phpunit-config.mjs` (`apply --import` / `restore`, existing), `scripts/config.mjs` (`env`, existing).
- Produces: the `unioss-pipeline:unioss-mr-feedback` skill name, invoked by Task 4's command.

- [ ] **Step 1: Create `SKILL.md`**:

```markdown
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

Apply the same rigor as `superpowers:receiving-code-review` — verify, don't rubber-stamp a reviewer's suggestion just because another developer left it.

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
```

- [ ] **Step 2: Verify**

Run: `test -f plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md && grep -c '^### ' plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md`
Expected: file exists; `9` (Steps 1–9 as level-3 headers).

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md
git commit -m "feat(unioss-pipeline): add unioss-mr-feedback skill (item 1)"
```

---

### Task 4: `/unioss-mr-feedback` command

**Files:**
- Create: `plugins/unioss-pipeline/commands/unioss-mr-feedback.md`

**Interfaces:**
- Consumes: the `unioss-pipeline:unioss-mr-feedback` skill (Task 3).

- [ ] **Step 1: Create the command file**, mirroring `commands/unioss-feedback.md` and `commands/unioss-ship.md`:

```markdown
---
description: Analyze review feedback on one or more GitLab merge requests and, on approval, apply verified fixes, run the full test suite, commit, and push.
argument-hint: <mr-url> [mr-url...]
---

# /unioss-mr-feedback

Turn another developer's MR review comments into verified, tested, pushed fixes — standalone, not part of the A→Z pipeline.

## Input

- `$ARGUMENTS` — one or more GitLab merge-request URLs. None found → ask the user for at least one.

## Workflow

Use the `unioss-pipeline:unioss-mr-feedback` skill and follow it exactly, once per URL:

1. Fetch the MR's open discussion threads.
2. Verify each against the current code; sweep the MR's touched files for the same unmentioned pattern.
3. Print one summary and ask "Does that look right?" — wait for approval.
4. Apply, run the full test suite (AdminPage only), commit `#<ID> - Optimize code`, push.

## Output

Per the skill: the summary before applying anything, then per repo — the commit + push result. No MR is created; that stays `/unioss-ship`.

## Related files

- `skills/unioss-mr-feedback/SKILL.md` — the full per-MR workflow.
- `skills/unioss-pipeline/REFERENCE.md` — branch naming, protected branches, submodules, commit format.
```

- [ ] **Step 2: Verify**

Run: `test -f plugins/unioss-pipeline/commands/unioss-mr-feedback.md && grep -c '^---$' plugins/unioss-pipeline/commands/unioss-mr-feedback.md`
Expected: file exists; `2` (opening + closing frontmatter fence).

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/commands/unioss-mr-feedback.md
git commit -m "feat(unioss-pipeline): register /unioss-mr-feedback command (item 1)"
```

---

### Task 5: REFERENCE.md — second permitted GitLab-write path

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md:98-103`

- [ ] **Step 1: Replace the GitLab section.** Find:

```markdown
## GitLab (read-only except ship)

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`.
- URL regex: `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`.
- ⛔ The **only** permitted GitLab writes are inside `/unioss-ship` (push a feature branch + `POST …/merge_requests`). Never POST/PUT/DELETE during any read stage. Never merge. Never print the token. MR creation needs the `api` scope; read stages need only `read_api`.
```

Replace with:

```markdown
## GitLab (read-only except ship + mr-feedback)

- Host: `gitlab.host` from config (default `gitlab.unioss.jp`). Token from `process.env.GITLAB_TOKEN`.
- URL regex (tickets): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/` → groups: host, namespace, repo, type, IID.
- URL regex (merge requests): `/https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/` → groups: host, namespace, repo, IID.
- Endpoints (GET, header `PRIVATE-TOKEN`): `/api/v4/projects/:id/issues/:iid`, `.../issues/:iid/notes?per_page=100`, `.../issues/:iid/links`, `.../merge_requests/:iid`, `.../merge_requests/:iid/discussions?per_page=100`, `.../merge_requests/:iid/changes`.
- ⛔ GitLab **writes** are permitted in exactly two places: `/unioss-ship` (push a feature branch + `POST …/merge_requests`) and `/unioss-mr-feedback` (push a feature branch only, after the user approves the analyzed fixes — never creates or merges an MR). Never POST/PUT/DELETE during any read stage. Never merge, anywhere, ever. Never print the token. MR creation needs the `api` scope; a plain push needs `write_repository`; read stages need only `read_api`.
```

- [ ] **Step 2: Verify**

Run: `grep -n "read-only except ship + mr-feedback\|permitted in exactly two places" plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md`
Expected: both lines found.

- [ ] **Step 3: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "docs(unioss-pipeline): document the second GitLab-write path for mr-feedback (item 1)"
```

---

### Task 6: `ship-plan.mjs` — preview plan text (item 2)

**Files:**
- Create: `plugins/unioss-pipeline/scripts/ship-plan.mjs`
- Test: `plugins/unioss-pipeline/scripts/ship-plan.test.mjs`

**Interfaces:**
- Produces: `planSteps(mode: 'staging'|'customer', touchedRepos: string[]): string[]` — throws `Unknown ship mode` on anything else. Customer mode includes the test-suite step only when `'admin-page'` is in `touchedRepos`.
- Produces: `planText(mode, touchedRepos): string` — numbered rendering of `planSteps`, title line, trailing `No merge, ever — MR only. Proceed?`.
- Task 7 consumes both from `unioss-ship`'s workflow.

- [ ] **Step 1: Write the failing tests** — create `ship-plan.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSteps, planText } from './ship-plan.mjs';

test('planSteps staging is always the fixed 2-step list, regardless of repos', () => {
  assert.deepEqual(planSteps('staging', ['admin-page']), [
    'Push each touched branch.',
    'Create one MR per repo into v3-develop-tps.',
  ]);
  assert.deepEqual(planSteps('staging', ['front-end', 'common-models']), planSteps('staging', ['admin-page']));
});

test('planSteps customer includes the test step when admin-page is touched', () => {
  assert.deepEqual(planSteps('customer', ['admin-page', 'common-models']), [
    'Sync each branch with origin/v3-master → stop on conflict.',
    'Re-run full test suite (AdminPage only) → stop on failure.',
    'Push each touched branch.',
    'Create one MR per repo into v3-develop.',
  ]);
});

test('planSteps customer omits the test step when admin-page is not touched', () => {
  assert.deepEqual(planSteps('customer', ['front-end']), [
    'Sync each branch with origin/v3-master → stop on conflict.',
    'Push each touched branch.',
    'Create one MR per repo into v3-develop.',
  ]);
});

test('planText numbers the steps and ends with the no-merge line', () => {
  const text = planText('staging', ['admin-page']);
  assert.equal(text, [
    'Staging mode plan:',
    '',
    '1. Push each touched branch.',
    '2. Create one MR per repo into v3-develop-tps.',
    '',
    'No merge, ever — MR only. Proceed?',
  ].join('\n'));
});

test('planText customer without admin-page renders 3 numbered steps', () => {
  const text = planText('customer', ['front-end']);
  assert.equal(text, [
    'Customer mode plan:',
    '',
    '1. Sync each branch with origin/v3-master → stop on conflict.',
    '2. Push each touched branch.',
    '3. Create one MR per repo into v3-develop.',
    '',
    'No merge, ever — MR only. Proceed?',
  ].join('\n'));
});

test('planText customer with admin-page renders 4 numbered steps', () => {
  const lines = planText('customer', ['admin-page']).split('\n');
  assert.equal(lines[0], 'Customer mode plan:');
  assert.equal(lines[2], '1. Sync each branch with origin/v3-master → stop on conflict.');
  assert.equal(lines[3], '2. Re-run full test suite (AdminPage only) → stop on failure.');
  assert.equal(lines[4], '3. Push each touched branch.');
  assert.equal(lines[5], '4. Create one MR per repo into v3-develop.');
});

test('planSteps throws on an unknown mode', () => {
  assert.throws(() => planSteps('prod', []), /Unknown ship mode/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd plugins/unioss-pipeline/scripts && node --test ship-plan.test.mjs`
Expected: FAIL — `Cannot find module '.../ship-plan.mjs'`.

- [ ] **Step 3: Implement** — create `ship-plan.mjs`:

```js
#!/usr/bin/env node
// Render the /unioss-ship preview-before-proceed plan text. The step list is
// generated from mode + touched repos so it never lists a step that doesn't
// apply (e.g. no test line when only front-end was touched).
import { pathToFileURL } from 'node:url';

const STAGING_STEPS = [
  'Push each touched branch.',
  'Create one MR per repo into v3-develop-tps.',
];

function customerSteps(hasAdminPage) {
  const steps = ['Sync each branch with origin/v3-master → stop on conflict.'];
  if (hasAdminPage) steps.push('Re-run full test suite (AdminPage only) → stop on failure.');
  steps.push('Push each touched branch.');
  steps.push('Create one MR per repo into v3-develop.');
  return steps;
}

export function planSteps(mode, touchedRepos) {
  if (mode === 'staging') return STAGING_STEPS;
  if (mode === 'customer') return customerSteps(touchedRepos.includes('admin-page'));
  throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
}

export function planText(mode, touchedRepos) {
  const steps = planSteps(mode, touchedRepos);
  const title = mode === 'staging' ? 'Staging mode plan:' : 'Customer mode plan:';
  const numbered = steps.map((s, i) => `${i + 1}. ${s}`);
  return [title, '', ...numbered, '', 'No merge, ever — MR only. Proceed?'].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [mode, ...repos] = process.argv.slice(2);
  if (!mode) { process.stderr.write('Usage: ship-plan.mjs <staging|customer> [repoKey...]\n'); process.exit(1); }
  try {
    process.stdout.write(planText(mode, repos) + '\n');
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd plugins/unioss-pipeline/scripts && node --test ship-plan.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/scripts/ship-plan.mjs plugins/unioss-pipeline/scripts/ship-plan.test.mjs
git commit -m "feat(unioss-pipeline): add ship preview plan-text generator (item 2)"
```

---

### Task 7: Wire the preview gate into `/unioss-ship`

**Files:**
- Modify: `plugins/unioss-pipeline/skills/unioss-ship/SKILL.md`
- Modify: `plugins/unioss-pipeline/commands/unioss-ship.md`

**Interfaces:**
- Consumes: `planText` from `ship-plan.mjs` (Task 6).

- [ ] **Step 1: Insert the Preview subsection** in `skills/unioss-ship/SKILL.md`. Find:

```markdown
## Workflow

### Preconditions

- Determine the touched repos + their feature branches from `CHANGES.md` (REFERENCE branch naming). Include any submodule the coder edited.
- Verify every branch to ship is a `feature/v3/…` branch. **Abort** if any is a protected branch.

### Mode: staging
```

Replace with:

```markdown
## Workflow

### Preconditions

- Determine the touched repos + their feature branches from `CHANGES.md` (REFERENCE branch naming). Include any submodule the coder edited.
- Verify every branch to ship is a `feature/v3/…` branch. **Abort** if any is a protected branch.

### Preview

Before any write (sync, test, push, MR-create), render the plan for the resolved mode and the touched-repo key list, print it verbatim, and wait for one reply:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ship-plan.mjs" <staging|customer> <repoKey...>
```

A plain "proceed"/"yes"/"go ahead" (no skip mentioned) runs every listed step as-is. If the reply asks to skip the **sync** or **test** step (customer mode only — the only two steps that gate whether what gets pushed is known-good), echo the skip back once — e.g. "Skipping the test run — confirm?" — and wait for one more reply before continuing. Push and MR-creation are never offered as skippable: skipping either leaves nothing left to do.

### Mode: staging
```

- [ ] **Step 2: Update the Related files list** in the same `SKILL.md`. Find:

```markdown
## Related files

- `scripts/ship.mjs` — `create`, `mrTitle`, and the pre-filled-URL fallback.
- `scripts/config.mjs` — `ship.*` settings.
- `skills/unioss-pipeline/REFERENCE.md` — branch naming, protected branches, submodules.
```

Replace with:

```markdown
## Related files

- `scripts/ship.mjs` — `create`, `mrTitle`, and the pre-filled-URL fallback.
- `scripts/ship-plan.mjs` — the preview-gate plan text.
- `scripts/config.mjs` — `ship.*` settings.
- `skills/unioss-pipeline/REFERENCE.md` — branch naming, protected branches, submodules.
```

- [ ] **Step 3: Update `commands/unioss-ship.md`.** Find:

```markdown
## Workflow

Use the `unioss-pipeline:unioss-ship` skill and follow it exactly:

1. **staging** — push each feature branch, then open MRs into `v3-develop-tps`.
2. **customer** — sync each branch with `v3-master`, re-run the tests, push, then open MRs into `v3-develop`.
3. Every touched repo gets its own MR, including the submodules (`common-helper`, `common-models`).
4. MRs are created via the GitLab API, with a pre-filled-URL fallback if creation fails.
```

Replace with:

```markdown
## Workflow

Use the `unioss-pipeline:unioss-ship` skill and follow it exactly:

1. Print the plan for the resolved mode + touched repos and wait for "Proceed?" — the user may skip the sync/test steps by naming them in their reply.
2. **staging** — push each feature branch, then open MRs into `v3-develop-tps`.
3. **customer** — sync each branch with `v3-master`, re-run the tests, push, then open MRs into `v3-develop`.
4. Every touched repo gets its own MR, including the submodules (`common-helper`, `common-models`).
5. MRs are created via the GitLab API, with a pre-filled-URL fallback if creation fails.
```

- [ ] **Step 4: Verify**

Run: `grep -n "### Preview" plugins/unioss-pipeline/skills/unioss-ship/SKILL.md && grep -n "Print the plan for the resolved mode" plugins/unioss-pipeline/commands/unioss-ship.md`
Expected: both found.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-ship/SKILL.md plugins/unioss-pipeline/commands/unioss-ship.md
git commit -m "feat(unioss-pipeline): add preview-before-proceed gate to /unioss-ship (item 2)"
```

---

### Task 8: Version bump + README

**Files:**
- Modify: `plugins/unioss-pipeline/.claude-plugin/plugin.json` (version → `1.9.0`)
- Modify: `README.md` (version badge, tests badge, Usage bullet)

- [ ] **Step 1: Bump the plugin version.** In `plugins/unioss-pipeline/.claude-plugin/plugin.json`, change `"version": "1.8.4"` to `"version": "1.9.0"`.

- [ ] **Step 2: Update the README badges.** Find:

```markdown
[![version](https://img.shields.io/badge/version-1.8.4-blue)](./plugins/unioss-pipeline/.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-99%20passing-brightgreen)](#)
```

Replace with:

```markdown
[![version](https://img.shields.io/badge/version-1.9.0-blue)](./plugins/unioss-pipeline/.claude-plugin/plugin.json)
[![tests](https://img.shields.io/badge/tests-115%20passing-brightgreen)](#)
```

- [ ] **Step 3: Add the new command to the Usage list.** Find:

```markdown
## Usage

- New ticket — `/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834`
- Feedback (new round) — `/unioss-feedback <gitlab-url>`
- No ticket — `/unioss-task "Add a CSV export button to the sales-ledger screen"`
- Ship — `/unioss-ship staging` → `v3-develop-tps`; `/unioss-ship customer` (syncs `v3-master`, re-runs tests) → `v3-develop`
```

Replace with:

```markdown
## Usage

- New ticket — `/unioss-pipeline https://gitlab.unioss.jp/unioss/AdminPage/-/work_items/1834`
- Feedback (new round) — `/unioss-feedback <gitlab-url>`
- No ticket — `/unioss-task "Add a CSV export button to the sales-ledger screen"`
- MR review feedback — `/unioss-mr-feedback <mr-url> [mr-url...]` — verifies and applies another developer's review comments, standalone (not part of the A→Z pipeline)
- Ship — `/unioss-ship staging` → `v3-develop-tps`; `/unioss-ship customer` (syncs `v3-master`, re-runs tests) → `v3-develop`; both preview the plan and wait for "Proceed?" first
```

- [ ] **Step 4: Verify**

Run: `grep -n "1.9.0\|115%20passing\|unioss-mr-feedback" README.md plugins/unioss-pipeline/.claude-plugin/plugin.json`
Expected: all three strings found across the two files.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json README.md
git commit -m "chore(unioss-pipeline): bump to 1.9.0"
```

---

### Task 9: Full regression (release gate)

**Files:** none (verification only).

- [ ] **Step 1: Run the top-level script suite.**

Run: `cd plugins/unioss-pipeline/scripts && node --test`
Expected: `# tests 106` / `# pass 106` / `# fail 0` (99 baseline + 7 from Task 6).

- [ ] **Step 2: Run the skill-scoped suite.**

Run: `cd plugins/unioss-pipeline/skills/unioss-mr-feedback/scripts && node --test`
Expected: `# tests 9` / `# pass 9` / `# fail 0` (Task 1 — matches Task 1 Step 4's count already).

- [ ] **Step 3: Syntax-check every script.**

Run: `cd plugins/unioss-pipeline && for f in scripts/*.mjs skills/unioss-mr-feedback/scripts/*.mjs; do node --check "$f" || echo "FAIL $f"; done; echo done`
Expected: `done` with no `FAIL` lines.

- [ ] **Step 4: Confirm the dropped item left no trace.**

Run: `grep -rn "v3-develop-tps.*sync\|sync.*v3-develop-tps" plugins/unioss-pipeline/skills plugins/unioss-pipeline/scripts`
Expected: no matches — nothing in this plan writes to or syncs `v3-develop-tps`.

- [ ] **Step 5: Confirm no stale single-write-path language survives.**

Run: `grep -rn "The \*\*only\*\* permitted GitLab writes" plugins/unioss-pipeline/skills`
Expected: no matches — Task 5 replaced it with the two-path wording.

- [ ] **Step 6: Commit** (only if Steps 1–5 surfaced a fix; otherwise this task is verification-only and needs no commit).

---

## Self-Review (author checklist — completed)

**Spec coverage:** item 1 (fetch/parse/format → T1, network/CLI → T2, skill → T3, command → T4, REFERENCE → T5) fully covered; item 2 (plan-text → T6, wiring → T7) fully covered; item 3 (dropped by user) — no task touches it, confirmed by T9 Step 4; version/README → T8; release gate → T9.

**Placeholder scan:** no TBD/TODO; every code step shows complete code; every doc/skill edit shows the exact before/after markdown block.

**Type consistency:** `parseMrUrl`/`moduleKeyForRepo`/`parseTicketId`/`formatDiscussions` signatures match between T1's implementation and T2's `fetchMrFeedback` caller. `planSteps`/`planText` signatures match between T6's implementation and T7's `ship-plan.mjs` invocation. `mr.projectPath` (added by `fetchMrFeedback`, not present in the raw GitLab response) is threaded consistently into `formatDiscussions`'s expected shape in both T1's tests and T2's implementation.

**Notes for the executor:**
- Tasks 1, 2, and 6 are TDD script changes (run each file's `node --test`); Tasks 3, 4, 5, 7, 8 are doc/skill edits verified by `grep`/`test -f`; Task 9 is the release-gate regression.
- `fetchMrFeedback`'s network path is not unit-tested by design (matches `fetch-ticket.js`, `ship.mjs create` — every live-GitLab call in this plugin is exercised manually, not mocked). Task 2 Step 3 is that manual exercise.
- Task order respects dependencies: T1 before T2 (same file, T2 appends), T2 before T3 (SKILL.md's Step 1 command must exist), T3 before T4, T6 before T7, all before T8 (version bump names the final state), all before T9 (regression needs everything present).
- Simplification from the design doc: the doc mentioned a "skip-parsing unit test" for the ship preview. Dropped — free-text intent parsing (does this reply mean "skip the tests"?) is core LLM reasoning, already instructed in T7's Preview subsection; a regex parser would be strictly worse at it and would have no other caller. `planText`/`planSteps` (the part that's genuinely a "did I count the steps right" problem, the same class of problem `plan-table.mjs` solves for the main pipeline) stayed a tested script.
