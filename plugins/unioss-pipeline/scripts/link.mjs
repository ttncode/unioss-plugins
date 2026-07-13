#!/usr/bin/env node
// Emit a clickable file:// markdown link for a pipeline artifact path.
// The bare '#' in ticket dirs (AP#1583) breaks terminal linkifiers, so encode it.
// Under WSL, emit a file://wsl.localhost/<distro> URL a Windows-side IDE can open.
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

function readProcVersion() {
  try { return readFileSync('/proc/version', 'utf8'); } catch { return ''; }
}

function wslDistro(procVersion, env) {
  return (/microsoft/i.test(procVersion) && env.WSL_DISTRO_NAME) ? env.WSL_DISTRO_NAME : null;
}

export function fileLink(path, { label, cwd = process.cwd(), procVersion, env = process.env } = {}) {
  const abs = resolve(cwd, path);
  // encodeURI leaves '/' intact and encodes spaces; it does NOT encode '#', so do that explicitly.
  const encoded = encodeURI(abs).replace(/#/g, '%23');
  const text = label ?? basename(path.replace(/\/+$/, '')) ?? abs;
  const distro = wslDistro(procVersion ?? readProcVersion(), env);
  const url = distro ? `file://wsl.localhost/${distro}${encoded}` : `file://${encoded}`;
  return `[${text}](${url})`;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [path, label] = process.argv.slice(2);
  if (!path) { process.stderr.write('Usage: link.mjs <path> [label]\n'); process.exit(1); }
  process.stdout.write(fileLink(path, label ? { label } : {}) + '\n');
}
