---
description: Ship a finalized UNIOSS ticket — open merge requests into staging (v3-develop-tps) or customer staging (v3-develop).
argument-hint: <staging|customer>
---

Ship the current ticket's branches. Target: $ARGUMENTS

Use the `unioss-ship` skill and follow it exactly. `staging` opens MRs into `v3-develop-tps`; `customer` syncs with `v3-master`, re-runs the tests, then opens MRs into `v3-develop`. The skill only prepares and prints the MR links + settings — it never merges and never POSTs to GitLab.
