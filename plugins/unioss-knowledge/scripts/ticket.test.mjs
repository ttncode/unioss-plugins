import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTicket } from './ticket.mjs';

const issue = {
  iid: 1862, project_id: 32, title: 'ランディングページのチラシ種別追加',
  description: '# 内容\nサイネックス用（返礼品2割用）の種別を追加', state: 'opened',
  web_url: 'https://g/unioss/AdminPage/-/work_items/1862',
  created_at: '2026-07-23T00:00:00Z', labels: ['UNIOSS 3'], author: { name: 'Satoshi Yamaguchi' },
};

test('runTicket writes single-ticket evidence with full description and notes', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'kticket-'));
  const deps = {
    getToken: () => 'tok',
    apiGet: async () => issue,
    listNotes: async () => [
      { id: 1, body: 'note body', system: false, created_at: '2026-07-23T01:00:00Z', author: { name: 'U' } },
      { id: 2, body: 'sys', system: true, created_at: '2026-07-23T02:00:00Z', author: { name: 'bot' } },
    ],
  };
  const res = await runTicket('https://g/unioss/AdminPage/-/work_items/1862', cwd, deps);
  assert.equal(res.prefix, 'AP');
  assert.equal(res.iid, '1862');
  assert.ok(res.needsReport);
  assert.match(res.path, /ticket-AP-1862\.evidence\.json$/);
  const ev = JSON.parse(readFileSync(res.path, 'utf8'));
  assert.equal(ev.description, '# 内容\nサイネックス用（返礼品2割用）の種別を追加');
  assert.deepEqual(ev.notes, [{ author: 'U', at: '2026-07-23T01:00:00Z', body: 'note body' }]);
});

test('runTicket rejects a non-ticket URL', async () => {
  await assert.rejects(() => runTicket('https://example.com/nope', mkdtempSync(join(tmpdir(), 'kticket-')), { getToken: () => 'tok' }), /Invalid GitLab ticket URL/);
});
