# UNIOSS Pipeline — Maintenance Batch (v1.6.0) — Design

Date: 2026-07-13
Scope: nine independent maintenance changes to the `unioss-pipeline` plugin,
delivered on one feature branch as a single phased plan.

## Goal

Fix rendering/link bugs, remove human friction at two gates, make PHPUnit setup
device-independent, extend tester/coder guidance, automate shipping, and add an
API-spec generator — without changing the gated pipeline's core shape.

## Decisions locked with the user

- Ship (item 8): **push + create MR via GitLab API, stop before merge.** Adds a
  scoped exception to the "never POST" rule.
- PHPUnit (item 5): regenerate the test config from resolved `config.mjs` values
  (no per-machine `git stash`); `apply`/`restore`.
- Links (item 2): auto-detect environment, emit a universally-openable link.
- Submodule pointer (item 4): submodule branch pushed; apps move the pointer in
  the working tree but **do not commit or push** the bump.
- GATE 3 "clean" (item 3): reviewer reports **0 Critical (🔴) and 0 Violation
  (🟡)** — 🟢-only — auto-continue; any 🔴/🟡 still stops.
- API-spec (item 9): coder auto-generates it in the round dir when a new API
  endpoint is added; also usable standalone.

---

## Item-by-item

### 1 — Plan table right border misaligned (`scripts/box.mjs`)

Root cause: `displayWidth` uses `Array.from(str).length` (code-point count). The
GATE rows use `🛑`/`⛔`, which are one code point but render **two** terminal
columns, so `pad` is one short and the right `│` bulges out.

Fix: make `displayWidth` wide-aware — return 2 for code points in emoji and
East-Asian-wide ranges, 1 otherwise. No caller changes. Add a `box.test.mjs`
case: a line containing `🛑` must produce the same right-edge column as a
plain-ASCII line.

### 2 — Artifact links won't open (`scripts/link.mjs`)

Root cause: emits `file:///home/ttndev/...` — a WSL path a Windows-side IDE
(Antigravity) cannot resolve.

Fix: detect the environment and emit a link the host can open:
- **WSL** (`/proc/version` contains `microsoft` and `$WSL_DISTRO_NAME` set) →
  `file://wsl.localhost/<distro>/home/ttndev/...`
- **native Linux/macOS** → `file:///...` (today's behavior).

Detection inputs (`/proc/version` text + distro name) are passed into a pure
helper so both branches are unit-testable. No config key, no per-machine setup.

### 3 — GATE 3 auto-continue on a clean review (`skills/unioss-pipeline/SKILL.md`)

The reviewer's scale is 🔴 Critical / 🟡 Violation / 🟢 Good-Style. When the
returned counts are **🔴 = 0 and 🟡 = 0**, the orchestrator skips the GATE 3
stop and proceeds directly to the accept path (full PHPUnit → tester), printing
a one-line "GATE 3 auto-passed (clean review: 0 Critical, 0 Violation)" note and
any 🟢 items. If 🔴 > 0 or 🟡 > 0, GATE 3 stops for the user's fix/accept
decision exactly as today. GATE 0/1/2 are unchanged.

### 4 — No pointer-bump commit in app repos (submodule flow)

New flow when a ticket changes `common-models`/`common-helper`:

1. In the canonical submodule source: branch off `v3-master`, edit, commit
   (`#[IID] - …`), **push** the submodule feature branch.
2. In each consuming app (AdminPage/FrontEnd): `git fetch && git checkout
   <branch> && git pull` — this moves the app's submodule pointer **in the
   working tree only**.
3. **Do not `git add` the gitlink, do not commit the pointer bump, do not push**
   the app repo for the pointer change. The submodule branch alone carries the
   common-code change.

Finalize commits app **code** changes only and must **exclude the submodule
gitlink** from the commit. Update: `REFERENCE.md` submodule section,
`unioss-implement` Step 0 common-code paragraph, `unioss-pipeline` Finalize step.

### 5 — Stash-free PHPUnit (`scripts/phpunit-config.mjs`, new)

The manual `git stash apply 'PHPUnit config'` edits four files; every
machine-specific literal in it already exists in `config.mjs`:

| File | What the stash sets | Source |
| --- | --- | --- |
| `application/config/testing/database.php` | `$db['default']` hostname/user/pass, `database => testing_DB` | `US_MYSQL` / `US_DB_USER` / `US_DB_PASS`, fixed `testing_DB` |
| `application/tests/StartedSubscriberImpl.php` | dump-import `exec(...)` mysql host/user/pass | same |
| `application/config/testing/config.php` | `HTTP_HOST`, `log_threshold`, `composer_autoload` realpath | fixed |
| `application/tests/phpunit.xml` | `<php>` block: `HTTP_HOST`, `CI_ENV=testing`, `ENVIRONMENT=testing`, `memory_limit` | fixed |

New script `phpunit-config.mjs`:
- `apply [--skip-import|--import]` — writes the required values into the four
  files (machine-specific values pulled from resolved config), idempotent. The
  import flag comments/uncomments the dump-import `exec` line: `--skip-import`
  for fast mode, `--import` for full mode.
- `restore` — `git checkout --` the four files, leaving the repo clean.

`unioss-phpunit-test` and `unioss-implement` drop the stash/manual-comment
instructions and call `phpunit-config apply/restore` around the run. Ships with
`phpunit-config.test.mjs`.

Open point for plan: `apply` performs targeted line rewrites (anchored on stable
substrings), not full-file templates, to survive across branches.

### 6 — Tester environment access (`config.mjs` + REFERENCE + `unioss-verify`)

Add a `tester` config block:

```
tester: {
  mailhog:      'http://localhost:8225',
  ecsiteLogin:  'http://localhost:2380/storetax/login',
}
```

REFERENCE documents the flow: log in to ECSite, trigger the action, **verify the
email via Mailhog** (`/#` inbox). Login credentials are **ticket/seed-specific**
(e.g. `test-ap1584@example.com` for ticket 1584), so the tester receives or
discovers them per run — not hardcoded in config. `unioss-verify` references the
`tester.*` URLs (resolved via `config.mjs env`, exported as `US_TESTER_*`).

### 7 — Coder verifies migrations (`references/migration-verify.md`, new)

Store the user's multi-environment up/down verify guide verbatim as a reference
doc. `unioss-implement` gains a step: **if the approved plan added a migration**,
run the up/down verify (dev by default). The safety rule ships verbatim:

> STOP and ask for explicit go-ahead before running `up()` OR `down()` whenever
> either destroys data that existed before the migration and the other side
> can't restore it — naming the table, environment, and recoverability. Pure
> create-then-drop cases proceed without asking.

### 8 — `/unioss-ship` push + MR creation (`scripts/ship.mjs`, SKILL, security note)

Today ship never pushes and never POSTs. New behavior:

1. **Push** each touched feature branch to origin (a network operation; the
   sandbox may prompt — the skill states the push is expected and required).
2. **Create the MR via the GitLab API**: `ship.mjs create <mode> <repoWebPath>
   <branch>` resolves the project id and assignee/reviewer usernames → ids
   (`GET /users?username=`), then `POST /projects/:id/merge_requests` with
   `source_branch`, `target_branch`, `assignee_ids`, `reviewer_ids`, `labels`,
   `remove_source_branch`, `squash`. Prints the created MR's web URL.
3. **Never merges.** Stops before merge for a human. If the POST is declined or
   fails, fall back to today's printed pre-filled "new MR" URL.

**Security-policy change (scoped exception).** The standing rule "never
POST/PUT/DELETE to GitLab" is amended to: GitLab writes are permitted **only**
inside `/unioss-ship`, and **only** to (a) push a feature branch and (b) create a
merge request. Never merge, never during read-only investigation, never any
other endpoint. This requires `GITLAB_TOKEN` to carry the `api` scope (read-only
stages need only `read_api`); the token remains env-only, never written or
printed. `unioss-doctor` notes the `api`-scope requirement.

### 9 — `unioss-api-spec` skill (new) + `references/api-spec-template.md`

New skill that writes an API spec following the provided template (cached as a
reference doc). Two entry points:
- **Coder-integrated:** when the approved change **adds a new API endpoint**,
  `unioss-implement` invokes `unioss-api-spec` to write
  `<PREFIX>#[IID]_API_SPEC.md` into the current round dir.
- **Standalone:** `/unioss-api-spec <endpoint|controller>` — writes nothing
  under `.walkthrough/` unless the user asks (consistent with other standalone
  stages).

The skill reads the endpoint's controller/validation to fill: URL, method,
auth header, request params (type/required/rules), request example, response
success/error/401 shapes, and the HTTP error-code table.

---

## Non-goals

- No change to GATE 0/1/2 behavior.
- No auto-merge, ever.
- No refactor of unrelated scripts or skills.

## Version

`plugin.json` 1.4.0 → **1.6.0** (1.5.0 already shipped).

## Testing

- `box.test.mjs`: wide-glyph right-edge alignment.
- `link.test.mjs`: WSL vs native emission.
- `phpunit-config.test.mjs`: apply writes config values / import toggle; restore
  is a no-op contract (git-level).
- `ship.test.mjs`: MR create payload shape (assignee/reviewer/labels/options),
  URL building; POST is not exercised against live GitLab in unit tests.
- `config.test.mjs`: `tester.*` defaults + `US_TESTER_*` env emission.
