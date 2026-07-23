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
import { renderSentiment, renderGlobal, validateClassified, buildEvidence } from './distill.mjs';

const WINDOW = { daily: 'today', weekly: 'week', monthly: 'month', yearly: 'year' };

function readApprovedRules(dir) {
  const approvedPath = join(dir, 'rules', 'approved.md');
  if (!existsSync(approvedPath)) return [];
  return readFileSync(approvedPath, 'utf8')
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .slice(0, 5);
}

async function crawlPhase(kind, period, cfg, dir, now, deps) {
  const getToken = deps.getToken ?? realGetToken;
  const crawl = deps.crawl ?? realCrawl;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  // daily digest = tickets that arrived today; weekly/monthly/yearly = any ticket active in the window.
  const dateField = kind === 'daily' ? 'created' : 'updated';
  const crawled = await crawl({ host: cfg.host, token, label: cfg.workLabel, from: period.from, to: period.to, dateField });
  appendObservations(dir, toObservations(crawled));
  if (kind === 'daily') {
    ensureDir(join(dir, 'digests'));
    const p = join(dir, 'digests', `${period.key}-daily.md`);
    atomicWrite(p, renderDailyDigest(crawled.map((c) => c.issue), period.key));
    touchLayer(dir, 'daily', now);
    return { written: [p] };
  }
  // Sentiment is the agent's judgment — emit evidence only; finalize renders it.
  ensureDir(join(dir, 'sentiment'));
  const focus = crawled.map((c) => `${c.issue.title} (${c.issue.web_url})`).slice(0, 5);
  const evidence = buildEvidence(period.key, focus, toObservations(crawled));
  const ep = join(dir, 'sentiment', `evidence-${period.key}.json`);
  atomicWrite(ep, JSON.stringify(evidence, null, 2) + '\n');
  return { written: [ep], count: evidence.observations.length };
}

function finalizePhase(kind, period, dir, now, classifiedPath) {
  const ep = join(dir, 'sentiment', `evidence-${period.key}.json`);
  if (!existsSync(ep)) throw new Error(`Evidence not found: ${ep} — run --phase=crawl first (same period).`);
  const evidence = JSON.parse(readFileSync(ep, 'utf8'));
  if (!classifiedPath) throw new Error('--classified=<path> is required for --phase=finalize');
  if (!existsSync(classifiedPath)) throw new Error(`Classified file not found: ${classifiedPath}`);
  const classified = validateClassified(JSON.parse(readFileSync(classifiedPath, 'utf8')));
  const written = [];
  const cp = join(dir, 'sentiment', 'current.md');
  atomicWrite(cp, renderSentiment(classified, period.key));
  written.push(cp);
  touchLayer(dir, 'sentiment', now);
  const gp = join(dir, 'GLOBAL.md');
  const age = stalenessDays(readIndex(dir), 'sentiment', now) ?? 0;
  const friction = classified.criticism.slice(0, 5).map((c) => `${c.body} (${c.source})`);
  atomicWrite(gp, renderGlobal({
    focus: Array.isArray(evidence.focus) ? evidence.focus : [],
    rules: readApprovedRules(dir),
    friction,
    updated: now.toISOString().slice(0, 10),
    sentimentAgeDays: age,
  }));
  written.push(gp);
  touchLayer(dir, kind, now);
  return { written };
}

export async function runRefresh(kind, cwd = process.cwd(), now = new Date(), deps = {}, opts = {}) {
  const { phase = 'crawl', classifiedPath } = opts;
  if (!WINDOW[kind]) throw new Error(`Unknown refresh kind: ${kind}`);
  if (phase !== 'crawl' && phase !== 'finalize') throw new Error(`Unknown phase: ${phase}`);
  if (kind === 'daily' && phase === 'finalize') throw new Error('daily has no finalize phase');
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(dir);
  if (!acquireLock(dir)) throw new Error('Another knowledge run is in progress (.lock present).');
  try {
    const period = parsePeriod(WINDOW[kind], now);
    return phase === 'crawl'
      ? await crawlPhase(kind, period, cfg, dir, now, deps)
      : finalizePhase(kind, period, dir, now, classifiedPath);
  } finally {
    releaseLock(dir);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const argv = process.argv.slice(2);
  const kind = argv.find((a) => !a.startsWith('--')) || 'daily';
  const flags = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return [m[1], m[2] ?? true];
  }));
  runRefresh(kind, process.cwd(), new Date(), {}, { phase: flags.phase || 'crawl', classifiedPath: flags.classified })
    .then((r) => {
      console.log(r.written.join('\n'));
      if (r.count != null) console.log(`${r.count} observation(s) in evidence — classify, then run --phase=finalize --classified=<path>`);
    })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
