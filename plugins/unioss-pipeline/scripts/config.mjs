#!/usr/bin/env node
// Single source of truth for UNIOSS pipeline configuration.
// Resolution order (highest wins): env -> local file -> built-in default.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULTS = {
  gitlab: { host: 'gitlab.unioss.jp' },
  repos: {
    adminPage: { id: 32, path: 'AdminPage/' },
    frontEnd: { id: 31, path: 'FrontEnd/' },
  },
  docker: { mysql: 'mysql-unioss3', php: 'php-unioss3' },
  db: { name: '_unioss', user: 'root', password: 'ProotW' },
  git: {
    baseBranch: 'v3-master',
    protected: ['master', 'v3-master', 'develop', 'v3-develop', 'v3-develop-tps'],
  },
  source: {
    root: null,
    modules: {
      'admin-page': 'AdminPage',
      'front-end': 'FrontEnd',
      'common-helper': 'common-helper',
      'common-models': 'common-models',
    },
  },
  artifactRoot: '.walkthrough',
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function deepMerge(base, override) {
  const out = isObject(base) ? { ...base } : base;
  for (const [k, v] of Object.entries(override || {})) {
    // Clone object values so the result never shares nested references with `base`
    // (prevents the env override below from mutating the shared DEFAULTS constant).
    out[k] = isObject(v) ? deepMerge(isObject(out[k]) ? out[k] : {}, v) : v;
  }
  return out;
}

export function configPath(cwd = process.cwd()) {
  return join(cwd, '.walkthrough', 'config', 'unioss.config.json');
}

function readFileConfig(cwd) {
  const p = configPath(cwd);
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Invalid JSON in ${p}: ${e.message}`);
  }
}

export function resolveConfig(cwd = process.cwd()) {
  // deepMerge onto a fresh {} guarantees DEFAULTS is never mutated.
  const merged = deepMerge(deepMerge({}, DEFAULTS), readFileConfig(cwd));
  if (process.env.DB_PASSWORD) merged.db.password = process.env.DB_PASSWORD;
  merged.source.root = process.env.SOURCE_ROOT || merged.source.root || cwd;
  return merged;
}

export function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function readFileConfigSafe(cwd) {
  try { return JSON.parse(readFileSync(configPath(cwd), 'utf8')); } catch { return {}; }
}

export function valueSources(cwd = process.cwd()) {
  const resolved = flatten(resolveConfig(cwd));
  const fileFlat = flatten(readFileConfigSafe(cwd));
  return Object.entries(resolved).map(([key, value]) => {
    let source = 'default';
    if (key === 'db.password' && process.env.DB_PASSWORD) source = 'env';
    else if (key === 'source.root' && process.env.SOURCE_ROOT) source = 'env';
    else if (key in fileFlat) source = 'file';
    return { key, value, source };
  });
}

export function getValue(cwd, dottedKey) {
  const v = dottedKey.split('.').reduce((o, k) => (o == null ? o : o[k]), resolveConfig(cwd));
  if (v === undefined) throw new Error(`Unknown config key: ${dottedKey}`);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

const sq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

export function buildEnv(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  const srcRoot = c.source.root;
  const srcLines = Object.entries(c.source.modules).map(
    ([key, dir]) => `US_SRC_${key.toUpperCase().replace(/-/g, '_')}=${sq(join(srcRoot, dir))}`,
  );
  return [
    `US_MYSQL=${sq(c.docker.mysql)}`,
    `US_PHP=${sq(c.docker.php)}`,
    `US_DB=${sq(c.db.name)}`,
    `US_DB_USER=${sq(c.db.user)}`,
    `US_DB_PASS=${sq(c.db.password)}`,
    `US_GITLAB_HOST=${sq(c.gitlab.host)}`,
    `US_AP_PATH=${sq(c.repos.adminPage.path)}`,
    `US_FE_PATH=${sq(c.repos.frontEnd.path)}`,
    `US_BASE_BRANCH=${sq(c.git.baseBranch)}`,
    `US_ARTIFACT_ROOT=${sq(c.artifactRoot)}`,
    `US_SRC_ROOT=${sq(srcRoot)}`,
    ...srcLines,
  ].join('\n');
}

const SECRET_KEYS = new Set(['db.password']);

export function formatPrint(cwd = process.cwd()) {
  const lines = valueSources(cwd).map(({ key, value, source }) => {
    const shown = SECRET_KEYS.has(key) ? '******' : (Array.isArray(value) ? value.join(',') : value);
    return `  ${key.padEnd(22)} ${String(shown).padEnd(28)} (${source})`;
  });
  const token = process.env.GITLAB_TOKEN ? '******                       (env)' : 'MISSING                      (env)';
  lines.push(`  ${'GITLAB_TOKEN'.padEnd(22)} ${token}`);
  return lines.join('\n');
}

export function initFile(cwd = process.cwd()) {
  const p = configPath(cwd);
  if (existsSync(p)) return { created: false, path: p };
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(DEFAULTS, null, 2) + '\n');
  return { created: true, path: p };
}

export function runCheck(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  const errors = [];
  const warnings = [];
  const isStr = (v) => typeof v === 'string' && v.length > 0;
  if (!isStr(c.gitlab.host)) errors.push('gitlab.host must be a non-empty string');
  for (const r of ['adminPage', 'frontEnd']) {
    if (typeof c.repos[r].id !== 'number') errors.push(`repos.${r}.id must be a number`);
    if (!isStr(c.repos[r].path)) errors.push(`repos.${r}.path must be a non-empty string`);
  }
  if (!isStr(c.docker.mysql)) errors.push('docker.mysql must be a non-empty string');
  if (!isStr(c.docker.php)) errors.push('docker.php must be a non-empty string');
  if (!isStr(c.db.name) || !isStr(c.db.user) || !isStr(c.db.password)) errors.push('db.name/user/password must be non-empty strings');
  if (!isStr(c.git.baseBranch)) errors.push('git.baseBranch must be a non-empty string');
  if (!Array.isArray(c.git.protected) || c.git.protected.length === 0) errors.push('git.protected must be a non-empty array');
  if (!isStr(c.artifactRoot)) errors.push('artifactRoot must be a non-empty string');
  if (!isStr(c.source.root)) errors.push('source.root must resolve to a non-empty string');
  for (const [key, dir] of Object.entries(c.source.modules)) {
    if (!existsSync(join(c.source.root, dir))) warnings.push(`source module '${key}' not found at ${join(c.source.root, dir)}`);
  }
  if (!process.env.GITLAB_TOKEN) errors.push('GITLAB_TOKEN is not set in the environment');
  const status = errors.length ? errors.map((e) => `  ERROR: ${e}`).join('\n') : '  All checks passed.';
  const warnBlock = warnings.length ? warnings.map((w) => `  WARN: ${w}`).join('\n') : '';
  const report = [formatPrint(cwd), '', status, warnBlock].filter(Boolean).join('\n');
  return { ok: errors.length === 0, report };
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'get') process.stdout.write(getValue(process.cwd(), arg) + '\n');
  else if (cmd === 'env') process.stdout.write(buildEnv() + '\n');
  else if (cmd === 'print') process.stdout.write('\nUNIOSS pipeline — resolved config\n\n' + formatPrint() + '\n');
  else if (cmd === 'init') {
    const r = initFile();
    process.stdout.write(r.created ? `Created ${r.path}\n` : `Exists (left unchanged): ${r.path}\n`);
  } else if (cmd === 'check') {
    const r = runCheck();
    process.stdout.write('\nUNIOSS pipeline — config check\n\n' + r.report + '\n');
    process.exit(r.ok ? 0 : 1);
  } else {
    process.stderr.write('Usage: config.mjs <print|get <key>|env|init|check>\n');
    process.exit(1);
  }
}
