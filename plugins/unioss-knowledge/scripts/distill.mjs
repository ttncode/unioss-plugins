const PRAISE = /(thank|great|good\s+job|nice|helpful|apprecia|perfect|excellent|resolved|works? (now|well))/i;
const CRITICISM = /(broken|bug|wrong|frustrat|slow|error|fail|not working|disappoint|complain|still|again)/i;

export function estimateTokens(text) { return Math.ceil((text || '').length / 4); }

export function truncateToCap(text, capTokens) {
  const capChars = capTokens * 4;
  if (text.length <= capChars) return text;
  return text.slice(0, capChars).replace(/\n[^\n]*$/, '\n');
}

export function splitSentiment(observations) {
  const praise = [], criticism = [];
  for (const o of observations) {
    const body = o.body || '';
    if (PRAISE.test(body)) praise.push({ body: body.slice(0, 200), source: o.source });
    else if (CRITICISM.test(body)) criticism.push({ body: body.slice(0, 200), source: o.source });
  }
  return { praise, criticism };
}

const bullets = (arr, map) => (arr.length ? arr.map(map) : ['- (none yet)']);

export function renderSentiment({ praise, criticism }, periodKey) {
  return [
    `# Customer sentiment — ${periodKey}`,
    '', '## Praise',
    ...bullets(praise, (p) => `- ${p.body}  (${p.source})`),
    '', '## Criticism',
    ...bullets(criticism, (c) => `- ${c.body}  (${c.source})`),
    '',
  ].join('\n');
}

export function renderGlobal({ focus = [], rules = [], friction = [], updated, sentimentAgeDays }, capTokens = 1200) {
  const lines = [
    '# UNIOSS Knowledge — read before any ticket',
    `_Updated ${updated ?? '—'} · sentiment ${sentimentAgeDays ?? '?'}d old_`,
    '', '## Customer focus this month', ...bullets(focus, (f) => `- ${f}`),
    '', '## Top active pitfalls (approved rules)', ...bullets(rules, (r) => `- ${r}`),
    '', '## Current friction (this week)', ...bullets(friction, (f) => `- ${f}`),
    '',
  ];
  return truncateToCap(lines.join('\n'), capTokens);
}
