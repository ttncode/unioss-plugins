# `changes.md` Format Template

Save to: `.walkthrough/<PREFIX>-[IID]/round-<N>/changes.md`

```markdown
# Changes Manifest — <PREFIX>#[IID] (Round <N>)

> **Origin Repo:** AdminPage | FrontEnd
> **Feature Branch:** feature/v3/#<IID>

## Changed Files

| Module | File Path | Change Type | Summary |
|---|---|---|---|
| admin-page | `application/controllers/Order.php` | Modified | Add validation for product discount |
| common-models | `submodules/common-models/Order_model.php` | Modified | Update order total calculation logic |

## Database Migrations

- `application/migrations/development/20260727120000_add_discount_col_1234.php` (applied & verified)

## Fast Test Verification (AdminPage)

- **Command:** `node scripts/phpunit-config.mjs apply --skip-import && ...`
- **Result:** PASS (2 tests, 5 assertions)

## GATE 3 Fixes (populated only if GATE 3 fix requested)

- Fix [#1]: Sanitized inputs in `Order.php:142`
- Re-verification: PASS
```
