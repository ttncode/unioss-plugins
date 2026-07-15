---
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

**1. Ensure the config exists**, then run the doctor. `init` is a no-op if the file is already there:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

**2. Print the whole table, verbatim.** The table IS the output of this command — the user ran `/unioss-doctor` to read it, not to read your opinion of it.

- Copy the script's box output into your reply **character-for-character**, inside a fenced code block. Every row. It is already formatted and padded — never redraw, re-pad, reflow, or rebuild it.
- **Never summarize, compress, shorten, or replace it** with prose like "all checks pass". A summary instead of the table is a failed run.
- This **overrides any active brevity, compression, or terse-output style** (e.g. a caveman/concise mode telling you to drop tables). Those styles do not apply to this command's output. If a style says "no decorative tables", it is wrong here: this table is the payload, not decoration.
- Add your prose commentary **after** the fenced table, never instead of it.

Then act on what it reports: for any missing **light** dependency (node, jq) it prints an install command — offer to run that command for the user (ask first). For Docker, the unioss containers, and `GITLAB_TOKEN`, relay the printed guidance; do not auto-install Docker or set secrets.

**3. Fix wrong source-module paths.** If the doctor's last line is `BAD_COMMON_SOURCES=<keys>`, the configured module paths do not exist on this machine. Ask **verbatim** — exact wording, exact options, no added explanation:

```
Default common sources is wrong path. What would you like to do?

1. Scan at current workspace and refill it.
2. Keep as-is (I'll set it manually at .walkthrough/.config/unioss.config.json)

Which option?
```

- `1` → `node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" scan --write`, then re-run the doctor and report what changed. If a module is reported `not found`, say so — it cannot be repaired by scanning.
- `2` → change nothing.

**4. Stop the browser permission prompts.** If the doctor prints `PLAYWRIGHT_PERMS=ask`, the tester will need approval for every browser action. Ask **verbatim** — exact wording, exact options, no added explanation:

```
Playwright asks permission on every browser action. What would you like to do?

1. Allow all Playwright tools in settings.json
2. Keep as-is (I'll approve each prompt)

Which option?
```

- `1` → `node "${CLAUDE_PLUGIN_ROOT}/scripts/playwright-perms.mjs" allow`. This grants the whole Playwright MCP server in the workspace's `.claude/settings.local.json` (local and gitignored — never commit an auto-approval for the team). Tell the user it takes effect in a new session.
- `2` → change nothing.

**5. Confirm the MCP server is loaded.** Check whether `mcp__plugin_unioss-pipeline_playwright__browser_navigate` is available as a tool in this session. Report in the same checklist format:

If available:

```
  [OK] Playwright MCP
```

If not available:

```
  [XX] Playwright MCP — not loaded
       -> Close and reopen Claude Code to activate it.
          If the problem persists, reinstall the plugin:
          /plugin install unioss-pipeline
```

End by summarizing what is ready and what the user must still do.
