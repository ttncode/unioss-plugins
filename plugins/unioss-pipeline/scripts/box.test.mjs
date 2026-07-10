import { test } from 'node:test';
import assert from 'node:assert/strict';
import { box, displayWidth } from './box.mjs';

test('displayWidth counts code points', () => {
  assert.equal(displayWidth('abc'), 3);
  assert.equal(displayWidth('✓ node'), 6);
});

test('every rendered line is the same display width', () => {
  const out = box('Title', ['a', 'a longer line here', '✓ node'], 40);
  const lines = out.split('\n');
  const widths = new Set(lines.map(displayWidth));
  assert.equal(widths.size, 1);
  assert.equal([...widths][0], 43); // width + 3
});

test('corners and borders are correct', () => {
  const lines = box('T', ['x'], 20).split('\n');
  assert.ok(lines[0].startsWith('╭') && lines[0].endsWith('╮'));
  for (const mid of lines.slice(1, -1)) {
    assert.ok(mid.startsWith('│') && mid.endsWith('│'));
  }
  const last = lines[lines.length - 1];
  assert.ok(last.startsWith('╰') && last.endsWith('╯'));
});

test('title appears in the top border', () => {
  const out = box('Env Check', [], 40);
  assert.match(out.split('\n')[0], /╭─ Env Check ─+╮/);
});
