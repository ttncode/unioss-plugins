import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileLink } from './link.mjs';

test('encodes # as %23 and resolves absolute, default label is basename', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md', { cwd: '/ws' });
  assert.equal(out, '[AP#1583_REVIEW.md](file:///ws/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)');
});

test('no bare # remains in the url portion', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/', { cwd: '/ws' });
  const url = out.slice(out.indexOf('(') + 1, -1);
  assert.ok(!url.includes('#'));
  assert.match(url, /%23/);
});

test('custom label is used verbatim', () => {
  const out = fileLink('/abs/UT_#1583_20260709_V1.txt', { label: 'full test run' });
  assert.equal(out, '[full test run](file:///abs/UT_%231583_20260709_V1.txt)');
});

test('spaces encode to %20', () => {
  const out = fileLink('/abs/my file.md', {});
  assert.match(out, /file:\/\/\/abs\/my%20file\.md/);
});
