import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, truncateToCap, renderGlobal, buildEvidence, validateClassified } from './distill.mjs';

test('truncateToCap keeps short text, trims long', () => {
  assert.equal(truncateToCap('abc', 100), 'abc');
  const long = 'x'.repeat(1000);
  assert.ok(truncateToCap(long, 10).length <= 40);
});

test('renderGlobal respects the token cap', () => {
  const focus = Array.from({ length: 500 }, (_, i) => `focus item number ${i} with padding text`);
  const md = renderGlobal({ focus, rules: [], friction: [], updated: '2026-07-21', sentimentAgeDays: 2 }, 1200);
  assert.ok(estimateTokens(md) <= 1200);
  assert.match(md, /read before any ticket/);
});

test('buildEvidence keeps the 300 most recent and maps shape', () => {
  const obs = Array.from({ length: 301 }, (_, i) => ({
    id: `x${i}`, project_id: 1, iid: 2,
    author: 'A', at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), body: `b${i}`, source: 's',
  }));
  const ev = buildEvidence('2026-W30', ['f1'], obs);
  assert.equal(ev.periodKey, '2026-W30');
  assert.deepEqual(ev.focus, ['f1']);
  assert.equal(ev.observations.length, 300);
  assert.equal(ev.observations[0].body, 'b300'); // newest first
  assert.ok(!ev.observations.some((o) => o.body === 'b0')); // oldest dropped
  assert.deepEqual(Object.keys(ev.observations[0]), ['author', 'at', 'body', 'source']);
});

test('validateClassified accepts a good shape and strips extra keys', () => {
  const out = validateClassified({ praise: [{ body: 'Fast fix appreciated', source: 'u1', extra: 1 }], criticism: [] });
  assert.deepEqual(out, { praise: [{ body: 'Fast fix appreciated', source: 'u1' }], criticism: [] });
});

test('validateClassified rejects bad shapes', () => {
  assert.throws(() => validateClassified(null), /object/);
  assert.throws(() => validateClassified({ praise: 'no', criticism: [] }), /array/);
  assert.throws(() => validateClassified({ praise: [{ body: 1, source: 's' }], criticism: [] }), /string/);
  assert.throws(() => validateClassified({ praise: [{ body: 'x'.repeat(201), source: 's' }], criticism: [] }), /200/);
  assert.throws(() => validateClassified({ praise: Array.from({ length: 21 }, () => ({ body: 'b', source: 's' })), criticism: [] }), /20/);
});
