import { test } from 'node:test';
import assert from 'node:assert/strict';
import { protectedViolation } from './guard-protected-branch.mjs';

const PROTECTED = ['master', 'v3-master', 'develop', 'v3-develop', 'v3-develop-tps'];
const on = (branch, cmd) => protectedViolation(cmd, branch, PROTECTED);

test('blocks commit while a protected branch is checked out', () => {
  assert.deepEqual(on('v3-master', 'git commit -m "#1585 - Do the thing"'), { op: 'commit', branch: 'v3-master' });
});

test('blocks a bare push from a protected branch', () => {
  assert.deepEqual(on('v3-develop', 'git push'), { op: 'push', branch: 'v3-develop' });
});

test('blocks an explicit push to a protected branch from a feature branch', () => {
  assert.deepEqual(on('feature/v3/#1585', 'git push origin v3-develop-tps'), { op: 'push', branch: 'v3-develop-tps' });
});

test('blocks a force push to a protected branch', () => {
  assert.deepEqual(on('feature/v3/#1585', 'git push --force origin master'), { op: 'push', branch: 'master' });
});

test('blocks a refspec push whose destination is protected', () => {
  assert.deepEqual(on('feature/v3/#1585', 'git push origin HEAD:v3-master'), { op: 'push', branch: 'v3-master' });
});

test('blocks rebase/reset/revert/cherry-pick on a protected branch', () => {
  for (const op of ['rebase', 'reset --hard origin/master', 'revert HEAD', 'cherry-pick abc123']) {
    assert.ok(on('v3-master', `git ${op}`), `expected ${op} to be blocked`);
  }
});

test('blocks a write hidden later in a chained command', () => {
  assert.deepEqual(
    on('v3-master', 'cd AdminPage && git add -A && git commit -m x'),
    { op: 'commit', branch: 'v3-master' },
  );
});

test('blocks git -C <dir> commit on a protected branch', () => {
  assert.deepEqual(on('master', 'git -C submodules/common-helper commit -m x'), { op: 'commit', branch: 'master' });
});

// ── Must NOT block: the documented coder flow runs on v3-master ──────────────
test('allows the documented Step 0 flow on the protected base branch', () => {
  assert.equal(on('v3-master', 'git fetch origin && git checkout v3-master && git pull'), null);
});

test('allows checkout, fetch, pull, and reads on a protected branch', () => {
  for (const cmd of ['git checkout v3-master', 'git fetch origin', 'git pull', 'git status', 'git log --oneline', 'git diff']) {
    assert.equal(on('v3-master', cmd), null, `expected "${cmd}" to be allowed`);
  }
});

test('allows cutting a feature branch off a protected one', () => {
  assert.equal(on('v3-master', 'git checkout -b feature/v3/#1585'), null);
});

test('allows commit and push on a feature branch', () => {
  assert.equal(on('feature/v3/#1585', 'git commit -m "#1585 - x"'), null);
  assert.equal(on('feature/v3/#1585', 'git push -u origin feature/v3/#1585'), null);
});

test('allows merging a protected branch INTO a feature branch (the customer ship flow)', () => {
  assert.equal(on('feature/v3/#1585', 'git fetch origin && git merge origin/v3-master'), null);
});

test('ignores non-git commands that merely mention a protected name', () => {
  assert.equal(on('v3-master', 'echo "deploying to v3-master"'), null);
});
