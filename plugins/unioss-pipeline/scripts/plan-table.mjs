#!/usr/bin/env node
// Render the Step-0 pipeline plan table deterministically.
// The rows are fixed; only the title (prefix / IID / round) varies. Columns are
// pre-aligned here and the rounded border comes from box.mjs, so the LLM never
// has to count monospace columns (which it does unreliably).
import { pathToFileURL } from 'node:url';
import { box, displayWidth } from './box.mjs';

const STAGES = [
  ['1', 'Investigate', 'subagent · opus', 'INVESTIGATION + REPORT'],
  ['⛔', 'GATE 0', 'you', 'clarify (only if unclear)'],
  ['2', 'Spec', 'subagent · opus', 'SPEC.md'],
  ['⛔', 'GATE 1', 'you', 'approve spec / edit'],
  ['3', 'Plan', 'subagent · opus', 'IMPLEMENTATION_V1'],
  ['⛔', 'GATE 2', 'you', 'approve plan / edit'],
  ['4', 'Code', 'main · sonnet', 'CHANGES.md + fast tests'],
  ['5', 'Review', 'subagent · opus', 'REVIEW.md'],
  ['⛔', 'GATE 3', 'you', 'fix / accept'],
  ['6', 'Verify', 'subagent · sonnet', 'TEST_RESULTS.md (DB+UI)'],
  ['7', 'Scope', 'subagent · sonnet', 'SCOPE.md'],
  ['8', 'Finalize', 'main', 'branch + commit (no push/MR)'],
];

const FOOTER = 'Gates stop for approval. Nothing runs until you confirm.';
const COL = { num: 2, stage: 11, runsAs: 17 };

const padEndW = (str, width) => str + ' '.repeat(Math.max(0, width - displayWidth(str)));

const formatRow = ([num, stage, runsAs, output]) =>
  ` ${padEndW(num, COL.num)}  ${padEndW(stage, COL.stage)}  ${padEndW(runsAs, COL.runsAs)}  ${output}`;

export function planTable(prefix, iid, round) {
  const title = `UNIOSS Pipeline · ${prefix}#${iid} · round-${round}`;
  const lines = [
    '',
    formatRow(['#', 'Stage', 'Runs as', 'Output']),
    ` ${'─'.repeat(63)}`,
    ...STAGES.map(formatRow),
    '',
    ` ${FOOTER}`,
  ];
  return box(title, lines);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [prefix, iid, round] = process.argv.slice(2);
  if (!prefix || !iid || !round) {
    process.stderr.write('Usage: plan-table.mjs <PREFIX> <IID> <round>\n');
    process.exit(1);
  }
  process.stdout.write(planTable(prefix, iid, round) + '\n');
}
