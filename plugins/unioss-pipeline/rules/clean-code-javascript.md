---
description: "Clean Code rules for JavaScript"
globs:
  - "**/*.js"
  - "**/*.cjs"
  - "**/*.mjs"
  - "**/*.jsx"
alwaysApply: true
---

# Clean Code JavaScript

Apply these rules when writing or refactoring JavaScript. Optimize for readability, reusability, and refactorability.

## Variables

- Use meaningful, pronounceable names.
- Use one vocabulary per concept (don’t call the same thing `userInfo`, `clientData`, `customerRecord`).
- Make names searchable:
  - Replace magic numbers with named constants.
- Use explanatory variables (especially with regex/destructuring) instead of repeating complex expressions.
- Avoid mental mapping:
  - Prefer `locations.forEach(location => ...)` over single-letter variables.
- Don’t add unneeded context:
  - If the object/class already provides context, keep property names short (e.g., `car.color`, not `car.carColor`).
- Prefer default parameters over short-circuiting:
  - Use `function fn(x = defaultValue)` rather than `x || defaultValue` when appropriate (note: defaults apply only to `undefined`).

## Functions

- Keep function arguments small (0–2 ideally; 3 avoid; more => consolidate):
  - Prefer a single options object and **destructure** to document expected fields and help linters catch unused props.
- Functions should do **one thing**:
  - Extract helpers (e.g., `isActiveClient`) instead of mixing lookup + filtering + effects.
- Name functions by what they do (make intent obvious).
- Keep one level of abstraction per function:
  - Split tokenize/parse/etc. into separate functions/modules.
- Remove duplicate code:
  - Prefer a good abstraction; avoid cloning the same logic across variants.
- Set default objects cleanly:
  - Use `Object.assign(defaults, config)` (or `{...defaults, ...config}`) rather than mutating each key manually.
- Don’t use flags (booleans) as parameters to switch behavior:
  - Split into separate functions (e.g., `createFile` vs `createTempFile`).
- Avoid side effects:
  - Prefer pure functions; return values instead of mutating outer scope.
  - Avoid mutating input arrays/objects; clone/update immutably (e.g., `[...cart, item]`).
- Don’t write to global prototypes / global functions:
  - Avoid monkey-patching like `Array.prototype.*`; use composition or subclasses if needed.
- Favor functional style when it improves clarity:
  - Prefer `map/filter/reduce` over manual loops when it reads better.
- Encapsulate conditionals:
  - Move complex predicates into well-named functions (e.g., `shouldShowSpinner()`).
- Avoid negative conditionals:
  - Prefer `isPresent()` over `isNotPresent()` + `!`.
- Reduce conditionals with polymorphism:
  - Replace `switch` on `type` with separate classes/strategies implementing the same method.
- Avoid type-checking when you can rely on consistent APIs/polymorphism:
  - Prefer `vehicle.move(...)` over branching on `instanceof`.
  - If you truly need stronger type guarantees, prefer TypeScript + tests/code review over verbose manual checks.
- Don’t over-optimize:
  - Trust modern runtimes unless profiling shows a real hotspot.
- Remove dead code:
  - Delete unused modules/functions; rely on version control history.

## Objects and Data Structures

- Use getters/setters (or closure-based access) when it improves encapsulation:
  - Makes validation/logging/lazy-loading easier and avoids scattered direct field edits.
- Keep members private where possible:
  - Prefer closures/modules to prevent accidental external mutation, especially for invariants.

## Classes

- Prefer ES2015+ `class` syntax over ES5 constructor/prototype patterns for readability.
- Use method chaining when it **improves readability** and your API is designed for it:
  - Return `this` intentionally; don’t force chaining everywhere.
- Prefer composition over inheritance:
  - Use inheritance mainly for true “is-a” relationships; otherwise model “has-a” with composed objects.

## SOLID

- **SRP**: One reason to change per class; separate auth from settings, etc.
- **OCP**: Add new behavior via new implementations rather than editing large `if/else` branches.
- **LSP**: Avoid invalid “is-a” hierarchies that break substitutability (classic Square/Rectangle pitfall).
- **ISP**: Don’t require consumers to provide fat configuration/“interfaces” they don’t use; keep options modular.
- **DIP**: Depend on abstractions:
  - Inject dependencies rather than constructing them internally (e.g., inject `requester` into `InventoryTracker`).

## Testing

- Testing is mandatory for confidence; pick a framework + coverage tooling and use them consistently.
- One concept per test:
  - Split multiple scenarios into separate `it(...)` blocks for clarity and diagnosis.

## Concurrency

- Prefer Promises over callbacks to avoid nested control flow.
- Prefer `async/await` over long `.then()` chains when it makes flow clearer:
  - Always handle errors (`try/catch` or `.catch`).

## Error Handling

- Don’t ignore caught errors:
  - Use `console.error`, user notification, and/or error reporting as appropriate.
- Don’t ignore rejected promises:
  - Always `.catch` or use `try/catch` with `await`.

## Formatting

- Don’t argue about formatting:
  - Use an auto-formatter / linter and be consistent.
- Use consistent capitalization conventions for constants/functions/classes.
- Keep callers and callees close (vertical proximity):
  - Make files read top-to-bottom like a newspaper.

## Comments

- Comment only when business logic is non-obvious:
  - Prefer expressive naming and small functions over explanatory comments.
- Don’t leave commented-out code:
  - Use version control history instead.
- Don’t keep journal comments:
  - Use `git log` instead.
- Avoid positional marker comment blocks:
  - Let structure and naming provide readability.

## Translation

- The original guide includes many translations; keep *this* rules file language-neutral and focused on code rules.
