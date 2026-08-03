# Checklist — PHP (common)

Load for **any** changed `.php` file. Layer-specific checklists (controllers, models, views, helpers, migrations, tests) stack on top of this one.

## Project Baseline Rules

- [ ] Target stack remains compatible with **CodeIgniter 3.x**, **PHP 8.1+**, **Bootstrap 3.x**, **jQuery**, **MySQL 8.0**, **PHPUnit with CI3 bootstrap**, and **Composer**.
- [ ] Code remains backward-compatible with CI3 loader conventions; avoid traits/features/patterns that break CI3 loading behavior.
- [ ] Environments are respected through CI3 `ENVIRONMENT` (`development`, `staging`, `testing`, `production`); no environment-specific branching is hardcoded in feature code.
- [ ] Follow **SOLID**, **CRY**, **KISS**, and **YAGNI** principles when reviewing new code.
- [ ] Prefer CI3 standard libraries/helpers/methods over ad-hoc globals or custom reimplementation.
- [ ] New code fails gracefully; do not introduce fatal `die`/`exit` flows except existing migration execution patterns if explicitly accepted by the project.
- [ ] Avoid external dependencies beyond CI3 + Bootstrap 3 + PHPUnit unless the requirement explicitly asks for them.
- [ ] New code should be self-consistent and runnable inside a typical CI3 app.

## Naming & Structure Rules

- [ ] Files follow project naming: `Snake_case` for controllers, models, libraries, and migration classes; `snake_case` for helper files/functions.
- [ ] Controllers, models, and libraries use `Snake_case` class names; methods, variables, and properties use `snake_case`; constants use `SCREAMING_SNAKE_CASE`.
- [ ] Routes use `kebab-case` URLs where possible and are mapped through `application/config/routes.php`.
- [ ] Tests use `Snake_case` for class names and `snake_case` for test methods.
- [ ] DB tables and columns use `snake_case`.
- [ ] SQL keywords are uppercase, and raw SQL must be parameterized.
- [ ] The generated or changed project structure should preserve standard CI3 directories and avoid misplaced feature code.
- [ ] **Booleans are prefixed `is` (or `has`/`can`)** — `$isActive`, `$hasStock`, `canEdit()`; never a bare `$active`, `$deleted`, `$enabled`. Applies to variables, properties, array keys, new DB columns, and any method returning `bool`. 🟡 when a new boolean lacks the prefix. Pre-existing names (`delete_flg`) are out of scope — flag only new code.

## PHP — Global

- [ ] Domain and installation directory must always be configurable (no hardcoding). Using CI3 config `$this->config->load(...)`
- [ ] No municipality/user-specific hardcoded branching — use config or DB flags (on/off) to toggle features per tenant instead
- [ ] Internal DB IDs are never exposed to the client or external systems — use aliases, codes, or slugs instead
- [ ] PHPDoc on every public method/class/property (params, return, throws), including `@property` for CI3 magic-loaded dependencies and code jumping
- [ ] Type hints on all new method parameters and return values
- [ ] No direct `$_POST` / `$_GET` access — use `$this->input->post(null, true)` / `$this->input->get(key, true)` with XSS filter enabled
- [ ] No N+1 queries inside loops
- [ ] All user-facing messages (flash notifications, success/error responses, validation feedback) must be loaded from a `*_lang.php` file via `$this->lang->load('xxx_lang')` — no hardcoded strings inline
- [ ] Session keys are strings — no numeric keys or ambiguous types stored
- [ ] No dead code (unused variables, unreachable branches)
- [ ] If loops too many times (more than 2) `array_unique(array_diff(array_column(...)))` replaced with `foreach` loops
- [ ] Model loaded with uppercase first char: `$this->load->model('Order_model')`
- [ ] No magic numbers — use named constants
- [ ] Input trimmed before saving: `trim()`
- [ ] Prioritize using CI3's loading mechanism instead of `require`, `require_once`, `include`, `include_once`
- [ ] `foreach ($nullable_var ?? [] as ...)` guards on nullable arrays
- [ ] `??` null-coalescing instead of `isset()` ternaries
- [ ] New constants follow `SCREAMING_SNAKE_CASE`
- [ ] Unit comment present for numeric constants (seconds, days, pixels, etc.)
- [ ] Files stay under 1000 lines and methods remain short; split oversized files/methods into focused units.
- [ ] Function parameters are explicit and typed where possible; avoid ambiguous array parameters for new code.
- [ ] Do not use reference parameters for new functions unless there is a proven technical need.
- [ ] Use existing date/time helpers where possible, such as `current_time()` and `create_time_from_format()`.
- [ ] Code should produce no PHP errors, warnings, or notices under development error reporting.

## PHP — Comments

- [ ] New comments explain **Why** the code exists rather than only **What** it does; comments are written in English.
- [ ] **No spec, plan, or ticket identifiers in comments** — no `REQ-1`, `CON-4`, `SEC-2`, `GUD-3`, `AC-5`, no `spec.md` / `implementation.v1.md` references, no "per the plan". Those live under `.walkthrough/`, never ship with the source, and go stale the moment the spec is revised. The comment must read as if that documentation did not exist: state the business rule or constraint itself. 🟡 on every occurrence, with the rewritten comment as the **Fix**. The ticket number belongs in the branch name, commit message, and migration filename — not the source.
- [ ] No commented-out code, no journal comments.

## PHP — Constants

- [ ] Constants defined with `defined('X') or define('X', value)` pattern
- [ ] No unused constants added
- [ ] Shared constants for both AdminPage and FrontEnd go in `/application/helpers/common/constants_helper.php`; app-specific constants go in each app's `/application/config/constants.php`
