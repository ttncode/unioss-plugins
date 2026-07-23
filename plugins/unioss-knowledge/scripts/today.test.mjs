import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runToday } from './today.mjs';

const issue = (iid) => ({ iid, project_id: 32, title: `T${iid}`, description: '# 内容\nfull body', web_url: 'https://g/unioss/AdminPage/-/issues/' + iid, created_at: '2026-07-21T09:00:00Z', labels: [], author: { name: 'A' } });
const NOW = new Date('2026-07-21T10:00:00Z');

test('runToday with tickets writes evidence json, no rendered digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const deps = {
    getToken: () => 'tok',
    crawl: async () => [
      { issue: issue(10), notes: [{ id: 1, body: 'n', system: false, created_at: '2026-07-21T09:30:00Z', author: { name: 'U' } }] },
      { issue: issue(11), notes: [] },
    ],
  };
  const res = await runToday(cwd, NOW, deps);
  assert.equal(res.count, 2);
  assert.ok(res.needsReport);
  assert.match(res.path, /2026-07-21-daily\.evidence\.json$/);
  const ev = JSON.parse(readFileSync(res.path, 'utf8'));
  assert.equal(ev.date, '2026-07-21');
  assert.equal(ev.tickets.length, 2);
  assert.equal(ev.tickets[0].description, '# 内容\nfull body');
  assert.equal(existsSync(join(cwd, '.walkthrough', '.knowledge', 'digests', '2026-07-21-daily.md')), false);
});

test('runToday with zero tickets writes the empty digest itself', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const res = await runToday(cwd, NOW, { getToken: () => 'tok', crawl: async () => [] });
  assert.equal(res.count, 0);
  assert.equal(res.needsReport, false);
  assert.match(res.path, /2026-07-21-daily\.md$/);
  assert.match(readFileSync(res.path, 'utf8'), /No new tickets/);
});

test('runToday throws a clear error without a token', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await assert.rejects(() => runToday(cwd, new Date(), { getToken: () => undefined, crawl: async () => [] }), /GITLAB_TOKEN/);
});

test('today crawls by created window', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return [{ issue: issue(10), notes: [] }]; };
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await runToday(cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'created');
});
