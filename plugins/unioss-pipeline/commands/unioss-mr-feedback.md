---
description: Analyze review feedback on one or more GitLab merge requests and, on approval, apply verified fixes, run the full test suite, commit, and push.
argument-hint: <mr-url> [mr-url...]
---

# /unioss-mr-feedback

Turn another developer's MR review comments into verified, tested, pushed fixes — standalone, not part of the A→Z pipeline.

## Input

- `$ARGUMENTS` — one or more GitLab merge-request URLs. None found → ask the user for at least one.

## Workflow

Use the `unioss-pipeline:unioss-mr-feedback` skill and follow it exactly, once per URL:

1. Fetch the MR's open discussion threads.
2. Verify each against the current code; sweep the MR's touched files for the same unmentioned pattern.
3. Print one summary and ask "Does that look right?" — wait for approval.
4. Apply, run the full test suite (AdminPage only), commit `#<ID> - Optimize code`, push.

## Output

Per the skill: the summary before applying anything, then per repo — the commit + push result. No MR is created; that stays `/unioss-ship`.

## Related files

- `skills/unioss-mr-feedback/SKILL.md` — the full per-MR workflow.
- `skills/unioss-pipeline/REFERENCE.md` — branch naming, protected branches, submodules, commit format.
