---
description: Run the UNIOSS A→Z ticket pipeline on a GitLab work-item/issue URL.
argument-hint: <gitlab-ticket-url>
---

# /unioss-pipeline

Run the full A→Z pipeline on a GitLab ticket, stopping at every human gate.

## Input

- `$ARGUMENTS` — the GitLab work-item/issue URL.

## Workflow

1. Use the `unioss-pipeline:unioss-pipeline` skill in **ticket mode** and follow it exactly.
2. Start at **Step 0**: render the plan table and stop. Run no stage until the user confirms.

## Output

Per the skill: the Step 0 plan table verbatim, then each stage's summary and gate as the run proceeds.

## Related files

- `skills/unioss-pipeline/SKILL.md` — the orchestrator, gates, and entry modes.
- `skills/unioss-pipeline/REFERENCE.md` — config, branches, artifact layout.
- `/unioss-feedback`, `/unioss-task` — the other two entry modes.
