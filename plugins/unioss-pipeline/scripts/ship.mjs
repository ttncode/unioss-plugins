#!/usr/bin/env node
// Build a pre-filled GitLab "new merge request" URL + settings (the print-URL
// fallback), and — in `create` mode — push-adjacent MR creation via the GitLab
// API (POST merge_requests only; never merges). Merge stays a human action.
import { pathToFileURL } from 'node:url';
import { resolveConfig } from './config.mjs';

const MODES = new Set(['staging', 'customer']);

export function mrUrl({ host, repoWebPath, sourceBranch, targetBranch }) {
  const src = `merge_request%5Bsource_branch%5D=${encodeURIComponent(sourceBranch)}`;
  const tgt = `merge_request%5Btarget_branch%5D=${encodeURIComponent(targetBranch)}`;
  return `https://${host}/${repoWebPath}/-/merge_requests/new?${src}&${tgt}`;
}

export function shipInfo({ cwd = process.cwd(), mode, repoWebPath, sourceBranch }) {
  if (!MODES.has(mode)) throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
  const cfg = resolveConfig(cwd);
  const m = cfg.ship[mode];
  const url = mrUrl({ host: cfg.gitlab.host, repoWebPath, sourceBranch, targetBranch: m.targetBranch });
  const settings = {
    assignee: cfg.ship.assignee,
    reviewer: m.reviewer,
    label: cfg.ship.label,
    deleteSourceBranch: m.deleteSourceBranch,
    squash: m.squash,
    targetBranch: m.targetBranch,
  };
  return { url, settings };
}

export function mrCreatePayload({ sourceBranch, targetBranch, title, assigneeId, reviewerId, label, removeSourceBranch, squash }) {
  return {
    source_branch: sourceBranch,
    target_branch: targetBranch,
    title,
    assignee_ids: assigneeId ? [assigneeId] : [],
    reviewer_ids: reviewerId ? [reviewerId] : [],
    labels: label ?? '',
    remove_source_branch: !!removeSourceBranch,
    squash: !!squash,
  };
}

// Module key -> GitLab web path. Not per-machine, so it stays in code; the
// project id lives in config (gitlab.projects).
const REPO_WEB = {
  'admin-page': 'unioss/AdminPage',
  'front-end': 'unioss/FrontEnd',
  'common-helper': 'unioss/common-helper',
  'common-models': 'unioss/common-models',
};
const REPO_KEYS = Object.keys(REPO_WEB).join('|');

export function repoRef(cwd, repoKey) {
  const cfg = resolveConfig(cwd);
  const id = cfg.gitlab.projects[repoKey];
  if (typeof id !== 'number' || !REPO_WEB[repoKey]) throw new Error(`Unknown repo key: ${repoKey} (use ${REPO_KEYS})`);
  return { id, webPath: REPO_WEB[repoKey] };
}

// The MR title is fixed by house convention — derived from the branch and the
// mode's target, never from the ticket subject.
export const mrTitle = (sourceBranch, targetBranch) => `Merge ${sourceBranch} into ${targetBranch}`;

async function gitlabUserId(host, token, username) {
  const res = await fetch(`https://${host}/api/v4/users?username=${encodeURIComponent(username)}`, {
    headers: { 'PRIVATE-TOKEN': token },
  });
  if (!res.ok) throw new Error(`GitLab user lookup failed for ${username}: HTTP ${res.status}`);
  const users = await res.json();
  return users[0]?.id ?? null;
}

async function gitlabCurrentUser(host, token) {
  const res = await fetch(`https://${host}/api/v4/user`, { headers: { 'PRIVATE-TOKEN': token } });
  if (!res.ok) throw new Error(`GitLab current-user lookup failed: HTTP ${res.status}`);
  const user = await res.json();
  return { id: user.id ?? null, username: user.username };
}

// The MR assignee is whoever runs the ship: an explicit `ship.assignee` in config
// wins; otherwise the GITLAB_TOKEN owner is auto-detected. Returns { id, username }.
export async function resolveAssignee(cfg, host, token) {
  if (cfg.ship.assignee) {
    return { id: await gitlabUserId(host, token, cfg.ship.assignee), username: cfg.ship.assignee };
  }
  return gitlabCurrentUser(host, token);
}

async function createMr({ cwd = process.cwd(), mode, repoKey, sourceBranch }) {
  const token = process.env.GITLAB_TOKEN;
  if (!token) throw new Error('GITLAB_TOKEN is not set (needs `api` scope to create an MR)');
  if (!MODES.has(mode)) throw new Error(`Unknown ship mode: ${mode} (use staging|customer)`);
  const cfg = resolveConfig(cwd);
  const m = cfg.ship[mode];
  const { id, webPath } = repoRef(cwd, repoKey);
  const [assignee, reviewerId] = await Promise.all([
    resolveAssignee(cfg, cfg.gitlab.host, token),
    gitlabUserId(cfg.gitlab.host, token, m.reviewer),
  ]);
  const payload = mrCreatePayload({
    sourceBranch, targetBranch: m.targetBranch, title: mrTitle(sourceBranch, m.targetBranch),
    assigneeId: assignee.id, reviewerId, label: cfg.ship.label,
    removeSourceBranch: m.deleteSourceBranch, squash: m.squash,
  });
  const res = await fetch(`https://${cfg.gitlab.host}/api/v4/projects/${id}/merge_requests`, {
    method: 'POST',
    headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`MR create failed: HTTP ${res.status} — ${await res.text()}`);
  const mr = await res.json();
  return { webUrl: mr.web_url, webPath };
}

function renderSettings(s) {
  const onOff = (b) => (b ? 'ON' : 'OFF');
  return [
    `  Assignee:              ${s.assignee ? '@' + s.assignee : 'yourself (the GITLAB_TOKEN owner)'}`,
    `  Reviewer:              @${s.reviewer}`,
    `  Labels:                ${s.label} (only if it exists on the project)`,
    `  Delete source branch:  ${onOff(s.deleteSourceBranch)}`,
    `  Squash commits:        ${onOff(s.squash)}`,
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args[0] === 'create') {
    const [, mode, repoKey, sourceBranch] = args;
    if (!mode || !repoKey || !sourceBranch) {
      process.stderr.write(`Usage: ship.mjs create <staging|customer> <${REPO_KEYS}> <branch>\n`);
      process.exit(1);
    }
    createMr({ mode, repoKey, sourceBranch })
      .then(({ webUrl }) => process.stdout.write(`MR created (not merged):\n  ${webUrl}\n`))
      .catch((e) => { process.stderr.write(`${e.message}\n`); process.exit(1); });
  } else {
    const [mode, repoWebPath, sourceBranch] = args;
    if (!mode || !repoWebPath || !sourceBranch) {
      process.stderr.write('Usage: ship.mjs <staging|customer> <repoWebPath> <sourceBranch>\n');
      process.exit(1);
    }
    const { url, settings } = shipInfo({ mode, repoWebPath, sourceBranch });
    process.stdout.write(`Open MR (click to create):\n  ${url}\n\nThen set on the MR page:\n${renderSettings(settings)}\n`);
  }
}
