import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RULE, isAllowed, allow } from './playwright-perms.mjs';

function workspace(settings, file = 'settings.local.json') {
  const dir = mkdtempSync(join(tmpdir(), 'unipw-'));
  if (settings !== undefined) {
    mkdirSync(join(dir, '.claude'), { recursive: true });
    writeFileSync(join(dir, '.claude', file), JSON.stringify(settings));
  }
  return dir;
}

test('rule carries the plugin namespace, not the bare server name', () => {
  assert.equal(RULE, 'mcp__plugin_unioss-pipeline_playwright');
});

test('isAllowed is false on a workspace with no settings', () => {
  const dir = workspace(undefined);
  assert.equal(isAllowed(dir), false);
  rmSync(dir, { recursive: true, force: true });
});

test('isAllowed detects a whole-server grant', () => {
  const dir = workspace({ permissions: { allow: [RULE] } });
  assert.equal(isAllowed(dir), true);
  rmSync(dir, { recursive: true, force: true });
});

test('isAllowed detects a single-tool grant on the server', () => {
  const dir = workspace({ permissions: { allow: [`${RULE}__browser_click`] } });
  assert.equal(isAllowed(dir), true);
  rmSync(dir, { recursive: true, force: true });
});

test('isAllowed ignores an unrelated rule', () => {
  const dir = workspace({ permissions: { allow: ['mcp__something_else'] } });
  assert.equal(isAllowed(dir), false);
  rmSync(dir, { recursive: true, force: true });
});

test('allow writes the rule into .claude/settings.local.json', () => {
  const dir = workspace(undefined);
  const r = allow(dir);
  assert.equal(r.written, true);
  const written = JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(written.permissions.allow, [RULE]);
  rmSync(dir, { recursive: true, force: true });
});

test('allow preserves existing settings and rules', () => {
  const dir = workspace({ model: 'opus', permissions: { allow: ['Bash(ls:*)'], deny: ['Read(./secret)'] } });
  allow(dir);
  const written = JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
  assert.equal(written.model, 'opus');
  assert.deepEqual(written.permissions.allow, ['Bash(ls:*)', RULE]);
  assert.deepEqual(written.permissions.deny, ['Read(./secret)']);
  rmSync(dir, { recursive: true, force: true });
});

test('allow is a no-op when already granted, and does not duplicate the rule', () => {
  const dir = workspace({ permissions: { allow: [RULE] } });
  const r = allow(dir);
  assert.equal(r.written, false);
  const written = JSON.parse(readFileSync(join(dir, '.claude', 'settings.local.json'), 'utf8'));
  assert.deepEqual(written.permissions.allow, [RULE]);
  rmSync(dir, { recursive: true, force: true });
});

test('a grant in project settings.json satisfies the check', () => {
  const dir = workspace({ permissions: { allow: [RULE] } }, 'settings.json');
  assert.equal(isAllowed(dir), true);
  rmSync(dir, { recursive: true, force: true });
});
