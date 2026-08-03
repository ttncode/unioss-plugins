# Checklist — Helpers (`application/helpers/`)

- [ ] Helpers are **pure assistants** — stateless utility functions only; no database queries and no business logic inside a helper
- [ ] A helper must not load models or libraries (allow load library if this helper only return a library instance) — if DB access is needed, move the logic to a model
- [ ] Helper functions are globally available; keep them generic and reusable, not feature-specific
- [ ] Function names follow `snake_case` and are descriptive of what they return/do; boolean-returning helpers are prefixed `is_` / `has_` / `can_`
- [ ] No side effects (no session writes, no redirects, no output) unless the helper's sole purpose is output (e.g., `log_message_helper`)
- [ ] Shared helpers used by both AdminPage and FrontEnd live in `application/helpers/common/`
