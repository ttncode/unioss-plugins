---
name: migration up/down verify (multi-environment)
---

# Migration Up/Down Verify Guide (multi-environment)

## 1. Identify current/target environment

ENVIRONMENT is set in `AdminPage/public/index.php`:
`define('ENVIRONMENT', isset($_SERVER['CI_ENV']) ? $_SERVER['CI_ENV'] : '<default>');`

For the local docker checkout, read the resolved value instead of hardcoding it — it comes from the real `index.php` default (and any `CI_ENV` override in `docker-compose.yml` / `z-docker-resources/`):
`node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-app-env.mjs"`

For any other target (staging box, production box, etc.) `CI_ENV` is injected at that host's webserver/php-fpm level (outside this repo). To confirm the live value on a given host:

- Ask infra/DevOps what `CI_ENV` that vhost sets, or
- Temporarily add `echo ENVIRONMENT; exit;` right after the `define(...)` line in `AdminPage/public/index.php`, hit any URL on that host, read the value, then immediately revert the line — never commit this debug line.

## 2. Confirm the target environment has a migrations folder

Only these environments have a `migrations/{ENV}/` directory (CI errors if missing):
`development`, `testing`, `staging`, `production`, `virtualbox_direct_domain`.
(`demo`, `sample`, `virtualbox`, `virtualbox20head`, `virtualbox_fusion` have config only — do not attempt migrate there.)

- Config file to edit: `AdminPage/application/config/{ENV}/migration.php`
- Migration files: `AdminPage/application/migrations/{ENV}/`
- Endpoint: `http://{target-host}/admin/migrate` (same Migrate controller for every environment).

`migration_enabled = TRUE` is already confirmed for development/staging/production/virtualbox_direct_domain.

## 3. Before touching staging/production/virtualbox: check what up() AND down() destroy

Read both methods together and ask:

1. Does `up()` delete/modify pre-existing data (rows/columns/tables that existed before this migration)?
2. Does `down()` actually restore it, or is it a no-op / partial restore?

| up() touches pre-existing data?           | down() restores it?          | Verdict                                                          |
| ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| No (only creates new table/column)        | drops only what up() created | Safe — nothing pre-existing at risk                              |
| Yes (DELETE/UPDATE/DROP on existing data) | Yes, fully                   | Confirm before running (risk if down() is buggy)                 |
| Yes (DELETE/UPDATE/DROP on existing data) | No / no-op                   | Irreversible — confirm before running up() itself, not just down |

Example, irreversible case (`20260608090246_delete_duplicated_asct_records_a1798_241.php`):
`public function up() { /* DELETE FROM ascts ... duplicate rows, real data */ }`
`public function down() { echo "..."; return true; }  // does NOT restore deleted rows`
Running up() on staging/production here permanently removes those `ascts` rows — down() gives no way back.

**Rule:** STOP and ask the user for explicit go-ahead before running up() OR down() whenever either one destroys data that existed before the migration and the other side can't restore it. Say plainly what's deleted, on which table, on which environment, whether it's recoverable, and wait for confirmation. Pure create-then-drop cases (nothing pre-existing touched) can proceed without asking.

## 4. Run the verify (per-environment)

1. Note the new migration's timestamp and the previous active timestamp in that env's `migration.php`.
2. Up: set `migration_version` to the new timestamp → hit `/admin/migrate` → confirm before/after version.
3. Down (only after user confirms, see step 3): set `migration_version` back to the previous timestamp → hit `/admin/migrate` → confirm before/after version + DB reverted.
4. Restore `migration_version` to the latest timestamp, reload once more, confirm the re-up is clean.
5. On dev, config edits can stay local/throwaway. On staging/production, treat the config edit itself as a deploy action — confirm with the user whether it should be committed/deployed or reverted after the test.
