const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad2 = (n) => String(n).padStart(2, '0');

function startOfWeek(now) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}
function isoWeek(now) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round((d - firstThursday) / 604800000);
  return `${d.getUTCFullYear()}-W${pad2(week)}`;
}

export function parsePeriod(input, now = new Date()) {
  const s = String(input || '').trim().toLowerCase();
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  if (s === 'today') { const from = new Date(Date.UTC(y, m, now.getUTCDate())); return { key: from.toISOString().slice(0, 10), from, to: new Date(now) }; }
  if (s === 'week') { const from = startOfWeek(now); return { key: isoWeek(now), from, to: new Date(now) }; }
  if (s === 'month') { const from = new Date(Date.UTC(y, m, 1)); return { key: `${y}-${pad2(m + 1)}`, from, to: new Date(now) }; }
  if (s === 'year') { const from = new Date(Date.UTC(y, 0, 1)); return { key: `${y}`, from, to: new Date(now) }; }
  const mm = s.match(/^(\d{4})-(\d{2})$/);
  if (mm) { const yy = +mm[1], mo = +mm[2] - 1; return { key: s, from: new Date(Date.UTC(yy, mo, 1)), to: new Date(Date.UTC(yy, mo + 1, 1)) }; }
  const rg = s.match(/^(\d{4})-(\d{2})-(\d{2})\s*(?:\.\.|to)\s*(\d{4})-(\d{2})-(\d{2})$/);
  if (rg) {
    const from = new Date(Date.UTC(+rg[1], +rg[2] - 1, +rg[3]));
    const to = new Date(Date.UTC(+rg[4], +rg[5] - 1, +rg[6], 23, 59, 59));
    return { key: `${rg[1]}${rg[2]}${rg[3]}-${rg[4]}${rg[5]}${rg[6]}`, from, to };
  }
  return null;
}

export function detectIntent(question) {
  const q = String(question || '').toLowerCase();
  if (/prais|satisf|apprecia|complain|criticiz|dissatisf|unhappy|friction|attention/.test(q)) return 'sentiment';
  if (/focus|priorit|develop|working on|theme/.test(q)) return 'focus';
  if (/ticket|issue|overview|\bnew\b/.test(q)) return 'tickets';
  return 'general';
}

export function detectPeriod(question, now = new Date()) {
  const q = String(question || '').toLowerCase();
  const ym = q.match(/\b(20\d{2})-(\d{2})\b/);
  if (ym) return parsePeriod(`${ym[1]}-${ym[2]}`, now);
  const named = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/);
  if (named) { const mo = MONTHS.indexOf(named[1].slice(0, 3)); return parsePeriod(`${named[2]}-${pad2(mo + 1)}`, now); }
  if (/this week/.test(q)) return parsePeriod('week', now);
  if (/this month/.test(q)) return parsePeriod('month', now);
  if (/this year/.test(q)) return parsePeriod('year', now);
  return null;
}

export function periodOverlapsPresent(period, now = new Date()) {
  if (!period) return false;
  return period.to >= now || (now >= period.from && now <= period.to);
}
