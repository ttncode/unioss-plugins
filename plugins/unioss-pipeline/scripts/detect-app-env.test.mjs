import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectAppEnvironments } from './detect-app-env.mjs';

const ENV_DEFINE_LINE = "\tdefine('ENVIRONMENT', isset($_SERVER['CI_ENV']) ? $_SERVER['CI_ENV'] : 'development');\n";

function workspace() {
  return mkdtempSync(join(tmpdir(), 'uniapp-env-'));
}

function writeIndexPhp(root, appDir, defineLine = ENV_DEFINE_LINE) {
  const dir = join(root, appDir, 'public');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.php'), `<?php\n${defineLine}`);
}

test('no override: both apps resolve to the file default', () => {
  const dir = workspace();
  writeIndexPhp(dir, 'AdminPage');
  writeIndexPhp(dir, 'FrontEnd');
  try {
    const [adminPage, frontEnd] = detectAppEnvironments(dir);
    assert.equal(adminPage.app, 'AdminPage');
    assert.equal(adminPage.found, true);
    assert.equal(adminPage.default, 'development');
    assert.equal(adminPage.override, null);
    assert.equal(adminPage.resolved, 'development');
    assert.equal(frontEnd.found, true);
    assert.equal(frontEnd.resolved, 'development');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('CI_ENV override in docker-compose.yml is reflected in resolved', () => {
  const dir = workspace();
  writeIndexPhp(dir, 'AdminPage');
  writeIndexPhp(dir, 'FrontEnd');
  writeFileSync(
    join(dir, 'docker-compose.yml'),
    'services:\n  php-unioss3:\n    environment:\n      - CI_ENV=production\n',
  );
  try {
    const [adminPage, frontEnd] = detectAppEnvironments(dir);
    assert.deepEqual(adminPage.override, { source: 'docker-compose.yml', value: 'production' });
    assert.equal(adminPage.resolved, 'production');
    assert.equal(adminPage.default, 'development'); // default is untouched, only resolved changes
    assert.equal(frontEnd.resolved, 'production');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('missing public/index.php yields found: false without throwing', () => {
  const dir = workspace();
  // AdminPage dir exists but has no public/index.php; FrontEnd is fully absent.
  mkdirSync(join(dir, 'AdminPage'), { recursive: true });
  try {
    const [adminPage, frontEnd] = detectAppEnvironments(dir);
    assert.equal(adminPage.found, false);
    assert.ok(adminPage.reason);
    assert.equal(adminPage.resolved, null);
    assert.equal(frontEnd.found, false);
    assert.ok(frontEnd.reason);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
