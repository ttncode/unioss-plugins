import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, configPath, deepMerge, resolveConfig, buildEnv, scanModules, applyScan } from './config.mjs';

function workspace(fileContents) {
  const dir = mkdtempSync(join(tmpdir(), 'uniconf-'));
  if (fileContents !== undefined) {
    mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), fileContents);
  }
  return dir;
}

test('defaults: absent file yields built-in values', () => {
  const dir = workspace(undefined);
  const cfg = resolveConfig(dir);
  assert.equal(cfg.docker.mysql, 'mysql-unioss3');
  assert.equal(cfg.gitlab.projects['admin-page'], 32);
  assert.equal(cfg.db.password, 'ProotW');
  rmSync(dir, { recursive: true, force: true });
});

test('every gitlab.projects key has a matching source.modules path', () => {
  const dir = workspace(undefined);
  const cfg = resolveConfig(dir);
  assert.deepEqual(Object.keys(cfg.gitlab.projects).sort(), Object.keys(cfg.source.modules).sort());
  rmSync(dir, { recursive: true, force: true });
});

test('module paths live only in source.modules — no second copy to drift', () => {
  const dir = workspace(undefined);
  const cfg = resolveConfig(dir);
  assert.equal(cfg.repos, undefined);
  assert.equal(cfg.source.modules['admin-page'], 'AdminPage');
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
  assert.ok(configPath('/tmp/ws').endsWith(join('.walkthrough', '.config', 'unioss.config.json')));
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

test('ship defaults expose per-mode target branch, reviewer, merge options', () => {
  const dir = workspace(undefined);
  const { ship } = resolveConfig(dir);
  assert.equal(ship.assignee, null);
  assert.equal(ship.label, 'UNIOSS 3');
  assert.equal(ship.staging.targetBranch, 'v3-develop-tps');
  assert.equal(ship.staging.reviewer, 'dat.pham');
  assert.equal(ship.staging.deleteSourceBranch, false);
  assert.equal(ship.customer.targetBranch, 'v3-develop');
  assert.equal(ship.customer.reviewer, 'r.yosimura');
  assert.equal(ship.customer.deleteSourceBranch, true);
  rmSync(dir, { recursive: true, force: true });
});

test('ship reviewer is overridable from file', () => {
  const dir = workspace(JSON.stringify({ ship: { customer: { reviewer: 'someone.else' } } }));
  const { ship } = resolveConfig(dir);
  assert.equal(ship.customer.reviewer, 'someone.else');        // overridden
  assert.equal(ship.customer.targetBranch, 'v3-develop');      // default preserved (deep merge)
  rmSync(dir, { recursive: true, force: true });
});

test('buildEnv exports the protected list so the guard and skills can read it', () => {
  const env = buildEnv('/tmp/ws-env');
  assert.match(env, /US_PROTECTED='master v3-master develop v3-develop v3-develop-tps'/);
  assert.match(env, /US_BASE_BRANCH='v3-master'/);
});

test('buildEnv exports nothing that has no consumer', () => {
  const env = buildEnv('/tmp/ws-env');
  for (const dead of ['US_GITLAB_HOST', 'US_AP_PATH', 'US_FE_PATH', 'US_ARTIFACT_ROOT', 'US_TESTER_']) {
    assert.ok(!env.includes(dead), `${dead} has no consumer and must not be exported`);
  }
});

test('scanModules: flags a wrong path and locates the real directory', () => {
  const dir = workspace(undefined);
  mkdirSync(join(dir, 'submodules', 'common-helper'), { recursive: true });
  const byKey = Object.fromEntries(scanModules(dir).map((m) => [m.key, m]));
  assert.equal(byKey['common-helper'].ok, false);
  assert.equal(byKey['common-helper'].found, join('submodules', 'common-helper'));
  rmSync(dir, { recursive: true, force: true });
});

test('scanModules: a correctly configured module reports ok and is not searched', () => {
  const dir = workspace(undefined);
  mkdirSync(join(dir, 'AdminPage'), { recursive: true });
  const byKey = Object.fromEntries(scanModules(dir).map((m) => [m.key, m]));
  assert.equal(byKey['admin-page'].ok, true);
  assert.equal(byKey['admin-page'].found, 'AdminPage');
  rmSync(dir, { recursive: true, force: true });
});

test('scanModules: reports found=null when the module is nowhere on disk', () => {
  const dir = workspace(undefined);
  const byKey = Object.fromEntries(scanModules(dir).map((m) => [m.key, m]));
  assert.equal(byKey['common-models'].ok, false);
  assert.equal(byKey['common-models'].found, null);
  rmSync(dir, { recursive: true, force: true });
});

test('applyScan: writes only the repaired keys into the config file', () => {
  const dir = workspace(undefined);
  mkdirSync(join(dir, 'submodules', 'common-models'), { recursive: true });
  const r = applyScan(dir);
  assert.equal(r.written, true);
  const written = JSON.parse(readFileSync(configPath(dir), 'utf8'));
  assert.equal(written.source.modules['common-models'], join('submodules', 'common-models'));
  // an unfixable module keeps its configured default rather than being nulled out
  assert.equal(written.source.modules['common-helper'], undefined);
  rmSync(dir, { recursive: true, force: true });
});

test('applyScan: no-op when every module already resolves', () => {
  const dir = workspace(undefined);
  for (const d of ['AdminPage', 'FrontEnd', 'common-helper', 'common-models']) mkdirSync(join(dir, d), { recursive: true });
  const r = applyScan(dir);
  assert.equal(r.written, false);
  assert.deepEqual(r.fixes, []);
  rmSync(dir, { recursive: true, force: true });
});
