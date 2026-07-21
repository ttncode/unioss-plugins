import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawl, toObservations, moduleOf } from './crawl.mjs';

const issue = (over = {}) => ({ id: 1, iid: 10, project_id: 32, title: 'T', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T00:00:00Z', author: { name: 'A' }, ...over });

test('moduleOf reads repo from web_url', () => {
  assert.equal(moduleOf(issue()), 'admin-page');
  assert.equal(moduleOf(issue({ web_url: 'https://g/unioss/FrontEnd/-/issues/3' })), 'front-end');
});

test('crawl attaches notes per issue', async () => {
  const deps = {
    listIssues: async () => [issue(), issue({ iid: 11 })],
    listNotes: async (h, t, pid, iid) => [{ id: 5, body: `n${iid}`, system: false, created_at: 'x', author: { name: 'U' } }],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3' }, deps);
  assert.equal(out.length, 2);
  assert.equal(out[0].notes[0].body, 'n10');
});

test('toObservations dedup-keys and skips system notes', () => {
  const crawled = [{ issue: issue(), notes: [
    { id: 5, body: 'real', system: false, created_at: 'x', author: { name: 'U' } },
    { id: 6, body: 'changed labels', system: true, created_at: 'y', author: { name: 'bot' } },
  ] }];
  const obs = toObservations(crawled);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].body, 'real');
  assert.ok(obs[0].id.length === 40);
});
