#!/usr/bin/env node
// PreToolUse(Edit|Write): block edits under application/migrations/ unless the ACTIVE
// ticket's implementation plan references the file.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';
import { latestRoundNum, planFilesForRound } from '../scripts/rounds.mjs';

export function activeTicketDir(root) {
  const pipelineDir = join(root, '.pipeline');
  if (!existsSync(pipelineDir)) return null;
  let newest = null;
  for (const entry of readdirSync(pipelineDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const state = join(pipelineDir, entry.name, 'pipeline-state.json');
    if (!existsSync(state)) continue;
    const mtime = statSync(state).mtimeMs;
    if (!newest || mtime > newest.mtime) newest = { mtime, name: entry.name };
  }
  return newest ? join(root, newest.name) : null;
}

function planFilesIn(dir) {
  try {
    return readdirSync(dir)
      .filter((n) => /implementation/i.test(n) && n.endsWith('.md'))
      .map((n) => join(dir, n));
  } catch { return []; }
}

function allTicketPlanFiles(root) {
  let plans = [];
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      plans.push(...planFilesIn(join(root, entry.name)));
    }
  } catch { /* no artifact root yet */ }
  return plans;
}

export function authorizingPlanFiles(root) {
  const active = activeTicketDir(root);
  if (!active) return allTicketPlanFiles(root);
  const latest = latestRoundNum(active);
  return latest ? planFilesForRound(active, latest) : planFilesIn(active);
}

// Only attach stdin listeners when run as the hook entrypoint, so importing this
// module (e.g. from tests) does not keep the process alive waiting on stdin.
const isMain = process.argv[1] && process.argv[1].endsWith('guard-migrations.mjs');
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let file = '';
    try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
    const f = file.replace(/\\/g, '/');
    if (!f.includes('application/migrations/')) process.exit(0);
    const base = basename(f);
    const root = resolveConfig().artifactRoot;
    const planFiles = authorizingPlanFiles(root);
    const referenced = planFiles.some((p) => {
      try { return readFileSync(p, 'utf8').includes(base); } catch { return false; }
    });
    if (!referenced) {
      const active = activeTicketDir(root);
      const where = active
        ? `the active ticket's latest round plan (under ${active})`
        : `any implementation plan under ${root}/`;
      process.stderr.write(`Blocked: ${base} is not referenced by ${where}. Add it to the plan first.\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}
