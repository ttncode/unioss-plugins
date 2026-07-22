// Round-path math for the UNIOSS pipeline. A round is `<ticketDir>/round-N`.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROUND_RE = /^round-(\d+)$/;

export function listRounds(ticketDir) {
  if (!existsSync(ticketDir)) return [];
  return readdirSync(ticketDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && ROUND_RE.test(e.name))
    .map((e) => Number(e.name.match(ROUND_RE)[1]))
    .sort((a, b) => a - b);
}

export function latestRoundNum(ticketDir) {
  const rounds = listRounds(ticketDir);
  return rounds.length ? rounds[rounds.length - 1] : 0;
}

export function roundDir(ticketDir, n) {
  return join(ticketDir, `round-${n}`);
}

export function planFilesForRound(ticketDir, n) {
  try {
    return readdirSync(roundDir(ticketDir, n))
      .filter((name) => /implementation/i.test(name) && name.endsWith('.md'))
      .map((name) => join(roundDir(ticketDir, n), name));
  } catch {
    return [];
  }
}
