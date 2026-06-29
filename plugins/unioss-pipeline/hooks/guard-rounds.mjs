#!/usr/bin/env node
// PreToolUse(Edit|Write): block writes into a sealed (prior) round's folder.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';

function currentRoundFor(root, ticket) {
  try {
    const state = JSON.parse(readFileSync(join(root, '.pipeline', ticket, 'pipeline-state.json'), 'utf8'));
    return Number(state.current_round) || 0;
  } catch {
    return 0;
  }
}

export function sealedRoundViolation(filePath, root) {
  const f = filePath.replace(/\\/g, '/');
  const m = f.match(/\/([^/]+)\/round-(\d+)\//);
  if (!m) return null;
  const ticket = m[1];
  const round = Number(m[2]);
  const current = currentRoundFor(root, ticket);
  return current && round < current ? round : null;
}

const isMain = process.argv[1] && process.argv[1].endsWith('guard-rounds.mjs');
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let file = '';
    try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
    const root = resolveConfig().artifactRoot;
    const violated = sealedRoundViolation(file, root);
    if (violated !== null) {
      process.stderr.write(`Blocked: round-${violated} is sealed. Write into the current round instead.\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}
