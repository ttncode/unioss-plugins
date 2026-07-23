import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crawl, toObservations, moduleOf, toTicketEvidence } from './crawl.mjs';

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

test('crawl with dateField updated forwards it and filters notes to the window', async () => {
  let captured;
  const from = new Date('2026-07-14T00:00:00Z');
  const to = new Date('2026-07-21T00:00:00Z');
  const deps = {
    listIssues: async (h, t, opts) => { captured = opts; return [issue()]; },
    listNotes: async () => [
      { id: 1, body: 'old comment', system: false, created_at: '2026-06-01T00:00:00Z', author: { name: 'U' } },
      { id: 2, body: 'in window', system: false, created_at: '2026-07-15T00:00:00Z', author: { name: 'U' } },
      { id: 3, body: 'boundary', system: false, created_at: '2026-07-21T00:00:00Z', author: { name: 'U' } },
      { id: 4, body: 'no date', system: false, author: { name: 'U' } },
    ],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3', from, to, dateField: 'updated' }, deps);
  assert.equal(captured.dateField, 'updated');
  assert.equal(captured.after, from.toISOString());
  assert.equal(captured.before, to.toISOString());
  assert.deepEqual(out[0].notes.map((n) => n.body), ['in window', 'boundary']);
});

test('crawl with default dateField keeps all notes', async () => {
  const deps = {
    listIssues: async () => [issue()],
    listNotes: async () => [
      { id: 1, body: 'old comment', system: false, created_at: '2026-06-01T00:00:00Z', author: { name: 'U' } },
    ],
  };
  const out = await crawl({ host: 'h', token: 't', label: 'UNIOSS 3', from: new Date('2026-07-14T00:00:00Z'), to: new Date('2026-07-21T00:00:00Z') }, deps);
  assert.equal(out[0].notes.length, 1);
});

test('toTicketEvidence keeps full description and non-system notes', () => {
  const crawled = [{
    issue: issue({ description: '# 内容\nline two\nline three', state: 'closed', labels: ['UNIOSS 3', '改修依頼'] }),
    notes: [
      { id: 5, body: 'real note', system: false, created_at: '2026-07-01T00:00:00Z', author: { name: 'U' } },
      { id: 6, body: 'changed labels', system: true, created_at: '2026-07-02T00:00:00Z', author: { name: 'bot' } },
    ],
  }];
  const [t] = toTicketEvidence(crawled);
  assert.equal(t.iid, 10);
  assert.equal(t.prefix, 'AP');
  assert.equal(t.state, 'closed');
  assert.deepEqual(t.labels, ['UNIOSS 3', '改修依頼']);
  assert.equal(t.description, '# 内容\nline two\nline three');
  assert.deepEqual(t.notes, [{ author: 'U', at: '2026-07-01T00:00:00Z', body: 'real note' }]);
});

test('toTicketEvidence prefixes FrontEnd tickets FE', () => {
  const [t] = toTicketEvidence([{ issue: issue({ web_url: 'https://g/unioss/FrontEnd/-/issues/3', iid: 3 }), notes: [] }]);
  assert.equal(t.prefix, 'FE');
});
