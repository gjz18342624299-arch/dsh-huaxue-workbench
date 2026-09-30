window.__ModuleLoader__.load({
  id: 'dsh-huaxue-workbench',
  factory(require) {
    const React = require('react');
    const { createPortal } = require('react-dom');
    const { IconCheckOutline16, IconCloseOutline16, IconUserOutline16 } = require('@deepseek-ai/dsh-client-ui-primitives');
    const h = React.createElement;
    const members = __MEMBERS__;
    const css = __CSS__;
    const games = __GAMES__;
    const ns = 'huaxue-workbench';
    __GAME_CLIENT__
    function PictureIcon() {
      return h('svg', { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': true }, h('rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 }), h('circle', { cx: 8, cy: 8, r: 1.5 }), h('path', { d: 'M3 17l5-5 4 4 3-3 6 6' }));
    }
    // Decorations own only their new nodes; React's message nodes are never reparented.
    function decorateAnalysis(root) {
      root.querySelectorAll('[data-chat-flow-kind="assistant"] [class*="_markdown"], [data-turn-process-answer] [class*="_markdown"], .JfTm6W_body [class*="_markdown"]').forEach(md => {
        if (md.closest('[data-variant="think"]')) return;
        const blocks = [...md.children];
        const start = blocks.findIndex(el => /^(花学拆解|花学解析)\s*[:：]?/.test(el.textContent.trim()));
        md.classList.toggle('hx-analysis-surface', start >= 0);
        blocks.forEach(el => el.classList.remove('hx-analysis-part', 'hx-analysis-first', 'hx-analysis-last'));
        if (start < 0) return;
        const heading = /^H[1-6]$/.test(blocks[start].tagName) ? Number(blocks[start].tagName[1]) : 0;
        let end = blocks.length;
        if (heading) for (let i = start + 1; i < blocks.length; i++) {
          if (/^H[1-6]$/.test(blocks[i].tagName) && Number(blocks[i].tagName[1]) <= heading) { end = i; break; }
        }
        blocks.slice(start, end).forEach(el => el.classList.add('hx-analysis-part'));
        blocks[start].classList.add('hx-analysis-first'); blocks[end - 1].classList.add('hx-analysis-last');
        const box = md.getBoundingClientRect();
        md.style.setProperty('--hx-analysis-top', (blocks[start].getBoundingClientRect().top - box.top) + 'px');
        md.style.setProperty('--hx-analysis-bottom', (box.bottom - blocks[end - 1].getBoundingClientRect().bottom) + 'px');
      });
    }
    function SwitchEvent({ root, sessionId, event }) {
      const [mount, setMount] = React.useState(null);
      React.useLayoutEffect(() => {
        if (!root || !event) return;
        const node = document.createElement('div'); node.className = 'hx-switch-event-slot';
        const place = () => {
          const items = [...root.querySelectorAll('[data-chat-flow-key]')];
          const next = items.find(el => Number(el.dataset.chatTurn) > event.afterTurn && el.querySelector('[data-turn-process], [data-variant="think"], .JfTm6W_root'));
          const column = next?.parentElement || items.at(-1)?.parentElement;
          if (!column) return;
          if (next) { if (node.nextSibling !== next) column.insertBefore(node, next); }
          else if (node.parentElement !== column || node !== column.lastChild) column.appendChild(node);
          setMount(node);
        };
        place(); const observer = new MutationObserver(place); observer.observe(root, { childList: true, subtree: true });
        return () => { observer.disconnect(); node.remove(); };
      }, [root, sessionId, event]);
      return mount && createPortal(h('div', { className: 'hx-switch-event', role: 'status' }, h('span', { 'aria-hidden': true }, '↔'), '已切换为' + event.name + '，从下一条消息开始接话'), mount);
    }
    function Panel({ sessionId, presetId, api, rootElement, gameEntry }) {
      const [view, setView] = React.useState(null);
      const [error, setError] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [open, setOpen] = React.useState(false);
      const [notice, setNotice] = React.useState('');
      const savedNotice = view?.value.sessions[sessionId]?.switchNotice;
      const selectedForNotice = view?.value.sessions[sessionId]?.activeMemberId ?? view?.value.lastMemberId;
      const switchEvent = React.useMemo(() => savedNotice?.memberId && savedNotice.memberId === selectedForNotice ? { name: members.find(m => m.id === savedNotice.memberId)?.name, afterTurn: savedNotice.afterTurn } : null, [savedNotice, selectedForNotice]);
      const generation = React.useRef(0);
      const mounted = React.useRef(false);
      const busy = React.useRef(false);
      const load = React.useCallback(async () => {
        if (busy.current) return;
        const token = ++generation.current;
        try {
          const result = await api.describe();
          const row = result.namespaces.find(r => r.ns === ns);
          if (!row) throw Error('花学插件尚未在 Host 启用');
          if (mounted.current && token === generation.current) { setView(row); setError(''); }
        } catch (err) { if (mounted.current && token === generation.current) setError(err.message || '读取失败'); }
      }, [api, sessionId]);
      React.useEffect(() => {
        mounted.current = true;
        setView(null); setError(''); setSaving(false); setNotice('');
        load();
        const dispose = api.subscribe?.(load);
        return () => { mounted.current = false; generation.current++; dispose?.(); };
      }, [load]);
      React.useEffect(() => {
        if (presetId !== 'huashao2' || !rootElement) return;
        rootElement.classList.add('hx-native-root');
        return () => rootElement.classList.remove('hx-native-root');
      }, [rootElement, presetId]);
      if (presetId !== 'huashao2') return null;
      const selected = view?.value.sessions[sessionId]?.activeMemberId ?? view?.value.lastMemberId;
      async function choose(id) {
        if (!view || saving || id === selected) return;
        busy.current = true;
        const token = ++generation.current;
        setSaving(true); setError('');
        try {
          const event = { memberId: id, afterTurn: Math.max(-1, ...[...(rootElement?.querySelectorAll('[data-chat-turn]') || [])].map(el => Number(el.dataset.chatTurn))) };
          const next = await api.mutate(ns, [
            { op: 'set', path: ['lastMemberId'], value: id },
            { op: 'set', path: ['sessions', sessionId, 'activeMemberId'], value: id },
            { op: 'set', path: ['sessions', sessionId, 'switchNotice'], value: event }
          ], view.revision);
          if (mounted.current && token === generation.current) {
            setView(next); setNotice('已切换为' + members.find(m => m.id === id).name + '，从下一条消息开始接话。当前回复继续由原旅伴完成。'); setOpen(false);
          }
        } catch (err) {
          if (mounted.current && token === generation.current) { setError(err.message || '切换失败，请重试'); }
        } finally { busy.current = false; if (mounted.current && token === generation.current) setSaving(false); }
      }
      const rail = h('aside', { className: 'hx-rail' + (open ? ' hx-open' : ''), 'aria-label': '今日旅伴' },
        h('div', { className: 'hx-rail-title' }, h('h2', null, '今日旅伴'), h('button', { className: 'hx-mobile hx-icon', onClick: () => setOpen(false), title: '收起旅伴', 'aria-label': '收起旅伴' }, h(IconCloseOutline16))),
        gameEntry || (selected && h('div', { className: 'hx-current' }, h('img', { src: members.find(m => m.id === selected)?.avatar, alt: '' }), h('div', null, h('b', null, members.find(m => m.id === selected)?.name), h('small', null, '当前陪伴')))),
        h('h3', null, '七人成员'),
        !view && !error && h('p', { role: 'status' }, '正在连接…'),
        h('div', { className: 'hx-people' }, members.map(m => h('button', {
          key: m.id, className: 'hx-person', disabled: saving || !view, 'aria-pressed': selected === m.id,
          'aria-label': '选择' + m.name, onClick: () => choose(m.id)
        }, h('img', { src: m.avatar, alt: '', width: 48, height: 48 }), h('span', null, h('b', null, m.name)), h('i', { className: 'hx-dot', 'aria-hidden': true })))),
        error && h('div', { className: 'hx-error', role: 'alert' }, error, h('button', { onClick: load, disabled: saving }, '重新连接')),
        h('p', { className: 'hx-notice', role: 'status', 'aria-live': 'polite' }, saving ? '正在切换…' : notice),
        h('small', { className: 'hx-footer' }, '角色化演绎 · 非本人发言')
      );
      return h(React.Fragment, null,
        h(SwitchEvent, { root: rootElement, sessionId, event: switchEvent }),
        h('button', { className: 'hx-mobile hx-icon', onClick: () => setOpen(!open), title: '今日旅伴', 'aria-label': '展开今日旅伴', 'aria-expanded': open }, h(IconUserOutline16)),
        rootElement ? createPortal(rail, rootElement) : rail
      );
    }
    function NativePanel(props) {
      const marker = React.useRef(null);
      const [root, setRoot] = React.useState(null);
      const preset = props.useSessions(state => state.byId[props.sessionId]?.projectionValues?.agentPreset);
      React.useLayoutEffect(() => { setRoot(marker.current?.closest('[data-phase]') ?? null); }, [props.sessionId]);
      return h('span', { ref: marker }, h(Panel, { key: props.sessionId, sessionId: props.sessionId, presetId: preset, api: props.api, rootElement: root }));
    }
    function decorateThinking(root, identities) {
      const rows = [...root.querySelectorAll('[data-turn-process], [data-variant="think"] [data-disclosure-row]')];
      const turnOf = row => row.closest('[data-chat-turn]')?.dataset.chatTurn ?? row.dataset.turnProcess;
      const chosen = new Map();
      for (const row of rows) {
        const turn = turnOf(row);
        if (!chosen.has(turn) || row.hasAttribute('data-turn-process')) chosen.set(turn, row);
      }
      for (const row of rows) {
        const turn = turnOf(row);
        const member = members.find(m => m.id === identities[turn]);
        const active = !!member && chosen.get(turn) === row;
        row.classList.toggle('hx-persona-thinking', active);
        if (active) { row.style.setProperty('--hx-turn-avatar', 'url(' + JSON.stringify(member.avatar) + ')'); row.dataset.hxSpeaker = member.name; }
        else { row.style.removeProperty('--hx-turn-avatar'); delete row.dataset.hxSpeaker; }
      }
    }
    function WorkbenchDialog({ kind, close, skin, saveSkin, startGame, draftStore, person = members.find(m => m.id === 'ning') }) {
      const dialog = React.useRef(null);
      const defaults = { image: '', opacity: 0.15, position: 'center', fit: 'cover', filename: '' };
      const [draft, setDraft] = React.useState({ ...defaults, ...skin, ...draftStore?.skinDraft });
      React.useEffect(() => { if (draftStore) draftStore.skinDraft = draft; }, [draft, draftStore]);
      const fileInput = React.useRef(null);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [scene, setScene] = React.useState(null);
      const [line, setLine] = React.useState('');
      const [review, setReview] = React.useState(false);
      React.useEffect(() => { if (draftStore) dialog.current.show(); else dialog.current.showModal(); }, []);
      async function upload(e) {
        const file = e.dataTransfer?.files?.[0] || e.target.files?.[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { setError('请选择 4 MB 以内的 PNG、JPEG 或 WebP 图片'); return; }
        const reader = new FileReader();
        reader.onload = () => { setDraft(value => ({ ...value, image: reader.result, filename: file.name })); setError(''); };
        reader.onerror = () => setError('图片读取失败');
        reader.readAsDataURL(file);
      }
      async function submit() {
        setBusy(true); setError('');
        try { if (kind === 'skin') await saveSkin(draft); else await startGame(scene, line); close(); }
        catch (e) { setError(e.message); } finally { setBusy(false); }
      }
      const segments = (field, options) => h('div', { className: 'hx-skin-segments', role: 'group', 'aria-label': field === 'position' ? '图片位置' : '显示方式' }, options.map(([value, label, icon]) => h('button', { key: value, type: 'button', 'aria-pressed': draft[field] === value, onClick: () => setDraft({ ...draft, [field]: value }) }, icon === '▧' ? h(PictureIcon) : h('span', { 'aria-hidden': true }, icon), label)));
      return h('dialog', { ref: dialog, className: 'hx-dialog' + (kind === 'skin' ? ' hx-skin-dialog' : ''), onCancel: e => { if (busy) e.preventDefault(); else close(); }, 'aria-label': kind === 'skin' ? '自定义背景' : '第八位嘉宾' },
        h('header', null, h('h2', null, kind === 'skin' ? '自定义背景' : '第八位嘉宾'), h('button', { className: 'hx-icon', title: '关闭', disabled: busy, onClick: close }, h(IconCloseOutline16))),
        kind === 'skin' ? h(React.Fragment, null,
          h('p', { className: 'hx-skin-subtitle' }, '给这段旅程，换一张风景'),
          h('div', { className: 'hx-skin-layout' },
            h('section', { className: 'hx-skin-controls', 'aria-label': '背景设置' },
              h('h3', null, '上传图片'),
              h('div', { className: 'hx-skin-upload', onDragOver: e => e.preventDefault(), onDrop: e => { e.preventDefault(); upload(e); } }, h('span', { className: 'hx-upload-icon', 'aria-hidden': true }, h(PictureIcon)), h('p', null, '拖拽图片到这里'), h('button', { className: 'hx-confirm', onClick: () => fileInput.current.click() }, draft.image ? '更换图片' : '选择图片'), h('small', null, 'PNG / JPEG / WebP · 最大 4 MB'), h('input', { hidden: true, ref: fileInput, type: 'file', accept: 'image/png,image/jpeg,image/webp', onChange: upload })),
              draft.image && h('div', { className: 'hx-skin-file' }, h('img', { src: draft.image, alt: '' }), h('span', { title: draft.filename }, draft.filename || '当前背景'), h('button', { title: '移除背景', onClick: () => setDraft({ ...draft, image: '', filename: '' }) }, '×')),
              h('label', { className: 'hx-skin-opacity' }, h('b', null, '背景浓度'), h('span', null, Math.round(draft.opacity * 100) + '%'), h('input', { type: 'range', min: 0, max: 0.5, step: 0.01, value: draft.opacity, style: { '--hx-range': draft.opacity * 200 + '%' }, onChange: e => setDraft({ ...draft, opacity: Number(e.target.value) }) })),
              h('h3', null, '图片位置'), segments('position', [['top', '顶部', '↑'], ['center', '居中', '▣'], ['bottom', '底部', '↓']]),
              h('h3', null, '显示方式'), segments('fit', [['cover', '铺满', '⛶'], ['contain', '适应', '▧']]),
              h('button', { className: 'hx-skin-remove', disabled: !draft.image, onClick: () => setDraft({ ...draft, image: '', filename: '' }) }, '移除背景')),
            h('section', { className: 'hx-skin-live', 'aria-label': '背景实时预览' }, h('div', { className: 'hx-skin-preview-title' }, h('b', null, h('i'), '实时预览'), h('small', null, '示例对话')),
              h('div', { className: 'hx-skin-chat' },
                h('div', { className: 'hx-skin-landscape', style: { backgroundImage: draft.image ? 'url(' + JSON.stringify(draft.image) + ')' : 'none', opacity: draft.opacity, backgroundPosition: draft.position, backgroundSize: draft.fit } }),
                h('div', { className: 'hx-skin-chat-header' }, h('b', null, person.name), h('small', null, '花少2')),
                h('div', { className: 'hx-skin-chat-content' }, h('small', { className: 'hx-skin-time' }, '今天'), h('p', { className: 'hx-skin-user' }, '我们下一站去哪里？'), h('div', { className: 'hx-skin-think' }, h('img', { src: person.avatar, alt: person.name }), h('span', null, '思考')), h('p', { className: 'hx-skin-reply' }, '跟着自己的心走，风景就在路上。')),
                h('div', { className: 'hx-skin-composer', 'aria-hidden': true }, h('span', null, '＋'), h('span', null, '发消息…'), h('b', null, '↑'))),
              h('small', { className: 'hx-skin-preview-note' }, 'ⓘ 调整会实时显示，应用后生效。')))) : h(React.Fragment, null,
          h('div', { className: 'hx-game-list' }, games.map((game, i) => h('section', { key: game.title }, h('h3', null, String(i + 1).padStart(2, '0') + ' · ' + game.title), game.nodes.map(node => h('button', { key: node.id, 'aria-pressed': scene?.id === node.id, onClick: () => { setScene(node); setReview(false); } }, node.title))))),
          scene && h('section', { className: 'hx-scene' }, h('h3', null, scene.title), h('small', null, '剧情摘要 · 非节目原话'), h('p', null, scene.summary), h('label', null, '你的第一句话', h('textarea', { value: line, onChange: e => setLine(e.target.value), rows: 3 })),
            h('button', { onClick: () => setReview(!review) }, review ? '收起节目走向' : '回看节目走向'), review && h('p', null, scene.outcome), h('small', null, '从这里开始是 AI 续演，与节目实际发展无关'))),
        error && h('p', { className: 'hx-error', role: 'alert' }, error),
        h('footer', null, kind === 'skin' && h('button', { className: 'hx-skin-reset', disabled: busy, onClick: () => { setDraft(defaults); setError(''); } }, '↶ 恢复默认'), h('button', { disabled: busy, onClick: close }, '取消'), h('button', { className: 'hx-confirm', disabled: busy || (kind === 'game' && (!scene || !line.trim())), onClick: submit }, busy ? '正在保存…' : kind === 'skin' ? '应用背景' : '开始续演')));
    }
    function NativeWorkbench({ runtime, api }) {
      const [snapshot, setSnapshot] = React.useState(() => runtime.sessions.list.getSnapshot());
      const [workspaces, setWorkspaces] = React.useState(() => runtime.workspaces.list.getSnapshot().items);
      const host = React.useSyncExternalStore(runtime.workbenches.subscribe, runtime.workbenches.getSnapshot);
      const root = host.root;
      const [picked, setPicked] = React.useState(null);
      const [workspaceId, setWorkspaceId] = React.useState(host.workspace.huaxue || '');
      const [error, setError] = React.useState('');
      const [saving, setSaving] = React.useState(false);
      const [view, setView] = React.useState(null);
      const pendingSession = React.useRef(null);
      const [dialog, setDialog] = React.useState(null);
      const [gamePlay, setGamePlay] = React.useState(null);
      const enabled = host.activeId === 'huaxue';
      const session = host.bindings[snapshot.current] === 'huaxue' ? snapshot.byId[snapshot.current] : undefined;
      const currentWorkspace = workspaces.find(w => w.sessionIds.includes(session?.id));
      const selected = view?.value.sessions[session?.id]?.activeMemberId || view?.value.lastMemberId || 'ning';
      const person = members.find(m => m.id === selected);
      const initial = members.find(m => m.id === (view?.value.sessions[session?.id]?.initialMemberId || selected));
      const isGameSession = !!(session && view?.value.sessions?.[session.id]?.gameId);
      const picker = enabled && (host.initializingId === 'huaxue' || !session);
      React.useEffect(() => {
        runtime.workbenches.coverConversation('huaxue', enabled && (picker || !!dialog));
        return () => runtime.workbenches.coverConversation('huaxue', false);
      }, [runtime, enabled, picker, dialog]);
      React.useEffect(() => {
        const a = runtime.sessions.list.subscribe(() => setSnapshot(runtime.sessions.list.getSnapshot()));
        const b = runtime.workspaces.list.subscribe(() => setWorkspaces(runtime.workspaces.list.getSnapshot().items));
        let live = true;
        const read = () => api.describe().then(data => { if (live) setView(data.namespaces.find(row => row.ns === ns)); }).catch(e => { if (live) setError(e.message); });
        read(); const c = api.subscribe(read);
        return () => { live = false; a(); b(); c(); };
      }, [runtime, api]);
      React.useEffect(() => {
        if (!view?.value.sessions) return;
        isolateGameSessions(runtime, view.value.sessions).catch(e => setError(e.message));
      }, [runtime, view]);
      React.useEffect(() => {
        if (dialog !== 'game' && view?.value.sessions[session?.id]?.gameId) returnFromGame(runtime, view.value.sessions, session.id);
      }, [runtime, view, dialog, session?.id]);
      React.useEffect(() => {
        if (currentWorkspace && !workspaceId) setWorkspaceId(currentWorkspace.workspaceId);
      }, [workspaces, session?.id, workspaceId]);
      React.useEffect(() => {
        if (!enabled || !root) return;
        root.classList.add('hx-dsh-mode');
        root.classList.add('hx-dsh-chat');
        return () => { root.classList.remove('hx-dsh-mode'); root.classList.remove('hx-dsh-chat'); };
      }, [enabled, root]);
      React.useEffect(() => {
        if (!root || !enabled) return;
        const hiddenWelcome = new Map();
        const hideNativeWelcome = () => {
          // DSH 0.8.1 renamed the welcome classes. Hide only the decorative
          // copy itself; its section also owns the composer in blank sessions.
          for (const node of root.querySelectorAll('*')) {
            const text = (node.textContent || '').trim().toLowerCase();
            if ((text.includes('into the unknown') || text.includes('探索未至之境')) && node.children.length < 6 && !node.querySelector('[data-composer-card],textarea,input,button,select')) {
              if (!hiddenWelcome.has(node)) hiddenWelcome.set(node, node.style.display);
              node.style.display = 'none';
            }
          }
        };
        const feed = runtime.sessions.binding(session?.id)?.session?.eventSource;
        const mark = () => {
          hideNativeWelcome();
          decorateAnalysis(root);
          const identities = { ...view?.value.sessions[session?.id]?.turnMembers };
          let turn;
          for (const entry of feed?.getSnapshot().entries || []) {
            const event = entry.event;
            if (event.type === 'turn/start') turn = event.data.turn;
            if (event.type === 'request/header' && turn !== undefined) {
              const system = event.data.header?.system;
              const match = typeof system === 'string' && system.match(/\[huaxue:[^:\]]+:(mao|qing|ning|chen|jing|yang|zheng)\]/);
              if (match) identities[turn] = match[1];
            }
          }
          decorateThinking(root, identities);
        };
        let frame;
        const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(mark); };
        mark(); const observer = new MutationObserver(schedule); observer.observe(root, { childList: true, subtree: true, characterData: true });
        const resize = new ResizeObserver(schedule); resize.observe(root);
        const unsubscribe = feed?.subscribe(schedule);
        return () => {
          observer.disconnect(); resize.disconnect(); unsubscribe?.(); cancelAnimationFrame(frame);
          for (const [node, display] of hiddenWelcome) node.style.display = display;
          for (const node of root.querySelectorAll('.hx-analysis-surface,.hx-analysis-part,.hx-persona-thinking')) {
            node.classList.remove('hx-analysis-surface','hx-analysis-part','hx-analysis-first','hx-analysis-last','hx-persona-thinking');
            node.style.removeProperty('--hx-turn-avatar'); delete node.dataset.hxSpeaker;
          }
        };
      }, [root, enabled, runtime, session?.id, view]);
      async function choose(id, targetWorkspaceId = workspaceId) {
        if (saving) return;
        setSaving(true); setError('');
        try {
          const saveSelection = async sid => {
            const data = await api.describe();
            const row = data.namespaces.find(r => r.ns === ns);
            const next = await api.mutate(ns, [
              { op: 'set', path: ['lastMemberId'], value: id },
              { op: 'set', path: ['sessions', sid, 'activeMemberId'], value: id },
              { op: 'set', path: ['sessions', sid, 'initialMemberId'], value: id }
            ], row.revision);
            setView(next);
          };
          const sid = await runtime.workbenches.create({ workbenchId: 'huaxue', workspaceId: targetWorkspaceId, initialize: saveSelection });
          setWorkspaceId(targetWorkspaceId);
          setPicked(sid);
        } catch (e) { setError(e.message); } finally { setSaving(false); }
      }
      async function addWorkspace() {
        if (saving) return;
        setSaving(true); setError('');
        try {
          const path = await runtime.uiWorkspace.pickDirectory();
          if (path) {
            const workspace = await runtime.workspaces.create({ path });
            setWorkspaceId(workspace.workspaceId);
          }
        } catch (e) { setError(e.message); } finally { setSaving(false); }
      }
      async function saveSkin(skin) {
        const data = await api.describe();
        const row = data.namespaces.find(r => r.ns === ns);
        setView(await api.mutate(ns, [{ op: 'set', path: ['skin'], value: skin }], row.revision));
      }
      async function startGame(scene, line) {
        const target = workspaces.find(w => w.sessionIds.includes(session.id));
        if (!target) throw Error('未找到当前工作区，请重新选择工作区');
        const sid = await runtime.workbenches.create({ workbenchId: 'huaxue', workspaceId: target.workspaceId, background: true });
        const result = await runtime.remote.agentPresets.select(sid, 'huashao2');
        if (!result.ok) throw Error(result.error.message);
        const data = await api.describe();
        const row = data.namespaces.find(r => r.ns === ns);
        await api.mutate(ns, [{ op: 'set', path: ['sessions', sid], value: { activeMemberId: selected, initialMemberId: selected, gameId: scene.id } }], row.revision);
        setPicked(sid);
        const gameSession = runtime.sessions.binding(sid)?.session;
        if (!gameSession) throw Error('游戏会话未连接，请稍后重试');
        const sent = await gameSession.prompt([{ type: 'text', text: line.trim() }], 'queue');
        if (!sent.ok) throw Error(sent.error.message);
        setDialog(null); setGamePlay({ scene, sid, messages: [{ speaker: '你', text: line.trim() }] });
      }
      if (!enabled || isGameSession) return null;
      if (picker) return h('section', { className: 'hx-native-picker' },
        h('header', null, h('b', null, 'DSH'), h('strong', null, '花儿与少年'), h('small', null, '第二季'),
          h('select', { 'aria-label': '花学工作区', disabled: saving, value: workspaceId, onChange: e => { pendingSession.current = null; setWorkspaceId(e.target.value); } }, h('option', { value: '' }, '选择工作区'), workspaces.map(w => h('option', { key: w.workspaceId, value: w.workspaceId }, w.name || w.path))),
          h('button', { disabled: saving, onClick: addWorkspace, title: '选择或新建文件夹作为工作区' }, '新建工作区'),
          h('button', { className: 'hx-icon', title: '返回通用聊天', 'aria-label': '返回通用聊天', onClick: () => runtime.workbenches.leave().catch(e => setError(e.message)) }, h(IconCloseOutline16))),
        h('div', { className: 'hx-picker-heading' }, h('p', null, '花学研讨会，今天开麦。'), h('h1', null, '今天，你想和哪位花学老师', h('br'), h('em', null, '“创飞”所有人？'))),
        h('div', { className: 'hx-picker-people' }, members.map(m => h('button', { key: m.id, disabled: saving, 'aria-label': '和' + m.name + '开始对话', onClick: () => choose(m.id) }, h('img', { src: m.avatar, alt: '' }), h('b', null, m.name), h('small', null, m.quote)))),
        error && h('p', { className: 'hx-error', role: 'alert' }, error),
        h('footer', null, h('span', null, '七位旅伴，今天由你选。'), h('small', null, '角色化演绎 · 非本人发言')));
      const gameEntry = h('button', { className: 'hx-game-card', onClick: () => setDialog('game'), 'aria-label': '打开第八位嘉宾游戏' },
        h('div', { className: 'hx-game-screen' }, h('strong', null, '第八位嘉宾'), h('small', null, '7 / 8 READY'), h('span', null, members.map(m => h('i', { key: m.id, style: { backgroundImage: 'url(' + JSON.stringify(m.avatar) + ')' } })), h('em', null, '+'))),
        h('div', { className: 'hx-game-controls' }, h('span', { className: 'hx-dpad', 'aria-hidden': true }, '✚'), h('b', null, '▶ 进入游戏'), h('span', { className: 'hx-ab', 'aria-hidden': true }, 'A　B')));
      return h(React.Fragment, null,
        gamePlay && createPortal(h('section', { className: 'hx-game-overlay' }, h('header', null, h('div', null, h('small', null, '花少2 · 第八位嘉宾'), h('h1', null, gamePlay.scene.title)), h('button', { onClick: () => setGamePlay(null) }, '退出游戏')), h('div', { className: 'hx-game-context' }, h('b', null, '现场前情'), h('p', null, gamePlay.scene.summary), h('small', null, '从这里开始是 AI 续演 · 你是第八位嘉宾')), h('div', { className: 'hx-game-messages' }, gamePlay.messages.map((m, i) => h('p', { key: i }, h('b', null, m.speaker), h('span', null, m.text)))), h('p', { className: 'hx-game-empty' }, '后台角色回复正在生成，稍后会显示在这里。')), document.body),
        dialog === 'game' && h(GameExperience, { runtime, api, parentSessionId: session.id, selected, close: () => { returnFromGame(runtime, view?.value.sessions || {}, session.id); setDialog(null); } }),
        dialog === 'skin' && h(WorkbenchDialog, { key: dialog, kind: dialog, close: () => setDialog(null), skin: view?.value.skin, saveSkin, person, draftStore: runtime.workbenches.businessState('huaxue', {}) }),
        root && view?.value.skin?.image && createPortal(h('div', { className: 'hx-custom-background', style: { backgroundImage: 'url(' + JSON.stringify(view.value.skin.image) + ')', opacity: view.value.skin.opacity, backgroundPosition: view.value.skin.position, backgroundSize: view.value.skin.fit || 'cover', backgroundRepeat: 'no-repeat' } }), root),
        root && createPortal(h('nav', { className: 'hx-mode-actions', 'aria-label': '花学工作台' },
          h('label', { className: 'hx-workspace-control' }, '工作区', h('select', { 'aria-label': '花学工作区', title: '选择工作区后，在该目录新建花少会话；当前会话保留', disabled: saving, value: currentWorkspace?.workspaceId || '', onChange: e => choose(selected, e.target.value) }, h('option', { value: '', disabled: true }, '选择工作区'), workspaces.map(w => h('option', { key: w.workspaceId, value: w.workspaceId }, w.name || w.path)))),
          h('button', { disabled: saving || !currentWorkspace, onClick: () => choose(selected, currentWorkspace.workspaceId), title: '在当前工作区新建花少会话' }, '新建会话'),
          h('button', { className: 'hx-skin-action', onClick: () => setDialog('skin') }, '自定义背景')), root),
        error && root && createPortal(h('p', { className: 'hx-workspace-error', role: 'alert' }, error), root),
        root && h(Panel, { sessionId: session.id, presetId: 'huashao2', api, rootElement: root, gameEntry }),
        root && createPortal(h('div', { className: 'hx-dsh-identity' }, h('div', null, h('b', null, person.name), h('small', null, '花少2')), h('button', { onClick: () => runtime.workbenches.leave().catch(e => setError(e.message)), title: '返回通用聊天' }, '返回 DSH')), root),
        session?.blank && root && createPortal(h('article', { className: 'hx-dsh-opening' }, h('div', null, h('b', null, initial.name), h('p', null, initial.opening))), root));
    }
    function installStyles() {
      if (document.getElementById('huaxue-workbench-style')) return () => {};
      const style = document.createElement('style'); style.id = 'huaxue-workbench-style'; style.textContent = css;
      document.head.appendChild(style); return () => style.remove();
    }
    function apply(ctx) {
      ctx.effect(installStyles, 'huaxue.styles');
      async function unwrap(request) {
        const result = await request;
        if (!result.ok) throw Error(result.error?.message || 'Host 请求失败');
        return result.value;
      }
      const api = {
        describe: () => unwrap(ctx.remote.settings.describe()),
        mutate: (ns, ops, revision) => unwrap(ctx.remote.settings.mutate(ns, ops, revision)),
        subscribe: callback => ctx.remote.$on('settings/document-updated', changed => { if (changed === ns) callback(); })
      };
      ctx.inject(['workbenches', 'sessions', 'workspaces', 'uiWorkspace', 'remote.agentPresets'], scope => {
        if (scope.workbenches.protocolVersion !== 1) throw Error('当前 DSH 缺少兼容的工作台宿主，请安装本项目的本机宿主支持。');
        scope.effect(() => scope.workbenches.register({
          id: 'huaxue', name: '花少2 · 花学工作台', version: '0.2.0', defaultPreset: 'standard', entryBehavior: 'picker',
          description: '七位花学旅伴陪你工作、聊天与借个嘴，保留花学拆解和第八位嘉宾游戏。',
          Component: props => h(NativeWorkbench, { ...props, api }),
          initialize: async sid => {
            const data = await api.describe();
            const row = data.namespaces.find(r => r.ns === ns);
            const memberId = row.value.lastMemberId || 'ning';
            await api.mutate(ns, [{ op: 'set', path: ['sessions', sid], value: { activeMemberId: memberId, initialMemberId: memberId } }], row.revision);
          }
        }));
      });
    }
    return { apply, inject: ['slots', 'remote', 'remote.settings'], Panel, members, installStyles, decorateAnalysis, decorateThinking, WorkbenchDialog, SwitchEvent, NativeWorkbench, GameExperience, gameTranscript, gameDialogue, GameReply, GameMessage, gameOutcome, isolateGameSessions, returnFromGame };
  }
});

