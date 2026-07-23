import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRefresh } from './refresh.mjs';

const crawlStub = async () => [{
  issue: {
    iid: 42, project_id: 32, title: 'Sales detail delete bug',
    web_url: 'https://g/unioss/AdminPage/-/issues/42',
    created_at: '2026-07-15T00:00:00Z', author: { name: 'A' },
  },
  notes: [{ id: 1, body: 'This is broken and frustrating', system: false, created_at: 'x', author: { name: 'U' } }],
}];

const deps = { getToken: () => 'tok', crawl: crawlStub };

test('weekly refresh folds approved rules into GLOBAL.md', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const rulesDir = join(cwd, '.walkthrough', '.knowledge', 'rules');
  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(
    join(rulesDir, 'approved.md'),
    '- [R-001] Never hard-delete t_sales_detail. (AP#1834)\n',
  );

  const res = await runRefresh('weekly', cwd, new Date('2026-07-21T00:00:00Z'), deps);
  const globalPath = res.written.find((p) => p.endsWith('GLOBAL.md'));
  assert.ok(globalPath);
  const content = readFileSync(globalPath, 'utf8');
  assert.match(content, /Never hard-delete t_sales_detail/);
});

test('weekly refresh with no approved.md still succeeds and renders "(none yet)"', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));

  const res = await runRefresh('weekly', cwd, new Date('2026-07-21T00:00:00Z'), deps);
  const globalPath = res.written.find((p) => p.endsWith('GLOBAL.md'));
  assert.ok(globalPath);
  const content = readFileSync(globalPath, 'utf8');
  assert.match(content, /## Top active pitfalls \(approved rules\)\n- \(none yet\)/);
});

test('daily refresh crawls by created window; weekly by updated', async () => {
  const fields = [];
  const spyCrawl = async (opts) => { fields.push(opts.dateField); return crawlStub(); };
  const spyDeps = { getToken: () => 'tok', crawl: spyCrawl };
  await runRefresh('daily', mkdtempSync(join(tmpdir(), 'krefresh-')), new Date('2026-07-21T00:00:00Z'), spyDeps);
  await runRefresh('weekly', mkdtempSync(join(tmpdir(), 'krefresh-')), new Date('2026-07-21T00:00:00Z'), spyDeps);
  assert.deepEqual(fields, ['created', 'updated']);
});
