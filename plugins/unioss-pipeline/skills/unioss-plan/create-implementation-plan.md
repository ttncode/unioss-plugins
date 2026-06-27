---
name: create-implementation-plan
description: Template for UNIOSS implementation plans. All sections are required; no placeholder text may remain in the final output.
---

# Implementation Plan Template

## Rules

- All sections below are **mandatory**. No `TBD` may remain when complete.
- Use identifier prefixes: `REQ-`, `CON-`, `SEC-`, `GUD-`, `PAT-`, `ALT-`, `DEP-`, `RISK-`, `ASSUMPTION-`, `TASK-`, `TEST-`
- Save to `.walkthrough/` at project root. Naming: `#[IID]_IMPLEMENTATION_V1.md` (increment version if prior exists)
- Language: **English in main language**. Translate source text to English. Keep technical terms in Japanese.
- Status badge colors: `Planned` → blue · `In progress` → yellow · `Completed` → brightgreen · `On Hold` → orange · `Deprecated` → red

---

## Template

```markdown
---
goal: '[Concise title of the implementation goal]'
version: '1.0'
date_created: 'YYYY-MM-DD'
status: 'Planned'
tags: ['feature|upgrade|refactor|migration|bug']
story_points: 3
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

[One paragraph: what this plan achieves and why.]

## 1. Requirements & Constraints

- **REQ-001**: [Functional requirement]
- **CON-001**: [Hard constraint — e.g., must not break backward compat]
- **SEC-001**: [Security requirement, if any]
- **GUD-001**: [Guideline to follow, if any]

## 2. Scope & Impact Analysis

### 2.1 Scope

- **In-Scope**:
  - [Specific change 1, e.g., "Remove column `movies3url` from `products` table"]
  - [Specific change 2]
- **Out-of-Scope**:
  - [Explicit exclusion 1, e.g., "Historical data correction"]
  - [Explicit exclusion 2]

### 2.2 Impacted URLs & Components

**Affected Features**

- [Feature area 1]
- [Feature area 2]

**Affected URLs**

| Method | Route                      | Handler (Controller@method) | Impact |
| ------ | -------------------------- | --------------------------- | ------ |
| GET    | `/admin/products/edit/:id` | `Products@edit`             | HIGH   |

**Affected Cronjobs** _(if any)_

- `docker exec -it php-unioss3 sh -lc "php ... <command>"`

## 3. Implementation Steps

### Phase 1 — [Phase Name, e.g., DB Migration]

- GOAL-001: [Goal of this phase]

| Task     | Description                                               | Completed | Date |
| -------- | --------------------------------------------------------- | --------- | ---- |
| TASK-001 | [Exact action: create migration `20250101_drop_column_x`] |           |      |
| TASK-002 | [Exact action]                                            |           |      |

### Phase 2 — [Phase Name, e.g., Backend]

- GOAL-002: [Goal]

| Task     | Description                                                           | Completed | Date |
| -------- | --------------------------------------------------------------------- | --------- | ---- |
| TASK-003 | [Exact action: remove `$col` from `Product_model::get_list()` select] |           |      |

### Phase 3 — [Phase Name, e.g., Views]

- GOAL-003: [Goal]

| Task     | Description    | Completed | Date |
| -------- | -------------- | --------- | ---- |
| TASK-004 | [Exact action] |           |      |

### Phase 4 — Tests

- GOAL-004: [Goal]

| Task     | Description                                                | Completed | Date |
| -------- | ---------------------------------------------------------- | --------- | ---- |
| TASK-005 | [Update/add PHPUnit tests for affected models/controllers] |           |      |

## 4. Alternatives

- **ALT-001**: [Alternative considered and why rejected]

## 5. Dependencies

- **DEP-001**: [External dependency, e.g., migration must run before deploy]

## 6. Files

| File (absolute path)                                           | Change type | Description                       |
| -------------------------------------------------------------- | ----------- | --------------------------------- |
| `/var/www/html/AdminPage/application/models/Product_model.php` | Modify      | Remove retired column from SELECT |

## 7. Manual Testing

[List the test cases required to verify the modified code. You MUST categorize the test cases into Normal Cases and Abnormal Cases, including validation errors, unauthorized access, fallback behavior, and database verification.]

**Database Migration**

- [ ] **TEST-001 (Run Migration Up)**: Run the migration locally. Verify that the columns are dropped.
- [ ] **TEST-002 (Run Migration Down)**: Run the migration locally. Verify that the columns are re-added.

**Order Forms (Form History)**

- [ ] **TEST-003 (Order Search)**: Navigate to Order Search (`/admin/order_search`). Manually toggle form issuance (e.g., Thank You Letter, Certificate, One-Stop). Verify that `form_history.admin_id` is correctly populated with your logged-in ID in the database.
- [ ] **TEST-004 (Order Status)**: Navigate to Order Status (`/admin/order_status`). Perform the same form issuance toggling and verify that `form_history.admin_id` is recorded properly in the database.

**PDF Exporting**

- [ ] **TEST-005 (Thank You Letter)**: Export a Thank You Letter (`/admin/order_detail/show_thankyou_letter`). Verify the PDF generates correctly and no database JOIN errors occur.
- [ ] **TEST-006 (Certificate of Donation Deduction)**: Export a Certificate (`/admin/order_detail/show_donation_deduction_certificate`). Confirm it generates correctly without errors.

**Session Resilience**

- [ ] **TEST-008 (Graceful Degradation)**: Log out, clear sessions or access the order pages with a stale legacy session if possible. Verify the application gracefully handles session initialization without throwing fatal errors.

## 8. Risks & Assumptions

- **RISK-001**: [Risk and mitigation, e.g., "Cached queries may still reference old columns → clear OPcache after deploy"]
- **ASSUMPTION-001**: [Assumption made, e.g., "No external system reads the retired columns directly"]

## 9. Related Specifications

[Link to related spec 1]
[Link to relevant external documentation]

## 10. Agentic Resources

[List all Agentic AI skills, rules, MCP servers, or external tools that must be utilized when executing this plan at system, global, project, or local. The availability of these resources varies by environment.]

- **SKILL**: `skill-name` (Path & Reason for usage)
- **RULE**: `rule-name.md` (Path & Reason for usage)
- **MCP**: `mcp-server-name` (Path & Reason for usage)
```
