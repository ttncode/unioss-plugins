import { createHash } from 'node:crypto';
import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync, renameSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';

export function knowledgeDir(cwd, artifactRoot) { return join(cwd, artifactRoot, '.knowledge'); }
export function ensureDir(dir) { if (!existsSync(dir)) mkdirSync(dir, { recursive: true }); }

export function atomicWrite(path, content) {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, content);
  renameSync(tmp, path);
}

export function obsId(projectId, iid, noteId) {
  return createHash('sha1').update(`${projectId}:${iid}:${noteId}`).digest('hex');
}

export function appendObservations(dir, records) {
  const sentimentDir = join(dir, 'sentiment');
  ensureDir(sentimentDir);
  const file = join(sentimentDir, 'observations.jsonl');
  const seen = new Set();
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { seen.add(JSON.parse(line).id); } catch { /* skip corrupt line */ }
    }
  }
  const add = records.filter((r) => r.id && !seen.has(r.id));
  if (add.length === 0) return 0;
  appendFileSync(file, add.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return add.length;
}

export function readIndex(dir) {
  const f = join(dir, 'index.json');
  if (!existsSync(f)) return {};
  try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return {}; }
}
export function writeIndex(dir, obj) {
  ensureDir(dir);
  atomicWrite(join(dir, 'index.json'), JSON.stringify(obj, null, 2) + '\n');
}
export function touchLayer(dir, layer, now = new Date()) {
  const idx = readIndex(dir);
  idx[layer] = { lastRun: now.toISOString() };
  writeIndex(dir, idx);
  return idx;
}
export function stalenessDays(index, layer, now = new Date()) {
  const iso = index?.[layer]?.lastRun;
  if (!iso) return null;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
}

export function acquireLock(dir) {
  ensureDir(dir);
  const lock = join(dir, '.lock');
  if (existsSync(lock)) return false;
  writeFileSync(lock, String(process.pid));
  return true;
}
export function releaseLock(dir) {
  const lock = join(dir, '.lock');
  if (existsSync(lock)) unlinkSync(lock);
}
