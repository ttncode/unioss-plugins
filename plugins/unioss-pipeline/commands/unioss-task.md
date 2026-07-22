---
description: Run the UNIOSS pipeline on an ad-hoc request that has no GitLab ticket.
argument-hint: <description of the task>
---

# /unioss-task

Run the pipeline on an ad-hoc request with no GitLab ticket behind it.

## Input

- `$ARGUMENTS` — a plain-language description of the task.

## Workflow

Use the `unioss-pipeline:unioss-pipeline` skill in **task mode** (see its "Entry modes" section) and follow it exactly:

1. Derive the artifact identity `TASK#<short-slug>` from the request; open `round-1/` and write `round-brief.md` from it.
2. Skip the GitLab ticket fetch and the DB-from-ticket steps — map impact from the request text + code only. No GitLab links in artifacts.
3. Brainstorm it, then run Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize.

## Output

Per the skill: each stage's summary and gate, with all artifacts under `.walkthrough/TASK#<slug>/round-1/`.

## Related files

- `skills/unioss-pipeline/SKILL.md` — entry modes, rounds, gates.
