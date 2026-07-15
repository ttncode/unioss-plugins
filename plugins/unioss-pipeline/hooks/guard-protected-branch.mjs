#!/usr/bin/env node
// PreToolUse(Bash): block git commands that would WRITE to a protected branch.
//
// gitlab.protected was previously validated and then read by nobody — the rule
// lived only in prose. This enforces it.
//
// Reads, and moves that only change what is checked out, stay allowed: the
// documented coder flow is `git fetch && git checkout v3-master && git pull`,
// so checkout/pull/fetch on a protected branch MUST keep working. Only the
// operations REFERENCE forbids (commit, push, rebase, reset, revert,
// cherry-pick, merge) are blocked, and only when their target is protected.
import { execFileSync } from 'node:child_process';
import { resolveConfig } from '../scripts/config.mjs';

const WRITE_OPS = ['commit', 'push', 'rebase', 'reset', 'revert', 'cherry-pick', 'merge'];

const tokenize = (segment) => segment.trim().split(/\s+/).filter(Boolean);

// A command line may chain several commands; each is checked on its own.
const segments = (command) => command.split(/&&|\|\||;|\|/);

function gitOp(tokens) {
  const i = tokens.indexOf('git');
  if (i === -1) return null;
  let j = i + 1;
  // Skip global flags and their values: git -C <dir> commit …
  while (j < tokens.length && tokens[j].startsWith('-')) j += tokens[j] === '-C' ? 2 : 1;
  const op = tokens[j];
  return WRITE_OPS.includes(op) ? { op, rest: tokens.slice(j + 1) } : null;
}

// `git push [flags] [remote] [refspec]` — an explicit refspec names the branch
// being written, which may differ from the one checked out.
function pushTarget(rest) {
  const positional = rest.filter((t) => !t.startsWith('-'));
  if (positional.length < 2) return null; // no refspec → the current branch
  const spec = positional[1];
  const dst = spec.includes(':') ? spec.split(':').pop() : spec;
  return dst.replace(/^refs\/heads\//, '') || null;
}

export function protectedViolation(command, currentBranch, protectedList) {
  const isProtected = (b) => b && protectedList.includes(b);
  for (const seg of segments(command)) {
    const found = gitOp(tokenize(seg));
    if (!found) continue;
    const target = found.op === 'push' ? (pushTarget(found.rest) ?? currentBranch) : currentBranch;
    if (isProtected(target)) return { op: found.op, branch: target };
  }
  return null;
}

function currentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('guard-protected-branch.mjs');
if (isMain) {
  let raw = '';
  process.stdin.on('data', (c) => (raw += c));
  process.stdin.on('end', () => {
    let command = '';
    try { command = (JSON.parse(raw).tool_input || {}).command || ''; } catch { process.exit(0); }
    if (!command.includes('git')) process.exit(0);
    let violation = null;
    try {
      violation = protectedViolation(command, currentBranch(), resolveConfig().gitlab.protected);
    } catch {
      process.exit(0); // never block because the guard itself failed
    }
    if (violation) {
      process.stderr.write(
        `Blocked: \`git ${violation.op}\` targets the protected branch '${violation.branch}'.\n` +
        `Protected branches are read-only. Work on a feature/v3/... branch instead.\n`,
      );
      process.exit(2);
    }
    process.exit(0);
  });
}
