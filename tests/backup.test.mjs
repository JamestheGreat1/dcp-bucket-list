import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const from = html.indexOf('function exportProgress(){');
const to = html.indexOf('function resetProgress(){', from);
assert(from >= 0 && to > from, 'Backup functions must remain discoverable');
const backupCode = html.slice(from, to);

function makeBackupHarness(confirmResult = true) {
  const result = { alerts: [], confirms: [], writes: [], timeouts: [], clicks: 0, removed: false, blob: null, revoked: [] };
  const anchor = {
    href: '', download: '',
    click() { result.clicks++; },
    remove() { result.removed = true; }
  };
  const ctx = vm.createContext({
    Date, JSON, Set, Object,
    Blob: class { constructor(parts) { result.blob = parts.join(''); } },
    URL: { createObjectURL: () => 'blob:progress', revokeObjectURL: value => result.revoked.push(value) },
    document: { createElement: () => anchor, body: { appendChild: node => { assert.equal(node, anchor); } } },
    FileReader: class { readAsText(file) { this.result = file.contents; this.onload(); } },
    setTimeout: (fn, delay) => result.timeouts.push({ fn, delay }),
    confirm: message => { result.confirms.push(message); return confirmResult; },
    alert: message => result.alerts.push(message),
    toast: () => {},
    rearmIncompleteCategories: () => {},
    syncMetaAchievements: () => {},
    syncSecretAchievements: () => {},
    renderSections: () => {},
    updateAll: () => {},
    applyFilters: () => {}
  });
  const initial = [
    "let state = {'old-quest': true};",
    "let unlocks = {'old-achievement': true};",
    "let categoryHistory = {'old-category': { count: 1, latest: '2026-10-01' }};",
    "function allItems(){return [{id:'test-a'}, {id:'test-b'}];}",
    "function save(){globalThis.writes.push('state');}",
    "function saveUnlocks(){globalThis.writes.push('unlocks');}",
    "function saveCategoryHistory(){globalThis.writes.push('history');}"
  ].join('\n');
  ctx.writes = result.writes;
  vm.runInContext(initial + '\n' + backupCode + '\n' +
    'globalThis.api={exportProgress,importProgress,snapshot:()=>({state,unlocks,categoryHistory})}', ctx);
  return { result, api: ctx.api, snapshot: () => JSON.parse(JSON.stringify(ctx.api.snapshot())) };
}

test('JSON export includes all save dimensions and gives mobile browser time', () => {
  const { result, api } = makeBackupHarness();
  api.exportProgress();
  const data = JSON.parse(result.blob);
  assert.equal(data.version, 4);
  assert.deepEqual(data.completed, ['old-quest']);
  assert.deepEqual(data.unlocks, ['old-achievement']);
  assert.equal(data.categoryHistory['old-category'].count, 1);
  assert.equal(result.clicks, 1);
  assert.equal(result.timeouts[0].delay, 30000);
  assert.deepEqual(result.revoked, []);
  result.timeouts[0].fn();
  assert.equal(result.removed, true);
  assert.deepEqual(result.revoked, ['blob:progress']);
});

test('confirmed import restores valid quests and achievements and ignores unknown quests', () => {
  const { result, api, snapshot } = makeBackupHarness();
  api.importProgress({ contents: JSON.stringify({
    version: 4, completed: ['test-a', 'unknown-future-quest', 'test-a'],
    unlocks: ['earned'], categoryHistory: { parks: { count: 2, latest: '2026-09-01' } }
  }) });
  assert.equal(result.confirms.length, 1);
  assert.match(result.confirms[0], /replaces your existing progress/i);
  assert.deepEqual(snapshot().state, { 'test-a': true });
  assert.deepEqual(snapshot().unlocks, { earned: true });
  assert.equal(snapshot().categoryHistory.parks.count, 2);
  assert.deepEqual(result.writes, ['state', 'unlocks', 'history']);
});

test('cancelled or malformed import never touches existing progress', () => {
  const cancelled = makeBackupHarness(false);
  const original = cancelled.snapshot();
  cancelled.api.importProgress({ contents: '{"completed":["test-b"]}' });
  assert.deepEqual(cancelled.snapshot(), original);
  assert.equal(cancelled.result.writes.length, 0);

  const invalid = makeBackupHarness();
  invalid.api.importProgress({ contents: '{"completed":"not-an-array"}' });
  assert.deepEqual(invalid.snapshot().state, { 'old-quest': true });
  assert.equal(invalid.result.confirms.length, 0);
  assert.equal(invalid.result.writes.length, 0);
  assert.equal(invalid.result.alerts.length, 1);
});

function makeWorkerHarness() {
  const handlers = {};
  const result = { cached: [], deleted: [] };
  const fallback = { offline: true };
  const caches = {
    async open() { return { addAll: async list => result.cached.push(...list) }; },
    async keys() { return ['unrelated-pwa-cache', 'dcp-bucket-list-v13', 'dcp-bucket-list-v15']; },
    async delete(key) { result.deleted.push(key); },
    async match() { return fallback; }
  };
  vm.runInNewContext(sw, {
    caches,
    self: {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      skipWaiting() {},
      clients: { async claim() {} }
    },
    fetch: async () => { throw new Error('offline'); }
  });
  return { handlers, result, fallback };
}

test('offline shell precaches the app and activation does not delete other app caches', async () => {
  const { handlers, result } = makeWorkerHarness();
  let task;
  handlers.install({ waitUntil(promise) { task = promise; } });
  await task;
  for (const item of ['./', './index.html', './manifest.webmanifest', './icon-192.png']) {
    assert(result.cached.includes(item));
  }
  handlers.activate({ waitUntil(promise) { task = promise; } });
  await task;
  assert.deepEqual(result.deleted, ['dcp-bucket-list-v13']);
});

test('offline navigation falls back to cached index', async () => {
  const { handlers, fallback } = makeWorkerHarness();
  let task;
  handlers.fetch({
    request: { method: 'GET', mode: 'navigate', headers: { get: () => 'text/html' } },
    respondWith(promise) { task = promise; }
  });
  assert.equal(await task, fallback);
});
