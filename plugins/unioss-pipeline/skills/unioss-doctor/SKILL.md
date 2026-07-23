---
name: unioss-doctor
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

# UNIOSS Doctor

Check the pipeline's environment on this machine, and repair what can be repaired.

## Workflow

1. Ensure the config exists, then run the doctor:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" init
   node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
   ```

2. Relay the full stdout verbatim as a fenced block. Do not redraw, reflow, or summarize it.
3. Add a line after the table only when the user must act.
4. If `BAD_COMMON_SOURCES` flag printed → prompt the user to scan or keep as-is.
5. If `PLAYWRIGHT_PERMS=ask` printed → prompt to allow all or keep as-is.
6. If no `mcp__plugin_unioss-pipeline_playwright__browser_navigate` tool is available:

   ```
     [XX] Playwright MCP — not loaded
          -> Restart your session to activate it.
             If the problem persists, reinstall the plugin.
   ```

## Related files

- `scripts/doctor.mjs`
- `scripts/config.mjs`
- `commands/unioss-doctor.md` — full output template and decision prompts.
