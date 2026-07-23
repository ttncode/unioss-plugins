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
  // Activity view: any ticket updated in the period counts, not only newly created ones.
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'updated' });
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  const observations = toObservations(crawled);
  // observations.jsonl is the append-only, deduped evidence trail (Tier 3) — always written, never part of the curated live KB (GLOBAL.md / rules/ / sentiment/current.md).
  appendObservations(dir, observations);
  const markdown = renderAnswer(intent, crawled, period.key);
  const path = join(dir, 'digests', `${period.key}-${intent}.md`);
  atomicWrite(path, markdown);

  // Mutation into the live "now" KB is allowed ONLY for a current-period refresh.
  if (mutate && periodOverlapsPresent(period, now)) {
    ensureDir(join(dir, 'sentiment'));
    atomicWrite(join(dir, 'sentiment', 'current.md'), renderSentiment(splitSentiment(observations), period.key));
    touchLayer(dir, 'sentiment', now);
  }
  return { path, markdown };
}

// appended to plugins/unioss-knowledge/scripts/ask.mjs
import { pathToFileURL } from 'node:url';
import { parsePeriod } from './period.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const period = parsePeriod(args.period);
  if (!period) { console.error('Invalid --period'); process.exit(1); }
  runAsk({ intent: args.intent || 'general', period, mutate: Boolean(args.refresh) })
    .then((r) => console.log(`${r.path}\n\n${r.markdown}`))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
