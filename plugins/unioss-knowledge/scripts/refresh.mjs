import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import {
  knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer,
  readIndex, stalenessDays, acquireLock, releaseLock,
} from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { splitSentiment, renderSentiment, renderGlobal } from './distill.mjs';

const WINDOW = { daily: 'today', weekly: 'week', monthly: 'month' };

export async function runRefresh(kind, cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  if (!WINDOW[kind]) throw new Error(`Unknown refresh kind: ${kind}`);
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(dir);
  if (!acquireLock(dir)) throw new Error('Another knowledge run is in progress (.lock present).');
  const written = [];
  try {
    const period = parsePeriod(WINDOW[kind], now);
    // daily digest = tickets that arrived today; weekly/monthly = any ticket active in the window.
    const dateField = kind === 'daily' ? 'created' : 'updated';
    const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField });
    appendObservations(dir, toObservations(crawled));

    if (kind === 'daily') {
      ensureDir(join(dir, 'digests'));
      const p = join(dir, 'digests', `${period.key}-daily.md`);
      atomicWrite(p, renderDailyDigest(crawled.map((c) => c.issue), period.key));
      written.push(p);
    }
    if (kind === 'weekly' || kind === 'monthly') {
      ensureDir(join(dir, 'sentiment'));
      const sentiment = splitSentiment(toObservations(crawled));
      const cp = join(dir, 'sentiment', 'current.md');
      atomicWrite(cp, renderSentiment(sentiment, period.key));
      written.push(cp);
      touchLayer(dir, 'sentiment', now);
      const gp = join(dir, 'GLOBAL.md');
      const age = stalenessDays(readIndex(dir), 'sentiment', now) ?? 0;
      const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
      const friction = sentiment.criticism.slice(0, 5).map((c) => `${c.body} (${c.source})`);
      const approvedPath = join(dir, 'rules', 'approved.md');
      const rules = existsSync(approvedPath)
        ? readFileSync(approvedPath, 'utf8')
            .split('\n')
            .filter((line) => line.startsWith('- '))
            .map((line) => line.slice(2).trim())
            .slice(0, 5)
        : [];
      atomicWrite(gp, renderGlobal({ focus, rules, friction, updated: now.toISOString().slice(0, 10), sentimentAgeDays: age }));
      written.push(gp);
    }
    touchLayer(dir, kind, now);
    return { written };
  } finally {
    releaseLock(dir);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runRefresh(process.argv[2] || 'daily').then((r) => console.log(r.written.join('\n'))).catch((e) => { console.error(e.message); process.exit(1); });
}
