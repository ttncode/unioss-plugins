# Checklist — Models (`application/models/`)

- [ ] Extends `CI_Model`; one model per table
- [ ] No cross-table queries that belong in another model
- [ ] Uses `$this->db->trans_start()` / `trans_complete()` for multi-step writes
- [ ] Returns typed data (array, int, bool) — never silently returns `null` on failure
- [ ] DB insert/update returns input data, not a re-query
- [ ] `SELECT *` forbidden — list only needed columns
- [ ] `delete_flg` filter applied on all relevant queries
- [ ] No direct model-to-model `$this->load->model()` orchestration (belongs in controller or library)
- [ ] `GROUP BY` present whenever `SUM()` / `COUNT()` + `ORDER BY` are used
- [ ] No JSON stored in a single string column unless absolutely unavoidable; prefer proper relational columns with FK constraints
- [ ] If JSON-like storage is unavoidable, the column uses text storage rather than MySQL `JSON` type.
- [ ] Data retrieval, processing, and validation rules live in models where they represent business/data rules.
- [ ] Query result limits and pagination are applied to prevent large data loads.
- [ ] Cache expensive lookups only where sensible and safe for the business rules.
- [ ] Boolean-returning methods and boolean columns read as a question: `isPublished()`, `is_active` — not `published()`, `active`.
