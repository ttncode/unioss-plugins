---
name: unioss-bump-migration
description: Use when bumping a UNIOSS migration timestamp, reindexing files, and updating the migration config and tests.
---

# UNIOSS Migration Bumper

## Overview

Move a set of migrations — plus their configs and tests — from an old timestamp to a new one. **Core principle:** reindex from the current active sequence, never the directory's absolute max index.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

## Input

- **OLD_TS** — 14-digit timestamp of the target migrations (e.g. `20260114101209`).
- **NEW_TS** — 14-digit replacement timestamp. From the user, or `date +"%Y%m%d%H%M%S"`.

### Locations

- **Migrations** — `AdminPage/application/migrations/{production,staging,testing,virtualbox_direct_domain}/`
  - Format: `<TS>_<action>_<ticket>_<index>.php`
- **Configs** — `AdminPage/application/config/{production,staging,virtualbox_direct_domain}/migration.php`
- **Tests** — `AdminPage/application/tests/migrations/Migration_<TS>_test.php`

## Workflow

### A. Rename & update migrations

1. Find all PHP files starting with `OLD_TS_`.
2. **Reindex.** Calculate a `NEW_INDEX` for each file: unique, monotonically increasing (e.g. `001`, `002`), greater than the index of the **most recent migration** (highest timestamp) in that environment's folder.

   **CRITICAL:** do not use the absolute maximum index in the directory — some folders hold outlier files with very high indices (e.g. `1471`) left by much older timestamps. Always sort by timestamp first to find the current active sequence index.

3. **Rename.** Replace `OLD_TS` with `NEW_TS` and update the trailing index to `NEW_INDEX`.
4. **Update the class name** inside the file to match the new filename: timestamp (new) + action + ticket + index (new).

### B. Update config files

In the `production`, `staging`, and `virtualbox_direct_domain` config folders:

1. Locate the `migration_version` lines.
2. **Remove** any line (commented or active) containing `OLD_TS`.
3. **If OLD_TS was the active version:** replace `OLD_TS` with `NEW_TS` in that line.
4. **If OLD_TS was NOT active:**
   - Comment out the current active `migration_version`.
   - Insert `$config['migration_version'] = NEW_TS;` as the new active version.
5. No empty line between migration versions in config files.

**Case: OLD_TS is NOT the active version**

```php
// Before (OLD_TS = 20260109100000)
#$config['migration_version'] = 20260109100000;
#$config['migration_version'] = 20260109150000;
$config['migration_version'] = 20260110180000;

// After (NEW_TS = 20260111180000)
#$config['migration_version'] = 20260109150000;
#$config['migration_version'] = 20260110180000;
$config['migration_version'] = 20260111180000;
```

**Case: OLD_TS IS the active version**

```php
// Before (OLD_TS = 20260110180000)
#$config['migration_version'] = 20260109150000;
$config['migration_version'] = 20260110180000;

// After (NEW_TS = 20260111180000)
#$config['migration_version'] = 20260109150000;
$config['migration_version'] = 20260111180000;
```

### C. Update migration tests

1. **Rename** `Migration_<OLD_TS>_test.php` → `Migration_<NEW_TS>_test.php`.
2. **Update content:**
   - Replace `OLD_TS` with `NEW_TS` in the class name and all references.
   - Set `MIGRATION_VERSION_UP` to `NEW_TS`.
   - Set `MIGRATION_VERSION_DOWN` to the latest timestamp remaining in the migration directory (the version to revert to).

## Output

Verify before reporting:

- `rg "<OLD_TS>"` returns nothing under `AdminPage/application` — no stale references.
- Class names exactly match their new filenames.
- Each config file has exactly one active `migration_version`, and it is `NEW_TS`.

Then summarize: the `NEW_TS` used, the files renamed, and a config diff snippet.

## Common Mistakes

| Mistake | Why it breaks | Instead |
| --- | --- | --- |
| Using the directory's absolute maximum index | Some folders hold outlier files with very high indices (e.g. `1471`) left by much older timestamps | Sort by timestamp first, then index off the current active sequence |
| Leaving a blank line between `migration_version` lines | Breaks the expected config format | No empty line between migration versions |
| Leaving `MIGRATION_VERSION_DOWN` stale | Test would revert to the wrong version | Set it to the latest timestamp remaining in the migration directory |

## Related files

- `skills/unioss-generate-migration/SKILL.md` — creating migrations in the first place.
- `skills/unioss-implement/migration-verify.md` — the up/down/re-up verification.
