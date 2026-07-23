import { listIssues, listNotes } from './gitlab.mjs';
import { obsId } from './store.mjs';

export function moduleOf(issue) {
  return issue.web_url?.includes('/FrontEnd/') ? 'front-end' : 'admin-page';
}

function noteInWindow(note, from, to) {
  if (!note.created_at) return false;
  const at = new Date(note.created_at);
  if (from && at < from) return false;
  if (to && at > to) return false;
  return true;
}

export async function crawl({ host, token, label, from, to, dateField = 'created' }, deps = { listIssues, listNotes }) {
  const after = from ? from.toISOString() : undefined;
  const before = to ? to.toISOString() : undefined;
  const issues = await deps.listIssues(host, token, { label, after, before, dateField });
  const out = [];
  for (const issue of issues) {
    const notes = await deps.listNotes(host, token, issue.project_id, issue.iid);
    const all = Array.isArray(notes) ? notes : [];
    // 'updated' windows on activity — an old ticket's full history must not re-enter every period.
    out.push({ issue, notes: dateField === 'updated' ? all.filter((n) => noteInWindow(n, from, to)) : all });
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

// Full-fidelity per-ticket evidence for agent-written reports (today/ticket/daily flows).
export function toTicketEvidence(crawled) {
  return crawled.map(({ issue, notes }) => ({
    iid: issue.iid,
    prefix: moduleOf(issue) === 'front-end' ? 'FE' : 'AP',
    title: issue.title,
    web_url: issue.web_url,
    state: issue.state ?? 'opened',
    author: issue.author?.name ?? 'unknown',
    created_at: issue.created_at,
    labels: issue.labels ?? [],
    description: issue.description ?? '',
    notes: (Array.isArray(notes) ? notes : [])
      .filter((n) => !n.system)
      .map((n) => ({ author: n.author?.name ?? 'unknown', at: n.created_at, body: n.body ?? '' })),
  }));
}
