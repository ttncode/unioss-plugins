---
description: Run the UNIOSS pipeline on an ad-hoc request that has no GitLab ticket.
argument-hint: <description of the task>
---

Run the UNIOSS pipeline for this ticket-less request: $ARGUMENTS

Use the `unioss-pipeline:unioss-pipeline` skill in **task mode** (see its "Entry modes" section): there is no GitLab ticket, so skip the ticket fetch. Derive an artifact identity `TASK#<short-slug>` from the request, brainstorm it, then run Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize.
