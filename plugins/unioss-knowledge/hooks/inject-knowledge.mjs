#!/usr/bin/env node
// SessionStart: inject the tiny always-on knowledge slice + a staleness nudge.
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from '../scripts/config.mjs';
import { knowledgeDir, readIndex, stalenessDays } from '../scripts/store.mjs';
import { truncateToCap } from '../scripts/distill.mjs';

const STALE_DAYS = 7;
const CAP_TOKENS = 1200;

export function buildAdditionalContext(cwd = process.cwd(), now = new Date()) {
  const { artifactRoot } = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, artifactRoot);
  const globalFile = join(dir, 'GLOBAL.md');
  if (!existsSync(globalFile)) return '';
  let body = truncateToCap(readFileSync(globalFile, 'utf8'), CAP_TOKENS);
  const age = stalenessDays(readIndex(dir), 'sentiment', now);
  if (age != null && age > STALE_DAYS) {
    body += `\n\n⚠ sentiment ${age}d old · run /unioss-knowledge-refresh weekly`;
  }
  return body;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const additionalContext = buildAdditionalContext();
  if (additionalContext) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }) + '\n');
  }
}
