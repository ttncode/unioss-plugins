---
description: Ship a finalized UNIOSS ticket — open merge requests into staging (v3-develop-tps) or customer staging (v3-develop).
argument-hint: <staging|customer>
---

# /unioss-ship

Push the finalized branches and open one merge request per touched repo. Never merges.

## Input

- `$ARGUMENTS` — `staging` or `customer`.

## Workflow

Use the `unioss-pipeline:unioss-ship` skill and follow it exactly:

1. Print the plan for the resolved mode + touched repos and wait for "Proceed?" — the user may skip the sync/test steps by naming them in their reply.
2. **staging** — push each feature branch, then open MRs into `v3-develop-tps`.
3. **customer** — sync each branch with `v3-master`, re-run the tests, push, then open MRs into `v3-develop`.
4. Every touched repo gets its own MR, including the submodules (`common-helper`, `common-models`).
5. MRs are created via the GitLab API, with a pre-filled-URL fallback if creation fails.

## Output

Per the skill: the created MR URL(s), or the fallback links. **Merging stays a human action** — the skill never merges.

## Related files

- `skills/unioss-ship/SKILL.md` — repo keys, fixed MR titles, both modes.
- `scripts/ship.mjs` — `create`, and the pre-filled-URL fallback.
- `skills/unioss-pipeline/REFERENCE.md` — branch naming, protected branches.
