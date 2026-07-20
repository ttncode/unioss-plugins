#!/usr/bin/env node
// Single source of truth for UNIOSS pipeline configuration.
// Resolution order (highest wins): env -> local file -> built-in default.
import { existsSync, readFileSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

// Ordered by how likely a value is to need changing: per-machine first,
// per-team next, project-wide last.
// A module key (`admin-page`, `common-helper`, …) is the one vocabulary:
// source.modules gives its path on disk, gitlab.projects gives its project id.
export const DEFAULTS = {
  // ── Per-machine ──
  source: {
    root: null, // null = the workspace you opened Claude in
    modules: {
      'admin-page': 'AdminPage',
      'front-end': 'FrontEnd',
      'common-helper': 'common-helper',
      'common-models': 'common-models',
    },
  },
  docker: { mysql: 'mysql-unioss3', php: 'php-unioss3' },
  db: { name: '_unioss', user: 'root', password: 'ProotW' },

  // ── Per-team ──
  ship: {
    assignee: null, // auto-detect
    label: 'UNIOSS 3',
    staging: { targetBranch: 'v3-develop-tps', reviewer: 'dat.pham', deleteSourceBranch: false, squash: false },
    customer: { targetBranch: 'v3-develop', reviewer: 'r.yosimura', deleteSourceBranch: true, squash: false },
  },

  // ── Project-wide ──
  gitlab: {
    host: 'gitlab.unioss.jp',
    projects: { 'admin-page': 32, 'front-end': 31, 'common-helper': 18, 'common-models': 19 },
    baseBranch: 'v3-master',
    protected: ['master', 'v3-master', 'develop', 'v3-develop', 'v3-develop-tps'],
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
  return join(cwd, '.walkthrough', '.config', 'unioss.config.json');
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
  // Only vars a skill actually reads. Anything unused was removed — an export
  // nobody consumes is a value that can rot without anyone noticing.
  return [
    `US_MYSQL=${sq(c.docker.mysql)}`,
    `US_PHP=${sq(c.docker.php)}`,
    `US_DB=${sq(c.db.name)}`,
    `US_DB_USER=${sq(c.db.user)}`,
    `US_DB_PASS=${sq(c.db.password)}`,
    `US_BASE_BRANCH=${sq(c.gitlab.baseBranch)}`,
    `US_PROTECTED=${sq(c.gitlab.protected.join(' '))}`,
    `US_SRC_ROOT=${sq(srcRoot)}`,
    ...srcLines,
  ].join('\n');
}

const SECRET_KEYS = new Set(['db.password']);

export function formatPrint(cwd = process.cwd()) {
  const lines = valueSources(cwd).map(({ key, value, source }) => {
    const shown = SECRET_KEYS.has(key) ? '******'
      : value === null ? 'auto'
      : Array.isArray(value) ? value.join(',') : value;
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
  for (const [key, id] of Object.entries(c.gitlab.projects)) {
    if (typeof id !== 'number') errors.push(`gitlab.projects.${key} must be a number`);
    if (!(key in c.source.modules)) errors.push(`gitlab.projects.${key} has no matching source.modules.${key}`);
  }
  if (!isStr(c.docker.mysql)) errors.push('docker.mysql must be a non-empty string');
  if (!isStr(c.docker.php)) errors.push('docker.php must be a non-empty string');
  if (!isStr(c.db.name) || !isStr(c.db.user) || !isStr(c.db.password)) errors.push('db.name/user/password must be non-empty strings');
  if (!isStr(c.gitlab.baseBranch)) errors.push('gitlab.baseBranch must be a non-empty string');
  if (!Array.isArray(c.gitlab.protected) || c.gitlab.protected.length === 0) errors.push('gitlab.protected must be a non-empty array');
  if (!isStr(c.artifactRoot)) errors.push('artifactRoot must be a non-empty string');
  if (!isStr(c.source.root)) errors.push('source.root must resolve to a non-empty string');
  for (const [key, dir] of Object.entries(c.source.modules)) {
    if (!existsSync(join(c.source.root, dir))) warnings.push(`source module '${key}' not found at ${join(c.source.root, dir)}`);
  }
  if (!process.env.GITLAB_TOKEN) errors.push('GITLAB_TOKEN is not set in the environment');
  const status = errors.length ? errors.map((e) => `  ERROR: ${e}`).join('\n') : '  All checks passed.';
  const warnBlock = warnings.length ? warnings.map((w) => `  WARN: ${w}`).join('\n') : '';
  const report = [formatPrint(cwd), '', status, warnBlock].filter(Boolean).join('\n');
  return { ok: errors.length === 0, report, errors, warnings };
}

const SCAN_SKIP = new Set(['node_modules', '.git', 'vendor', 'storage', '.walkthrough']);
const SCAN_MAX_DEPTH = 3;

function findDir(root, names, depth = 0) {
  if (depth > SCAN_MAX_DEPTH) return null;
  let entries;
  try { entries = readdirSync(root, { withFileTypes: true }); } catch { return null; }
  const dirs = entries.filter((e) => e.isDirectory() && !SCAN_SKIP.has(e.name));
  const hit = dirs.find((e) => names.includes(e.name));
  if (hit) return join(root, hit.name);
  for (const d of dirs) {
    const found = findDir(join(root, d.name), names, depth + 1);
    if (found) return found;
  }
  return null;
}

// Locate each source module on disk. Used by /unioss-doctor when the configured
// paths are wrong — the module layout differs per machine.
export function scanModules(cwd = process.cwd()) {
  const c = resolveConfig(cwd);
  return Object.entries(c.source.modules).map(([key, dir]) => {
    const configured = join(c.source.root, dir);
    if (existsSync(configured)) return { key, configured: dir, found: dir, ok: true };
    const names = [...new Set([basename(dir), key])];
    const hit = findDir(c.source.root, names);
    return { key, configured: dir, found: hit ? relative(c.source.root, hit) : null, ok: false };
  });
}

// Write scanned module paths into the local config file. Only rewrites the keys
// whose configured path was wrong and whose real location was found.
export function applyScan(cwd = process.cwd()) {
  const results = scanModules(cwd);
  const fixes = results.filter((r) => !r.ok && r.found);
  if (fixes.length === 0) return { written: false, fixes, path: configPath(cwd) };
  const p = configPath(cwd);
  const current = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
  const modules = { ...(current.source?.modules ?? {}) };
  for (const f of fixes) modules[f.key] = f.found;
  const next = deepMerge(current, { source: { modules } });
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(next, null, 2) + '\n');
  return { written: true, fixes, path: p };
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
  } else if (cmd === 'scan') {
    if (arg === '--write') {
      const r = applyScan();
      if (!r.written) process.stdout.write('Nothing to fix — every source module resolved.\n');
      else {
        for (const f of r.fixes) process.stdout.write(`  ${f.key}: ${f.configured} -> ${f.found}\n`);
        process.stdout.write(`Written to ${r.path}\n`);
      }
    } else {
      for (const m of scanModules()) {
        if (m.ok) process.stdout.write(`  ok      ${m.key}: ${m.configured}\n`);
        else if (m.found) process.stdout.write(`  FIXABLE ${m.key}: ${m.configured} -> ${m.found}\n`);
        else process.stdout.write(`  MISSING ${m.key}: ${m.configured} (not found under source.root)\n`);
      }
    }
  } else {
    process.stderr.write('Usage: config.mjs <print|get <key>|env|init|check|scan [--write]>\n');
    process.exit(1);
  }
}
