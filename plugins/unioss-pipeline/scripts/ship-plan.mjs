#!/usr/bin/env node
// Render the /unioss-ship preview-before-proceed plan text. The step list is
// generated from mode + touched repos so it never lists a step that doesn't
// apply (e.g. no test line when only front-end was touched).
import { pathToFileURL } from 'node:url';

const STAGING_STEPS = [
  'Push each touched branch.',
  'Create one MR per repo into v3-develop-tps.',
];

function customerSteps(hasAdminPage) {
  const steps = ['Sync each branch with origin/v3-master → stop on conflict.'];
  if (hasAdminPage) steps.push('Re-run full test suite (AdminPage only) → stop on failure.');
  steps.push('Push each touched branch.');
  steps.push('Create one MR per repo into v3-develop.');
  return steps;
}

export function planSteps(mode, touchedRepos) {
  if (mode === 'staging') return STAGING_STEPS;
  if (mode === 'customer') return customerSteps(touchedRepos.includes('admin-page'));
  throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
}

export function planText(mode, touchedRepos) {
  const steps = planSteps(mode, touchedRepos);
  const title = mode === 'staging' ? 'Staging mode plan:' : 'Customer mode plan:';
  const numbered = steps.map((s, i) => `${i + 1}. ${s}`);
  return [title, '', ...numbered, '', 'No merge, ever — MR only. Proceed?'].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [mode, ...repos] = process.argv.slice(2);
  if (!mode) { process.stderr.write('Usage: ship-plan.mjs <staging|customer> [repoKey...]\n'); process.exit(1); }
  try {
    process.stdout.write(planText(mode, repos) + '\n');
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
