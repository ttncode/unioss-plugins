---
name: unioss-knowledge-approve
description: Review staged prescriptive rules and promote the approved ones into the live rules + GLOBAL.
---

# UNIOSS Knowledge — Approve

Prescriptive rules never enter the live KB automatically. Promote them here.

## Workflow

1. Open `.walkthrough/.knowledge/rules/staged.md`. If missing or empty, report "No staged rules." and stop.
2. Present the staged rules to the user. Ask, using the fixed format:

   ```
   <N> staged rule(s) to review. What would you like to do?

   1. Approve all (recommended)
   2. Let me pick which to approve
   3. Approve none

   Which option?
   ```

3. For approved rules: append each (verbatim, with its evidence link) to `.walkthrough/.knowledge/rules/approved.md`, and remove it from `staged.md`. Both writes replace the whole file.
4. Fold the top approved rules into `GLOBAL.md`'s "Top active pitfalls" section (keep the 1200-token cap — drop overflow, do not delete from `approved.md`).

## Output

- Count approved / remaining staged.
- Confirmation that `approved.md` and `GLOBAL.md` were updated.
