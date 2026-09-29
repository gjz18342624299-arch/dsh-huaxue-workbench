import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFacade, WORKBENCH_ID, LEGACY_ID } from '../src/facade.js';

function fixture({ active = null, added = [WORKBENCH_ID], sessionBindings = {}, items = [], byId = {}, legacy = {} } = {}) {
  const calls = { newSession: [], create: [], retain: [], open: [], clear: 0, select: [], mutations: [] };
  const host = {
    getSnapshot: () => ({ state: { active, added, sessionBindings }, ready: true, error: '' }),
    subscribe: () => () => {},
    newSession: async workspaceId => { calls.newSession.push(workspaceId); return 'sid-official'; },
    add: async id => { if (!added.includes(id)) added.push(id); },
    leave: async () => { calls.left = true; },
    run: p => { p.catch(() => {}); }
  };
  const ctx = {
    sessions: {
      list: { subscribe: () => () => {}, getSnapshot: () => ({ ids: Object.keys(byId), byId, phase: 'ready' }) },
      create: async opts => { calls.create.push(opts); return 'sid-plain'; },
      retain: (sid, opts) => { calls.retain.push([sid, opts]); return { ready: Promise.resolve(), release() {} }; },
      binding: sid => ({ sessionId: sid, session: { eventSource: null }, eventSource: null })
    },
    workspaces: {
      list: { subscribe: () => () => {}, getSnapshot: () => ({ items, archivedSessionIds: [] }) },
      archiveSession: async id => { calls.archived = id; },
      create: async input => ({ ok: true, value: { workspace: { workspaceId: 'ws-new', ...input } } })
    },
    uiWorkspace: {
      openSession: sid => calls.open.push(sid),
      clearMain: () => { calls.clear++; },
      archiveSession: async id => { calls.archivedUi = id; },
      pickDirectory: async () => null
    },
    layout: { selectPanel: () => {}, beginNavigation: () => ({ aborted: false }) },
    remote: {
      agentPresets: { select: async (sid, preset) => { calls.select.push([sid, preset]); return { ok: true }; } },
      $on: () => () => {}
    },
    emit: () => {}
  };
  const api = {
    describe: async () => ({ namespaces: [{ ns: 'huaxue-workbench', revision: 1, value: { lastMemberId: 'ning', sessions: {} } }] }),
    mutate: async (ns, ops) => { calls.mutations.push([ns, ops]); return { ns, revision: 2, value: {} }; },
    subscribe: () => () => {}
  };
  const facade = createFacade(ctx, host, api);
  facade.workbenches.setLegacyBindings(legacy);
  return { facade, calls };
}

test('facade maps official ownership to the local contract id', () => {
  const { facade } = fixture({ sessionBindings: { s1: WORKBENCH_ID, s2: 'other/wb' }, legacy: { s3: 'huaxue', s4: 'seo' } });
  const snap = facade.workbenches.getSnapshot();
  assert.deepEqual(snap.bindings, { s1: 'huaxue', s3: 'huaxue' });
});

test('facade maps active state only for this workbench', () => {
  assert.equal(fixture({ active: WORKBENCH_ID }).facade.workbenches.getSnapshot().activeId, 'huaxue');
  assert.equal(fixture({ active: 'other/wb' }).facade.workbenches.getSnapshot().activeId, '');
  assert.equal(fixture({ active: null }).facade.workbenches.getSnapshot().activeId, '');
});

test('sessions.list derives current from the mainView retention', () => {
  const { facade } = fixture({ byId: { a: { id: 'a', retainedBy: {} }, b: { id: 'b', retainedBy: { mainView: 1 } } } });
  assert.equal(facade.sessionsList.getSnapshot().current, 'b');
});

test('foreground create binds through the official host, background stays local and retained', async () => {
  const items = [{ workspaceId: 'ws1', sessionIds: [] }];
  const fg = fixture({ items });
  const sid1 = await fg.facade.workbenches.create({ workspaceId: 'ws1' });
  assert.equal(sid1, 'sid-official');
  assert.deepEqual(fg.calls.newSession, ['ws1']);
  assert.equal(fg.calls.mutations.length, 1);
  const bg = fixture({ items });
  const sid2 = await bg.facade.workbenches.create({ workspaceId: 'ws1', background: true });
  assert.equal(sid2, 'sid-plain');
  assert.deepEqual(bg.calls.create, [{ workspaceId: 'ws1' }]);
  assert.deepEqual(bg.calls.retain.map(([sid]) => sid), ['sid-plain']);
});

test('create falls back to the workspace preference and rejects without one', async () => {
  const items = [{ workspaceId: 'ws1', sessionIds: [] }];
  const f = fixture({ items });
  f.facade.workbenches.setWorkspace('ws1');
  await f.facade.workbenches.create({});
  assert.deepEqual(f.calls.newSession, ['ws1']);
  await assert.rejects(fixture({ items: [] }).facade.workbenches.create({}), /工作区/);
});

test('workspaces.create unwraps the remote result', async () => {
  const { facade } = fixture();
  const ws = await facade.runtime.workspaces.create({ path: 'D:/x' });
  assert.equal(ws.workspaceId, 'ws-new');
});

test('coverConversation toggles the conversation root and publishes', () => {
  const { facade } = fixture();
  const root = { inert: false, style: {} };
  facade.workbenches.setRoot(root);
  facade.workbenches.coverConversation('huaxue', true);
  assert.equal(root.inert, true);
  assert.equal(root.style.visibility, 'hidden');
  facade.workbenches.coverConversation('huaxue', false);
  assert.equal(root.inert, false);
  assert.equal(root.style.visibility, '');
});

test('businessState memoizes per id', () => {
  const { facade } = fixture();
  const a = facade.workbenches.businessState('huaxue-game', () => ({ n: 1 }));
  a.n = 2;
  assert.equal(facade.workbenches.businessState('huaxue-game', {}), a);
  assert.equal(facade.workbenches.businessState('huaxue-game', {}).n, 2);
});
