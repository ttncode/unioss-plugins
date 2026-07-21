#!/usr/bin/env node
// UNIOSS pipeline environment doctor — cross-platform (node/jq/docker/containers/token/chrome/MCP).
import { execSync } from 'node:child_process';
import { platform } from 'node:os';
import { existsSync } from 'node:fs';
import { resolveConfig, runCheck, valueSources, scanModules } from './config.mjs';
import { detectAppEnvironments } from './detect-app-env.mjs';
import { box, displayWidth } from './box.mjs';
import { isAllowed as playwrightAllowed, RULE as PLAYWRIGHT_RULE } from './playwright-perms.mjs';

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
  { name: `container ${mysqlName}`, ok: new RegExp(`(^|\\n)${mysqlName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${mysqlName}\` is not running. Start the stack: docker compose up -d (from your UNIOSS project root)` },
  { name: `container ${phpName}`, ok: new RegExp(`(^|\\n)${phpName}(\\r?\\n|$)`).test(runningNames), fix: `Container \`${phpName}\` is not running. Start the stack: docker compose up -d (from your UNIOSS project root)` },
  { name: 'GITLAB_TOKEN', ok: !!process.env.GITLAB_TOKEN, fix: (isWin ? 'setx GITLAB_TOKEN <your-token>' : 'export GITLAB_TOKEN=<your-token>  (add to your shell profile)') + '  — needs `api` scope for /unioss-ship MR creation' },
  { name: 'Chrome (tester browser)', ok: chromeOk, fix: 'Playwright Chrome not found — the tester cannot verify UI. Run in a real terminal (needs a TTY for sudo):  ! npx playwright install --with-deps chrome' },
];

const WIDTH = 78;
const SECRET_KEYS = new Set(['db.password']);
const COL = { key: 34, value: 24, source: 14 };
const RULE = ' ' + '─'.repeat(69);

// Fixed-width cells: pad short, truncate long. Paths keep their tail (the
// distinctive part); everything else keeps its head.
const clip = (str, width, fromLeft = false) => {
  const s = String(str);
  if (displayWidth(s) <= width) return s + ' '.repeat(width - displayWidth(s));
  return fromLeft ? '…' + Array.from(s).slice(-(width - 1)).join('') : Array.from(s).slice(0, width - 1).join('') + '…';
};
const row = (key, value, source, isPath = false) =>
  ` ${clip(key, COL.key)}  ${clip(value, COL.value, isPath)}  ${clip(source, COL.source)}`;

const home = process.env.HOME || '';
const short = (p) => (home && String(p).startsWith(home) ? '~' + String(p).slice(home.length) : String(p));

const lines = [];
let allOk = true;
const lightMissing = [];

lines.push('', ' Dependencies', RULE);
for (const c of checks) {
  lines.push(`  ${c.ok ? '✓' : '✗'}  ${c.name}`);
  if (!c.ok) {
    allOk = false;
    if (c.light) lightMissing.push(c.name);
    lines.push(`     └ ${c.fix}`);
  }
}

const pwAllowed = playwrightAllowed();
lines.push(`  ${pwAllowed ? '✓' : '!'}  Playwright MCP`);
if (!pwAllowed) {
  lines.push('     └ Browser actions prompt every time.', `       Grant rule: ${PLAYWRIGHT_RULE}`);
}

if (lightMissing.length && pm) {
  lines.push('', `  Light deps:  ${lightMissing.map(installCmd).join('  &&  ')}`);
}

lines.push('', ' Configuration', RULE, row('Key', 'Value', 'Source'));
for (const { key, value, source } of valueSources()) {
  const isPath = key === 'source.root';
  const raw = SECRET_KEYS.has(key) ? '******' : (Array.isArray(value) ? value.join(',') : value);
  lines.push(row(key, isPath ? short(raw) : raw, source, isPath));
}
lines.push(row('GITLAB_TOKEN', process.env.GITLAB_TOKEN ? '******' : 'MISSING', 'env'));

// Long failure detail must stay OUT of the grid — wrapping it shreds the table.
lines.push('', ' App Environment', RULE, row('App', 'Value', 'Source'));
const envDetail = [];
for (const e of detectAppEnvironments()) {
  if (e.found) lines.push(row(e.app, e.resolved, e.override ? `override: ${e.override.source}` : 'default'));
  else {
    lines.push(row(e.app, 'unknown', 'not found'));
    envDetail.push(`  ! ${e.app}: ${clip(short(e.reason), WIDTH - e.app.length - 8, true).trimEnd()}`);
  }
}

// Source modules: report wrong paths and whether a scan can repair them.
// /unioss-doctor reads BAD_COMMON_SOURCES to decide whether to offer the fix.
const modules = scanModules();
const badModules = modules.filter((m) => !m.ok);
if (badModules.length) {
  lines.push('', ' Source modules', RULE, row('Module', 'Configured', 'Status'));
  for (const m of modules) {
    const status = m.ok ? 'ok' : m.found ? 'fixable by scan' : 'not found';
    lines.push(row(m.key, m.configured, status));
  }
  for (const m of badModules.filter((x) => x.found)) lines.push(`  → ${m.key} found at: ${m.found}`);
}

const check = runCheck();
if (!check.ok) allOk = false;
for (const err of check.errors) lines.push('', `  ✗ config: ${err}`);
if (envDetail.length) lines.push('', ...envDetail);

const status = !allOk
  ? 'Issues found — resolve the ✗ items above, then re-run.'
  : badModules.length
    ? 'Dependencies OK — source module paths need attention (see above).'
    : 'All checks passed — pipeline ready.';
lines.push('', ` Status   ${status}`);

console.log('\n' + box('UNIOSS Pipeline · Environment Check', lines, WIDTH) + '\n');
// Machine-readable flags: /unioss-doctor reads these to decide which questions to ask.
if (badModules.length) console.log(`BAD_COMMON_SOURCES=${badModules.map((m) => m.key).join(',')}`);
if (!pwAllowed) console.log('PLAYWRIGHT_PERMS=ask');
process.exit(allOk ? 0 : 1);
