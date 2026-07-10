import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mrUrl, shipInfo } from './ship.mjs';

test('mrUrl encodes branch (# and /) and sets bracketed params', () => {
  const url = mrUrl({
    host: 'gitlab.unioss.jp',
    repoWebPath: 'unioss/FrontEnd',
    sourceBranch: 'feature/v3/#391',
    targetBranch: 'v3-develop-tps',
  });
  assert.equal(
    url,
    'https://gitlab.unioss.jp/unioss/FrontEnd/-/merge_requests/new?merge_request%5Bsource_branch%5D=feature%2Fv3%2F%23391&merge_request%5Btarget_branch%5D=v3-develop-tps',
  );
});

test('shipInfo staging pulls target/reviewer/options from config defaults', () => {
  const { url, settings } = shipInfo({
    cwd: process.cwd(), mode: 'staging', repoWebPath: 'unioss/AdminPage', sourceBranch: 'feature/v3/#1583',
  });
  assert.match(url, /target_branch%5D=v3-develop-tps$/);
  assert.equal(settings.reviewer, 'dat.pham');
  assert.equal(settings.assignee, 'nghia.truong');
  assert.equal(settings.deleteSourceBranch, false);
  assert.equal(settings.label, 'UNIOSS 3');
});

test('shipInfo customer uses v3-develop and delete-source ON', () => {
  const { url, settings } = shipInfo({
    cwd: process.cwd(), mode: 'customer', repoWebPath: 'unioss/FrontEnd', sourceBranch: 'feature/v3/#391',
  });
  assert.match(url, /target_branch%5D=v3-develop$/);
  assert.equal(settings.reviewer, 'r.yosimura');
  assert.equal(settings.deleteSourceBranch, true);
});

test('shipInfo throws on unknown mode', () => {
  assert.throws(() => shipInfo({ cwd: process.cwd(), mode: 'prod', repoWebPath: 'x/y', sourceBranch: 'b' }), /Unknown ship mode/);
});
