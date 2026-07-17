import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planSteps, planText } from './ship-plan.mjs';

test('planSteps staging is always the fixed 2-step list, regardless of repos', () => {
  assert.deepEqual(planSteps('staging', ['admin-page']), [
    'Push each touched branch.',
    'Create one MR per repo into v3-develop-tps.',
  ]);
  assert.deepEqual(planSteps('staging', ['front-end', 'common-models']), planSteps('staging', ['admin-page']));
});

test('planSteps customer includes the test step when admin-page is touched', () => {
  assert.deepEqual(planSteps('customer', ['admin-page', 'common-models']), [
    'Sync each branch with origin/v3-master → stop on conflict.',
    'Re-run full test suite (AdminPage only) → stop on failure.',
    'Push each touched branch.',
    'Create one MR per repo into v3-develop.',
  ]);
});

test('planSteps customer omits the test step when admin-page is not touched', () => {
  assert.deepEqual(planSteps('customer', ['front-end']), [
    'Sync each branch with origin/v3-master → stop on conflict.',
    'Push each touched branch.',
    'Create one MR per repo into v3-develop.',
  ]);
});

test('planText numbers the steps and ends with the no-merge line', () => {
  const text = planText('staging', ['admin-page']);
  assert.equal(text, [
    'Staging mode plan:',
    '',
    '1. Push each touched branch.',
    '2. Create one MR per repo into v3-develop-tps.',
    '',
    'No merge, ever — MR only. Proceed?',
  ].join('\n'));
});

test('planText customer without admin-page renders 3 numbered steps', () => {
  const text = planText('customer', ['front-end']);
  assert.equal(text, [
    'Customer mode plan:',
    '',
    '1. Sync each branch with origin/v3-master → stop on conflict.',
    '2. Push each touched branch.',
    '3. Create one MR per repo into v3-develop.',
    '',
    'No merge, ever — MR only. Proceed?',
  ].join('\n'));
});

test('planText customer with admin-page renders 4 numbered steps', () => {
  const lines = planText('customer', ['admin-page']).split('\n');
  assert.equal(lines[0], 'Customer mode plan:');
  assert.equal(lines[2], '1. Sync each branch with origin/v3-master → stop on conflict.');
  assert.equal(lines[3], '2. Re-run full test suite (AdminPage only) → stop on failure.');
  assert.equal(lines[4], '3. Push each touched branch.');
  assert.equal(lines[5], '4. Create one MR per repo into v3-develop.');
});

test('planSteps throws on an unknown mode', () => {
  assert.throws(() => planSteps('prod', []), /Unknown ship mode/);
});
