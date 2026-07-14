---
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

Run the environment doctor:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

Read its checklist. For any missing **light** dependency (node, jq) it prints an install command — offer to run that command for the user (ask first). For Docker, the unioss containers, and `GITLAB_TOKEN`, relay the printed guidance; do not auto-install Docker or set secrets.

After running the script, check whether the Playwright MCP server is loaded in this session by verifying that `mcp__playwright__browser_navigate` is available as a tool. Report the result in the same checklist format:

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
