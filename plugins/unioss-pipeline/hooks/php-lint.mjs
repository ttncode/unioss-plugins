#!/usr/bin/env node
// PostToolUse(Edit|Write): php -l edited PHP files under the AdminPage repo via the container.
import { execFileSync } from 'node:child_process';
import { resolveConfig } from '../scripts/config.mjs';

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let file = '';
  try { file = (JSON.parse(raw).tool_input || {}).file_path || ''; } catch { process.exit(0); }
  file = file.replace(/\\/g, '/');
  if (!file.endsWith('.php')) process.exit(0);

  const cfg = resolveConfig();
  const repo = cfg.source.modules['admin-page'].replace(/\/+$/, ''); // "AdminPage"
  const marker = `/${repo}/`;
  const idx = file.indexOf(marker);
  if (idx === -1) process.exit(0);

  const rel = file.slice(idx + marker.length);
  try {
    execFileSync('docker', ['exec', '-i', cfg.docker.php, 'php', '-l', `/var/www/html/${repo}/${rel}`], { stdio: ['ignore', 'ignore', 'inherit'] });
    process.exit(0);
  } catch {
    process.stderr.write(`php -l failed for ${file}\n`);
    process.exit(2);
  }
});
