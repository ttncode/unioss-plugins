import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { activeTicketDir } from './guard-migrations.mjs';

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
