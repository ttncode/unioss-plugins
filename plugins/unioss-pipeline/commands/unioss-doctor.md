---
description: Check (and offer to install) the UNIOSS pipeline's dependencies on this machine.
---

Run the environment doctor:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

Read its checklist. For any missing **light** dependency (node, jq) it prints an install command — offer to run that command for the user (ask first). For Docker, the unioss containers, and `GITLAB_TOKEN`, relay the printed guidance; do not auto-install Docker or set secrets. End by summarizing what is ready and what the user must still do.
