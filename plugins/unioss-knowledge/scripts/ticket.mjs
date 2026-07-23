import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { getToken as realGetToken, apiGet as realApiGet, listNotes as realListNotes } from './gitlab.mjs';
import { toTicketEvidence } from './crawl.mjs';
import { knowledgeDir, ensureDir, atomicWrite } from './store.mjs';

const URL_RE = /https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/;

export async function runTicket(url, cwd = process.cwd(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const get = deps.apiGet ?? realApiGet;
  const listNotes = deps.listNotes ?? realListNotes;
  const m = String(url).match(URL_RE);
  if (!m) throw new Error('Invalid GitLab ticket URL');
  const [, host, ns, repo, , iid] = m;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const project = encodeURIComponent(`${ns}/${repo}`);
  const issue = await get(host, `projects/${project}/issues/${iid}`, token);
  const notes = await listNotes(host, token, issue.project_id, iid);
  // Reports are the agent's job (unioss-knowledge-report skill) — emit evidence only.
  const [ticket] = toTicketEvidence([{ issue, notes: Array.isArray(notes) ? notes : [] }]);
  const cfg = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, cfg.artifactRoot);
  ensureDir(join(dir, 'digests'));
  const path = join(dir, 'digests', `ticket-${ticket.prefix}-${iid}.evidence.json`);
  atomicWrite(path, JSON.stringify(ticket, null, 2) + '\n');
  return { path, prefix: ticket.prefix, iid, needsReport: true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runTicket(process.argv[2]).then((r) => {
    console.log(r.path);
    console.log(`Write the report per the unioss-knowledge-report skill → digests/ticket-${r.prefix}-${r.iid}.md`);
  }).catch((e) => { console.error(e.message); process.exit(1); });
}
