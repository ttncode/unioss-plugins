import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mrUrl, shipInfo, mrCreatePayload, repoRef, mrTitle, resolveAssignee } from './ship.mjs';

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
  assert.equal(settings.assignee, null); // auto-detected at MR-create time, not here
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

test('mrCreatePayload maps ids, label and options into the POST body', () => {
  const body = mrCreatePayload({
    sourceBranch: 'feature/v3/#1584', targetBranch: 'v3-develop-tps', title: '#1584 - Do the thing',
    assigneeId: 7, reviewerId: 9, label: 'UNIOSS 3', removeSourceBranch: false, squash: false,
  });
  assert.deepEqual(body, {
    source_branch: 'feature/v3/#1584',
    target_branch: 'v3-develop-tps',
    title: '#1584 - Do the thing',
    assignee_ids: [7],
    reviewer_ids: [9],
    labels: 'UNIOSS 3',
    remove_source_branch: false,
    squash: false,
  });
});

test('mrCreatePayload emits empty id arrays when a user is unresolved', () => {
  const body = mrCreatePayload({ sourceBranch: 'b', targetBranch: 't', title: 'x' });
  assert.deepEqual(body.assignee_ids, []);
  assert.deepEqual(body.reviewer_ids, []);
});

test('resolveAssignee auto-detects the token owner when config assignee is unset', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, /\/api\/v4\/user$/); // the current-user endpoint, not a username lookup
    return { ok: true, json: async () => ({ id: 42, username: 'runner.user' }) };
  };
  try {
    const result = await resolveAssignee({ ship: { assignee: null } }, 'gitlab.unioss.jp', 'tok');
    assert.deepEqual(result, { id: 42, username: 'runner.user' });
  } finally {
    globalThis.fetch = orig;
  }
});

test('resolveAssignee honors an explicit config assignee over the token owner', async () => {
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, /\/api\/v4\/users\?username=someone/); // looks up by username
    return { ok: true, json: async () => [{ id: 7 }] };
  };
  try {
    const result = await resolveAssignee({ ship: { assignee: 'someone' } }, 'gitlab.unioss.jp', 'tok');
    assert.deepEqual(result, { id: 7, username: 'someone' });
  } finally {
    globalThis.fetch = orig;
  }
});

test('repoRef maps module keys to project id + web path', () => {
  assert.deepEqual(repoRef(process.cwd(), 'admin-page'), { id: 32, webPath: 'unioss/AdminPage' });
  assert.deepEqual(repoRef(process.cwd(), 'front-end'), { id: 31, webPath: 'unioss/FrontEnd' });
});

test('repoRef resolves the submodule repos', () => {
  assert.deepEqual(repoRef(process.cwd(), 'common-helper'), { id: 18, webPath: 'unioss/common-helper' });
  assert.deepEqual(repoRef(process.cwd(), 'common-models'), { id: 19, webPath: 'unioss/common-models' });
});

test('repoRef rejects the old camelCase keys rather than silently resolving', () => {
  assert.throws(() => repoRef(process.cwd(), 'adminPage'), /Unknown repo key/);
});

test('mrTitle is fixed: Merge <branch> into <target>', () => {
  assert.equal(mrTitle('feature/v3/#1585', 'v3-develop-tps'), 'Merge feature/v3/#1585 into v3-develop-tps');
  assert.equal(mrTitle('feature/v3/AdminPage#1585', 'v3-develop'), 'Merge feature/v3/AdminPage#1585 into v3-develop');
});

test('repoRef throws on unknown repo key', () => {
  assert.throws(() => repoRef(process.cwd(), 'nope'), /Unknown repo key/);
});
