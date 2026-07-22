import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAdditionalContext } from './inject-knowledge.mjs';

function withStore({ global, sentimentDaysAgo } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'khook-'));
  if (global !== undefined) {
    const dir = join(cwd, '.walkthrough', '.knowledge');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'GLOBAL.md'), global);
    if (sentimentDaysAgo !== undefined) {
      const at = new Date(Date.now() - sentimentDaysAgo * 86400000).toISOString();
      writeFileSync(join(dir, 'index.json'), JSON.stringify({ sentiment: { lastRun: at } }));
    }
  }
  return cwd;
}

test('empty string when no store', () => {
  assert.equal(buildAdditionalContext(withStore({})), '');
});

test('injects GLOBAL.md when present', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB\n- rule' }));
  assert.match(ctx, /# KB/);
});

test('adds a staleness nudge past threshold', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB', sentimentDaysAgo: 9 }));
  assert.match(ctx, /9d old/);
  assert.match(ctx, /unioss-knowledge-refresh weekly/);
});

test('no nudge when fresh', () => {
  const ctx = buildAdditionalContext(withStore({ global: '# KB', sentimentDaysAgo: 1 }));
  assert.doesNotMatch(ctx, /old ·|old\b/);
});
