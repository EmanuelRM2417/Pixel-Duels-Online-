import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const wrangler = fs.readFileSync(new URL('./wrangler.test.toml', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8');

test('all test routes run through worker before Assets', () => {
  assert.match(wrangler, /\brun_worker_first\s*=\s*true\b/);
});

test('worker resolves editor directory to editor index asset', () => {
  assert.match(worker, /url\.pathname === "\/editor" \|\| url\.pathname === "\/editor\/"/);
  assert.match(worker, /assetUrl\.pathname = "\/editor\/index\.html"/);
});

test('health endpoint identifies test worker', () => {
  assert.match(worker, /worker:\s*"universal-duels-test"/);
  assert.match(worker, /version:\s*"alpha-0\.1-editor-2026-10-02"/);
});
