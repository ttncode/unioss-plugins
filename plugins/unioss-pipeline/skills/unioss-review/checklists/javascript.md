# Checklist — JavaScript

Standards: `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-javascript.md`.

- [ ] Written as a named module object (named JS module pattern per the clean-code rules)
- [ ] `constants: {}` block present with named constants for all magic numbers, hardcoded values, and fallback values — no literals inline
- [ ] `elements: {}` block caches all jQuery selectors at definition time
- [ ] Private methods prefixed with `_` (`_bindToggle`, `_openCard`)
- [ ] Protected methods prefixed with `__`
- [ ] Public methods have no prefix
- [ ] `init()` guards with early return if primary element not found
- [ ] No always-truthy guards like `if ($)` or `if (window)`
- [ ] Event listeners use `document.addEventListener('DOMContentLoaded', ...)` not `$(function() {...})`
- [ ] Timers created with `setInterval` must call `clearInterval` when completed
- [ ] PHP variables passed to JS via `json_encode`, not inline echoed values
- [ ] `alert()` only for user-facing errors — no debug alerts
- [ ] If you need to access data from PHP, set data to `window.App = { ... }` at view
- [ ] JavaScript code is modular and avoids global side effects beyond the agreed module/window data entry point.
- [ ] Select directly on the target tag/element instead of broad document delegation unless delegation is necessary for dynamic elements.
- [ ] **Booleans prefixed `is` / `has` / `can`** — `isLoading`, `hasError`, `canSubmit`; never a bare `loading`, `error`, `submit`. Applies to variables, object properties, and `constants: {}` entries.
- [ ] **No spec, plan, or ticket identifiers in comments** — no `REQ-1`, `CON-4`, no `spec.md` references. State the business rule itself; the comment must make sense to a reader who has never seen the spec.
