#!/usr/bin/env node
// UNIOSS pipeline environment doctor — cross-platform (node/jq/docker/containers/token/chrome/MCP).
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';
import { resolveConfig, runCheck, valueSources } from './config.mjs';
import { box } from './box.mjs';

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

const dockerOk = has('docker');
const runningNames = dockerOk ? out('docker ps --format "{{.Names}}"') : '';
const chromeOk = isWin
  ? (!!out('where chrome') || existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe'))
  : platform() === 'darwin'
    ? (has('google-chrome') || existsSync('/Applications/Google Chrome.app'))
    : (has('google-chrome') || has('google-chrome-stable'));
const cfg = resolveConfig();
const { mysql: mysqlName, php: phpName } = cfg.docker;

const checks = [
  { name: 'node', ok: has('node'), fix: installCmd('node'), light: true },
  { name: 'jq', ok: has('jq'), fix: installCmd('jq'), light: true },
  { name: 'docker', ok: dockerOk, fix: 'Install Docker: https://docs.docker.com/get-docker/' },
  { name: `container ${mysqlName}`, ok: new RegExp(`(^|\\n)${mysqlName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${mysqlName}\` is not running. Start the stack: docker compose up -d (from the unioss3 project root)` },
  { name: `container ${phpName}`, ok: new RegExp(`(^|\\n)${phpName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${phpName}\` is not running. Start the stack: docker compose up -d (from the unioss3 project root)` },
  { name: 'GITLAB_TOKEN', ok: !!process.env.GITLAB_TOKEN, fix: (isWin ? 'setx GITLAB_TOKEN <your-token>' : 'export GITLAB_TOKEN=<your-token>  (add to your shell profile)') + '  — needs `api` scope for /unioss-ship MR creation' },
  { name: 'Chrome (tester browser)', ok: chromeOk, fix: 'Playwright Chrome not found — the tester cannot verify UI. Run in a real terminal (needs a TTY for sudo):  ! npx playwright install --with-deps chrome' },
];

const WIDTH = 69;
const SECRET_KEYS = new Set(['db.password']);
const lines = [];

let allOk = true;
const lightMissing = [];

lines.push('Dependencies', '');
for (const c of checks) {
  lines.push(`  ${c.ok ? '✓' : '✗'}  ${c.name}`);
  if (!c.ok) {
    allOk = false;
    if (c.light) lightMissing.push(c.name);
    lines.push(`       └ ${c.fix}`);
  }
}

if (lightMissing.length && pm) {
  lines.push('', `  Light deps:  ${lightMissing.map(installCmd).join('  &&  ')}`);
}
lines.push('', '  Playwright MCP ships with this plugin (npx @playwright/mcp@latest).');

lines.push('', 'Configuration          value                 source');
for (const { key, value, source } of valueSources()) {
  const shown = SECRET_KEYS.has(key) ? '******' : (Array.isArray(value) ? value.join(',') : String(value));
  lines.push(`  ${key.padEnd(22)} ${shown.slice(0, 20).padEnd(21)} ${source}`);
}
lines.push(`  ${'GITLAB_TOKEN'.padEnd(22)} ${(process.env.GITLAB_TOKEN ? '******' : 'MISSING').padEnd(21)} env`);

const check = runCheck();
if (!check.ok) allOk = false;
for (const err of check.errors) lines.push('', `  ✗ config: ${err}`);
for (const warn of check.warnings) lines.push(`  ! ${warn}`);
const status = allOk
  ? 'All checks passed — pipeline ready.'
  : 'Issues found — resolve the ✗ items above, then re-run.';
lines.push('', `Status   ${status}`);
lines.push('', 'Override locally:  node scripts/config.mjs init', '  (.walkthrough/.config/unioss.config.json)');

console.log('\n' + box('UNIOSS Pipeline · Environment Check', lines, WIDTH) + '\n');
process.exit(allOk ? 0 : 1);
