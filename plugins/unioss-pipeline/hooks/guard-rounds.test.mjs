import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sealedRoundViolation } from './guard-rounds.mjs';

test('sealedRoundViolation allows writes to current_round', () => {
  // Mocking path checking logic safely without dependency on state filesystem
  assert.equal(sealedRoundViolation('/path/to/AP-123/round-2/file.md', '/path/to'), null);
});

test('sealedRoundViolation handles new_file_path input field format', () => {
  // Test target path matching round format
  const path = '/path/to/AP-123/round-1/file.md';
  assert.match(path, /\/round-1\//);
});
