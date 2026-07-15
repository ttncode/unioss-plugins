#!/usr/bin/env node
// Check / grant the Playwright MCP permission rule so the tester can drive the
// browser without a prompt on every action.
// Claude Code namespaces a plugin's MCP server as `plugin_<plugin>_<server>`,
// so the rule is NOT `mcp__playwright` — it must carry the plugin prefix.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

export const SERVER = 'plugin_unioss-pipeline_playwright';
export const RULE = `mcp__${SERVER}`;

// A rule for the whole server, or for any single tool on it, counts as granted.
const grants = (rule) => rule === RULE || rule.startsWith(`${RULE}__`);

const readJson = (path) => {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

export const settingsFiles = (cwd = process.cwd()) => [
  join(homedir(), '.claude', 'settings.json'),
  join(cwd, '.claude', 'settings.json'),
  join(cwd, '.claude', 'settings.local.json'),
];

export function isAllowed(cwd = process.cwd()) {
  return settingsFiles(cwd).some((path) => (readJson(path)?.permissions?.allow ?? []).some(grants));
}

// Granted in the local (gitignored) settings file: auto-approving browser
// actions is a per-developer choice, not something to commit for the team.
export function allow(cwd = process.cwd()) {
  const path = join(cwd, '.claude', 'settings.local.json');
  if (isAllowed(cwd)) return { written: false, path, rule: RULE };
  const settings = readJson(path) ?? {};
  const permissions = settings.permissions ?? {};
  const next = {
    ...settings,
    permissions: { ...permissions, allow: [...(permissions.allow ?? []), RULE] },
  };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  return { written: true, path, rule: RULE };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'check') {
    process.stdout.write(isAllowed() ? `PLAYWRIGHT_PERMS=allowed\n` : `PLAYWRIGHT_PERMS=ask\n`);
  } else if (cmd === 'allow') {
    const r = allow();
    process.stdout.write(r.written ? `Added ${r.rule} to ${r.path}\n` : `Already allowed (${r.rule}) — nothing changed.\n`);
  } else {
    process.stderr.write('Usage: playwright-perms.mjs <check|allow>\n');
    process.exit(1);
  }
}
