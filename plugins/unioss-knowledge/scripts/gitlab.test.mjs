import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiGet, listIssues } from './gitlab.mjs';

function fakeFetch(pages) {
  let i = 0;
  return async () => ({ ok: true, status: 200, json: async () => pages[i++] ?? [] });
}

test('apiGet throws on non-2xx', async () => {
  const f = async () => ({ ok: false, status: 404, json: async () => ({}) });
  await assert.rejects(() => apiGet('h', 'issues', 't', f), /404/);
});

test('listIssues paginates until a short page', async () => {
  const full = Array.from({ length: 100 }, (_, k) => ({ iid: k }));
  const issues = await listIssues('h', 't', { label: 'UNIOSS 3' }, fakeFetch([full, [{ iid: 999 }]]));
  assert.equal(issues.length, 101);
  assert.equal(issues.at(-1).iid, 999);
});

test('listIssues stops on first empty page', async () => {
  const issues = await listIssues('h', 't', {}, fakeFetch([[]]));
  assert.equal(issues.length, 0);
});
