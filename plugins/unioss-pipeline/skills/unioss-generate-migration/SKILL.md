---
name: unioss-generate-migration
description: 'Use when the user asks to generate migration files for UNIOSS project.'
---

# CI3 Migration Generator For UNIOSS Project

You are working in a CodeIgniter 3 repository with timestamp-based migrations.

## Input (from the user message)

The user may optionally add:

- "production only" (meaning: do not keep staging/testing/vbox copies)
- a ticket id: f353, a1768, etc (meaning: include in the migration file name)
- column type/default/null/after (if provided, honor it)

## Rules & structure

- Migration filename format:
  `<timestamp>_<action>_<ticket_id>_<index>.php`, example: `20260114101209_alter_column_administrator_id_nullable_to_status_histories_table_a1678_222.php`
- A migration may exist in multiple env folders:
  - production: `AdminPage/application/migrations/production`
  - staging: `AdminPage/application/migrations/staging`
  - testing: `AdminPage/application/migrations/testing`
  - virtualbox_direct_domain: `AdminPage/application/config/virtualbox_direct_domain`
- Config files to update:
  - production: `AdminPage/application/config/production/migration.php`
  - staging: `AdminPage/application/config/staging/migration.php`
  - virtualbox_direct_domain: `AdminPage/application/config/virtualbox_direct_domain/migration.php`
  - testing: skip config update
- Migration tests:
  - directory: `AdminPage/application/tests/migrations`
  - file pattern: `Migration_<timestamp>_test.php`
  - test file contains constants that include the timestamp / migration version; update them too.

## Goal (what you must deliver)

1. All migration files is added and migrate correctly.
2. All relevant migration config files have their "target migration version", comment the latest target version and add the new target version below.
3. The migration test file(s) are added with the test cases correctly.

Keep diffs minimal. Do not change unrelated code.

---

## Execution plan (do this in order)

### 1) Parse user intent from the prompt

Extract as much as possible:

- Operation: add column / drop column / add index / drop index / create table / drop table / rename column / change column / add foreign key / data migration
- Table name
- Column name(s)
- Type / nullability / default / comment / after (if provided)
- Ticket id (if present)
- Env scope:
  - If prompt includes "production only" -> keep only production migration files
  - Otherwise keep all generated envs
- Index: Find the latest migration file in the target environment, retrieve its index number, and add one to it

If the prompt does not include type details:

- Default added for all envs
- Try to infer from repo context:
  - Search for similar columns in existing migrations or SQL in the repo.
  - If column ends with `_at`, prefer `DATETIME NULL` unless repo clearly uses `timestamp` or `datetime(6)`.
  - If the column is completely new, use the best option.

### 2) Generate the migration files

Goal: Create a new migration file based on the template below and intent to all envs

- Template:

  ```php
  <?php defined('BASEPATH') or exit('No direct script access allowed');

  class Migration_Remove_Unused_Image_Columns_From_Products_Table_A1783_122 extends CI_Migration
  {
      private const TABLE = 'products';

      private const DEPRECATED_COLUMNS = [
          't_image_url1' => [
              'type' => 'VARCHAR(128)',
              'null' => 'DEFAULT NULL',
              'comment' => "COMMENT 'タブレット用横長商品画像２'",
              'after' => 't_image_url1'
          ],
          'vending_machine_image_url1' => [
              'type' => 'VARCHAR(128)',
              'null' => 'DEFAULT NULL',
              'comment' => "COMMENT '自販機用画像1'",
              'after' => 'vending_machine_thumbnail_url'
          ],
      ];

      public function up(): void
      {
          $this->db->trans_start();

          foreach (array_keys(self::DEPRECATED_COLUMNS) as $column) {
              if ($this->db->field_exists($column, self::TABLE)) {
                  $this->execute_sql(
                      "ALTER TABLE `" . self::TABLE . "` DROP COLUMN `{$column}`",
                      "Drop column `{$column}` from `" . self::TABLE . "`"
                  );
              }
          }

          $this->db->trans_complete();

          if ($this->db->trans_status() === false) {
              echo "<p style='color:red'> => Migrate Up " . __CLASS__ . " failed</p>";
          } else {
              echo "<p style='color:green'> => Migrate Up " . __CLASS__ . " done</p>";
          }
      }

      public function down(): void
      {
          $this->db->trans_start();

          foreach (self::DEPRECATED_COLUMNS as $column => $def) {
              if (!$this->db->field_exists($column, self::TABLE)) {
                  $this->execute_sql(
                      "ALTER TABLE `" . self::TABLE . "` ADD COLUMN `{$column}` {$def['type']} {$def['null']} {$def['comment']} AFTER `{$def['after']}`",
                      "Add column `{$column}` to `" . self::TABLE . "`"
                  );
              }
          }

          $this->db->trans_complete();

          if ($this->db->trans_status() === false) {
              echo "<p style='color:red'> => Migrate Down " . __CLASS__ . " failed</p>";
          } else {
              echo "<p style='color:green'> => Migrate Down " . __CLASS__ . " done</p>";
          }
      }

      /**
       * Execute SQL statement
       *
       * @param string $sql
       * @param string $message
       * @return boolean
       */
      private function execute_sql(string $sql, string $message): bool
      {
          if ($this->db->simple_query($sql)) {
              echo "<p style='color:green'>{$message} success</p>";
              return true;
          }
          echo "<p style='color:red'>{$message} failed</p>";
          if (function_exists('unioss_debug')) {
              unioss_debug($this->db->error());
          }
          return false;
      }
  }
  ```

### 3) Add the target version to the migration config files

Update only the following files (if they exist):

- `AdminPage/application/config/production/migration.php`
- `AdminPage/application/config/staging/migration.php`
- `AdminPage/application/config/virtualbox_direct_domain/migration.php`

Rules:

- Comment the latest target version line
- Add new the new target version line below the commented latest target version
- Do not touch testing config (skip).

Example:

- The old migration config:

  ```php
  #$config['migration_version'] = 20260113093511;
  #$config['migration_version'] = 20260114101209;
  $config['migration_version'] = 20260127150000;
  ```

- The updated migration config:

  ```php
  #$config['migration_version'] = 20260109170001;
  #$config['migration_version'] = 20260114101209;
  #$config['migration_version'] = 20260127150000;
  $config['migration_version'] = 20260129000001;
  ```

### 4) Generate the migration test file

Goal: Create a new migration test file for the new migration file.

- Template:

  ```php
  <?php

  class Migration_{timestamp}_test extends TestCase
  {
      private const MIGRATION_VERSION_UP   = {new_timestamp};
      private const MIGRATION_VERSION_DOWN = {latest_timestamp};

      public static function setUpBeforeClass(): void
      {
          self::$migrate = true;
          parent::setUpBeforeClass();

          // Load instances
          $CI = &get_instance();
          $CI->load->library('migration');
          $CI->migration->version(self::MIGRATION_VERSION_UP);
      }

      public function setUp(): void
      {
          $this->resetInstance();
          $this->CI->load->database();
          $this->CI->db->trans_begin();
      }

      public function tearDown(): void
      {
          $this->CI->db->trans_rollback();
          parent::tearDown();
      }

      /**
      * Test: Version migration up.
      */
      public function test_version_migration_up(): void
      {
          $version_migrations = $this->CI->db->from('migrations')->get()->first_row('array');

          $this->assertTrue(
              $version_migrations['version'] >= self::MIGRATION_VERSION_UP,
              $this->build_message('ut_migrations.error.migration_up_failed', ['version' => self::MIGRATION_VERSION_UP])
          );
      }

      // TODOME: Add test case for up status

      /**
      * Test: Version migration down
      */
      public function test_version_migration_down(): void
      {
          $this->resetInstance();
          $this->CI->load->database();
          $this->CI->load->library('migration');
          $this->CI->migration->version(self::MIGRATION_VERSION_DOWN);

          $version_migrations = $this->CI->db->from('migrations')->get()->first_row('array');

          $this->assertTrue(
              $version_migrations['version'] < self::MIGRATION_VERSION_UP,
              $this->build_message(
                  'ut_migrations.error.migration_down_failed',
                  ['version_up' => self::MIGRATION_VERSION_UP, 'version_down' => self::MIGRATION_VERSION_DOWN]
              )
          );
      }

      // TODOME: Add test case for down status
  }
  ```
