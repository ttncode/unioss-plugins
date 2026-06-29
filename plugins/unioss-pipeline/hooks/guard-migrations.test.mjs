import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeTicketDir, authorizingPlanFiles } from './guard-migrations.mjs';

function ticket(root, name, stateMtimeSec) {
  mkdirSync(join(root, name), { recursive: true });
  const pdir = join(root, '.pipeline', name);
  mkdirSync(pdir, { recursive: true });
  const state = join(pdir, 'pipeline-state.json');
  writeFileSync(state, '{}');
  if (stateMtimeSec) utimesSync(state, stateMtimeSec, stateMtimeSec);
}

test('activeTicketDir picks the newest pipeline-state', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  ticket(root, 'AP#1', 1000);
  ticket(root, 'AP#2', 2000);
  assert.equal(activeTicketDir(root), join(root, 'AP#2'));
});

test('activeTicketDir returns null when no state files', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  mkdirSync(join(root, 'AP#1'), { recursive: true });
  assert.equal(activeTicketDir(root), null);
});

test('authorizingPlanFiles uses only the latest round of the active ticket', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-'));
  // active ticket AP#9 with two rounds; the migration is only in round-2's plan
  mkdirSync(join(root, 'AP#9', 'round-1'), { recursive: true });
  writeFileSync(join(root, 'AP#9', 'round-1', 'AP#9_IMPLEMENTATION_V1.md'), 'no match here');
  mkdirSync(join(root, 'AP#9', 'round-2'), { recursive: true });
  writeFileSync(join(root, 'AP#9', 'round-2', 'AP#9_IMPLEMENTATION_V1.md'), 'touches 099_add_col.php');
  const pdir = join(root, '.pipeline', 'AP#9');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'pipeline-state.json'), '{}');

  const files = authorizingPlanFiles(root);
  assert.equal(files.length, 1);
  assert.match(files[0], /round-2/);
});
