import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runToday } from './today.mjs';

const issue = (iid) => ({ iid, project_id: 32, title: `T${iid}`, description: 'desc', web_url: 'https://g/unioss/AdminPage/-/issues/' + iid, created_at: '2026-07-21T09:00:00Z', labels: [], author: { name: 'A' } });

test('runToday writes a dated digest and returns count', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  const deps = {
    getToken: () => 'tok',
    crawl: async () => [{ issue: issue(10), notes: [] }, { issue: issue(11), notes: [] }],
  };
  const now = new Date('2026-07-21T10:00:00Z');
  const res = await runToday(cwd, now, deps);
  assert.equal(res.count, 2);
  assert.ok(existsSync(res.path));
  assert.match(readFileSync(res.path, 'utf8'), /2 ticket\(s\)/);
  assert.ok(existsSync(join(cwd, '.walkthrough', '.knowledge', 'index.json')));
});

test('runToday throws a clear error without a token', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await assert.rejects(() => runToday(cwd, new Date(), { getToken: () => undefined, crawl: async () => [] }), /GITLAB_TOKEN/);
});

test('today crawls by created window', async () => {
  let captured;
  const spyCrawl = async (opts) => {
    captured = opts;
    return [{
      issue: { iid: 10, project_id: 32, title: 'T', description: 'd', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T00:00:00Z', labels: [], author: { name: 'A' } },
      notes: [],
    }];
  };
  const cwd = mkdtempSync(join(tmpdir(), 'ktoday-'));
  await runToday(cwd, new Date('2026-07-21T00:00:00Z'), { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'created');
});
