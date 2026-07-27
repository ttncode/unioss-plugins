import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMigrationReferenced } from './guard-migrations.mjs';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('isMigrationReferenced matches full filename, un-timestamped name, and descriptor', () => {
  const dir = join(tmpdir(), 'guard_migrations_test_' + Date.now());
  mkdirSync(dir, { recursive: true });
  const planFile = join(dir, 'implementation.v1.md');
  
  writeFileSync(planFile, 'Add migration setup_producer_tsm_linkage_a1863_246.php for ticket A1863');

  const file = '20260727150000_setup_producer_tsm_linkage_a1863_246.php';
  assert.equal(isMigrationReferenced(file, [planFile]), true);

  rmSync(dir, { recursive: true, force: true });
});
