import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export function getToken() {
  const home = homedir();
  if (home) {
    const p = join(home, '.zshrc.local');
    if (existsSync(p)) {
      const m = readFileSync(p, 'utf8').match(/export GITLAB_TOKEN=(.+)/);
      if (m) return m[1].trim();
    }
  }
  return process.env.GITLAB_TOKEN;
}

export async function apiGet(host, endpoint, token, fetchImpl = fetch) {
  const url = `https://${host}/api/v4/${endpoint}`;
  const res = await fetchImpl(url, { headers: { 'PRIVATE-TOKEN': token } });
  if (!res.ok) throw new Error(`GitLab ${res.status} for ${endpoint}`);
  return res.json();
}

const MAX_PAGES = 50;

export async function listIssues(host, token, opts = {}, fetchImpl = fetch) {
  const { label, createdAfter, createdBefore, state = 'all' } = opts;
  const params = new URLSearchParams({ scope: 'all', per_page: '100', order_by: 'created_at', sort: 'desc', state });
  if (label) params.set('labels', label);
  if (createdAfter) params.set('created_after', createdAfter);
  if (createdBefore) params.set('created_before', createdBefore);
  const out = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    params.set('page', String(page));
    const batch = await apiGet(host, `issues?${params.toString()}`, token, fetchImpl);
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

export async function listNotes(host, token, projectId, iid, fetchImpl = fetch) {
  return apiGet(host, `projects/${projectId}/issues/${iid}/notes?per_page=100`, token, fetchImpl);
}
