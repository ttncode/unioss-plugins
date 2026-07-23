import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAsk } from './ask.mjs';
import { parsePeriod } from './period.mjs';

const crawlStub = async () => [{
  issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-06-05T00:00:00Z', labels: [], author: { name: 'A' } },
  notes: [{ id: 1, body: 'This is broken and slow', system: false, created_at: '2026-06-06T00:00:00Z', author: { name: 'U' } }],
}];

const NOW = new Date('2026-07-21T00:00:00Z');
const classifiedOk = { praise: [], criticism: [{ body: 'Login lock duration is confusing', source: 'https://g/1832' }] };
const kb = (cwd, ...p) => join(cwd, '.walkthrough', '.knowledge', ...p);

test('ask sentiment evidence step writes evidence, no digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const res = await runAsk({ intent: 'sentiment', period, mutate: false }, cwd, NOW, { getToken: () => 'tok', crawl: crawlStub });
  assert.ok(res.needsClassification);
  assert.match(res.path, /evidence-2026-06\.json$/);
  assert.equal(res.count, 1);
  assert.equal(existsSync(kb(cwd, 'digests', '2026-06-sentiment.md')), false);
});

test('ask sentiment classified step writes digest; historical never touches live KB even with mutate', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const res = await runAsk({ intent: 'sentiment', period, mutate: true, classifiedPath: cf }, cwd, NOW, {});
  assert.ok(existsSync(res.path));
  assert.match(res.path, /2026-06-sentiment\.md$/);
  assert.match(res.markdown, /Login lock duration/);
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);
});

test('ask sentiment classified step on the current period with mutate updates current.md', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('month', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  await runAsk({ intent: 'sentiment', period, mutate: true, classifiedPath: cf }, cwd, NOW, {});
  assert.ok(existsSync(kb(cwd, 'sentiment', 'current.md')));
});

test('ask sentiment classified step rejects invalid classified and writes no digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify({ praise: 'nope', criticism: [] }));
  await assert.rejects(() => runAsk({ intent: 'sentiment', period, mutate: false, classifiedPath: cf }, cwd, NOW, {}), /array/);
  assert.equal(existsSync(kb(cwd, 'digests', '2026-06-sentiment.md')), false);
});

test('ask crawls by updated window (activity view)', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', NOW);
  await runAsk({ intent: 'focus', period, mutate: false }, cwd, NOW, { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
});
