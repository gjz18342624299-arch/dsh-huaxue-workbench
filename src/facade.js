// Client adapter: exposes the local workbench contract v1 (what the business
// component was built against) on top of the official `desktopWorkbenches`
// host shipped by DSH Desktop 0.10.x / Harness 0.1.6.
//
// Only this file knows about the official host; the business UI stays
// unchanged. Session ownership is owned by the official host and persisted by
// it; the legacy `dsh-workbenches` settings namespace is read solely to keep
// pre-migration sessions working.

export const WORKBENCH_REPOSITORY = 'https://github.com/gjz18342624299-arch/dsh-huaxue-workbench';
export const WORKBENCH_ID = 'gjz18342624299-arch/dsh-huaxue-workbench';
export const LEGACY_NAMESPACE = 'dsh-workbenches';
export const LEGACY_ID = 'huaxue';

export function createFacade(ctx, host, api) {
  const listeners = new Set();
  const covered = new Set();
  const businessStore = new Map();
  const retained = new Map();
  let root = null;
  let lastWorkspace = '';
  let legacyBindings = {};
  let lastError = '';

  const publish = () => { for (const fn of [...listeners]) { try { fn(); } catch { /* listener errors stay local */ } } };

  // Harness 0.1.6 has no list.current: the main view holds a `mainView`
  // retention which the session list projects onto the summary. Same
  // derivation as the official host's currentSession(). Snapshots handed to
  // React must stay referentially stable until their inputs change.
  let cachedSessionsInput, cachedSessions;
  const sessionsList = {
    subscribe: fn => ctx.sessions.list.subscribe(fn),
    getSnapshot: () => {
      const snap = ctx.sessions.list.getSnapshot();
      if (snap === cachedSessionsInput && cachedSessions) return cachedSessions;
      cachedSessionsInput = snap;
      const byId = snap?.byId || {};
      const current = Object.keys(byId).find(id => (byId[id]?.retainedBy?.mainView ?? 0) > 0);
      cachedSessions = { ...snap, current };
      return cachedSessions;
    }
  };

  // A scope exists only for retained sessions; keep game sessions materialized
  // so binding(sid).session.prompt works before the session is ever shown.
  const retainForPrompt = sid => {
    if (retained.has(sid)) return;
    try {
      const ref = ctx.sessions.retain(sid, { source: 'huaxue-workbench' });
      retained.set(sid, ref);
      Promise.resolve(ref?.ready).catch(() => { try { ref.release(); } catch { /* already released */ } retained.delete(sid); });
    } catch { /* binding() will surface the failure */ }
  };

  const sessions = {
    list: sessionsList,
    open: id => ctx.uiWorkspace.openSession(id),
    clear: () => ctx.uiWorkspace.clearMain(),
    create: opts => ctx.sessions.create(opts),
    binding: id => { try { return ctx.sessions.binding(id); } catch { return undefined; } },
    // Archived game sessions have no client scope after a restart; retain one
    // on demand and resolve once its binding is open.
    retain: id => {
      if (!id) return Promise.resolve();
      let ref = retained.get(id);
      if (!ref) { retainForPrompt(id); ref = retained.get(id); }
      return Promise.resolve(ref?.ready).catch(() => undefined);
    }
  };

  let cachedWorkspacesInput, cachedWorkspaces;
  const workspacesList = {
    subscribe: fn => ctx.workspaces.list.subscribe(fn),
    getSnapshot: () => {
      const snap = ctx.workspaces.list.getSnapshot();
      if (snap === cachedWorkspacesInput && cachedWorkspaces) return cachedWorkspaces;
      cachedWorkspacesInput = snap;
      const items = (snap?.items || []).map(w => ({ ...w, name: w.name ?? w.title ?? w.path ?? w.workspaceId }));
      cachedWorkspaces = { ...snap, items };
      return cachedWorkspaces;
    }
  };
  const workspaces = {
    list: workspacesList,
    archiveSession: id => {
      const owner = typeof ctx.workspaces.archiveSession === 'function' ? ctx.workspaces : ctx.uiWorkspace;
      if (typeof owner.archiveSession !== 'function') return Promise.resolve();
      return owner.archiveSession(id);
    },
    unarchiveSession: id => {
      const owner = typeof ctx.workspaces.unarchiveSession === 'function' ? ctx.workspaces : ctx.uiWorkspace;
      if (typeof owner.unarchiveSession !== 'function') return Promise.resolve();
      return owner.unarchiveSession(id);
    },
    create: async input => {
      const result = await ctx.workspaces.create(input);
      if (result && typeof result === 'object' && 'ok' in result) {
        if (!result.ok) throw Error(result.error?.message || '创建工作区失败');
        return result.value?.workspace ?? result.value;
      }
      return result;
    }
  };

  let cachedInputs, cachedSnapshot;
  const applyCover = () => {
    if (!root) return;
    const hide = covered.size > 0;
    root.inert = hide;
    root.style.visibility = hide ? 'hidden' : '';
  };

  const workbenches = {
    protocolVersion: 1,
    subscribe(fn) {
      listeners.add(fn);
      const off = [host.subscribe(fn), ctx.sessions.list.subscribe(fn)];
      return () => { listeners.delete(fn); for (const u of off) { try { u(); } catch { /* already disposed */ } } };
    },
    getSnapshot() {
      const snap = host.getSnapshot();
      const inputs = [snap, legacyBindings, lastWorkspace, root, lastError];
      if (cachedInputs && inputs.every((v, i) => v === cachedInputs[i])) return cachedSnapshot;
      cachedInputs = inputs;
      const state = snap?.state || {};
      const bindings = {};
      for (const [sid, owner] of Object.entries(state.sessionBindings || {})) if (owner === WORKBENCH_ID) bindings[sid] = LEGACY_ID;
      for (const [sid, owner] of Object.entries(legacyBindings)) if (owner === LEGACY_ID && bindings[sid] === undefined) bindings[sid] = LEGACY_ID;
      cachedSnapshot = {
        activeId: state.active === WORKBENCH_ID ? LEGACY_ID : '',
        bindings,
        initializingId: '',
        workspace: lastWorkspace ? { huaxue: lastWorkspace } : {},
        root,
        ready: snap?.ready !== false,
        error: lastError || snap?.error || ''
      };
      return cachedSnapshot;
    },
    businessState(id, initial) {
      if (!businessStore.has(id)) businessStore.set(id, typeof initial === 'function' ? initial() : initial);
      return businessStore.get(id);
    },
    coverConversation(id, flag) {
      if (flag) covered.add(id); else covered.delete(id);
      applyCover();
      publish();
    },
    isCovered: () => covered.size > 0,
    leave: () => host.leave(),
    report(error) { lastError = error?.message || String(error); publish(); },
    setRoot(node) { if (root === node) return; root = node; applyCover(); publish(); },
    setWorkspace(id) { lastWorkspace = id || ''; publish(); },
    setLegacyBindings(map) { legacyBindings = map && typeof map === 'object' && !Array.isArray(map) ? map : {}; publish(); },
    async create({ workspaceId, background = false, initialize } = {}) {
      const spaces = ctx.workspaces.list.getSnapshot()?.items || [];
      const current = sessionsList.getSnapshot().current;
      const target = workspaceId || lastWorkspace || spaces.find(w => (w.sessionIds || []).includes(current))?.workspaceId;
      if (!target || !spaces.some(w => w.workspaceId === target)) throw Error('请先选择工作区');
      let sid;
      if (background) {
        sid = await ctx.sessions.create({ workspaceId: target });
        retainForPrompt(sid);
      } else {
        sid = await host.newSession(target);
        try { await ctx.remote.agentPresets.select(sid, 'standard'); } catch { /* preset selection is best-effort; persona comes from the binding */ }
      }
      lastWorkspace = target;
      publish();
      await (initialize ?? defaultInitialize)(sid);
      return sid;
    }
  };

  const defaultInitialize = async sid => {
    const data = await api.describe();
    const row = data.namespaces.find(r => r.ns === 'huaxue-workbench');
    const memberId = row?.value?.lastMemberId || 'ning';
    await api.mutate('huaxue-workbench', [{ op: 'set', path: ['sessions', sid], value: { activeMemberId: memberId, initialMemberId: memberId } }], row?.revision);
  };

  const runtime = {
    sessions,
    workspaces,
    workbenches,
    layout: ctx.layout,
    uiWorkspace: ctx.uiWorkspace,
    remote: ctx.remote,
    emit: (...args) => ctx.emit(...args)
  };

  return { runtime, workbenches, sessionsList, workspacesList, publish };
}
