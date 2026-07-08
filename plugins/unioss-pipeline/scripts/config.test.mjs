import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, configPath, deepMerge, resolveConfig } from './config.mjs';

function workspace(fileContents) {
  const dir = mkdtempSync(join(tmpdir(), 'uniconf-'));
  if (fileContents !== undefined) {
    mkdirSync(join(dir, '.walkthrough', 'config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', 'config', 'unioss.config.json'), fileContents);
  }
  return dir;
}

test('defaults: absent file yields built-in values', () => {
  const dir = workspace(undefined);
  const cfg = resolveConfig(dir);
  assert.equal(cfg.docker.mysql, 'mysql-unioss3');
  assert.equal(cfg.repos.adminPage.id, 32);
  assert.equal(cfg.db.password, 'ProotW');
  rmSync(dir, { recursive: true, force: true });
});

test('file partial override deep-merges only its keys', () => {
  const dir = workspace(JSON.stringify({ docker: { mysql: 'db-local' } }));
  const cfg = resolveConfig(dir);
  assert.equal(cfg.docker.mysql, 'db-local');   // overridden
  assert.equal(cfg.docker.php, 'php-unioss3');   // default preserved
  rmSync(dir, { recursive: true, force: true });
});

test('arrays replace wholesale, not merge', () => {
  const dir = workspace(JSON.stringify({ git: { protected: ['main'] } }));
  assert.deepEqual(resolveConfig(dir).git.protected, ['main']);
  rmSync(dir, { recursive: true, force: true });
});

test('env DB_PASSWORD overrides file and default', () => {
  const dir = workspace(JSON.stringify({ db: { password: 'fromfile' } }));
  process.env.DB_PASSWORD = 'fromenv';
  try { assert.equal(resolveConfig(dir).db.password, 'fromenv'); }
  finally { delete process.env.DB_PASSWORD; rmSync(dir, { recursive: true, force: true }); }
});

test('malformed JSON throws with the path', () => {
  const dir = workspace('{ not json');
  assert.throws(() => resolveConfig(dir), /unioss\.config\.json/);
  rmSync(dir, { recursive: true, force: true });
});

test('configPath is under the given cwd', () => {
  assert.ok(configPath('/tmp/ws').endsWith(join('.walkthrough', 'config', 'unioss.config.json')));
});

test('source.root defaults to the given cwd when unset', () => {
  const dir = workspace(undefined);
  assert.equal(resolveConfig(dir).source.root, dir);
  assert.equal(DEFAULTS.source.root, null); // DEFAULTS never mutated
  rmSync(dir, { recursive: true, force: true });
});

test('SOURCE_ROOT env overrides the cwd default', () => {
  const dir = workspace(undefined);
  process.env.SOURCE_ROOT = '/srv/unioss3';
  try { assert.equal(resolveConfig(dir).source.root, '/srv/unioss3'); }
  finally { delete process.env.SOURCE_ROOT; rmSync(dir, { recursive: true, force: true }); }
});

test('file source.root overrides the cwd default', () => {
  const dir = workspace(JSON.stringify({ source: { root: '/from/file' } }));
  assert.equal(resolveConfig(dir).source.root, '/from/file');
  rmSync(dir, { recursive: true, force: true });
});

test('module keys are kebab-case with on-disk dir values', () => {
  const dir = workspace(undefined);
  const mods = resolveConfig(dir).source.modules;
  assert.equal(mods['admin-page'], 'AdminPage');
  assert.equal(mods['common-helper'], 'common-helper');
  rmSync(dir, { recursive: true, force: true });
});

test('config path derives from the passed cwd, not the script location', () => {
  const p = configPath('/tmp/ws');
  assert.ok(p.startsWith('/tmp/ws'));
  assert.ok(!p.includes(join('plugins', 'unioss-pipeline', 'scripts')));
});
