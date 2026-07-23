import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken } from './gitlab.mjs';
import { periodOverlapsPresent, parsePeriod } from './period.mjs';
import { crawl as realCrawl, toObservations } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite, appendObservations, touchLayer } from './store.mjs';
import { renderDailyDigest } from './wwwh.mjs';
import { renderSentiment, validateClassified, buildEvidence } from './distill.mjs';

function renderAnswer(intent, crawled, periodKey) {
  if (intent === 'focus') {
    const lines = [`# Customer focus — ${periodKey}`, ''];
    for (const c of crawled) lines.push(`- ${c.issue.title} (${c.issue.web_url})`);
    if (crawled.length === 0) lines.push('- (no tickets in this period)');
    return lines.join('\n') + '\n';
  }
  return renderDailyDigest(crawled.map((c) => c.issue), periodKey); // tickets / general
}

export async function runAsk({ intent, period, mutate = false, classifiedPath }, cwd = process.cwd(), now = new Date(), deps = {}) {
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);

  // Sentiment step 2: render the agent-classified result — no crawl needed.
  if (intent === 'sentiment' && classifiedPath) {
    if (!existsSync(classifiedPath)) throw new Error(`Classified file not found: ${classifiedPath}`);
    const classified = validateClassified(JSON.parse(readFileSync(classifiedPath, 'utf8')));
    const markdown = renderSentiment(classified, period.key);
    ensureDir(join(dir, 'digests'));
    const path = join(dir, 'digests', `${period.key}-sentiment.md`);
    atomicWrite(path, markdown);
    // Mutation into the live "now" KB is allowed ONLY for a current-period refresh.
    if (mutate && periodOverlapsPresent(period, now)) {
      ensureDir(join(dir, 'sentiment'));
      atomicWrite(join(dir, 'sentiment', 'current.md'), markdown);
      touchLayer(dir, 'sentiment', now);
    }
    return { path, markdown };
  }

  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  // Activity view: any ticket updated in the period counts, not only newly created ones.
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField: 'updated' });
  const observations = toObservations(crawled);
  // observations.jsonl is the append-only, deduped evidence trail (Tier 3) — always written, never part of the curated live KB (GLOBAL.md / rules/ / sentiment/current.md).
  appendObservations(dir, observations);

  // Sentiment step 1: emit evidence for the agent to classify — no digest yet, scripts never guess sentiment.
  if (intent === 'sentiment') {
    ensureDir(join(dir, 'sentiment'));
    const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
    const evidence = buildEvidence(period.key, focus, observations);
    const path = join(dir, 'sentiment', `evidence-${period.key}.json`);
    atomicWrite(path, JSON.stringify(evidence, null, 2) + '\n');
    return { path, markdown: '', needsClassification: true, count: evidence.observations.length };
  }

  ensureDir(join(dir, 'digests'));
  const markdown = renderAnswer(intent, crawled, period.key);
  const path = join(dir, 'digests', `${period.key}-${intent}.md`);
  atomicWrite(path, markdown);
  return { path, markdown };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }));
  const period = parsePeriod(args.period);
  if (!period) { console.error('Invalid --period'); process.exit(1); }
  runAsk({
    intent: args.intent || 'general',
    period,
    mutate: Boolean(args.refresh),
    classifiedPath: typeof args.classified === 'string' ? args.classified : undefined,
  })
    .then((r) => {
      if (r.needsClassification) {
        console.log(`${r.path}\n\n${r.count} observation(s) — classify (customer-impacting signal — see the ask skill), write classified JSON, then re-run with --classified=<path>`);
      } else {
        console.log(`${r.path}\n\n${r.markdown}`);
      }
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
