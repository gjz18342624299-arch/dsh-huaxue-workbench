// Boot smoke test: execute the built client bundle the way the web runner
// does — ModuleLoader registration, cordis plugin activation with the
// declared inject list, and a real React mount of the custom frame — so a
// renderer-side failure ("web boot: entry did not activate") is caught here
// instead of tripping Desktop safe-mode again.
//
// Usage: node scripts/boot-smoke.mjs <path to resources/app.asar.unpacked>
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = process.argv[2];
if (!app) throw Error('Pass the DSH resources/app.asar.unpacked directory');
const requireFromApp = createRequire(pathToFileURL(app.replace(/[\\/]$/, '') + '/placeholder.js'));

const { JSDOM } = requireFromApp('jsdom');
const React = requireFromApp('react');
const ReactDOMClient = requireFromApp('react-dom/client');
const { Context } = await import(pathToFileURL(app + '/node_modules/@deepseek-ai/cordis/lib/index.js').href);

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://127.0.0.1/', pretendToBeVisual: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); } catch { /* Node already provides one */ }
globalThis.localStorage = dom.window.localStorage;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame ?? (fn => setTimeout(fn, 0));
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame ?? clearTimeout;
globalThis.getComputedStyle = dom.window.getComputedStyle;

const registry = new Map();
dom.window.__ModuleLoader__ = { load(def) { registry.set(def.id, def); } };
const iconStub = new Proxy({}, { get: () => () => null });
const requireMock = id => {
  if (id === 'react') return React;
  if (id === 'react-dom') return requireFromApp('react-dom');
  if (id === '@deepseek-ai/dsh-client-ui-primitives') return iconStub;
  throw Error('unexpected require: ' + id);
};

const bundle = await readFile(new URL('../client.js', import.meta.url), 'utf8');
vm.runInThisContext(bundle, { filename: 'client.js' });
const entry = registry.get('dsh-huaxue-workbench');
assert.ok(entry, 'bundle must register the entry module');
const module = entry.factory(requireMock);
assert.ok(Array.isArray(module.inject) && module.inject.includes('desktopWorkbenches'), 'entry must inject desktopWorkbenches');

// ---- minimal but faithful host services -------------------------------
const WORKBENCH_ID = 'gjz18342624299-arch/dsh-huaxue-workbench';
const listeners = { workbenches: new Set(), sessions: new Set(), workspaces: new Set() };
const fire = set => { for (const fn of [...set]) fn(); };
let wbState = { active: null, added: [], pinned: [], favorites: [], sessionBindings: {}, recentSessions: {}, notes: {} };
let wbSnapshot = { state: wbState, ready: true, error: '', catalog: [], installs: {}, pending: 0, marketOpen: false };
const registered = [];
const host = {
  getSnapshot: () => wbSnapshot,
  subscribe: fn => { listeners.workbenches.add(fn); return () => listeners.workbenches.delete(fn); },
  register(descriptor, Component) { registered.push({ descriptor, Component }); return () => {}; },
  async add(id) { if (!wbState.added.includes(id)) { wbState = { ...wbState, added: [...wbState.added, id], pinned: [...wbState.pinned, id] }; wbSnapshot = { ...wbSnapshot, state: wbState }; fire(listeners.workbenches); } },
  async leave() {},
  async newSession() { return 'session-smoke'; },
  run(p) { Promise.resolve(p).catch(() => {}); }
};
const sessionList = { ids: [], byId: {}, phase: 'ready', subagentsByParent: {}, jobsBySession: {} };
const sessions = {
  list: { getSnapshot: () => sessionList, subscribe: fn => { listeners.sessions.add(fn); return () => listeners.sessions.delete(fn); } },
  create: async () => 'session-bg',
  retain: () => ({ ready: Promise.resolve({}), release() {} }),
  binding: () => undefined
};
const workspaceList = { items: [{ workspaceId: 'ws-smoke', sessionIds: [], title: 'smoke', path: 'D:/smoke' }], archivedSessionIds: [] };
const workspaces = {
  list: { getSnapshot: () => workspaceList, subscribe: fn => { listeners.workspaces.add(fn); return () => listeners.workspaces.delete(fn); } },
  archiveSession: async () => {}, create: async input => ({ ok: true, value: { workspace: { workspaceId: 'ws-new', ...input } } })
};
const uiWorkspace = { openSession: () => {}, clearMain: () => {}, archiveSession: async () => {}, pickDirectory: async () => null };
const layout = { selectPanel: () => {}, beginNavigation: () => ({ aborted: false }) };
const settingsState = { namespaces: [{ ns: 'huaxue-workbench', revision: 1, value: { lastMemberId: 'ning', skin: { image: '', opacity: 0.15, position: 'center', fit: 'cover', filename: '' }, sessions: {} } }, { ns: 'dsh-workbenches', revision: 1, value: { bindings: {}, installed: { huaxue: true }, workspace: {} } }] };
const remote = {
  settings: {
    describe: async () => ({ ok: true, value: settingsState }),
    mutate: async (ns, ops) => {
      const row = settingsState.namespaces.find(r => r.ns === ns);
      for (const op of ops) {
        let obj = row.value;
        for (const key of op.path.slice(0, -1)) obj = obj[key] ??= {};
        obj[op.path.at(-1)] = op.value;
      }
      row.revision += 1;
      return { ok: true, value: { ns, revision: row.revision, value: row.value } };
    }
  },
  agentPresets: { select: async () => ({ ok: true }) },
  $on: () => () => {}
};

const ctx = new Context();
ctx.reflect.provide('desktopWorkbenches', host);
ctx.reflect.provide('sessions', sessions);
ctx.reflect.provide('workspaces', workspaces);
ctx.reflect.provide('uiWorkspace', uiWorkspace);
ctx.reflect.provide('layout', layout);
ctx.reflect.provide('remote', remote);
ctx.reflect.provide('remote.settings', remote.settings);
ctx.reflect.provide('remote.agentPresets', remote.agentPresets);

await ctx.plugin({ name: 'dsh-huaxue-workbench', inject: module.inject, apply: module.apply });
await new Promise(resolve => setTimeout(resolve, 50));

assert.equal(registered.length, 1, 'the workbench must register exactly once');
const { descriptor, Component } = registered[0];
assert.equal(descriptor.title, '花少2 · 花学工作台');
assert.equal(descriptor.customFrame, true);
assert.equal(descriptor.repository, 'https://github.com/gjz18342624299-arch/dsh-huaxue-workbench');

// React mount: inactive first (frame hidden), then active with no bound
// session (picker must render), then with a bound current session.
const container = document.createElement('div');
document.body.appendChild(container);
const root = ReactDOMClient.createRoot(container);
const flush = () => new Promise(resolve => setTimeout(resolve, 20));
const { act } = React;
await act(async () => { root.render(React.createElement(Component, { service: host, entry: { id: WORKBENCH_ID, ...descriptor }, active: false, conversation: null })); await flush(); });
assert.equal(container.querySelector('.hx-native-picker'), null, 'inactive frame renders nothing business-visible');
// An active custom frame implies the official state has this workbench active.
wbState = { ...wbState, active: WORKBENCH_ID, added: [WORKBENCH_ID], pinned: [WORKBENCH_ID] };
wbSnapshot = { ...wbSnapshot, state: wbState };
await act(async () => { root.render(React.createElement(Component, { service: host, entry: { id: WORKBENCH_ID, ...descriptor }, active: true, conversation: null })); await flush(); });
assert.ok(container.querySelector('.hx-native-picker'), 'active frame without a bound session shows the member picker');
assert.ok(container.querySelector('.hx-native-picker').textContent.includes('毛毛姐'), 'picker lists the personas');

// Bind a session and mark it current: the picker must give way to the frame.
wbState = { ...wbState, active: WORKBENCH_ID, added: [WORKBENCH_ID], pinned: [WORKBENCH_ID], sessionBindings: { s1: WORKBENCH_ID } };
wbSnapshot = { ...wbSnapshot, state: wbState };
sessionList.ids = ['s1'];
sessionList.byId = { s1: { id: 's1', retainedBy: { mainView: 1 } } };
await act(async () => { fire(listeners.workbenches); fire(listeners.sessions); await flush(); });
assert.equal(container.querySelector('.hx-native-picker'), null, 'a bound current session hides the picker');
const frame = container.querySelector('.hx-frame');
assert.ok(frame, 'custom frame wrapper exists');

root.unmount();
await ctx.fiber.dispose();
console.log('Client boot smoke PASS: module registers, picker renders, bound session switches to the conversation frame');
