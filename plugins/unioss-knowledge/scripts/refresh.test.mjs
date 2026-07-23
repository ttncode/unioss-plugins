import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRefresh } from './refresh.mjs';

const crawlStub = async () => [{
  issue: {
    iid: 42, project_id: 32, title: 'Sales detail delete bug',
    web_url: 'https://g/unioss/AdminPage/-/issues/42',
    created_at: '2026-07-15T00:00:00Z', author: { name: 'A' },
  },
  notes: [{ id: 1, body: 'This is broken and frustrating', system: false, created_at: '2026-07-16T00:00:00Z', author: { name: 'U' } }],
}];

const deps = { getToken: () => 'tok', crawl: crawlStub };
const NOW = new Date('2026-07-21T00:00:00Z');
const classifiedOk = { praise: [], criticism: [{ body: 'Store page errors on click', source: 'https://g/1827' }] };
const kb = (cwd, ...p) => join(cwd, '.walkthrough', '.knowledge', ...p);

test('weekly crawl phase writes evidence only; finalize writes sentiment + GLOBAL with rules', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  mkdirSync(kb(cwd, 'rules'), { recursive: true });
  writeFileSync(kb(cwd, 'rules', 'approved.md'), '- [R-001] Never hard-delete t_sales_detail. (AP#1834)\n');

  const crawlRes = await runRefresh('weekly', cwd, NOW, deps);
  assert.ok(crawlRes.written.some((p) => /evidence-2026-W30\.json$/.test(p)));
  assert.equal(crawlRes.count, 1);
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);

  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  const globalPath = fin.written.find((p) => p.endsWith('GLOBAL.md'));
  assert.ok(globalPath);
  const content = readFileSync(globalPath, 'utf8');
  assert.match(content, /Never hard-delete t_sales_detail/);
  assert.match(content, /Store page errors on click/);
  const currentPath = fin.written.find((p) => p.endsWith('current.md'));
  assert.match(readFileSync(currentPath, 'utf8'), /Store page errors on click/);
});

test('finalize with no approved.md still succeeds and renders "(none yet)"', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await runRefresh('weekly', cwd, NOW, deps);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  const content = readFileSync(fin.written.find((p) => p.endsWith('GLOBAL.md')), 'utf8');
  assert.match(content, /## Top active pitfalls \(approved rules\)\n- \(none yet\)/);
});

test('daily refresh crawls by created window; weekly by updated', async () => {
  const fields = [];
  const spyCrawl = async (opts) => { fields.push(opts.dateField); return crawlStub(); };
  const spyDeps = { getToken: () => 'tok', crawl: spyCrawl };
  await runRefresh('daily', mkdtempSync(join(tmpdir(), 'krefresh-')), NOW, spyDeps);
  await runRefresh('weekly', mkdtempSync(join(tmpdir(), 'krefresh-')), NOW, spyDeps);
  assert.deepEqual(fields, ['created', 'updated']);
});

test('yearly refresh: crawl emits evidence, finalize writes sentiment + GLOBAL', async () => {
  let captured;
  const spyCrawl = async (opts) => { captured = opts; return crawlStub(); };
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('yearly', cwd, NOW, { getToken: () => 'tok', crawl: spyCrawl });
  assert.equal(captured.dateField, 'updated');
  assert.ok(res.written.some((p) => p.endsWith('evidence-2026.json')));
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  const fin = await runRefresh('yearly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf });
  assert.ok(fin.written.some((p) => p.endsWith('current.md')));
  assert.ok(fin.written.some((p) => p.endsWith('GLOBAL.md')));
});

test('finalize without prior crawl fails and writes nothing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify(classifiedOk));
  await assert.rejects(
    () => runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf }),
    /Evidence not found/,
  );
  assert.equal(existsSync(kb(cwd, 'GLOBAL.md')), false);
});

test('finalize rejects invalid classified and writes nothing', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await runRefresh('weekly', cwd, NOW, deps);
  const cf = join(cwd, 'classified.json');
  writeFileSync(cf, JSON.stringify({ praise: 'nope', criticism: [] }));
  await assert.rejects(
    () => runRefresh('weekly', cwd, NOW, {}, { phase: 'finalize', classifiedPath: cf }),
    /array/,
  );
  assert.equal(existsSync(kb(cwd, 'sentiment', 'current.md')), false);
});

test('daily has no finalize phase', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  await assert.rejects(
    () => runRefresh('daily', cwd, NOW, {}, { phase: 'finalize', classifiedPath: 'x' }),
    /daily has no finalize/,
  );
});

test('daily refresh with tickets writes evidence json, no rendered digest', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('daily', cwd, NOW, deps);
  assert.ok(res.needsReport);
  assert.equal(res.ticketCount, 1);
  assert.ok(res.written.some((p) => p.endsWith('2026-07-21-daily.evidence.json')));
  assert.equal(existsSync(kb(cwd, 'digests', '2026-07-21-daily.md')), false);
  const ev = JSON.parse(readFileSync(res.written[0], 'utf8'));
  assert.equal(ev.tickets[0].iid, 42);
});

test('daily refresh with zero tickets writes the empty digest itself', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'krefresh-'));
  const res = await runRefresh('daily', cwd, NOW, { getToken: () => 'tok', crawl: async () => [] });
  assert.ok(res.written.some((p) => p.endsWith('2026-07-21-daily.md')));
  assert.match(readFileSync(res.written[0], 'utf8'), /No new tickets/);
});
