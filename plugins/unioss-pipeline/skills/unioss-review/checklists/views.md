# Checklist — Views & Language files

## Views (`application/views/`)

- [ ] All dynamic output wrapped in `html_escape()` — no bare `echo $var`
- [ ] No inline `<style>` blocks — CSS in separate files
- [ ] No inline `<script>` blocks — JS in separate files
- [ ] No PHP logic (calculations, DB format, array building) — view is presentational only
- [ ] Uses `asset_url()` for assets, not `base_url() . 'asset/...'`
- [ ] CSS/JS versioned with `ASSET_VERSION` constant (e.g. `?v=<?= ASSET_VERSION ?>`) — no `rand()` cache-busting
- [ ] Uses `number_format()` on coins/yen — never raw integer output
- [ ] IDs and classes follow `kebab-case`
- [ ] Bootstrap 3 classes and ARIA attributes present where needed
- [ ] `form_open()`, `set_value()`, and `form_error()` used for CI3 CSRF and validation display
- [ ] Do not use abbreviations for class names
- [ ] CDN links are not loaded directly in views; required assets are downloaded into source code.
- [ ] Limit `!important` usage in CSS.
- [ ] Prefer `rem` and `1px` units where appropriate.
- [ ] Default image URLs fall back to a placeholder image.
- [ ] PHP variables passed to JavaScript use `json_encode()`.
- [ ] Lists are paginated.
- [ ] Views do not query the database.

## Language files (`application/language/japanese/*_lang.php`)

- [ ] All user-facing strings (notifications, success/error messages, validation messages, API response messages) are stored in a `*_lang.php` file — never hardcoded inline in controllers, models, libraries, or views
- [ ] Lang file named after its feature domain: `order_lang.php`, `vms_lang.php`, etc. — one file per feature area
- [ ] Key names follow the pattern `[module].[domain]_[status_or_error]` — e.g.:
  ```php
  $lang['vms.validation_error']
  $lang['vms.store_not_found']
  $lang['vms.product_invalid']
  $lang['vms.service_type_not_enabled']
  ```
- [ ] No duplicate keys within a lang file or across lang files for the same feature
- [ ] New lang keys added alongside the code change — never leave strings hardcoded as a "temporary" measure
