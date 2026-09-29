import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectApp } from '../scripts/doctor.mjs';
test('compatibility rejects a new Desktop or Harness instead of claiming universal support', async () => {
  const root = await mkdtemp(join(tmpdir(), 'huaxue-test-'));
  try {
    await mkdir(join(root, 'node_modules/@deepseek-ai/dsh'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({version:'0.10.0-test.20260927'}));
    await writeFile(join(root, 'node_modules/@deepseek-ai/dsh/package.json'), JSON.stringify({version:'0.1.7-rc.2'}));
    assert.equal((await inspectApp(root)).supported, true);
    await writeFile(join(root, 'package.json'), JSON.stringify({version:'0.9.0'}));
    assert.equal((await inspectApp(root)).supported, false);
    await writeFile(join(root, 'package.json'), JSON.stringify({version:'0.11.0'}));
    assert.equal((await inspectApp(root)).supported, false);
    await writeFile(join(root, 'package.json'), JSON.stringify({version:'0.10.0-test.20260927'}));
    await writeFile(join(root, 'node_modules/@deepseek-ai/dsh/package.json'), JSON.stringify({version:'0.1.6-alpha.2'}));
    assert.equal((await inspectApp(root)).supported, false);
    await writeFile(join(root, 'node_modules/@deepseek-ai/dsh/package.json'), JSON.stringify({version:'0.2.0'}));
    assert.equal((await inspectApp(root)).supported, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
