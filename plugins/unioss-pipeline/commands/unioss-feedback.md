---
description: Continue a shipped UNIOSS ticket from customer feedback — opens a new round from the GitLab comments (does not restart A→Z).
argument-hint: <gitlab-ticket-url>
---

# /unioss-feedback

Continue an existing ticket from customer feedback — a new round, never a restart.

## Input

- `$ARGUMENTS` — the GitLab URL of a ticket that already has ≥1 sealed round.

## Workflow

Use the `unioss-pipeline:unioss-pipeline` skill in **feedback mode** (see its "Entry modes" section) and follow it exactly:

1. Open round N+1 on the existing ticket. Prior rounds stay frozen.
2. Seed `round-brief.md` from the **new GitLab comments since the last round** only.
3. Brainstorm the feedback, then continue from the **spec** stage: Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize.
4. Investigate + GATE 0 are skipped — the ticket was investigated in round 1.

## Output

Per the skill: each stage's summary and gate, with all artifacts under `round-<N+1>/`.

## Related files

- `skills/unioss-pipeline/SKILL.md` — entry modes, rounds, gates.
- `skills/unioss-gitlab-issue-context/SKILL.md` — the ticket re-fetch.
