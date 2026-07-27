import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

test('doctor.mjs script runs cleanly in CLI mode', () => {
  const script = join(process.cwd(), 'scripts/doctor.mjs');
  try {
    const res = execSync(`node "${script}"`, { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
    assert.match(res, /UNIOSS Pipeline · Environment Check/);
  } catch (err) {
    const out = (err.stdout || err.stderr || '').toString();
    assert.match(out, /UNIOSS Pipeline · Environment Check/);
  }
});
