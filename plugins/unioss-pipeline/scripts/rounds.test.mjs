import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listRounds, latestRoundNum, roundDir, planFilesForRound } from './rounds.mjs';

function ticketWith(rounds) {
  const dir = mkdtempSync(join(tmpdir(), 'rounds-'));
  for (const [n, files] of Object.entries(rounds)) {
    const rd = join(dir, `round-${n}`);
    mkdirSync(rd, { recursive: true });
    for (const f of files) writeFileSync(join(rd, f), 'x');
  }
  return dir;
}

test('listRounds returns ascending numbers and ignores non-round dirs', () => {
  const dir = ticketWith({ 2: [], 1: [] });
  mkdirSync(join(dir, 'screenshots'));
  assert.deepEqual(listRounds(dir), [1, 2]);
});

test('latestRoundNum is 0 when none exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rounds-'));
  assert.equal(latestRoundNum(dir), 0);
});

test('latestRoundNum picks the highest, not lexical', () => {
  const dir = ticketWith({ 2: [], 10: [], 1: [] });
  assert.equal(latestRoundNum(dir), 10);
});

test('roundDir builds the expected path', () => {
  assert.ok(roundDir('/t', 3).endsWith(join('/t', 'round-3')));
});

test('planFilesForRound returns only IMPLEMENTATION md files of that round', () => {
  const dir = ticketWith({ 1: ['AP#1_IMPLEMENTATION_V1.md', 'AP#1_REVIEW.md'] });
  const plans = planFilesForRound(dir, 1);
  assert.equal(plans.length, 1);
  assert.match(plans[0], /IMPLEMENTATION_V1\.md$/);
});
