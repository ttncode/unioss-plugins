---
description: "Clean Code rules for PHP"
globs:
  - "**/*.php"
alwaysApply: true
---

# Clean Code PHP

Use these rules when writing or refactoring PHP. Keep code readable, reusable, and easy to test/refactor.

## Variables

- **Use meaningful, pronounceable names**
  - Prefer `$currentDate` over `$ymdstr`.
- **Use one vocabulary per concept**
  - If it’s “user”, stick to `getUser()` rather than `getUserInfo()/getUserData()/...` for the same thing.
- **Use searchable names**
  - Avoid “magic numbers” and unclear flags. Use named constants / option flags.
  - Example: use `JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE` instead of `448`.
- **Use explanatory variables**
  - Prefer named capture groups / clear intermediate variables over opaque regex-index access.
- **Avoid deep nesting; return early**
  - Guard clauses first; keep happy-path flat.
- **Avoid mental mapping**
  - Prefer `foreach ($locations as $location)` over index loops with `$l`, `$li`.
- **Don’t add unneeded context**
  - Don’t repeat the type in field names (e.g., `Car::$make`, not `Car::$carMake`).
- **Prefix booleans with `is` (or `has`/`can` where it reads better)**. Example: `$isActive`, `$isDeleted`, `$hasStock`, `$canEdit` — not `$active`, `$deleted`, `$stock`, `$edit`.

## Comparisons

- **Prefer identical comparisons**
  - Use `===` / `!==` to avoid type-juggling surprises.
- **Use the null coalescing operator (`??`)**
  - Prefer `$name = $_GET['name'] ?? $_POST['name'] ?? 'nobody';` over nested `isset()` chains.

## Functions

- **Prefer typed default arguments over short-circuiting**
  - Use `function foo(string $name = 'default')` rather than allowing `null` and fixing later with `?:`.
- **Keep function arguments small (0–2 ideally)**
  - If you need many params, consolidate into value objects (e.g., `Name`, `City`, `Contact`) or a DTO.
- **Name functions by what they do**
  - Prefer `send()` over ambiguous names like `handle()` when intent is sending email.
- **One level of abstraction per function**
  - If a function mixes tokenizing, lexing, parsing, and orchestration: extract responsibilities into classes/services.
- **Don’t use boolean flags to branch behavior**
  - Split into separate functions like `createFile()` and `createTempFile()`.
- **Avoid side effects where possible; centralize them when needed**
  - Prefer pure functions; avoid mutating external state unexpectedly.
- **Don’t write to global functions / globals**
  - Avoid introducing global helpers like `config()` that can collide; use injected objects (e.g., `Configuration`).
- **Avoid Singletons**
  - Prefer dependency injection; make dependencies explicit and testable.
- **Encapsulate conditionals**
  - Prefer `$article->isPublished()` over `$article->state === 'published'` checks spread everywhere.
- **Avoid negative conditionals**
  - Prefer `isPresent()` rather than `isNotPresent()` + `!` usage.
- **Reduce conditionals with polymorphism**
  - Replace `switch` on “type” with an interface + implementations (e.g., `Airplane::getCruisingAltitude()`).
- **Avoid manual type-checking**
  - Prefer interfaces / polymorphism (`Vehicle::travelTo(...)`) over `instanceof` branching.
- **Use type declarations / strictness instead of runtime type-checking**
  - Prefer `function combine(int $a, int $b): int` over `is_numeric()` + exceptions.
- **Remove dead code**
  - Delete unused/legacy functions; rely on version control history instead.

## Comments

- **Comment why, not what.** The code already says what it does; a comment earns its place only by explaining a constraint, a trade-off, or a non-obvious business rule. Comments are written in English.
- **Never cite spec, ticket, or plan identifiers in a comment.** No `REQ-1`, `CON-4`, `SEC-2`, `GUD-3`, `AC-5`; no `spec.md` / `implementation.v1.md` references; no "per the plan" or "as required by the ticket".
  - Those identifiers live under `.walkthrough/`, which never ships with the source and goes stale the moment the spec is revised. A reader six months from now cannot resolve them, so the comment becomes noise pointing at nothing.
  - **Write the comment as if that documentation did not exist** — state the rule itself, in terms someone reading only this file can act on.

  ```php
  // BAD
  // REQ-2: only active shops may be listed (see spec.md)
  $this->db->where('status', self::STATUS_ACTIVE);

  // GOOD
  // Suspended shops stay in the table for audit, but must never appear in the storefront.
  $this->db->where('status', self::STATUS_ACTIVE);
  ```

  The ticket number belongs in the branch name, the commit message, and the migration filename — not in the source.
- **Delete commented-out code and journal comments.** Version control remembers.
- PHPDoc on every public method/class/property, including `@property` for CI3 magic-loaded dependencies.

## Database migrations

- **Every `ADD COLUMN` on an existing table names its position** — `AFTER \`<column>\``, or `FIRST` for the leading column. Those two are the only legal forms; a bare `ADD COLUMN` is never acceptable on a table that already exists.
  - MySQL appends a positionless column wherever the table happens to end at that moment, so the resulting column order depends on which migrations ran first. Two environments that ran the same migrations in a different order end up with different schemas — and a `SELECT *` or an `INSERT` without a column list then behaves differently between them.
  - Place the new column with the columns it relates to, and keep the `delete_flg, created_at, updated_at` tail last.
  - Resolve the position against the live table (`DESCRIBE <table>`) rather than guessing from a model or an older migration.

  ```php
  // BAD — lands in a different place per environment
  $this->dbforge->add_column('shops', ['is_featured' => ['type' => 'TINYINT', 'constraint' => 1]]);

  // GOOD
  $this->dbforge->add_column('shops', [
      'is_featured' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0, 'after' => 'status'],
  ]);
  ```

  A new table has no existing order to preserve, so its `CREATE TABLE` needs no positions.

## Objects and Data Structures

- **Encapsulate object state**
  - Don’t expose mutable public fields; use methods (`withdraw()`, `deposit()`, `getBalance()`).
- **Prefer `private` by default; use `public/protected` intentionally**
  - Public/protected members increase coupling and make changes risky; keep internals private unless required.

## Classes

- **Prefer composition over inheritance**
  - Model “has-a” with composition; reserve inheritance for real “is-a” relationships.
- **Avoid fluent interfaces (method chaining) unless strongly justified**
  - Chaining often harms encapsulation and testability; prefer explicit setter calls.
- **Prefer `final` classes where possible**
  - Limits inheritance sprawl, encourages composition, and reduces breaking changes (prefer `final` + interfaces).

## SOLID

- **SRP (Single Responsibility)**
  - One reason to change per class; split auth from settings, etc.
- **OCP (Open/Closed)**
  - Extend behavior by adding new implementations rather than editing existing branching logic.
- **LSP (Liskov Substitution)**
  - Don’t force incorrect “is-a” hierarchies (e.g., `Square extends Rectangle` pitfalls). Use shared interfaces instead.
- **ISP (Interface Segregation)**
  - Keep interfaces small; don’t force implementers to add unused methods (e.g., `Workable` vs `Feedable`).
- **DIP (Dependency Inversion)**
  - Depend on abstractions, not concretions; inject interfaces into high-level modules.

## DRY (Don’t Repeat Yourself)

- **Remove duplication via good abstraction**
  - Consolidate similar logic into one function/service; keep abstractions clean (bad abstractions can be worse than duplication).
