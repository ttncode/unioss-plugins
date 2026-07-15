---
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

**1. Ensure the config exists**, then run the doctor. `init` is a no-op if the file is already there:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

**2. Relay the table.** Print the doctor's box output as-is — it is already formatted; never redraw or re-pad it. For any missing **light** dependency (node, jq) it prints an install command — offer to run that command for the user (ask first). For Docker, the unioss containers, and `GITLAB_TOKEN`, relay the printed guidance; do not auto-install Docker or set secrets.

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
