import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePeriod, detectIntent, detectPeriod, periodOverlapsPresent } from './period.mjs';

const NOW = new Date('2026-07-21T10:00:00Z');

test('month period spans month start to now', () => {
  const p = parsePeriod('month', NOW);
  assert.equal(p.key, '2026-07');
  assert.equal(p.from.getUTCMonth(), 6);
});

test('specific YYYY-MM', () => {
  const p = parsePeriod('2026-03', NOW);
  assert.equal(p.key, '2026-03');
  assert.equal(p.from.getFullYear(), 2026);
});

test('custom range with "to"', () => {
  const p = parsePeriod('2026-06-01 to 2026-06-30', NOW);
  assert.ok(p);
  assert.equal(p.key, '20260601-20260630');
});

test('unknown input is null', () => {
  assert.equal(parsePeriod('garble', NOW), null);
});

test('detectIntent classifies sentiment and focus', () => {
  assert.equal(detectIntent('what did customers praise or criticize'), 'sentiment');
  assert.equal(detectIntent('what is the customer focusing on'), 'focus');
});

test('detectPeriod reads a named month + year', () => {
  const p = detectPeriod('what did customers praise in June 2026', NOW);
  assert.equal(p.key, '2026-06');
});

test('detectPeriod returns null when absent', () => {
  assert.equal(detectPeriod('customer focus', NOW), null);
});

test('periodOverlapsPresent true for current month, false for past', () => {
  assert.equal(periodOverlapsPresent(parsePeriod('month', NOW), NOW), true);
  assert.equal(periodOverlapsPresent(parsePeriod('2026-03', NOW), NOW), false);
});
