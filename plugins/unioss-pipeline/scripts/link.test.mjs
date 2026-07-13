import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileLink } from './link.mjs';

// Force the native branch deterministically (no WSL) by passing empty env + procVersion.
const NATIVE = { env: {}, procVersion: '' };

test('native: encodes # as %23, resolves absolute, default label is basename', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/AP#1583_REVIEW.md', { cwd: '/ws', ...NATIVE });
  assert.equal(out, '[AP#1583_REVIEW.md](file:///ws/.walkthrough/AP%231583/round-1/AP%231583_REVIEW.md)');
});

test('native: no bare # remains in the url portion', () => {
  const out = fileLink('.walkthrough/AP#1583/round-1/', { cwd: '/ws', ...NATIVE });
  const url = out.slice(out.indexOf('(') + 1, -1);
  assert.ok(!url.includes('#'));
  assert.match(url, /%23/);
});

test('native: custom label is used verbatim', () => {
  const out = fileLink('/abs/UT_#1583_20260709_V1.txt', { label: 'full test run', ...NATIVE });
  assert.equal(out, '[full test run](file:///abs/UT_%231583_20260709_V1.txt)');
});

test('native: spaces encode to %20', () => {
  const out = fileLink('/abs/my file.md', { ...NATIVE });
  assert.match(out, /file:\/\/\/abs\/my%20file\.md/);
});

test('wsl: emits file://wsl.localhost/<distro> when under WSL', () => {
  const out = fileLink('/home/ttndev/ws/.walkthrough/AP#1/round-1/x.md', {
    cwd: '/home/ttndev/ws',
    env: { WSL_DISTRO_NAME: 'Ubuntu' },
    procVersion: 'Linux version 5.15 microsoft-standard-WSL2',
  });
  assert.equal(out, '[x.md](file://wsl.localhost/Ubuntu/home/ttndev/ws/.walkthrough/AP%231/round-1/x.md)');
});

test('wsl: not triggered when procVersion lacks microsoft even if distro var set', () => {
  const out = fileLink('/a/b.md', { cwd: '/a', env: { WSL_DISTRO_NAME: 'Ubuntu' }, procVersion: 'Linux generic' });
  assert.equal(out, '[b.md](file:///a/b.md)');
});
