import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFacade, WORKBENCH_ID } from '../src/facade.js';

// Harness 0.1.7 ships an archived-session-gate: every agent/pre-step of an archived
// session is rejected and the turn ends with reason.kind === 'blocked'. The game
// flow therefore must unarchive before prompting and only park sessions afterwards.
test('game send unarchives the session before prompting and no longer archives right after', async () => {
  const source = await readFile(new URL('../src/business-client.js', import.meta.url), 'utf8');
  const send = source.slice(source.indexOf('async function send()'), source.indexOf('async function stop()'));
  assert.ok(send.includes('unarchiveSession(id)'), 'send() must unarchive an archived game session');
  assert.ok(send.indexOf('unarchiveSession(id)') < send.indexOf("session.prompt("), 'unarchive must happen before the prompt');
  assert.ok(!send.includes('archiveSession(id)') || !/if \(!sid\) await runtime\.workspaces\.archiveSession\(id\)/.test(send), 'send() must not archive the session right after the first prompt');
  assert.match(source, /reason\?\.kind === 'blocked'/, 'gameTranscript must surface blocked turns');
  assert.match(source, /liveGameSessions\.has\(id\)/, 'isolateGameSessions must skip live game sessions');
  // After a restart an archived game session has no client scope; retain before binding.
  assert.ok(send.indexOf('runtime.sessions.retain?.(id)') !== -1 && send.indexOf('runtime.sessions.retain?.(id)') < send.indexOf('runtime.sessions.binding(id)'), 'send() must retain the session before reading its binding');
  assert.match(source, /runtime\.sessions\.retain\?\.\(sid\)/, 'the session effect must retain a reopened record');
});

test('facade exposes unarchiveSession on the workspaces surface', async () => {
  const calls = {};
  const ctx = {
    sessions: { list: { subscribe: () => () => {}, getSnapshot: () => ({ ids: [], byId: {}, phase: 'ready' }) }, create: async () => 'sid', retain: () => ({ ready: Promise.resolve(), release() {} }), binding: () => undefined },
    workspaces: { list: { subscribe: () => () => {}, getSnapshot: () => ({ items: [], archivedSessionIds: ['s1'] }) }, archiveSession: async id => { calls.archived = id; }, unarchiveSession: async id => { calls.unarchived = id; }, create: async () => ({ ok: true, value: {} }) },
    uiWorkspace: { openSession() {}, clearMain() {}, pickDirectory: async () => null },
    layout: { selectPanel() {}, beginNavigation: () => ({ aborted: false }) },
    remote: { agentPresets: { select: async () => ({ ok: true }) }, $on: () => () => {} },
    emit() {}
  };
  const host = { getSnapshot: () => ({ state: { active: null, added: [WORKBENCH_ID], sessionBindings: {} }, ready: true, error: '' }), subscribe: () => () => {}, newSession: async () => 'sid', add: async () => {}, leave: async () => {}, run: p => { p.catch(() => {}); } };
  const api = { describe: async () => ({ namespaces: [] }), mutate: async () => ({}), subscribe: () => () => {} };
  const { runtime } = createFacade(ctx, host, api);
  await runtime.workspaces.unarchiveSession('s1');
  assert.equal(calls.unarchived, 's1');
  // Falls back to uiWorkspace when the workspaces surface lacks the method.
  delete ctx.workspaces.unarchiveSession;
  ctx.uiWorkspace.unarchiveSession = async id => { calls.unarchivedUi = id; };
  await runtime.workspaces.unarchiveSession('s2');
  assert.equal(calls.unarchivedUi, 's2');
});
