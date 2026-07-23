import { moduleOf } from './crawl.mjs';

function prefixOf(issue) { return moduleOf(issue) === 'front-end' ? 'FE' : 'AP'; }

function firstLine(text) {
  const line = (text || '').split('\n').map((l) => l.trim()).find(Boolean);
  return line || '(no description)';
}

function why(issue) {
  const labels = (issue.labels || []).filter((l) => l !== 'UNIOSS 3');
  return labels.length ? labels.join(', ') : 'customer request';
}

function renderWwwh(issue) {
  return [
    `### ${prefixOf(issue)}#${issue.iid} — ${issue.title}`,
    `- **What:** ${firstLine(issue.description)}`,
    `- **Why:** ${why(issue)}`,
    `- **Who:** ${issue.author?.name ?? 'unknown'} · ${(issue.created_at || '').slice(0, 10)}`,
    `- **How:** ${issue.web_url}`,
    '',
  ].join('\n');
}

export function renderDailyDigest(issues, date) {
  const blocks = issues.map(renderWwwh);
  if (blocks.some((block) => !block || !block.trim())) {
    throw new Error('WWWH renderer produced an empty block — a ticket would be dropped');
  }
  const header = `# New UNIOSS 3 tickets — ${date}\n_${issues.length} ticket(s)_\n\n`;
  return header + (blocks.length ? blocks.join('\n') : '_No new tickets._\n');
}
