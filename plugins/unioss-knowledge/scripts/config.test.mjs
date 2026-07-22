import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULTS, resolveConfig } from './config.mjs';

function withConfig(json) {
  const dir = mkdtempSync(join(tmpdir(), 'kcfg-'));
  if (json !== undefined) {
    mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
    writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), JSON.stringify(json));
  }
  return dir;
}

test('defaults when no config file', () => {
  assert.deepEqual(resolveConfig(withConfig(undefined)), DEFAULTS);
});

test('gitlab.workLabel wins', () => {
  const dir = withConfig({ gitlab: { host: 'g.example', workLabel: 'X' }, artifactRoot: '.wt' });
  assert.deepEqual(resolveConfig(dir), { host: 'g.example', workLabel: 'X', artifactRoot: '.wt' });
});

test('falls back to ship.label then default', () => {
  const dir = withConfig({ ship: { label: 'UNIOSS 3' } });
  assert.equal(resolveConfig(dir).workLabel, 'UNIOSS 3');
});

test('malformed JSON yields defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kcfg-'));
  mkdirSync(join(dir, '.walkthrough', '.config'), { recursive: true });
  writeFileSync(join(dir, '.walkthrough', '.config', 'unioss.config.json'), '{bad');
  assert.deepEqual(resolveConfig(dir), DEFAULTS);
});
