import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';

export async function runToday(cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const period = parsePeriod('today', now);
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  const date = period.key;
  const md = renderDailyDigest(crawled.map((c) => c.issue), date);
  const path = join(dir, 'digests', `${date}-daily.md`);
  atomicWrite(path, md);
  appendObservations(dir, toObservations(crawled));
  touchLayer(dir, 'daily', now);
  return { path, count: crawled.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runToday().then((r) => console.log(`${r.count} ticket(s) → ${r.path}`)).catch((e) => { console.error(e.message); process.exit(1); });
}
