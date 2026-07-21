import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { periodOverlapsPresent } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { splitSentiment, renderSentiment } from './distill.mjs';

function renderAnswer(intent, crawled, periodKey) {
  if (intent === 'sentiment') return renderSentiment(splitSentiment(toObservations(crawled)), periodKey);
  if (intent === 'focus') {
    const lines = [`# Customer focus — ${periodKey}`, ''];
    for (const c of crawled) lines.push(`- ${c.issue.title} (${c.issue.web_url})`);
    if (crawled.length === 0) lines.push('- (no tickets in this period)');
    return lines.join('\n') + '\n';
  }
  return renderDailyDigest(crawled.map((c) => c.issue), periodKey); // tickets / general
}

export async function runAsk({ intent, period, mutate = false }, cwd = process.cwd(), now = new Date(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const cfg = resolveConfig(cwd);
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  appendObservations(dir, toObservations(crawled));
  const markdown = renderAnswer(intent, crawled, period.key);
  const path = join(dir, 'digests', `${period.key}-${intent}.md`);
  atomicWrite(path, markdown);

  // Mutation into the live "now" KB is allowed ONLY for a current-period refresh.
  if (mutate && periodOverlapsPresent(period, now)) {
    ensureDir(join(dir, 'sentiment'));
    atomicWrite(join(dir, 'sentiment', 'current.md'), renderSentiment(splitSentiment(toObservations(crawled)), period.key));
    touchLayer(dir, 'sentiment', now);
  }
  return { path, markdown };
}
