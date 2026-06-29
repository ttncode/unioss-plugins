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
