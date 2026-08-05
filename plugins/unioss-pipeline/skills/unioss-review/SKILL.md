---
name: unioss-review
description: Use when diff-reviewing the UNIOSS coder's changes against clean-code, CI3, plan-adherence, and security standards — the reviewer stage; outputs a severity-indexed report.
---

# UNIOSS Code Review Skill

## Overview

Diff-scoped review of the coder's changes against UNIOSS clean-code, CI3, plan-adherence, and security standards, flagging every place new/changed code breaks a standard.

**Core principle:** Report only — never edit files, unless the user explicitly follows up with `fix #N`.

Follow `../unioss-pipeline/REFERENCE.md` → Shared stage rules (read-only, round path, artifact paths, standalone use). You work from `git diff` and `changes.md` only — you do not need `REFERENCE-git.md` or `REFERENCE-data.md`.

---

## Input

- The changes manifest `round-<N>/changes.md` — the authoritative list of what changed.
- The round path.
- **Standalone:** the file(s) named in the request, with no round path.

Scope is the **diff only**. Never comment on code outside the `+` lines.

## Workflow

### Step 1 — Scope from the pipeline

Read `.walkthrough/<PREFIX>-[IID]/round-<N>/changes.md` to get the changed files and repo. `cd` into that repo (`AdminPage` or `FrontEnd`).

### Step 2 — Load only the checklists this diff needs

The checklists live in `./checklists/`. **Read only the ones whose trigger matches a path in `changes.md`** — a migration-only diff must not pull in the JavaScript checklist, and a JS-only diff must not pull in the PHP ones. Decide the set once, up front, from the file list; do not re-read a checklist you already loaded.

| Checklist                   | Load when a changed path…                                   |
| --------------------------- | ----------------------------------------------------------- |
| `checklists/php-common.md`  | ends in `.php` (**always**, alongside the layer file below) |
| `checklists/controllers.md` | is under `application/controllers/`                         |
| `checklists/models.md`      | is under `application/models/`                              |
| `checklists/views.md`       | is under `application/views/` or `application/language/`    |
| `checklists/helpers.md`     | is under `application/helpers/`                             |
| `checklists/migrations.md`  | is under `application/migrations/`                          |
| `checklists/tests.md`       | is under `application/tests/`                               |
| `checklists/javascript.md`  | ends in `.js`                                               |

The Security, Logging, Coding-standards, Philosophy, and False-positive sections below are **universal** — they apply to every review regardless of which checklists loaded.

For a diff that touches a file type with no checklist (`.css`, `.json`, `.sql`, config), review it against the universal sections plus general clean-code judgment.

### Step 3 — Read the diff

```bash
git diff            # working-tree changes from the coder stage
```

Judge `+` lines for the quality of new/changed code. Do **not** ignore `-` lines — each removal is a change with consequences. Whenever the diff deletes a referenceable symbol (a constant, function/method, class, DB column, route, config key, parameter, or a guard/branch), grep the repo for surviving references — e.g. `grep -rn "REMOVED_NAME" AdminPage FrontEnd` — and flag any remaining usage as 🔴 Critical (the change breaks callers). Likewise, when a signature, return shape, or column is changed (not just added), check the call sites. Unchanged context outside the diff is otherwise out of scope.

### Step 4 — Classify each issue

Assign every finding to one of three severity levels:

| Icon | Severity         | Definition                                                                    |
| ---- | ---------------- | ----------------------------------------------------------------------------- |
| 🔴   | **Critical**     | Bug, data corruption risk, security vulnerability, or execution-stopping flaw |
| 🟡   | **Violation**    | Breaks a rule; degrades maintainability or safety                             |
| 🟢   | **Good / Style** | Noteworthy improvement or minor style note — **no action required**           |

**🟢 never carries an action item.** It records what the coder got right, so the gate treats a 🟢-only review as clean and offers no fix pass. If you want something changed, it is 🟡 — a request for work filed as 🟢 is silently dropped.

### Step 5 — Assign sequential indices

Every finding gets a unique global index: `[#1]`, `[#2]`, `[#3]`, etc.

Group by file, but the index is continuous across the entire report — never reset per file.

### Step 6 — Output the report

Write the report to `.walkthrough/<PREFIX>-[IID]/round-<N>/review.md` and return the severity counts (🔴/🟡/🟢), the top-priority list, and the backticked absolute path to `review.md` (REFERENCE → Artifact paths) — do not paste the full report body.

Structure the report as follows:

```
# Code Review — <Feature Name> (<branch name>)
> Scope: Changed lines only

## 📋 Index of Issues
### 🔴 Critical
- [#N] File — short description & code
...
### 🟡 Violations
- [#N] File — short description & code
...
### 🟢 Good Changes
- [#N] File — short description
...

---

## Summary Table

| File | 🔴 | 🟡 | 🟢 |
|------|----|----|-----|
| ...  | N  |  N |  N  |
| **Total** | N | N | N |

## Top Priority Fixes

| # | File | Issue |
|---|------|-------|
| [#N] | file | description |
```

---

## Output

1. **One index per finding**: each `[#N]` appears exactly once in the index and once as a section header.
2. **Flag good changes** too — not everything is a problem.
3. **Pinned code snippets**: each finding shows the exact new `+` lines being discussed, clearly marked `// NEW:`.
4. **Concrete fix**: every 🔴 and 🟡 must include a `**Fix:**` with working code or a precise instruction.
5. **Summary table**: always end with totals per file and a "Top Priority Fixes" table sorted by severity.

---

## Template: Minimal Report (for small diffs, < 5 files)

````markdown
# Code Review — <feature> (<branch>)

> Scope: Changed lines only.

## Issues

### [#1] 🔴 `FileName.php` — `method()` — title

```php
// BAD:
$bad_code_here;
```

Explanation.
**Fix**: `$good_code_here;`

### [#2] 🟡 `FileName.php` — title

...

### [#3] 🟢 `FileName.js` — title ✅

Good because X.

---

## Summary

| File           | 🔴    | 🟡    | 🟢    |
| -------------- | ----- | ----- | ----- |
| `FileName.php` | 1     | 1     | 0     |
| `FileName.js`  | 0     | 0     | 1     |
| **Total**      | **1** | **1** | **1** |

## Top Priority Fixes

| #    | File           | Issue              |
| ---- | -------------- | ------------------ |
| [#1] | `FileName.php` | Fix execution flow |
````

## Agent Execution Notes

- **Load only the checklists Step 2 selects.** This is the single biggest cost lever in this stage — the full checklist set is several times the size of a typical diff.
- **Do not read entire files** — only read the diff lines and their immediate context (±10 lines) to understand intent.
- **Batch file reads**: if multiple files are changed, read all diffs in one pass before starting the report.
- **One report per session**: produce a single consolidated report, not one per file.
- **Token efficiency**: keep code snippets to the relevant lines only; avoid quoting entire methods.
- **Ambiguous changes**: if the intent of a change is unclear, note the ambiguity and flag it as 🟡 with a question rather than assuming incorrectly.

---

## Security Rules (Always Check)

| Rule       | Check                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| XSS        | `$this->input->post(null, true)` / `$this->input->get(key, true)`               |
| Output     | `html_escape()` on all echoed data                                              |
| SQL        | Query Builder or parameterized `$this->db->query($sql, $binds)`                 |
| CSRF       | `form_open()` on all forms; CSRF token in AJAX headers                          |
| Auth       | Server-side user/session validation — never trust client-side IDs               |
| Secrets    | No credentials in code; no secrets in logs                                      |
| Redirect   | Always `redirect()` + `return` after error — no fall-through                    |
| Rate limit | Sensitive public endpoints should be rate-limited or throttled where applicable |
| API        | JSON APIs use `application/json; charset=utf-8` and structured error responses  |

---

## Logging & Monitoring Rules

- Use `unioss_debug($debug_contents = '')` or CI's `log_message('error'|'debug'|'info', $msg)`.
- Never log secrets, credentials, raw tokens, or sensitive personal data; mask them before logging.
- Include timestamp, correlation ID, request ID, or useful context where possible.
- Logs should be informative enough for investigation without leaking sensitive data.

---

## Coding Standards

- Base style: **CodeIgniter 3 Style Guide**; everything else follows **PSR-12**.
- Auto-formatter is available in the development environment (PHPCS / PHPCBF).
- Refactoring must be done on a **separate branch** — never mix formatting/refactoring commits with feature commits (makes diffs unreviewable).
- New code must produce **zero PHP errors or warnings** — all error levels should be clean.
- Use **PHPCS** to check and **PHPCBF** to auto-fix code formatting issues in the development environment.
- PSR-12 formatting uses 4-space indentation and Unix newlines.

---

## Review Philosophy (from UNIOSS Review Policy)

- **Split into functions** — favour small, focused functions for readability and maintainability.
- **Do not force common processing** — if you are unsure whether two flows can share logic, keep them separate. Premature unification creates coupling and hides bugs.
- **WEB app portability** — domain and installation directory must always be configurable (no hardcoding).
- **Quality over low-cost** — low-quality code that requires rework is more expensive in the long run. Invest time in DB design and stable specifications.
- **Security first** — CSRF tokens, XSS filtering, output escaping, authorization checks, and prepared statements are mandatory review concerns.
- **I18N ready** — new user-facing strings belong in language files unless explicitly scoped otherwise.
- **Accessibility** — Bootstrap 3 UI changes should include appropriate ARIA attributes and keyboard-friendly behavior.

---

## Common False Positives (Do NOT flag these)

- `isset()` used for checking array key existence in PHP < 8 compat code — acceptable
- `html_escape()` omitted on integer/`number_format()` output — integers are safe
- `$this->load->model()` calls in constructors — standard CI3 pattern
- Trailing comma in last array item — acceptable in PHP 7.2+
- `unset($reference)` after `foreach (&$item)` — required PHP pattern, not dead code
- Pre-existing names that break the `is`-prefix or comment rules — those apply to **new** code only. A legacy `delete_flg` column or an untouched old comment is not a finding.

---

## Standalone use

See REFERENCE → Shared stage rules → Standalone use (e.g. `/unioss-review Review this controller …`): do the task on the named file(s), write nothing under `.walkthrough/` unless asked, skip gates. Select checklists by the named file's path exactly as in Step 2.

Then close with a menu (REFERENCE → Ending a run) rather than leaving the findings on screen:

```
Review complete — 🔴 <n> · 🟡 <n> · 🟢 <n>. What would you like to do?

1. Fix the findings
2. Walk through a specific finding
3. Stop here

Which option?
```

`1` → `unioss-pipeline:unioss-implement` (this skill never edits).

**With 🔴 0 and 🟡 0, there is nothing to fix** — 🟢 is Good/Style. Close with the clean menu instead, and never lead with a fix pass:

```
Review clean — 🔴 0 · 🟡 0 · 🟢 <n> good changes. What would you like to do?

1. Walk through the good changes
2. Stop here

Which option?
```

Zero findings of any colour → `Review clean — no findings.` with the same two options. Inside the pipeline, ask nothing — GATE 3 owns this decision.

## Related files

- `./checklists/` — the per-filetype checklists Step 2 selects from.
- `rules/clean-code-php.md`, `rules/clean-code-javascript.md` — the underlying standards. Read one only when a finding needs the fuller rationale; the checklists already carry the reviewable rules.
- `agents/unioss-reviewer.md` — the subagent that runs this.
- `skills/unioss-implement/SKILL.md` — applies the fixes at GATE 3; this skill never edits.
- `skills/unioss-receiving-code-review/SKILL.md` — reception rigor for evaluating feedback (verify before implementing).
- `skills/unioss-pipeline/REFERENCE.md` — shared stage rules.
