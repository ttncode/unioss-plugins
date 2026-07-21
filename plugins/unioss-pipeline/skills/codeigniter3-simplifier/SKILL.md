---
name: codeigniter3-simplifier
description: Use when refining recently-changed PHP/CodeIgniter 3 code for clarity and consistency without changing behavior.
model: opus
---

# CodeIgniter 3 Simplifier

## Overview

Make recently-changed CI3 code clearer without changing what it does. Prefer readable and explicit over clever and compact. **Core principle:** preserve functionality — change only how the code reads, never what it does.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

## Input

- **Default scope:** only the code modified or touched in the current session. Widen it only when explicitly told to.
- Standards come from `${CLAUDE_PLUGIN_ROOT}/rules/clean-code-php.md` and `clean-code-javascript.md`.

## Workflow

1. **Identify** the recently modified sections.
2. **Refine** them against the rules below.
3. **Verify** functionality is unchanged and the result is genuinely simpler.

### Preserve functionality — the hard constraint

Never change what the code does, only how it does it. Every original feature, output, and behavior stays intact.

### Apply project standards

- CodeIgniter 3 naming conventions for controllers, models, libraries, and helpers.
- File/class naming aligned with CI3 autoloading and application structure.
- Explicit method responsibilities and clear parameter handling.
- The project's established error-handling patterns.
- PSR-style readability wherever CI3 constraints allow.
- Respect CI3 patterns: `$this->load->model()`, `$this->load->library()`, `$this->input`, `$this->db`, config-driven behavior.

### Enhance clarity

- Reduce unnecessary complexity and nesting.
- Eliminate redundant code and abstractions.
- Improve variable and function names.
- Consolidate related logic when it helps.
- Remove comments that restate obvious code.
- **Avoid nested ternaries** — prefer if/else chains or `switch` for multiple conditions.
- Keep controllers lean; move reusable logic into models, libraries, or helpers when that improves maintainability.

### Maintain balance — do not over-simplify

Stop short of anything that would:

- Reduce clarity or maintainability.
- Produce clever solutions that are hard to follow.
- Combine too many concerns into one method or class.
- Remove a helpful abstraction.
- Trade readability for fewer lines (nested ternaries, dense one-liners).
- Make the code harder to debug or extend.
- Introduce patterns that do not fit CI3 architecture.

### CodeIgniter 3 specifics

- Preserve compatibility with `application/{controllers,models,libraries,helpers,views}`.
- Prefer Query Builder over raw SQL when readability improves and behavior is identical.
- Minimize direct superglobal use where CI3 input/config/session utilities already exist.
- Keep backward-compatible PHP style where the codebase requires it.
- Respect existing controller/view flow, form validation flow, and model loading patterns.

## Output

- The refined code, behavior-for-behavior identical to the original.
- Document **only** changes significant enough to affect understanding. No changelog of trivia.

## Related files

- `rules/clean-code-php.md`, `rules/clean-code-javascript.md` — the standards.
- `skills/unioss-implement/SKILL.md` — the coder that invokes this.
- `skills/unioss-review/SKILL.md` — the reviewer that enforces the same standards.
