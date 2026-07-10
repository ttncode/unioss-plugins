#!/usr/bin/env node
// Emit a clickable file:// markdown link for a pipeline artifact path.
// The bare '#' in ticket dirs (AP#1583) breaks terminal linkifiers, so encode it.
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export function fileLink(path, { label, cwd = process.cwd() } = {}) {
  const abs = resolve(cwd, path);
  // encodeURI leaves '/' intact and encodes spaces; it does NOT encode '#', so do that explicitly.
  const encoded = encodeURI(abs).replace(/#/g, '%23');
  const text = label ?? basename(path.replace(/\/+$/, '')) ?? abs;
  return `[${text}](file://${encoded})`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [path, label] = process.argv.slice(2);
  if (!path) { process.stderr.write('Usage: link.mjs <path> [label]\n'); process.exit(1); }
  process.stdout.write(fileLink(path, label ? { label } : {}) + '\n');
}
