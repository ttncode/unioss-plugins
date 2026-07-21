import { pathToFileURL } from 'node:url';
import { getToken as realGetToken, apiGet } from './gitlab.mjs';
import { renderWwwh } from './wwwh.mjs';
import { moduleOf } from './crawl.mjs';

const URL_RE = /https:\/\/([^/]+)\/([^/]+)\/([^/]+)(?:\/-\/|\/)(work_items|issues)\/(\d+)/;

export async function runTicket(url, cwd = process.cwd(), deps = {}) {
  const getToken = deps.getToken ?? realGetToken;
  const get = deps.apiGet ?? apiGet;
  const m = String(url).match(URL_RE);
  if (!m) throw new Error('Invalid GitLab ticket URL');
  const [, host, ns, repo, , iid] = m;
  const token = getToken();
  if (!token) throw new Error('GITLAB_TOKEN not found in env or ~/.zshrc.local');
  const project = encodeURIComponent(`${ns}/${repo}`);
  const issue = await get(host, `projects/${project}/issues/${iid}`, token);
  const prefix = moduleOf(issue) === 'front-end' ? 'FE' : 'AP';
  return { prefix, iid, markdown: renderWwwh(issue) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runTicket(process.argv[2]).then((r) => console.log(r.markdown)).catch((e) => { console.error(e.message); process.exit(1); });
}
