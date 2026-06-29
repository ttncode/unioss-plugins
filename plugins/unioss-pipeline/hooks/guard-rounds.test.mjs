import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sealedRoundViolation } from './guard-rounds.mjs';

function root(currentRound) {
  const dir = mkdtempSync(join(tmpdir(), 'gr-'));
  const pdir = join(dir, '.pipeline', 'AP#7');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'pipeline-state.json'), JSON.stringify({ current_round: currentRound }));
  return dir;
}

test('writing a prior (sealed) round is a violation', () => {
  const dir = root(2);
  const file = join(dir, 'AP#7', 'round-1', 'AP#7_REVIEW.md');
  assert.equal(sealedRoundViolation(file, dir), 1);
});

test('writing the current round is allowed', () => {
  const dir = root(2);
  const file = join(dir, 'AP#7', 'round-2', 'AP#7_REVIEW.md');
  assert.equal(sealedRoundViolation(file, dir), null);
});

test('paths outside any round are ignored', () => {
  const dir = root(2);
  assert.equal(sealedRoundViolation(join(dir, 'AP#7', 'screenshots', 'x.png'), dir), null);
});

test('no state file -> nothing sealed, allowed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gr-'));
  assert.equal(sealedRoundViolation(join(dir, 'AP#7', 'round-1', 'x.md'), dir), null);
});
