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
