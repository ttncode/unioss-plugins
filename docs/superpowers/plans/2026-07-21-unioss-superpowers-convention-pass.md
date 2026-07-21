# UNIOSS Superpowers Convention + Cleanup Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the `unioss-pipeline` plugin's docs into superpowers house-style, dedupe review rigor, de-machine-ify wording, and fix one typo'd skill id — with zero behavior change — so it can be shared with the UNIOSS team.

**Architecture:** Pure documentation + one directory rename. No pipeline flow, gate, hook, or script logic changes. Skills/commands/agents are edited in place; one new vendored skill is added; one skill directory is renamed.

**Tech Stack:** Markdown (SKILL/command/agent docs), Node ESM scripts (unchanged except wording strings), `node --test` for the existing test suite.

**Spec:** `docs/superpowers/specs/2026-07-21-unioss-superpowers-convention-pass-design.md`

**Working dir for all paths below:** `plugins/unioss-pipeline/` (repo root: `/home/ttndev/workspace/personal/ttnplugins`).

## Global Constraints

Every task's requirements implicitly include this section.

- **No behavior/logic changes.** No edits to `config.mjs`, any `*.mjs` logic, DEFAULTS, hooks, or `hooks.json`. The ONLY `.mjs` edits allowed are human-readable **string literals** in `doctor.mjs` (item 3 wording).
- **No `*.test.mjs` changes.** `node --test` must pass identically before and after.
- **No deletions** of any skill, command, or agent. Nothing is orphaned.
- **Trim rule:** trimming a long skill = remove duplicated text, combine identical rules, or reword shorter ONLY. Never drop a rule's substance. Every distinct rule that existed must still exist.
- **Self-contained:** the plugin does not depend on superpowers. Vendored forks (`unioss-brainstorming`, `unioss-writing-plans`, new `unioss-receiving-code-review`) keep their UNIOSS-specific internal references.
- **Frontmatter `description` rule:**
  - **Skills** (except vendored forks) — begin with `Use when …`.
  - **Agents** — begin with `Use when dispatched by unioss-pipeline to …`.
  - **Vendored forks** (`unioss-brainstorming`, `unioss-writing-plans`, `unioss-receiving-code-review`) — keep the superpowers original description verbatim (fidelity beats the "Use when" rule).
  - **Commands** — keep concise imperative slash-menu hints (NOT "Use when"); `argument-hint` preserved.
- **Body skeleton for every skill:** `# Title` → `## Overview` (1–2 lines + a bold `**Core principle:**` line) → existing numbered `## Workflow` kept intact → `## Common Mistakes` table ONLY where it adds value → `## Related files`.
- **`dot` flowcharts** only where a real branch/decision exists: `unioss-pipeline`, `unioss-mr-feedback`. Nowhere else.
- **Progress-tracking directive:** every procedural skill (one with a numbered `## Workflow`) gets a one-line directive in its Overview telling the agent to create a todo per Workflow step and check off as it goes — the superpowers "todo per checklist item" behavior. Exact line to insert:
  `**Track progress:** create a todo per Workflow step below and check each off as you complete it.`
  The `unioss-brainstorming` / `unioss-writing-plans` forks already carry their own task-per-item wording — leave theirs as-is.
- **Commit after every task.** Branch: `feat/unioss-superpowers-convention-pass` (already checked out).

---

## File Structure

**Create:**
- `skills/unioss-receiving-code-review/SKILL.md` — vendored review-reception rigor.

**Rename:**
- `skills/codeignitor3-simplifier/` → `skills/codeigniter3-simplifier/`.

**Modify (docs):** all 17 `skills/*/SKILL.md`, all 5 `agents/*.md`, all 8 `commands/*.md`, `skills/unioss-pipeline/REFERENCE.md`.

**Modify (string literals only):** `scripts/doctor.mjs`.

**Modify (config/meta):** `.claude-plugin/plugin.json` (version bump), `skills/unioss-implement/SKILL.md` (rename ref).

---

## Task 1: Vendor `receiving-code-review` and wire it in

**Files:**
- Create: `skills/unioss-receiving-code-review/SKILL.md`
- Modify: `skills/unioss-mr-feedback/SKILL.md` (Step 4 Analyze)
- Modify: `skills/unioss-review/SKILL.md` (add reception-rigor reference)

**Interfaces:**
- Produces: skill id `unioss-pipeline:unioss-receiving-code-review`, invoked by mr-feedback and review.

- [ ] **Step 1: Copy the source skill**

Copy `/home/ttndev/workspace/personal/superpowers/skills/receiving-code-review/SKILL.md` into `skills/unioss-receiving-code-review/SKILL.md` verbatim.

- [ ] **Step 2: Adapt the frontmatter name only**

Change the frontmatter `name:` to `unioss-receiving-code-review`. Keep the `description:` verbatim from superpowers (vendored-fork rule). Add, as the first body line under the H1, one italic note:

```markdown
*Vendored from superpowers `receiving-code-review` (6.1.1), adapted for UNIOSS GitLab.*
```

- [ ] **Step 3: Swap the GitHub replies section for GitLab**

Replace the `## GitHub Thread Replies` section with:

```markdown
## GitLab MR Thread Replies

When replying to a reviewer's inline comment on a GitLab merge request, reply **in that discussion thread** (`POST /api/v4/projects/:id/merge_requests/:iid/discussions/:discussion_id/notes`), not as a new top-level MR note. Never resolve a thread you did not verify.
```

Leave every other section (including "your human partner" phrasing) unchanged.

- [ ] **Step 4: Wire mr-feedback to invoke it**

In `skills/unioss-mr-feedback/SKILL.md`, in Step 4 (Analyze), replace the sentence:

> Apply the same rigor as `superpowers:receiving-code-review` — verify, don't rubber-stamp a reviewer's suggestion just because another developer left it.

with:

> Invoke `unioss-pipeline:unioss-receiving-code-review` and apply it to every thread — verify against current code, don't rubber-stamp a reviewer's suggestion just because another developer left it.

- [ ] **Step 5: Reference it from the reviewer skill**

In `skills/unioss-review/SKILL.md`, under `## Related files`, add:

```markdown
- `skills/unioss-receiving-code-review/SKILL.md` — reception rigor for evaluating feedback (verify before implementing).
```

- [ ] **Step 6: Verify no stale superpowers reference remains**

Run: `grep -rn "superpowers:receiving-code-review" plugins/unioss-pipeline/`
Expected: no matches (all now point to `unioss-pipeline:unioss-receiving-code-review`).

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-receiving-code-review plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md plugins/unioss-pipeline/skills/unioss-review/SKILL.md
git commit -m "feat(unioss-pipeline): vendor receiving-code-review skill; wire mr-feedback + review"
```

---

## Task 2: Rename the typo'd `codeignitor3-simplifier` skill

**Files:**
- Rename: `skills/codeignitor3-simplifier/SKILL.md` → `skills/codeigniter3-simplifier/SKILL.md`
- Modify: renamed `SKILL.md` frontmatter `name:`
- Modify: `skills/unioss-implement/SKILL.md` (inbound reference)

- [ ] **Step 1: Git-rename the directory**

```bash
cd plugins/unioss-pipeline
git mv skills/codeignitor3-simplifier skills/codeigniter3-simplifier
```

- [ ] **Step 2: Fix the skill name**

In `skills/codeigniter3-simplifier/SKILL.md`, change frontmatter `name: codeignitor3-simplifier` → `name: codeigniter3-simplifier`.

- [ ] **Step 3: Update the one inbound reference**

In `skills/unioss-implement/SKILL.md`, replace every `codeignitor3-simplifier` with `codeigniter3-simplifier` (both the `unioss-pipeline:codeignitor3-simplifier` invocation and any path).

- [ ] **Step 4: Verify no typo remains anywhere**

Run: `grep -rn "codeignitor" plugins/unioss-pipeline/`
Expected: no matches.

- [ ] **Step 5: Confirm tests still pass**

Run: `cd plugins/unioss-pipeline && node --test`
Expected: same pass/fail counts as before the pass (no test references the old id).

- [ ] **Step 6: Commit**

```bash
git add -A plugins/unioss-pipeline/skills
git commit -m "fix(unioss-pipeline): rename codeignitor3-simplifier -> codeigniter3-simplifier"
```

---

## Task 3: De-machine-ify doc wording

**Files:**
- Modify: `scripts/doctor.mjs` (string literals only)
- Modify: `skills/unioss-pipeline/REFERENCE.md`

- [ ] **Step 1: Generalize the doctor container-fix messages**

In `scripts/doctor.mjs`, in the two `fix:` strings that say `docker compose up -d (from the unioss3 project root)`, change `the unioss3 project root` → `your UNIOSS project root`. Change ONLY the string text; do not touch any logic.

- [ ] **Step 2: Verify doctor still runs**

Run: `node plugins/unioss-pipeline/scripts/doctor.mjs 2>&1 | head -5`
Expected: runs without error; the generalized wording appears if a container is down.

- [ ] **Step 3: Confirm doctor tests unaffected**

Run: `cd plugins/unioss-pipeline && node --test scripts/*.test.mjs`
Expected: unchanged pass (no test asserts the exact "unioss3 project root" string — verify with `grep -rn "unioss3 project root" plugins/unioss-pipeline/scripts/*.test.mjs` returning nothing first).

- [ ] **Step 4: Document the per-machine override path in REFERENCE**

In `skills/unioss-pipeline/REFERENCE.md`, in the Configuration section, add one bullet:

```markdown
- **Per-machine overrides** (source paths, container names, DB password, ship identities) live in `.walkthrough/.config/unioss.config.json` or environment variables — never edit `config.mjs` DEFAULTS on a shared machine. Run `/unioss-doctor` to detect and fix mismatches.
- **Progress tracking:** when a skill has a numbered Workflow, create a todo per step and check each off as you go — the visible checklist keeps long gated runs auditable.
```

- [ ] **Step 5: Verify no machine-specific phrasing remains in docs**

Run: `grep -rn "unioss3 project root\|/home/\|/Users/" plugins/unioss-pipeline/ --include=*.md --include=*.mjs | grep -v test`
Expected: no matches (test files may legitimately construct temp paths — excluded).

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/scripts/doctor.mjs plugins/unioss-pipeline/skills/unioss-pipeline/REFERENCE.md
git commit -m "docs(unioss-pipeline): generalize machine-specific wording; document per-machine overrides"
```

---

## Task 4: Refresh the two vendored forks

**Files:**
- Modify: `skills/unioss-brainstorming/SKILL.md`
- Modify: `skills/unioss-writing-plans/SKILL.md`

**Context:** These were cloned from superpowers and differ from the current 6.1.1 originals mainly by (a) the `name:` rename and (b) UNIOSS-specific internal references (e.g. brainstorming points to `unioss-writing-plans`, mentions `SCOPE.md`). BOTH adaptations must be preserved.

- [ ] **Step 1: Diff each fork against its superpowers 6.1.1 original**

```bash
diff plugins/unioss-pipeline/skills/unioss-brainstorming/SKILL.md /home/ttndev/workspace/personal/superpowers/skills/brainstorming/SKILL.md
diff plugins/unioss-pipeline/skills/unioss-writing-plans/SKILL.md /home/ttndev/workspace/personal/superpowers/skills/writing-plans/SKILL.md
```

- [ ] **Step 2: Port only genuine superpowers improvements**

For each hunk where superpowers 6.1.1 has newer wording that is NOT a UNIOSS adaptation (i.e. not the `name:`, not a `unioss-` skill reference, not a SCOPE/pipeline mention), apply the superpowers text into the fork. Leave every UNIOSS adaptation intact. If a fork is already current apart from its adaptations, make no body change.

- [ ] **Step 3: Add a vendored-provenance note**

Under the H1 of each fork, add (if not already present):

```markdown
*Vendored from superpowers (6.1.1), adapted for the UNIOSS pipeline.*
```

- [ ] **Step 4: Verify UNIOSS references survived**

Run: `grep -c "unioss-writing-plans" plugins/unioss-pipeline/skills/unioss-brainstorming/SKILL.md`
Expected: ≥ 1 (the brainstorming→writing-plans handoff still points at the fork, not the superpowers original).

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-brainstorming/SKILL.md plugins/unioss-pipeline/skills/unioss-writing-plans/SKILL.md
git commit -m "docs(unioss-pipeline): resync vendored brainstorming/writing-plans with superpowers 6.1.1"
```

---

## Task 5: House-style the five pipeline-stage skills

**Files:**
- Modify: `skills/unioss-investigate/SKILL.md`
- Modify: `skills/unioss-plan/SKILL.md`
- Modify: `skills/unioss-implement/SKILL.md`
- Modify: `skills/unioss-review/SKILL.md` (also apply the trim rule — 418 lines)
- Modify: `skills/unioss-verify/SKILL.md`

**Apply to each:** the Global-Constraints body skeleton + the exact `description` below. Preserve every workflow step and every rule.

- [ ] **Step 1: Rewrite each frontmatter `description` to these exact strings**

```
unioss-investigate:  Use when investigating a UNIOSS GitLab ticket — the read-only investigator stage: fetches the ticket and related issues, maps codebase/DB impact, and produces the investigation, Vietnamese scope report, and clarity verdict.
unioss-plan:         Use when turning a UNIOSS investigation into an implementation plan with exact per-file changes, estimate points, and per-step verification — the planner stage.
unioss-implement:    Use when applying an approved UNIOSS implementation plan exactly — the coder stage: edits code, runs migrations, owns PHPUnit, and writes a diff manifest.
unioss-review:       Use when diff-reviewing the UNIOSS coder's changes against clean-code, CI3, plan-adherence, and security standards — the reviewer stage; outputs a severity-indexed report.
unioss-verify:       Use when functionally verifying a UNIOSS change — the tester stage: confirms DB changes landed and drives the affected UI flow via browser MCP.
```

- [ ] **Step 2: Ensure each body has Overview + Core principle**

For any of the five missing a `## Overview` with a bold `**Core principle:**` line, add a 1–2 line Overview and a single core-principle sentence drawn from the skill's existing intro. Do not invent new rules.

- [ ] **Step 3: Ensure each ends with `## Related files`**

Confirm/normalize a `## Related files` section at the end listing the REFERENCE and any sibling skills/scripts it names.

- [ ] **Step 3b: Insert the progress-tracking directive**

At the end of each skill's `## Overview`, add the verbatim line:

```markdown
**Track progress:** create a todo per Workflow step below and check each off as you complete it.
```

- [ ] **Step 4: Trim `unioss-review` per the trim rule**

In `skills/unioss-review/SKILL.md` (418 lines): find passages that state the same rule twice, near-identical checklist bullets, or over-long explanations, and dedupe/combine/shorten them. Before editing, list the distinct rules present; after editing, confirm each still appears exactly once. Do NOT remove any distinct check (security, CSRF, XSS, escaping, authorization, prepared statements, clean-code, plan-adherence, severity scale).

- [ ] **Step 5: Verify descriptions and structure**

```bash
for f in investigate plan implement review verify; do
  head -5 plugins/unioss-pipeline/skills/unioss-$f/SKILL.md | grep -q "^description: Use when" && echo "$f ok" || echo "$f BAD desc"
  grep -q "## Related files" plugins/unioss-pipeline/skills/unioss-$f/SKILL.md && echo "$f related-ok" || echo "$f NO related"
done
```
Expected: all `ok` / `related-ok`.

- [ ] **Step 6: Confirm no rule lost in review trim**

Re-read the pre-edit rule list from Step 4 against the trimmed file. Every distinct rule present. Confirm `git diff --stat skills/unioss-review/SKILL.md` shows a net line reduction with no checklist heading removed.

- [ ] **Step 7: Commit**

```bash
git add plugins/unioss-pipeline/skills/unioss-investigate plugins/unioss-pipeline/skills/unioss-plan plugins/unioss-pipeline/skills/unioss-implement plugins/unioss-pipeline/skills/unioss-review plugins/unioss-pipeline/skills/unioss-verify
git commit -m "docs(unioss-pipeline): house-style the five pipeline-stage skills; trim reviewer"
```

---

## Task 6: House-style the support and standalone skills

**Files:**
- Modify: `skills/unioss-pipeline/SKILL.md` (add/keep `dot` flowchart of the gated flow)
- Modify: `skills/unioss-mr-feedback/SKILL.md` (add `dot` flowchart of per-MR flow; body skeleton)
- Modify: `skills/unioss-api-spec/SKILL.md`
- Modify: `skills/unioss-scope/SKILL.md`
- Modify: `skills/unioss-ship/SKILL.md`
- Modify: `skills/unioss-gitlab-issue-context/SKILL.md`
- Modify: `skills/unioss-bump-migration/SKILL.md`
- Modify: `skills/unioss-generate-migration/SKILL.md` (trim rule if pure duplication exists)
- Modify: `skills/unioss-phpunit-test/SKILL.md` (trim rule if pure duplication exists)
- Modify: `skills/codeigniter3-simplifier/SKILL.md`

- [ ] **Step 1: Rewrite frontmatter `description`s to these exact strings**

```
unioss-pipeline:            Use when running the full UNIOSS A→Z ticket pipeline on a GitLab ticket URL — the gated orchestrator: investigator → spec → planner → coder → reviewer → tester, stopping at human gates.
unioss-mr-feedback:         Use when a ticket's GitLab merge request(s) received review comments — verify each against current code, then on approval apply fixes, run the suite, commit, and push. Run as /unioss-mr-feedback <mr-url>.
unioss-api-spec:            Use when a change adds or alters a UNIOSS API endpoint and you need a house-format API spec, or standalone via /unioss-api-spec.
unioss-scope:               Use when writing or updating the PM/QC-facing SCOPE.md for a finished UNIOSS ticket.
unioss-ship:                Use when shipping a finalized UNIOSS ticket — pushes the feature branch and opens merge requests into staging or customer staging; never merges. Run as /unioss-ship.
unioss-gitlab-issue-context: Use when you need to fetch or refresh a GitLab ticket's data (writes RAW_TICKET_DATA.json + TICKET_SUMMARY.md) — standalone or as the investigator's ticket-fetch step.
unioss-bump-migration:      Use when bumping a UNIOSS migration timestamp, reindexing files, and updating the migration config and tests.
unioss-generate-migration:  Use when the user asks to generate migration files for the UNIOSS project.
unioss-phpunit-test:        Use when writing, updating, or debugging PHPUnit tests for UNIOSS CodeIgniter modules.
codeigniter3-simplifier:    Use when refining recently-changed PHP/CodeIgniter 3 code for clarity and consistency without changing behavior.
```

- [ ] **Step 2: Apply the body skeleton to each**

Ensure each has `## Overview` + `**Core principle:**`, the intact `## Workflow`, and `## Related files`. Add `## Common Mistakes` only where the skill already implies failure modes worth tabulating (e.g. mr-feedback, ship). Do not fabricate. Append the progress-tracking directive line (verbatim, from Global Constraints) to the end of each skill's `## Overview`. Skip the two forks (they keep their own task-per-item wording).

- [ ] **Step 3: Add `dot` flowcharts to the two branching skills**

`unioss-pipeline/SKILL.md` and `unioss-mr-feedback/SKILL.md` each get one `dot` diagram of their real decision flow (gates / per-MR skip-or-apply). If `unioss-pipeline` already has an equivalent flow diagram, leave it. No flowcharts in any other skill.

- [ ] **Step 4: Trim generate-migration / phpunit-test ONLY if pure duplication exists**

For `unioss-generate-migration` (280 lines) and `unioss-phpunit-test` (199 lines): apply the trim rule only to genuinely duplicated blocks or repeated examples. If length is all distinct content (multiple real examples), leave as-is. No rule dropped.

- [ ] **Step 5: Verify**

```bash
for f in api-spec scope ship gitlab-issue-context bump-migration generate-migration phpunit-test; do
  head -5 plugins/unioss-pipeline/skills/unioss-$f/SKILL.md | grep -q "^description: Use when" && echo "$f ok" || echo "$f BAD"
done
head -5 plugins/unioss-pipeline/skills/codeigniter3-simplifier/SKILL.md | grep -q "^description: Use when" && echo "codeigniter ok" || echo "codeigniter BAD"
grep -l "```dot" plugins/unioss-pipeline/skills/unioss-pipeline/SKILL.md plugins/unioss-pipeline/skills/unioss-mr-feedback/SKILL.md
```
Expected: all `ok`; both branching skills list a `dot` block.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/skills
git commit -m "docs(unioss-pipeline): house-style support/standalone skills; add flow diagrams"
```

---

## Task 7: House-style agents and normalize commands

**Files:**
- Modify: all 5 `agents/*.md`
- Modify: all 8 `commands/*.md`

- [ ] **Step 1: Rewrite agent `description`s to start "Use when dispatched by …"**

```
unioss-investigator: Use when dispatched by unioss-pipeline to investigate a ticket (read-only): ticket + related issues, codebase/DB impact, clarity verdict — or in report mode to write the PM-facing Vietnamese report.
unioss-planner:      Use when dispatched by unioss-pipeline to turn an investigation into an implementation plan with exact code and estimate points (read-only).
unioss-reviewer:     Use when dispatched by unioss-pipeline to diff-review the coder's changes and emit a severity-indexed report (read-only; never fixes).
unioss-tester:       Use when dispatched by unioss-pipeline to verify DB changes and drive the affected UI flow via browser MCP (read-only, functional).
unioss-scope:        Use when dispatched by unioss-pipeline after the tester stage to write/update the PM/QC-facing SCOPE.md (read-only to source).
```

Keep each agent's `tools:` and `model:` frontmatter EXACTLY as-is (behavior).

- [ ] **Step 2: Normalize agent bodies**

Ensure each agent body keeps its `## Input` / `## Workflow` / `## Output` / `## Related files` shape (already close). Fix only heading consistency and dangling `...` (the `unioss-scope` agent body was truncated with `...` in Related files — restore the full list). No workflow change.

- [ ] **Step 3: Normalize command descriptions (keep them as action hints)**

Confirm each of the 8 `commands/*.md` has a concise imperative `description` and a correct `argument-hint`. Do NOT convert to "Use when". Fix any that reference the old `codeignitor` id or `superpowers:receiving-code-review` (should be none after Tasks 1–2 — verify).

- [ ] **Step 4: Verify**

```bash
for f in plugins/unioss-pipeline/agents/*.md; do head -5 "$f" | grep -q "^description: Use when dispatched" && echo "$(basename $f) ok" || echo "$(basename $f) BAD"; done
grep -rn "\.\.\.$" plugins/unioss-pipeline/agents/ || echo "no truncated bodies"
grep -rn "codeignitor\|superpowers:receiving-code-review" plugins/unioss-pipeline/commands plugins/unioss-pipeline/agents || echo "clean"
```
Expected: all agents `ok`; no truncated bodies; `clean`.

- [ ] **Step 5: Commit**

```bash
git add plugins/unioss-pipeline/agents plugins/unioss-pipeline/commands
git commit -m "docs(unioss-pipeline): house-style agents; normalize command descriptions"
```

---

## Task 8: Final verification sweep and version bump

**Files:**
- Modify: `.claude-plugin/plugin.json` (version bump)

- [ ] **Step 1: Full test suite unchanged**

Run: `cd plugins/unioss-pipeline && node --test`
Expected: all tests pass; same counts as a pre-pass baseline (`git stash` not needed — no test was edited).

- [ ] **Step 2: Frontmatter audit — every skill/agent description compliant**

```bash
cd plugins/unioss-pipeline
for f in skills/*/SKILL.md; do head -6 "$f" | grep -qE "^description: (Use when|You MUST use this)" || echo "SKILL non-compliant: $f"; done
for f in agents/*.md; do head -6 "$f" | grep -q "^description: Use when dispatched" || echo "AGENT non-compliant: $f"; done
echo "audit done"
```
Expected: only `audit done` (forks may match "You MUST use this"; all others "Use when").

- [ ] **Step 3: De-machine-ify + typo sweep**

```bash
grep -rn "codeignitor\|unioss3 project root\|/home/ttndev\|/Users/" plugins/unioss-pipeline/ --include=*.md --include=*.mjs | grep -v "\.test\.mjs"
echo "sweep done"
```
Expected: no matches before `sweep done`.

- [ ] **Step 3b: Progress-tracking directive present in every procedural skill**

```bash
cd plugins/unioss-pipeline
for f in skills/*/SKILL.md; do
  grep -q "^## Workflow" "$f" || continue
  case "$f" in *unioss-brainstorming*|*unioss-writing-plans*) continue;; esac
  grep -q "\*\*Track progress:\*\*" "$f" || echo "MISSING directive: $f"
done
echo "directive audit done"
```
Expected: only `directive audit done` (every Workflow skill except the two forks carries the line).

- [ ] **Step 4: Confirm no logic files changed beyond doctor strings**

Run: `git diff main --stat -- plugins/unioss-pipeline/scripts plugins/unioss-pipeline/hooks`
Expected: only `scripts/doctor.mjs` appears; open it and confirm the diff is string-literal wording only.

- [ ] **Step 5: Bump plugin version**

In `.claude-plugin/plugin.json`, bump `version` `1.9.0` → `1.10.0`.

- [ ] **Step 6: Commit**

```bash
git add plugins/unioss-pipeline/.claude-plugin/plugin.json
git commit -m "chore(unioss-pipeline): bump to 1.10.0 — superpowers convention pass"
```

- [ ] **Step 7: Offer to finish the branch**

Invoke `superpowers:finishing-a-development-branch` to present merge/PR options.

---

## Self-Review

**Spec coverage:**
- Item 1 (house-style) → Tasks 5, 6, 7 (+ Global Constraints skeleton).
- Progress-tracking checklist behavior (superpowers "todo per item") → Global Constraints directive + Tasks 3/5/6 insertion + Task 8 audit.
- Item 2 (vendor receiving-code-review) → Task 1.
- Item 3 (de-machine-ify wording, no config/test change) → Task 3.
- Item 4 (refresh forks) → Task 4.
- Item 5 (rename typo) → Task 2.
- Audit finding "nothing orphaned / no deletions" → honored (no deletion task).
- Config-identities-stay decision → honored (Task 3 explicitly no `config.mjs`/DEFAULTS change).
- plan-vs-writing-plans not-a-dedup → honored (both kept; Task 4 only refreshes the fork).

**Placeholder scan:** exact description strings, exact grep commands, exact rename commands provided. The only judgment steps (trim, fork port) are bounded by the trim rule + "adaptations preserved" and carry before/after verification. No "TBD"/"handle edge cases".

**Type consistency:** the vendored skill id `unioss-pipeline:unioss-receiving-code-review` is produced in Task 1 and referenced only there; the renamed id `codeigniter3-simplifier` is produced in Task 2 and its sole consumer (`unioss-implement`) updated in the same task; both verified by grep.
