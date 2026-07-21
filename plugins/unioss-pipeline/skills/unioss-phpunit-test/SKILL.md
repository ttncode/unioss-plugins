---
name: unioss-phpunit-test
description: Use when writing, updating, or debugging PHPUnit tests for UNIOSS CodeIgniter modules.
---

# UNIOSS PHPUnit Testing Skill

## Overview

Write and repair PHPUnit tests for UNIOSS CodeIgniter modules — isolated, and run in Docker. **Core principle:** every test must be independent — no test may rely on state left by another.

You are an expert PHP/CodeIgniter developer on the UNIOSS project:

- The project uses PHPUnit for testing.
- The project uses Docker for development.
- The project seeds the database from a SQL dump, so some data already exists.

**Track progress:** create a todo per Workflow step below and check each off as you complete it.

## Input

Use this skill when asked to:

- Generate/update test cases for new code, modified code, or a commit hash.
- Fix failing or flaky PHPUnit tests.

Needed:

- The target source (default: `unioss3/AdminPage`).
- The changed logic — a diff, or the commit hashes.

## Workflow

> ⚠️ You MUST read example test files (tests that have passed) at `./examples/*` before writing a single line of test code.

1. **Reference**: Read the example test files at `./examples/*` directory.
2. Identify target souce code from the prompt (default: `unioss3/AdminPage`).
3. Inspect changed logic first.

> ⚠️ If generate test case for specific commits, ask user to provide the commit hashes if missing.

- For modified code, run `git diff` to see the changes.
- For specific commits, use command line `git diff <commit1> <commit2>`.

4. Build/adjust tests with isolated setup (helpers, DB, mocks, auth).
5. Run tests in Docker with `--testdox`.
6. Fix failures, then rerun until stable.

## Core Testing Rules

1. Every test must be independent.
2. Never rely on state from another test method.
3. Reset global/session/config changes in `tearDown()` or use process isolation.
4. Keep DB data deterministic to avoid unique-constraint collisions.
5. Assert state immediately after one request; avoid request chaining for verification.
6. Use `$response` as the variable name for request calls.
   _Example:_
   ```php
   $response = $this->request('POST', self::ROUTE_UPSERT);
   ```
7. Group assertions logically per goal and add a short comment for each group.
   _Example:_

   ```php
   // Assert success
   $this->assertIsArray($result);
   $this->assertNotEmpty($result);
   $this->assertArrayHasKey('is_success', $result);
   $this->assertArrayHasKey('data', $result);
   $this->assertArrayHasKey('total_rows', $result);

   // Assert data is available
   $this->assertTrue($result['is_success']);
   $this->assertNotEmpty($result['data']);
   $this->assertTrue($result['total_rows'] > 0);
   ```

8. Prepare or format all data (e.g., parsing, decoding) _before_ performing assertions on it. Do not interleave data processing steps between assertions.
   _Good:_

   ```php
   $response = $this->request('POST', self::ROUTE_UPSERT);
   $response = json_decode($response, true);

   $this->assertResponseCode(400);
   $this->assertSame('error', $response['status']);
   ```

   _Bad:_

   ```php
   $response = $this->request('POST', self::ROUTE_UPSERT);

   $this->assertResponseCode(404);
   $response = json_decode($response, true); // Interleaved processing
   $this->assertSame('error', $response['status']);
   ```

9. Prioritize using mock data if the verification does not require database persistence/logging (e.g., form validation, screen display checks).
10. Use `#[DataProvider('...')]` when running the same verification with different test datasets.
11. Always add `@property` annotations to the test class docblock for IDE autocompletion and static analysis.
    _Example:_
    ```php
    /**
     * @property CI_Form_validation $form_validation
     */
    ```

## Naming Convention

Use: `test_[method]_[expected_behavior]_when_[condition]`

- Prefer business terms over internal variable names.
- Behavior first, condition second.
- Keep names explicit and readable.

Examples:

- **UI display:** `test_show_[element]_when_[condition]`
- **UI hidden:** `test_hide_[element]_when_[condition]`
- **Permission allowed:** `test_allow_[action]_when_[condition]`
- **Permission denied:** `test_disallow_[action]_when_[condition]`
- **Validation:** `test_return_validation_error_when_[condition]`
- **Creation:** `test_create_[resource]_when_[condition]`
- **Update:** `test_update_[resource]_when_[condition]`
- **Delete:** `test_delete_[resource]_when_[condition]`
- **Redirect:** `test_redirect_to_[destination]_when_[condition]`
- **Exception:** `test_throw_[exception]_when_[condition]`
- **Event:** `test_dispatch_[event]_when_[condition]`
- **Notification:** `test_send_[notification]_when_[condition]`
- **State change:** `test_mark_[resource]_as_[state]_when_[condition]`
- **Calculation:** `test_calculate_[result]_correctly_when_[condition]`
- **Filter:** `test_filter_[resource]_by_[criteria]`
- **Sort:** `test_sort_[resource]_by_[field]`

## Run Commands

The pipeline imports a SQL dump into the DB on every full run — slow and unnecessary while iterating. Use **fast mode** while writing tests, **full mode** only when a review is accepted.

### Fast mode — only new/modified tests

1. Apply the device-independent test config (no git stash needed), skipping the slow dump import:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" apply --skip-import
   ```
2. Run only the target test(s):
   ```bash
   eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
   docker exec -i "$US_PHP" sh -lc "cd /var/www/html/AdminPage && ./vendor/phpunit/phpunit/phpunit -c application/tests/phpunit.xml --filter '<test_classname>' --testdox"
   # one method:  --filter '<test_classname>::<test_method>'
   # several:     --filter '<test_classname>::<m1>|<m2>'
   ```
3. When done iterating, restore the repo: `node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" restore`.

### Full mode — all tests with a fresh DB (on GATE 3 accept)

1. Apply the test config with the dump import enabled (fresh DB):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" apply --import
   ```
2. Run the whole suite and save the report:
   ```bash
   eval "$(node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" env)"
   docker exec -i "$US_PHP" sh -lc "cd /var/www/html/AdminPage && ./vendor/phpunit/phpunit/phpunit -c application/tests/phpunit.xml --testdox" > .walkthrough/<PREFIX>#[IID]/round-<N>/UT_#[IID]_[YYYYMMDD]_V1.txt
   ```
3. Restore the repo when finished: `node "${CLAUDE_PLUGIN_ROOT}/scripts/phpunit-config.mjs" restore`.

## Fast Failure Triage

- `Call to undefined function ...`: Missing helper load in `setUp()`.
- `... on null`: Missing dependency injection in pre-constructor.
- Unexpected `302` status: Missing/incorrect login role or required test data.
- DB assertion mismatch: State leakage or nondeterministic fixtures.
- Passes local, fails CI: Run via Docker to align environment.
- **PHPUnit: Deprecation/Error when calling `$this->form_validation->set_rules`**
  - **Issue**: `strtolower(): Passing null to parameter #1 ($string) of type string is deprecated` in `Input.php` under PHPUnit.
  - **Reason**: CodeIgniter's form validation checks `$_SERVER['REQUEST_METHOD']` which is not initialized automatically under PHPUnit.
  - **Solution**: Initialize it in the test `setUp()` method:
    ```php
    protected function setUp(): void
    {
        parent::setUp();
        $_SERVER['REQUEST_METHOD'] = $_SERVER['REQUEST_METHOD'] ?? 'GET/POST';
    }
    ```

## Output

- The new/updated test files, passing in Docker.
- **Fast mode (coder, pre-review):** the filtered run's result — no file under `.walkthrough/`.
- **Full mode (GATE 3 accept):** the full-suite output saved to `round-<N>/UT_#[IID]_[YYYYMMDD]_V{n}.txt`.
- Report the pass/fail counts and any test you could not make green — never present a skipped or filtered run as a full pass.

## Standalone use

See `../unioss-pipeline/REFERENCE.md` → Shared stage rules → Standalone use (e.g. `/unioss-phpunit-test Add tests for this model …`): do the task on the named file(s), write nothing under `.walkthrough/` unless asked, skip gates.

## Related files

- `./examples/*` — passing tests; read these before writing any test code.
- `scripts/phpunit-config.mjs` — `apply --skip-import` (fast), `apply --import` (full), `restore`.
- `skills/unioss-implement/SKILL.md` — the coder that invokes this.
- `skills/unioss-pipeline/REFERENCE.md` — config resolution, DB access.
