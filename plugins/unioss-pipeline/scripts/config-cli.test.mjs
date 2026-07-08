import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flatten, valueSources, getValue, buildEnv, formatPrint, initFile, runCheck } from './config.mjs';

const ws = () => mkdtempSync(join(tmpdir(), 'unicli-'));

test('flatten produces dotted leaves; arrays are leaves', () => {
  const f = flatten({ a: { b: 1 }, c: [1, 2] });
  assert.equal(f['a.b'], 1);
  assert.deepEqual(f['c'], [1, 2]);
});

test('getValue returns resolved scalar as string', () => {
  assert.equal(getValue(ws(), 'docker.mysql'), 'mysql-unioss3');
});

test('buildEnv emits US_ exports including db password', () => {
  const out = buildEnv(ws());
  assert.match(out, /US_MYSQL='mysql-unioss3'/);
  assert.match(out, /US_DB_PASS='ProotW'/);
});

test('formatPrint redacts db.password and shows GITLAB_TOKEN line', () => {
  delete process.env.GITLAB_TOKEN;
  const out = formatPrint(ws());
  assert.doesNotMatch(out, /ProotW/);
  assert.match(out, /db\.password\s+\*{6}/);
  assert.match(out, /GITLAB_TOKEN.*MISSING/);
});

test('valueSources marks db.password env when DB_PASSWORD set', () => {
  process.env.DB_PASSWORD = 'x';
  try {
    const src = valueSources(ws()).find((r) => r.key === 'db.password');
    assert.equal(src.source, 'env');
  } finally { delete process.env.DB_PASSWORD; }
});

test('initFile scaffolds defaults and refuses to overwrite', () => {
  const dir = ws();
  const first = initFile(dir);
  assert.equal(first.created, true);
  assert.ok(existsSync(first.path));
  assert.equal(JSON.parse(readFileSync(first.path, 'utf8')).docker.php, 'php-unioss3');
  assert.equal(initFile(dir).created, false);
});

test('runCheck fails when GITLAB_TOKEN missing', () => {
  delete process.env.GITLAB_TOKEN;
  assert.equal(runCheck(ws()).ok, false);
});

test('runCheck passes with token and clean defaults', () => {
  process.env.GITLAB_TOKEN = 'tok';
  try { assert.equal(runCheck(ws()).ok, true); }
  finally { delete process.env.GITLAB_TOKEN; }
});

test('buildEnv emits absolute US_SRC_* paths from root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'unisrc-'));
  process.env.SOURCE_ROOT = '/srv/unioss3';
  try {
    const out = buildEnv(dir);
    assert.match(out, /US_SRC_ROOT='\/srv\/unioss3'/);
    assert.match(out, /US_SRC_ADMIN_PAGE='\/srv\/unioss3\/AdminPage'/);
    assert.match(out, /US_SRC_COMMON_HELPER='\/srv\/unioss3\/common-helper'/);
  } finally { delete process.env.SOURCE_ROOT; }
});

test('runCheck warns (non-fatal) when a source module dir is missing', () => {
  process.env.GITLAB_TOKEN = 'tok';
  const dir = mkdtempSync(join(tmpdir(), 'uniwarn-'));
  try {
    const r = runCheck(dir); // modules do not exist in this empty tmp dir
    assert.equal(r.ok, true);            // warning is non-fatal
    assert.match(r.report, /WARN: source module 'admin-page' not found/);
  } finally { delete process.env.GITLAB_TOKEN; }
});
