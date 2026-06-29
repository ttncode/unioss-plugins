#!/usr/bin/env node
// PreToolUse(Edit|Write): block edits under application/migrations/ unless a plan references the file.
import { readdirSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
  const f = file.replace(/\\/g, '/');
  if (!f.includes('application/migrations/')) process.exit(0);
  const base = basename(f);
  let planFiles = [];
  try {
    const dirs = readdirSync('.walkthrough', { withFileTypes: true });
    for (const entry of dirs) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const sub = `.walkthrough/${entry.name}`;
      try {
        const files = readdirSync(sub).filter((n) => /IMPLEMENTATION/.test(n) && n.endsWith('.md'));
        planFiles.push(...files.map((n) => `${sub}/${n}`));
      } catch { /* skip unreadable subdir */ }
    }
  } catch { planFiles = []; }
  const referenced = planFiles.some((fullPath) => {
    try { return readFileSync(fullPath, 'utf8').includes(base); } catch { return false; }
  });
  if (!referenced) {
    process.stderr.write(`Blocked: ${base} is not referenced by any implementation plan under .walkthrough/. Add it to the plan first.\n`);
    process.exit(2);
  }
  process.exit(0);
});
