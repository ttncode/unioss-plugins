import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planTable } from './plan-table.mjs';
import { displayWidth } from './box.mjs';

test('title substitutes prefix, iid, round', () => {
  const out = planTable('FE', 391, 2);
  assert.match(out, /UNIOSS Pipeline · FE#391 · round-2/);
});

test('every line is the same display width (box stays flush)', () => {
  const lines = planTable('AP', 1585, 1).split('\n');
  const widths = new Set(lines.map(displayWidth));
  assert.equal(widths.size, 1, `ragged box: widths ${[...widths].join(', ')}`);
});

test('renders all 8 stages and 3 gates', () => {
  const out = planTable('AP', 1585, 1);
  for (const stage of ['Investigate', 'Spec', 'Plan', 'Code', 'Review', 'Verify', 'Scope', 'Finalize']) {
    assert.ok(out.includes(stage), `missing stage ${stage}`);
  }
  assert.equal((out.match(/GATE/g) ?? []).length, 4);
});
