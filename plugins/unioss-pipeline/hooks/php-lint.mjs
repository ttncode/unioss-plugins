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
  let matchedModule = null;
  let relPath = '';

  for (const [key, modulePath] of Object.entries(cfg.source.modules)) {
    const cleanPath = modulePath.replace(/\\/g, '/').replace(/\/+$/, '');
    const marker = `/${cleanPath}/`;
    const idx = file.indexOf(marker);
    if (idx !== -1) {
      matchedModule = cleanPath;
      relPath = file.slice(idx + marker.length);
      break;
    }
  }

  if (!matchedModule) process.exit(0);

  try {
    execFileSync('docker', ['exec', '-i', cfg.docker.php, 'php', '-l', `/var/www/html/${matchedModule}/${relPath}`], { stdio: ['ignore', 'ignore', 'inherit'] });
    process.exit(0);
  } catch {
    process.stderr.write(`php -l failed for ${file}\n`);
    process.exit(2);
  }
});
