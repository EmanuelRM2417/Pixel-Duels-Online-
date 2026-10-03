import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = fs.readFileSync(new URL('./wrangler.test.toml', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('./worker.js', import.meta.url), 'utf8');

test('editor routes run through worker before Assets', () => {
  assert.match(config, /run_worker_first\s*=\s*\[[^\]]*"\/editor"[^\]]*"\/editor\/\*"[^\]]*\]/s);
});

test('worker resolves editor directory to editor index asset', () => {
  assert.match(worker, /url\.pathname === "\/editor" \|\| url\.pathname === "\/editor\/"/);
  assert.match(worker, /assetUrl\.pathname = "\/editor\/index\.html"/);
});
