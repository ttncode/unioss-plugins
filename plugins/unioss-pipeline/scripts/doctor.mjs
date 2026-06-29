#!/usr/bin/env node
// UNIOSS pipeline environment doctor — cross-platform (node/jq/docker/containers/token/MCP).
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const isWin = platform() === 'win32';
const has = (cmd) => {
  try { execSync(isWin ? `where ${cmd}` : `command -v ${cmd}`, { stdio: 'ignore' }); return true; } catch { return false; }
};
const out = (cmd) => {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; }
};

const pm = isWin
  ? (has('winget') ? 'winget' : has('choco') ? 'choco' : '')
  : platform() === 'darwin'
    ? (has('brew') ? 'brew' : '')
    : (has('apt-get') ? 'apt' : has('dnf') ? 'dnf' : has('pacman') ? 'pacman' : '');

const installCmd = (pkg) => ({
  brew: `brew install ${pkg}`,
  apt: `sudo apt-get update && sudo apt-get install -y ${pkg}`,
  dnf: `sudo dnf install -y ${pkg}`,
  pacman: `sudo pacman -S --noconfirm ${pkg}`,
  winget: `winget install ${pkg}`,
  choco: `choco install -y ${pkg}`,
}[pm] || `(install ${pkg} with your package manager)`);

function readContainerNames() {
  const composePath = join(process.cwd(), 'docker-compose.yml');
  const defaults = { mysql: 'mysql-unioss3', php: 'php-unioss3' };
  if (!existsSync(composePath)) {
    console.log('  (docker-compose.yml not found — checking default container names)');
    return defaults;
  }
  const lines = readFileSync(composePath, 'utf8').split('\n');
  let mysql = null, php = null;
  for (const line of lines) {
    const m = line.match(/^\s+container_name:\s*(\S+)/);
    if (!m) continue;
    const name = m[1];
    if (name.includes('mysql') || name.includes('mariadb')) mysql = name;
    else if (name.includes('php')) php = name;
  }
  return { mysql: mysql ?? defaults.mysql, php: php ?? defaults.php };
}

const dockerOk = has('docker');
const runningNames = dockerOk ? out('docker ps --format "{{.Names}}"') : '';
const { mysql: mysqlName, php: phpName } = readContainerNames();

const checks = [
  { name: 'node', ok: has('node'), fix: installCmd('node'), light: true },
  { name: 'jq', ok: has('jq'), fix: installCmd('jq'), light: true },
  { name: 'docker', ok: dockerOk, fix: 'Install Docker: https://docs.docker.com/get-docker/' },
  { name: `container ${mysqlName}`, ok: new RegExp(`(^|\\n)${mysqlName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${mysqlName}\` is not running. Start the stack: docker compose up -d (from the unioss3 project root)` },
  { name: `container ${phpName}`, ok: new RegExp(`(^|\\n)${phpName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${phpName}\` is not running. Start the stack: docker compose up -d (from the unioss3 project root)` },
  { name: 'GITLAB_TOKEN', ok: !!process.env.GITLAB_TOKEN, fix: isWin ? 'setx GITLAB_TOKEN <your-token>' : 'export GITLAB_TOKEN=<your-token>  (add to your shell profile)' },
];

console.log('\nUNIOSS pipeline — environment check\n');
let allOk = true;
const lightMissing = [];
for (const c of checks) {
  console.log(`  [${c.ok ? 'OK' : 'XX'}] ${c.name}` + (c.ok ? '' : `\n        -> ${c.fix}`));
  if (!c.ok) { allOk = false; if (c.light) lightMissing.push(c.name); }
}
if (lightMissing.length && pm) {
  console.log(`\nLight deps install command:\n  ${lightMissing.map(installCmd).join('  &&  ')}`);
}
console.log(`\nPlaywright MCP ships with this plugin (npx @playwright/mcp@latest) — no manual install needed.\n`);
process.exit(allOk ? 0 : 1);
