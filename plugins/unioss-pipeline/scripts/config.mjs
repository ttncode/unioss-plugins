#!/usr/bin/env node
// Single source of truth for UNIOSS pipeline configuration.
// Resolution order (highest wins): env -> local file -> built-in default.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
  return merged;
}
