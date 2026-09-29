window.__ModuleLoader__.load({
  id: 'dsh-huaxue-workbench-host',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    __FACADE__
    const NS = 'huaxue-workbench';

    // The custom frame: hosts the native conversation node provided by the
    // official workbench host and mounts the unchanged business UI on top.
    // The picker page covers the conversation; a bound session reveals it.
    function HuaxueFrame({ active, conversation, facade, api, Business }) {
      const host = React.useSyncExternalStore(facade.workbenches.subscribe, facade.workbenches.getSnapshot);
      const list = React.useSyncExternalStore(facade.sessionsList.subscribe, facade.sessionsList.getSnapshot);
      const current = list.current;
      const session = current && host.bindings[current] === LEGACY_ID ? list.byId[current] : undefined;
      const showConversation = active && !!session && !facade.workbenches.isCovered();
      const conversationRef = React.useRef(null);
      React.useEffect(() => {
        const node = conversationRef.current;
        if (!node) return;
        const attach = () => facade.workbenches.setRoot(node.querySelector('[data-phase]'));
        attach();
        const observer = new MutationObserver(attach);
        observer.observe(node, { childList: true, subtree: true });
        return () => { observer.disconnect(); facade.workbenches.setRoot(null); };
      }, [facade]);
      return h('div', { className: 'hx-frame', style: { position: 'relative', flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' } },
        h('div', { ref: conversationRef, style: { display: showConversation ? 'contents' : 'none' } }, conversation),
        h('div', { className: 'hx-portable-layer', style: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 } },
          h(Business, { runtime: facade.runtime, api })));
    }

    function makeApi(ctx) {
      const listeners = new Set();
      const request = async (payload) => {
        const response = await fetch('/api/huaxue/state', payload ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)} : {cache:'no-store'});
        const data = await response.json();
        if (!response.ok) throw Object.assign(Error(data.error || 'State request failed'), {code:data.code});
        return data;
      };
      return {
        describe: () => request(),
        async mutate(ns,ops,revision) { const value=await request({ns,ops,revision}); for(const fn of listeners) fn(); return value; },
        subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); }
      };
    }
    function apply(ctx, business) {
      ctx.effect(business.installStyles, 'huaxue.styles');
      const host = ctx.desktopWorkbenches;
      const api = makeApi(ctx);
      const facade = createFacade(ctx, host, api);
      const workbenches = facade.workbenches;

      // Read-only legacy ownership: sessions bound before the official host
      // existed stay listed and keep their persona. Ownership writes go only
      // to the official host.
      const syncLegacy = async () => {
        try {
          const data = await api.describe();
          const row = data.namespaces.find(r => r.ns === LEGACY_NAMESPACE);
          workbenches.setLegacyBindings(row?.value?.bindings || {});
          const preferred = row?.value?.workspace?.huaxue;
          if (typeof preferred === 'string' && preferred) workbenches.setWorkspace(preferred);
        } catch { /* legacy state is optional */ }
      };
      syncLegacy();
      ctx.effect(() => api.subscribe(syncLegacy), 'huaxue.legacy-state');

      ctx.effect(() => ctx.desktopWorkbenches.register({
        title: '花少2 · 花学工作台',
        panelTitle: '花学工作台',
        repository: WORKBENCH_REPOSITORY,
        description: '七位花学旅伴陪你工作、聊天与借个嘴，保留花学拆解和第八位嘉宾游戏。',
        category: '娱乐',
        customFrame: true
      }, props => h(HuaxueFrame, { ...props, facade, api, Business: business.NativeWorkbench })), 'huaxue.register');

      // This workbench was installed and pinned before the official host
      // existed; restore that ownership exactly once. A later removal is the
      // user's choice and must never be reverted automatically.
      ctx.effect(() => {
        const MARKER = 'huaxue-workbench:official-restored';
        const ensure = () => {
          const snap = host.getSnapshot();
          if (!snap?.ready || !snap.state) return;
          if (snap.state.added.includes(WORKBENCH_ID)) return;
          try { if (globalThis.localStorage?.getItem(MARKER)) return; } catch { /* storage unavailable */ }
          try { globalThis.localStorage?.setItem(MARKER, '1'); } catch { /* marker is best-effort */ }
          host.run(host.add(WORKBENCH_ID));
        };
        ensure();
        return host.subscribe(ensure);
      }, 'huaxue.restore-added');
    }
    return { apply, inject: ['desktopWorkbenches', 'sessions', 'workspaces', 'uiWorkspace', 'layout', 'remote'] };
  }
});
