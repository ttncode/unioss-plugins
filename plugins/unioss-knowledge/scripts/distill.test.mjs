import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, truncateToCap, splitSentiment, renderGlobal } from './distill.mjs';

test('truncateToCap keeps short text, trims long', () => {
  assert.equal(truncateToCap('abc', 100), 'abc');
  const long = 'x'.repeat(1000);
  assert.ok(truncateToCap(long, 10).length <= 40);
});

test('splitSentiment classifies by keyword', () => {
  const obs = [
    { body: 'Thank you, this is very helpful', source: 's1' },
    { body: 'This is broken and frustrating', source: 's2' },
    { body: 'neutral status update', source: 's3' },
  ];
  const { praise, criticism } = splitSentiment(obs);
  assert.equal(praise.length, 1);
  assert.equal(criticism.length, 1);
});

test('renderGlobal respects the token cap', () => {
  const focus = Array.from({ length: 500 }, (_, i) => `focus item number ${i} with padding text`);
  const md = renderGlobal({ focus, rules: [], friction: [], updated: '2026-07-21', sentimentAgeDays: 2 }, 1200);
  assert.ok(estimateTokens(md) <= 1200);
  assert.match(md, /read before any ticket/);
});
