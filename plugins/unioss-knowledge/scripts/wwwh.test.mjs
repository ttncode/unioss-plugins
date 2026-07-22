// plugins/unioss-knowledge/scripts/wwwh.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWwwh, renderDailyDigest } from './wwwh.mjs';

const issue = (over = {}) => ({ iid: 10, title: 'Fix ledger', description: 'Ledger totals wrong\nmore', web_url: 'https://g/unioss/AdminPage/-/issues/10', created_at: '2026-07-21T09:00:00Z', labels: ['UNIOSS 3'], author: { name: 'Sato' }, ...over });

test('renderWwwh includes prefix, title, and all four Ws', () => {
  const md = renderWwwh(issue());
  assert.match(md, /### AP#10 — Fix ledger/);
  assert.match(md, /\*\*What:\*\* Ledger totals wrong/);
  assert.match(md, /\*\*Why:\*\*/);
  assert.match(md, /\*\*Who:\*\* Sato/);
  assert.match(md, /\*\*How:\*\* https:\/\/g/);
});

test('renderDailyDigest one block per issue, count in header', () => {
  const md = renderDailyDigest([issue(), issue({ iid: 11, title: 'B' })], '2026-07-21');
  assert.match(md, /2 ticket\(s\)/);
  assert.equal((md.match(/### AP#/g) || []).length, 2);
});

test('renderDailyDigest empty-safe', () => {
  const md = renderDailyDigest([], '2026-07-21');
  assert.match(md, /No new tickets/);
});

test('renderDailyDigest does not throw for valid issues', () => {
  assert.doesNotThrow(() => renderDailyDigest([issue(), issue({ iid: 12 })], '2026-07-21'));
});
