import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAsk } from './ask.mjs';
import { parsePeriod } from './period.mjs';

const crawlStub = async () => [{
  issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-06-05T00:00:00Z', labels: [], author: { name: 'A' } },
  notes: [{ id: 1, body: 'This is broken and slow', system: false, created_at: 'x', author: { name: 'U' } }],
}];

test('ask writes a dated report and does NOT touch GLOBAL/sentiment when historical', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  const res = await runAsk({ intent: 'sentiment', period, mutate: false }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: crawlStub });
  assert.ok(existsSync(res.path));
  assert.match(res.path, /2026-06-sentiment\.md$/);
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'GLOBAL.md')), false);
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'sentiment', 'current.md')), false);
});

test('ask on historical period ignores mutate=true (never overwrites live now-KB)', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  await runAsk({ intent: 'sentiment', period, mutate: true }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: crawlStub });
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'sentiment', 'current.md')), false);
});

test('ask crawls by updated window (activity view)', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'kask-'));
  const period = parsePeriod('2026-06', new Date('2026-07-21T00:00:00Z'));
  await runAsk({ intent: 'focus', period, mutate: false }, cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
});
