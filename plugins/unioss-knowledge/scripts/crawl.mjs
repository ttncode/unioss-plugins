import { listIssues, listNotes } from './gitlab.mjs';
import { obsId } from './store.mjs';

export function moduleOf(issue) {
  return issue.web_url?.includes('/FrontEnd/') ? 'front-end' : 'admin-page';
}

export async function crawl({ host, token, label, from, to }, deps = { listIssues, listNotes }) {
  const createdAfter = from ? from.toISOString() : undefined;
  const createdBefore = to ? to.toISOString() : undefined;
  const issues = await deps.listIssues(host, token, { label, createdAfter, createdBefore });
  const out = [];
  for (const issue of issues) {
    const notes = await deps.listNotes(host, token, issue.project_id, issue.iid);
    out.push({ issue, notes: Array.isArray(notes) ? notes : [] });
  }
  return out;
}

export function toObservations(crawled) {
  const recs = [];
  for (const { issue, notes } of crawled) {
    for (const n of notes) {
      if (n.system) continue;
      recs.push({
        id: obsId(issue.project_id, issue.iid, n.id),
        project_id: issue.project_id,
        iid: issue.iid,
        author: n.author?.name ?? 'unknown',
        at: n.created_at,
        body: (n.body || '').slice(0, 500),
        source: issue.web_url,
      });
    }
  }
  return recs;
}
