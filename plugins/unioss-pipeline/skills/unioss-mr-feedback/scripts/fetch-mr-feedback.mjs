#!/usr/bin/env node
// Fetch a GitLab MR's discussions and print a formatted summary for
// /unioss-mr-feedback to reason over directly (no JSON parsing step).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const REPO_KEY_BY_NAME = {
  AdminPage: 'admin-page',
  FrontEnd: 'front-end',
  'common-helper': 'common-helper',
  'common-models': 'common-models',
};

const MR_URL_RE = /^https:\/\/([^/]+)\/([^/]+)\/([^/]+)\/-\/merge_requests\/(\d+)/;

export function parseMrUrl(url) {
  const m = MR_URL_RE.exec(url);
  if (!m) throw new Error(`Not a GitLab merge request URL: ${url}`);
  const [, host, namespace, repo, iid] = m;
  return { host, namespace, repo, projectPath: `${namespace}/${repo}`, iid: Number(iid) };
}

export function moduleKeyForRepo(repo) {
  const key = REPO_KEY_BY_NAME[repo];
  if (!key) throw new Error(`Unknown repo in MR URL: ${repo} (expected one of ${Object.keys(REPO_KEY_BY_NAME).join(', ')})`);
  return key;
}

const TICKET_ID_RE = /#(\d+)$/;

export function parseTicketId(sourceBranch) {
  const m = TICKET_ID_RE.exec(sourceBranch);
  return m ? m[1] : null;
}

function threadStatus(firstNote) {
  if (!firstNote.resolvable) return 'not resolvable';
  return firstNote.resolved ? 'resolved' : 'unresolved';
}

export function formatDiscussions(mr, discussions, changedFiles) {
  const lines = [
    `MR !${mr.iid} · ${mr.projectPath} · ${mr.source_branch} -> ${mr.target_branch} · state: ${mr.state}`,
    `title: ${mr.title}`,
    '',
  ];

  const threads = discussions
    .map((d) => d.notes.filter((n) => !n.system))
    .filter((notes) => notes.length > 0);

  if (threads.length === 0) {
    lines.push('No review comments on this MR.');
  }

  threads.forEach((notes, i) => {
    lines.push(`-- THREAD ${i + 1} [${threadStatus(notes[0])}] --`);
    for (const n of notes) {
      const loc = n.position ? `${n.position.new_path}:${n.position.new_line ?? n.position.old_line}` : '(no file position)';
      lines.push(`author: ${n.author?.name ?? 'Unknown'}`);
      lines.push(`file: ${loc}`);
      lines.push(`body: ${n.body}`);
      lines.push('');
    }
  });

  lines.push('CHANGED FILES:');
  for (const f of changedFiles) lines.push(f);

  return lines.join('\n');
}
