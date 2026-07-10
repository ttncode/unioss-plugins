---
description: Continue a shipped UNIOSS ticket from customer feedback — opens a new round from the GitLab comments (does not restart A→Z).
argument-hint: <gitlab-ticket-url>
---

Continue the UNIOSS ticket from customer feedback: $ARGUMENTS

Use the `unioss-pipeline` skill in **feedback mode** (see its "Entry modes" section): open the next round on this existing ticket, seed the round brief from the new GitLab comments since the last round, brainstorm the feedback, then run Spec → GATE 1 → Plan → GATE 2 → Code → Review → GATE 3 → Verify → Finalize. Prior rounds stay frozen.
