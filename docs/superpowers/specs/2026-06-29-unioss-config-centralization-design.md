# UNIOSS Pipeline — Centralized Configuration

**Date:** 2026-06-29
**Status:** Approved design, ready for implementation planning
**Plugin:** `plugins/unioss-pipeline`

## Problem

Configuration that varies per machine — Docker container names, GitLab host, project
IDs, repo paths, base/protected branches, DB credentials — is currently hardcoded and
duplicated across `REFERENCE.md`, `scripts/doctor.mjs`, `hooks/php-lint.mjs`,
`hooks/guard-migrations.mjs`, `skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js`,
and several skill bodies. Two concrete consequences:

- **`doctor.mjs` and the runtime disagree.** The doctor reads container names from
  `docker-compose.yml`, but `php-lint.mjs` and the DB commands in `REFERENCE.md` hardcode
  `php-unioss3` / `mysql-unioss3` / `-pProotW`. A teammate with different container names
  passes the doctor and then fails at runtime.
- **A DB password lives in committed docs** (`REFERENCE.md`), the wrong pattern for a
  plugin that lists security as a goal.

This blocks three stated product goals: *support a team*, *multi-platform*, and
*quality/stability/security*.

## Goals

- One source of truth for all per-machine config.
- Zero-config for a standard UNIOSS setup (defaults reproduce today's behavior exactly).
- A teammate with a divergent setup overrides only what differs, in a local file.
- No secret in any committed file.
- Both consumers served: JavaScript (hooks, scripts) and Markdown skills executed by Claude.

## Non-goals (separate threads)

- Extending `php-lint` coverage to FrontEnd.
- A broad self-test suite for the whole plugin.
- Install / update / versioning documentation.

## Decisions (locked with the user)

| Decision | Choice |
| --- | --- |
| Config location | `.walkthrough/config/unioss.config.json` at the UNIOSS workspace root |
| Sharing | **Local only, gitignored.** Not committed. Team consistency comes from plugin-shipped defaults, not a shared file. |
| Resolution order | `env` → local file → built-in default (highest wins) |
| Markdown-skill consumption | CLI resolver the skills call via Bash (not direct file reads) |
| `db.password` | Lives in the config file (local DB); resolves env `DB_PASSWORD` → file → default `"ProotW"` |
| `GITLAB_TOKEN` | Stays env-only — never written to the file (personal API token, no sane default) |
| `db.testName` | **Not configurable** — `testing_DB` is a hardcoded constant in the UNIOSS codebase |

## Architecture

### Single resolver: `scripts/config.mjs`

The only module that knows configuration exists. Built-in defaults equal today's hardcoded
values, so an absent file yields current behavior.

Resolution per key, highest wins: **env var → local file → built-in default**, deep-merged
so a partial file overrides only the keys it sets.

**JS API:** `import { resolveConfig } from "../scripts/config.mjs"` → returns the fully
resolved object. Used by `doctor.mjs`, both hooks, and `fetch-ticket.js`.

**CLI (for skills and humans):**

- `node config.mjs print` — resolved config as a table, secrets redacted, each value
  annotated with its source (`default` / `file` / `env`).
- `node config.mjs get <dot.key>` — one raw value to stdout, for `$(…)` substitution in
  skill commands (e.g. `docker exec -i "$(node config.mjs get docker.mysql)" …`).
- `node config.mjs init` — scaffold `.walkthrough/config/unioss.config.json` with all
  defaults written out explicitly; never overwrites an existing file.
- `node config.mjs check` — validate types/required values; exit non-zero on error.
  Reports each value's source. This is what the doctor calls.

### Schema — `.walkthrough/config/unioss.config.json`

```json
{
  "gitlab": { "host": "gitlab.unioss.jp" },
  "repos": {
    "adminPage": { "id": 32, "path": "AdminPage/" },
    "frontEnd":  { "id": 31, "path": "FrontEnd/" }
  },
  "docker": { "mysql": "mysql-unioss3", "php": "php-unioss3" },
  "db": { "name": "_unioss", "user": "root", "password": "ProotW" },
  "git": {
    "baseBranch": "v3-master",
    "protected": ["master", "v3-master", "develop", "v3-develop", "v3-develop-tps"]
  },
  "artifactRoot": ".walkthrough"
}
```

Secrets handling:

- `db.password` — env `DB_PASSWORD` → file `db.password` → default `"ProotW"`. The file is
  gitignored/local, so a local-DB password here is acceptable. `print` shows `****** (file)`.
- `GITLAB_TOKEN` — env only, required, never in the file. `check` reports it `MISSING` when unset.
- `db.testName` is intentionally absent; `testing_DB` stays as the literal codebase constant.

### Consumers refactored (surgical)

- **`scripts/doctor.mjs`** — drop its own `readContainerNames`; use the resolver. `check`
  reports each value's source and validates. Offers `init` when no local file exists.
- **`hooks/guard-migrations.mjs`** — read `artifactRoot` from config instead of the hardcoded
  `.walkthrough`. **Also scope the plan-match to the active ticket's folder** so a stale plan
  from a different ticket can no longer authorize a migration edit (in scope — same file).
- **`hooks/php-lint.mjs`** — container name and repo path from config.
- **`skills/unioss-gitlab-issue-context/scripts/fetch-ticket.js`** — GitLab host from config.
- **`skills/unioss-pipeline/REFERENCE.md`** — replace literal values (host, project IDs,
  container names, DB password, branches) with a keys/defaults table plus the instruction to
  resolve via `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. REFERENCE remains the human
  doc; config becomes the runtime source of truth.
- **Skills `unioss-investigate` / `unioss-verify` / `unioss-implement`** — replace inline
  `docker exec … -pProotW` and literal container names with config-resolved commands via the
  `get` CLI.
- **`README.md`** — add a **Configuration** section: the `.walkthrough/config/unioss.config.json`
  file (local, gitignored), the full default schema, how to override only what diverges, the
  `config.mjs` commands (`init` / `print` / `check`), and that secrets stay in env
  (`GITLAB_TOKEN` required; `DB_PASSWORD` optional, with the local-DB default). Scoped to
  configuration only — install/update/versioning docs remain a separate thread.

### Doctor UX

`/unioss-doctor` runs `config check`: prints the resolved table with a source per value,
flags invalid/missing values, and offers to scaffold the local file via `init` when a
teammate's setup diverges from the defaults.

## Tests (`node:test`)

Scoped to the resolver — the seam most likely to break silently:

- precedence: env > file > default;
- deep merge: a partial file overrides only its keys;
- `db.password` fallback chain;
- secret redaction in `print`;
- missing file → pure defaults;
- `check` exits non-zero on an invalid value and on missing `GITLAB_TOKEN`.

## Back-compatibility

No new file is required to keep working. Defaults reproduce current behavior exactly; an
existing standard setup sees no change. The only committed-repo change with user-visible
effect is removing the literal DB password from `REFERENCE.md`.

## Acceptance criteria

1. With no config file and a standard setup, every stage behaves exactly as before.
2. Overriding `docker.mysql` in the file changes the container used by the doctor, the
   hooks, and the DB commands in the skills — consistently, with no other edits.
3. No literal DB password remains in any committed file.
4. `node config.mjs check` reports each value's source and fails loudly on missing
   `GITLAB_TOKEN` or an invalid value.
5. `guard-migrations` no longer authorizes a migration edit from a different ticket's plan.
6. The resolver test suite passes.
7. `README.md` documents the config file, the default schema, overriding, the `config.mjs`
   commands, and env-based secrets.
