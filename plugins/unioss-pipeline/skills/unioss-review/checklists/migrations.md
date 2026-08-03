# Checklist — Migrations & DB design (`application/migrations/`)

## Migration file

- [ ] Filename: `<timestamp>_<desc>_<ticket_id>_<index>.php`
- [ ] Class name: `Migration_<Desc>_<Ticket_id>_<Index>`
- [ ] `up()` and `down()` both implemented and tested
- [ ] Migration includes author and purpose in comments/docblock.
- [ ] Wrapped in `$this->db->trans_start()` / `trans_complete()`
- [ ] No `SET`, `USING BTREE`, or non-default DB params
- [ ] `CHECK EXISTS`: verify existing columns, indexes, and constraints before adding, changing, or dropping them
- [ ] Japanese column comments present in DDL for every schema, table, and column (mandatory)
- [ ] Foreign key constraints created for all relationships; reference action must be `RESTRICT` only — `CASCADE`, `SET NULL`, and `NO ACTION` are forbidden
- [ ] Indexes added for FK and frequently filtered columns
- [ ] No direct staging/production DB SQL execution — all DB structure changes go through migration files only

## Column position (mandatory)

- [ ] **Every `ADD COLUMN` against an existing table specifies its position** — `AFTER \`<column>\`` (or `FIRST` for a column that genuinely belongs at the head). A bare `ADD COLUMN` lets MySQL append to the end, drifting column order away from the documented schema and past the required audit tail. 🔴 when a position is missing on an existing table — the resulting schema differs per environment depending on migration order.
- [ ] The chosen position groups the column with its related columns and keeps the audit tail last.
- [ ] Table column order ends with: `delete_flg`, `created_at`, `updated_at` (omit any that are not applicable).

## DB design

- [ ] Database design must clearly reflect specifications so requirements can be understood without reading application code.
- [ ] DB structure or production/staging data changes must be performed through migrations only, never through direct manual SQL.
- [ ] Foreign keys should be used for relationships wherever feasible to protect data integrity.
- [ ] Avoid storing multiple data items in one JSON-like column; normalize into relational tables where feasible.
- [ ] If JSON-like storage is unavoidable, store it as a text string, not as a MySQL `JSON` type.
- [ ] Select only necessary columns; `SELECT *` is forbidden.
- [ ] Add indexes for foreign keys and frequent filters.
- [ ] Required Japanese comments must be present for every new DDL column.
- [ ] New boolean columns are named `is_*` / `has_*` (e.g. `is_active`), not a bare adjective. Legacy `*_flg` columns are out of scope.
