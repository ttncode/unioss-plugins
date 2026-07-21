import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULTS = { host: 'gitlab.unioss.jp', workLabel: 'UNIOSS 3', artifactRoot: '.walkthrough' };

export function resolveConfig(cwd = process.cwd()) {
  const p = join(cwd, '.walkthrough', '.config', 'unioss.config.json');
  if (!existsSync(p)) return { ...DEFAULTS };
  let file;
  try { file = JSON.parse(readFileSync(p, 'utf8')); } catch { return { ...DEFAULTS }; }
  return {
    host: file.gitlab?.host ?? DEFAULTS.host,
    workLabel: file.gitlab?.workLabel ?? file.ship?.label ?? DEFAULTS.workLabel,
    artifactRoot: file.artifactRoot ?? DEFAULTS.artifactRoot,
  };
}
