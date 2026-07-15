#!/usr/bin/env node
// Detects which CI3 ENVIRONMENT (development/staging/production/etc.) AdminPage
// and FrontEnd currently resolve to: the fallback literal in public/index.php's
// `define('ENVIRONMENT', isset($_SERVER['CI_ENV']) ? $_SERVER['CI_ENV'] : '...')`,
// unless CI_ENV is overridden in docker-compose.yml or under z-docker-resources/.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';

const ENV_DEFINE_RE = /define\(\s*'ENVIRONMENT'\s*,\s*isset\(\$_SERVER\['CI_ENV'\]\)\s*\?\s*\$_SERVER\['CI_ENV'\]\s*:\s*'([^']+)'\s*\)/;
const CI_ENV_ASSIGN_RE = /CI_ENV\s*[:=]\s*['"]?([\w.-]+)['"]?/;
const CI_ENV_NGINX_RE = /fastcgi_param\s+CI_ENV\s+['"]?([\w.-]+)['"]?\s*;/i;
const SKIP_DIRS = new Set(['node_modules', 'vendor', '.git', 'volumes']);
const MAX_DEPTH = 3;

function extractCiEnvValue(content) {
  const match = content.match(CI_ENV_ASSIGN_RE) || content.match(CI_ENV_NGINX_RE);
  return match ? match[1] : null;
}

function findConfigFiles(dir, depth = 0) {
  if (depth > MAX_DEPTH || !existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      files.push(...findConfigFiles(join(dir, entry.name), depth + 1));
    } else if (/\.conf$/.test(entry.name) || /^\.env/.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function detectCiEnvOverride(root) {
  const composePath = join(root, 'docker-compose.yml');
  if (existsSync(composePath)) {
    const value = extractCiEnvValue(readFileSync(composePath, 'utf8'));
    if (value) return { source: 'docker-compose.yml', value };
  }
  for (const file of findConfigFiles(join(root, 'z-docker-resources'))) {
    const value = extractCiEnvValue(readFileSync(file, 'utf8'));
    if (value) return { source: relative(root, file), value };
  }
  return null;
}

function detectOneApp(app, appPath, root, override) {
  const indexPath = join(root, appPath, 'public', 'index.php');
  if (!existsSync(indexPath)) {
    return { app, indexPath, default: null, override: null, resolved: null, found: false, reason: `public/index.php not found at ${indexPath}` };
  }
  const match = readFileSync(indexPath, 'utf8').match(ENV_DEFINE_RE);
  if (!match) {
    return { app, indexPath, default: null, override: null, resolved: null, found: false, reason: `ENVIRONMENT define not found in ${indexPath}` };
  }
  const defaultValue = match[1];
  return {
    app,
    indexPath,
    default: defaultValue,
    override,
    resolved: override ? override.value : defaultValue,
    found: true,
  };
}

export function detectAppEnvironments(root = resolveConfig().source.root) {
  const cfg = resolveConfig();
  const override = detectCiEnvOverride(root);
  // Paths come from source.modules — the same place `config.mjs scan` repairs,
  // so a scanned-fixed layout can no longer disagree with what we look at here.
  return [
    detectOneApp('AdminPage', cfg.source.modules['admin-page'], root, override),
    detectOneApp('FrontEnd', cfg.source.modules['front-end'], root, override),
  ];
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  for (const e of detectAppEnvironments()) {
    if (!e.found) process.stdout.write(`${e.app}: unknown (${e.reason})\n`);
    else if (e.override) process.stdout.write(`${e.app}: ${e.resolved} (override: ${e.override.source})\n`);
    else process.stdout.write(`${e.app}: ${e.resolved} (default)\n`);
  }
}
