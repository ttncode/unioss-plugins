import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations, toTicketEvidence } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';

export async function runToday(cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const period = parsePeriod('today', now);
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'created' });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  appendObservations(dir, toObservations(crawled));
  touchLayer(dir, 'daily', now);
  const date = period.key;
  if (crawled.length === 0) {
    const path = join(dir, 'digests', `${date}-daily.md`);
    atomicWrite(path, renderDailyDigest([], date));
    return { path, count: 0, needsReport: false };
  }
  // Reports are the agent's job (unioss-knowledge-report skill) — the script only emits evidence.
  const evidence = { date, tickets: toTicketEvidence(crawled) };
  const path = join(dir, 'digests', `${date}-daily.evidence.json`);
  atomicWrite(path, JSON.stringify(evidence, null, 2) + '\n');
  return { path, count: crawled.length, needsReport: true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runToday().then((r) => {
    console.log(`${r.count} ticket(s) → ${r.path}`);
    if (r.needsReport) console.log('Write the daily report per the unioss-knowledge-report skill.');
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
