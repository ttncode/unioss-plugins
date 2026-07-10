#!/usr/bin/env node
// Build a pre-filled GitLab "new merge request" URL + the settings the URL can't
// carry (assignee/reviewer/labels/merge options). No API writes — the human clicks.
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

function renderSettings(s) {
  const onOff = (b) => (b ? 'ON' : 'OFF');
  return [
    `  Assignee:              @${s.assignee}`,
    `  Reviewer:              @${s.reviewer}`,
    `  Labels:                ${s.label} (only if it exists on the project)`,
    `  Delete source branch:  ${onOff(s.deleteSourceBranch)}`,
    `  Squash commits:        ${onOff(s.squash)}`,
  ].join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [mode, repoWebPath, sourceBranch] = process.argv.slice(2);
  if (!mode || !repoWebPath || !sourceBranch) {
    process.stderr.write('Usage: ship.mjs <staging|customer> <repoWebPath> <sourceBranch>\n');
    process.exit(1);
  }
  const { url, settings } = shipInfo({ mode, repoWebPath, sourceBranch });
  process.stdout.write(`Open MR (click to create):\n  ${url}\n\nThen set on the MR page:\n${renderSettings(settings)}\n`);
}
