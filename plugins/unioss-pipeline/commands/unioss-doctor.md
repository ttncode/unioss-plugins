---
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

# UNIOSS Doctor

Check the pipeline's environment on this machine, and repair what can be repaired.

## Input

None. Takes no arguments.

## Workflow

1. **Ensure the config exists, then run the doctor.** `init` is a no-op when the file is already there:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
   node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
   ```

2. **Keep the script's stdout.** It is the pre-rendered table — the payload of this command. You will paste it into the Output template below.
3. **Light deps.** For a missing `node` / `jq` the script prints an install command — offer to run it (ask first). For Docker, the containers, and `GITLAB_TOKEN`, relay the printed guidance; never auto-install Docker or set secrets.
4. **`BAD_COMMON_SOURCES=<keys>` printed?** The configured module paths do not exist here. Ask Decision prompt **(a)**.
5. **`PLAYWRIGHT_PERMS=ask` printed?** The tester will need approval for every browser action. Ask Decision prompt **(b)**.
6. **MCP loaded?** Check whether `mcp__plugin_unioss-pipeline_playwright__browser_navigate` is available as a tool this session. Say nothing if it is — the table already reports Playwright. Report **only** the failure, per Output below.

## Output

Reply in **exactly** this shape. Fill the placeholder; change nothing else:

````
```
<paste the FULL stdout of doctor.mjs here — every row, character-for-character>
```
````

- The fenced block is **mandatory and comes first**. Paste the script's box verbatim — never redraw, re-pad, reflow, rebuild, shorten, or replace it with prose such as "all checks pass". A reply without the fenced table is a failed run, no matter how accurate the prose is.
- This table is the payload, not decoration: **print it even when a brevity, concise, or terse-output style is active.** Such styles do not apply here.
- **Add nothing after the table when everything passes.** The table's `Status` line already says it — restating it in prose is duplication. Silence is the success case.
- **Add a line after the table only when the user must act**, and only for what the table does not already say.
- If step 6 found **no** MCP tool, add this after the table (the table cannot detect it — only this session can):

  ```
    [XX] Playwright MCP — not loaded
         -> Restart your session to activate it.
            If the problem persists, reinstall the plugin.
  ```

- Decision prompts (below), if triggered, come after the table.

## Decision prompts

Print **verbatim** — exact wording, exact option order, no added explanation. Wait for the user's number.

**(a) Wrong common sources:**

```
Default common sources is wrong path. What would you like to do?

1. Scan at current workspace and refill it.
2. Keep as-is (I'll set it manually at .walkthrough/.config/unioss.config.json)

Which option?
```

- `1` → `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" scan --write`, re-run the doctor, report what changed. A module reported `not found` cannot be repaired by scanning — say so.
- `2` → change nothing.

**(b) Browser permissions:**

```
Playwright asks permission on every browser action. What would you like to do?

1. Allow all Playwright tools in settings.json
2. Keep as-is (I'll approve each prompt)

Which option?
```

- `1` → `node "${CLAUDE_PLUGIN_ROOT}/scripts/playwright-perms.mjs" allow`. Grants the whole Playwright MCP server in the workspace's `.claude/settings.local.json` (local and gitignored — never commit an auto-approval for the team). Takes effect in a new session.
- `2` → change nothing.

## Related files

- `scripts/doctor.mjs` — renders the table; prints the `BAD_COMMON_SOURCES` / `PLAYWRIGHT_PERMS` flags.
- `scripts/config.mjs` — `init`, `check`, `scan [--write]`.
- `scripts/playwright-perms.mjs` — `check`, `allow`.
- `skills/unioss-pipeline/REFERENCE.md` — config resolution + MCP naming.
