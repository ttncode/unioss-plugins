---
name: unioss-pipeline reference — data
---

# UNIOSS Pipeline — Data & Environment Surface

Databases, on-disk source paths, and the browser MCP servers.

**Read this only if your stage queries a DB, greps real source, or drives a browser:** investigator, planner, coder, tester. The reviewer works from `git diff` and the scope writer from `changes.md` — neither needs this file.

Resolve config first — every path and credential below comes from it:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
```

## Database (read-only; non-interactive `-i`, not `-it`)

- **`$US_DB` (`_unioss`)** — Read-only production dump used ONLY for investigation and schema/data reference during Investigate/Planner stages.
- **Application Runtime DB (User-Configured Schema)** — The schema configured by the user in `AdminPage/application/config/<ENV>/database.php` and `FrontEnd/application/config/<ENV>/database.php`. Resolve `<ENV>` via `node "${CLAUDE_PLUGIN_ROOT}/scripts/detect-app-env.mjs"`, read `'database'` in `database.php`, and query that schema for migration verification and test evidence (see `unioss-verify/tester-access.md`):
  ```bash
  # Query the user's resolved app DB (e.g., USE <resolved_app_db>;)
  docker exec -i "$US_MYSQL" mysql -u"$US_DB_USER" -p"$US_DB_PASS" -e "USE <resolved_app_db>; SHOW TABLES;"
  ```
- **`testing_DB`** — Fixed database name imported and queried during PHPUnit runs (`phpunit-config.mjs apply --import`).

## Source paths (read the real code)

`config.mjs env` exports absolute host paths to each module. Resolve them before reading source — never assume cwd is a repo checkout:

```bash
eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
# $US_SRC_ROOT, $US_SRC_ADMIN_PAGE, $US_SRC_FRONT_END, $US_SRC_COMMON_HELPER, $US_SRC_COMMON_MODELS
grep -rn "some_symbol" "$US_SRC_ADMIN_PAGE/application"
```

`source.root` defaults to the workspace you opened Claude in; override with the `SOURCE_ROOT` env var or `source.root` in local config.

## MCP (tester)

- Browser verification uses the Playwright and/or chrome-devtools MCP servers. The tester drives the affected UI flow and snapshots when useful.
- The plugin's Playwright server is namespaced by the harness: its tools are `mcp__plugin_unioss-pipeline_playwright__browser_*` — **not** `mcp__playwright__*`. Permission rule: `mcp__plugin_unioss-pipeline_playwright` (`/unioss-doctor` offers to grant it).
- Tester URLs and credentials live in `../unioss-verify/tester-access.md` — that file is the single source. They are not config.
