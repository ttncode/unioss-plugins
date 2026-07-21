import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  knowledgeDir, atomicWrite, obsId, appendObservations,
  readIndex, touchLayer, stalenessDays, acquireLock, releaseLock,
} from './store.mjs';

const mk = () => mkdtempSync(join(tmpdir(), 'kstore-'));

test('knowledgeDir composes artifactRoot/.knowledge', () => {
  assert.equal(knowledgeDir('/x', '.walkthrough'), join('/x', '.walkthrough', '.knowledge'));
});

test('obsId is stable and unique', () => {
  assert.equal(obsId(1, 2, 3), obsId(1, 2, 3));
  assert.notEqual(obsId(1, 2, 3), obsId(1, 2, 4));
});

test('appendObservations dedupes by id across runs', () => {
  const dir = mk();
  const recs = [{ id: 'a', body: 'x' }, { id: 'b', body: 'y' }];
  assert.equal(appendObservations(dir, recs), 2);
  assert.equal(appendObservations(dir, recs), 0);
  assert.equal(appendObservations(dir, [{ id: 'b' }, { id: 'c' }]), 1);
});

test('atomicWrite writes final content', () => {
  const dir = mk();
  const f = join(dir, 'x.md');
  atomicWrite(f, 'hello');
  assert.equal(readFileSync(f, 'utf8'), 'hello');
});

test('touchLayer + stalenessDays', () => {
  const dir = mk();
  const past = new Date('2026-07-12T00:00:00Z');
  touchLayer(dir, 'sentiment', past);
  const now = new Date('2026-07-21T00:00:00Z');
  assert.equal(stalenessDays(readIndex(dir), 'sentiment', now), 9);
  assert.equal(stalenessDays(readIndex(dir), 'missing', now), null);
});

test('lock is exclusive', () => {
  const dir = mk();
  assert.equal(acquireLock(dir), true);
  assert.equal(acquireLock(dir), false);
  releaseLock(dir);
  assert.equal(acquireLock(dir), true);
});
