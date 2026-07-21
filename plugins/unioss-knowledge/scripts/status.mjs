import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveConfig } from './config.mjs';
import { knowledgeDir, readIndex, stalenessDays } from './store.mjs';

export function runStatus(cwd = process.cwd(), now = new Date()) {
  const { artifactRoot } = resolveConfig(cwd);
  const dir = knowledgeDir(cwd, artifactRoot);
  if (!existsSync(dir)) return 'Knowledge store not initialized. Run /unioss-knowledge-today or /unioss-knowledge-refresh.';
  const idx = readIndex(dir);
  const layers = ['daily', 'weekly', 'monthly', 'sentiment'];
  const lines = ['UNIOSS knowledge status:'];
  for (const l of layers) {
    const age = stalenessDays(idx, l, now);
    lines.push(`- ${l}: ${age == null ? 'never run' : age + 'd ago'}`);
  }
  const staged = join(dir, 'rules', 'staged.md');
  const pending = existsSync(staged) ? (readFileSync(staged, 'utf8').match(/^- /gm) || []).length : 0;
  lines.push(`- staged rules pending approval: ${pending}`);
  return lines.join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) console.log(runStatus());
