import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMrUrl, moduleKeyForRepo, parseTicketId, formatDiscussions } from './fetch-mr-feedback.mjs';

test('parseMrUrl extracts host, project path, and iid', () => {
  const r = parseMrUrl('https://gitlab.unioss.jp/unioss/AdminPage/-/merge_requests/3763');
  assert.deepEqual(r, {
    host: 'gitlab.unioss.jp',
    namespace: 'unioss',
    repo: 'AdminPage',
    projectPath: 'unioss/AdminPage',
    iid: 3763,
  });
});

test('parseMrUrl throws on a non-MR GitLab URL', () => {
  assert.throws(
    () => parseMrUrl('https://gitlab.unioss.jp/unioss/AdminPage/-/issues/1585'),
    /Not a GitLab merge request URL/,
  );
});

test('moduleKeyForRepo maps repo names to config module keys', () => {
  assert.equal(moduleKeyForRepo('AdminPage'), 'admin-page');
  assert.equal(moduleKeyForRepo('FrontEnd'), 'front-end');
  assert.equal(moduleKeyForRepo('common-helper'), 'common-helper');
  assert.equal(moduleKeyForRepo('common-models'), 'common-models');
});

test('moduleKeyForRepo throws on an unknown repo', () => {
  assert.throws(() => moduleKeyForRepo('SomethingElse'), /Unknown repo in MR URL/);
});

test('parseTicketId reads the digits after # in origin and non-origin branch shapes', () => {
  assert.equal(parseTicketId('feature/v3/#1585'), '1585');
  assert.equal(parseTicketId('feature/v3/AdminPage#1585'), '1585');
});

test('parseTicketId returns null when the branch has no ticket id', () => {
  assert.equal(parseTicketId('v3-master'), null);
});

test('formatDiscussions lists unresolved and resolved threads with file:line and author', () => {
  const mr = {
    iid: 3763, projectPath: 'unioss/AdminPage',
    source_branch: 'feature/v3/#1585', target_branch: 'v3-develop-tps',
    state: 'opened', title: 'Merge feature/v3/#1585 into v3-develop-tps',
  };
  const discussions = [
    { notes: [{ system: false, author: { name: 'Dat Pham' }, resolvable: true, resolved: true, position: { new_path: 'a.php', new_line: 10 }, body: 'fixed already' }] },
    { notes: [{ system: false, author: { name: 'Dat Pham' }, resolvable: true, resolved: false, position: { new_path: 'b.php', new_line: 20 }, body: 'still open' }] },
    { notes: [{ system: true, body: 'changed the description' }] },
  ];
  const out = formatDiscussions(mr, discussions, ['a.php', 'b.php']);
  assert.match(out, /MR !3763 · unioss\/AdminPage · feature\/v3\/#1585 -> v3-develop-tps · state: opened/);
  assert.match(out, /THREAD 1 \[resolved\]/);
  assert.match(out, /file: a\.php:10/);
  assert.match(out, /THREAD 2 \[unresolved\]/);
  assert.match(out, /file: b\.php:20/);
  assert.doesNotMatch(out, /changed the description/);
  assert.match(out, /CHANGED FILES:\na\.php\nb\.php/);
});

test('formatDiscussions marks a non-resolvable (general) comment as not resolvable', () => {
  const mr = { iid: 1, projectPath: 'x/y', source_branch: 'feature/v3/#1', target_branch: 'v3-develop-tps', state: 'opened', title: 't' };
  const discussions = [{ notes: [{ system: false, author: { name: 'A' }, resolvable: false, resolved: false, position: null, body: 'general note' }] }];
  const out = formatDiscussions(mr, discussions, []);
  assert.match(out, /THREAD 1 \[not resolvable\]/);
  assert.match(out, /file: \(no file position\)/);
});

test('formatDiscussions reports no comments when every thread is system-only', () => {
  const mr = { iid: 1, projectPath: 'x/y', source_branch: 'feature/v3/#1', target_branch: 'v3-develop-tps', state: 'opened', title: 't' };
  const out = formatDiscussions(mr, [{ notes: [{ system: true, body: 'x' }] }], []);
  assert.match(out, /No review comments on this MR\./);
});
