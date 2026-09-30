    const gameArt = __GAME_ART__;
    const gameDetails = [
      { caption: '住宿、采购、分配，谁来把话说全？', nodes: ['住宿偏好', '卸行李与采购', '确认分配'], choices: [
        [['先说底线', '我不太能睡帐篷，能接受和不能接受的先说清。'], ['别再随便', '别都说随便，帐篷和房车各有几个人愿意住，报个数。'], ['留个余地', '现在不用把搭配排死，先把谁不能住什么记下来。']],
        [['拆开说', '住宿先记下，卸行李谁来、采购买什么，咱们分开说。'], ['回到问题', '灰尘和舒不舒服我听到了，先答一下行李和采购怎么分。'], ['先做一件', '有人先去卸行李，有人列采购单，住宿待会儿再细说。']],
        [['先对资源', '帐篷几顶、睡袋几条先数清，人再往里排。'], ['报个组合', '想一起住的三个人先说出来，剩下的再看车里怎么分。'], ['最后确认', '现在这版每个人都听见了没有？不合适的现在说。']]
      ] },
      { caption: '继续夜游，还是回去休息？', nodes: ['去塔桥，还是休息'], choices: [[['疲惫', '我有点累了，想先回去休息。'], ['想玩', '我还想去看看，咱们约好会合时间怎么样？'], ['一起决定', '想去和想休息的都说一下，别替别人做决定。']]] },
      { caption: '一个问题，把全桌问安静了。', nodes: ['接住停顿'], choices: [[['真心话', '你更喜欢上一季的什么？我想听具体一点。'], ['两季比较', '两次旅行都不一样，咱们也慢慢认识彼此。'], ['带点花味', '正常的标准，要不也让我们听听？']]] },
      { caption: '羊羊还没回来，先把人找回来。', nodes: ['酒店找人', '归队以后'], choices: [
        [['分组寻找', '先核对最后见到他的地点，我和一个人出去找。'], ['说清信息', '地址和最后联系时间先放在一起，别漏消息。'], ['带点花味', '解释等人回来了再说，现在先把人找着。']],
        [['先接住人', '人先回来了，别站着说了，给他留口热饭。'], ['把话说开', '人找着了就好，刚才怎么没接上，等会儿我们慢慢说。'], ['不急着圆场', '回来就回来，别一句“没事”就把刚才全翻过去。']]
      ] },
      { caption: '刚吵完，这枕头接不接？', nodes: ['把话接住'], choices: [[['把话接住', '先玩这一轮，刚才的事等会儿再说。'], ['把自己说清楚', '我可以一起玩，不过刚才那件事我还想找时间说清楚。'], ['带点花味', '这局按游戏规则来，旧账别算进比分。']]] }
    ];
    async function isolateGameSessions(runtime, sessions) {
      const archived = runtime.workspaces.list.getSnapshot().archivedSessionIds || [];
      for (const [id, record] of Object.entries(sessions)) {
        if (record.gameId && !archived.includes(id)) await runtime.workspaces.archiveSession(id);
      }
    }
    function returnFromGame(runtime, sessions, parentId) {
      const seen = new Set();
      let target = parentId;
      while (target && sessions[target]?.gameId && !seen.has(target)) {
        seen.add(target); target = sessions[target].gameParentId;
      }
      if (target && !sessions[target]?.gameId && runtime.sessions.list.getSnapshot().byId[target]) runtime.sessions.open(target);
      else runtime.sessions.clear();
    }
    function nicknameText(text) {
      return members.reduce((value, member) => member.legacyName ? value.replaceAll(member.legacyName, member.name) : value, String(text || ''));
    }
    function gameDialogue(text) {
      text = nicknameText(text);
      const names = members.map(m => m.name).join('|');
      const marker = new RegExp('^\\s*(?:\\*\\*)?(' + names + ')(?:\\*\\*)?\\s*[：:](?:\\s*\\*\\*)?\\s*', 'gm');
      const matches = [...text.matchAll(marker)];
      if (!matches.length) return [{ text }];
      const parts = [];
      const intro = text.slice(0, matches[0].index).trim();
      if (intro) parts.push({ text: intro });
      matches.forEach((match, i) => {
        const member = members.find(m => m.name === match[1]);
        parts.push({ member, text: text.slice(match.index + match[0].length, matches[i + 1]?.index ?? text.length).trim() });
      });
      return parts;
    }
    function GameReply({ text }) {
      return gameDialogue(withoutOutcomeMeta(text)).map((part, i) => h('div', { key: i, className: 'hx-game-speaker' },
        part.member && h('img', { src: part.member.avatar, alt: '', className: 'hx-game-speaker-avatar' }),
        h('div', null, part.member && h('b', null, part.member.name), h('p', null, part.text))));
    }
    function GameMessage({ message: m }) {
      const result = m.speaker === '现场' && m.id !== 'stream' ? gameOutcome(m.text) : null;
      return h(React.Fragment, null,
        h('article', { className: m.speaker === '你' ? 'hx-play-message is-user' : 'hx-play-message', 'data-message-id': m.id }, m.speaker === '你' ? h(React.Fragment, null, h('b', null, '你'), h('p', null, m.text)) : h(GameReply, { text: m.text })),
        result && h('div', { className: 'hx-game-outcome', 'data-result-for': m.id, role: 'status' }, h('b', null, '阶段结果：' + result.result), h('p', { style: { whiteSpace: 'pre-line' } }, result.direction)));
    }
    function gameTranscript(entries) {
      const messages = []; let chunks = []; let running = false; let error = '';
      const textOf = content => Array.isArray(content) ? content.filter(b => b.type === 'text').map(b => b.text || '').join('\n') : typeof content === 'string' ? content : '';
      for (const { event } of entries) {
        if (event.type === 'turn/start') { running = true; error = ''; }
        if (event.type === 'step/start' || event.type === 'llm/retry') chunks = [];
        // DSH also logs injected context as user/message; only human input belongs in the game transcript.
        if (event.type === 'user/message' && event.data.source?.kind === 'user') {
          const text = visibleGameInput(textOf(event.data.content)); if (text) messages.push({ id: 'u' + event.seq, speaker: '你', text });
        }
        if (event.type === 'assistant/chunk') {
          const c = event.data.chunk;
          if (c.type === 'block-start') chunks[c.index] = '';
          if (c.type === 'text-delta') chunks[c.index] = (chunks[c.index] || '') + c.text;
        }
        if (event.type === 'assistant/message') {
          const text = textOf(event.data.message?.content); if (text) messages.push({ id: 'a' + event.seq, speaker: '现场', text }); chunks = [];
        }
        if (event.type === 'turn/end') { running = false; if (event.data?.error) error = event.data.error.message || '本轮续演未完成'; }
      }
      if (chunks.some(Boolean)) messages.push({ id: 'stream', speaker: '现场', text: chunks.filter(Boolean).join('\n') });
      return { messages, running, error };
    }
    function visibleGameInput(text) {
      return String(text || '').split(/\n\s*\n【阶段结果】/)[0].trim();
    }
    function gameOutcome(text) {
      const source = nicknameText(text);
      const field = name => source.match(new RegExp('^\\s*' + name + '\\s*[：:]\\s*([^\\n]+)', 'm'))?.[1]?.trim() || '';
      const result = field('本轮结果');
      const direction = field('现场走向');
      const labels = ['局面变化', '你的影响', '人物态度', '未解矛盾', '下一步'];
      const details = labels.map(label => [label, field(label)]);
      if (result.length < 4 || result.length > 40 || !direction || /[<>]|尚未定型/.test(result + direction)) return null;
      return { result, direction: direction + details.filter(([,value]) => value).map(([label,value]) => '\n' + label + '：' + value).join('') };
    }
    function withoutOutcomeMeta(text) {
      return String(text || '')
        .replace(/^\s*(?:本轮结果|现场结果|结果)\s*[：:].*$/gim, '')
        .replace(/^\s*(?:下一行写一句)?\s*(?:当前现场走向|现场走向|走向|局面变化|你的影响|人物态度|未解矛盾|下一步)\s*[：:].*$/gim, '')
        .replace(/\n{3,}/g, '\n\n').trim();
    }
    function GameExperience({ runtime, api, parentSessionId, selected, close }) {
      const savedGame = runtime.workbenches?.businessState('huaxue-game', {}) || {};
      const dialogRef = React.useRef(null);
      const sending = React.useRef(false);
      const [index, setIndex] = React.useState(savedGame.index ?? null);
      const [nodeIndex, setNodeIndex] = React.useState(savedGame.nodeIndex ?? 0);
      const [page, setPage] = React.useState(savedGame.page ?? '前情');
      const [gallery, setGallery] = React.useState(savedGame.gallery ?? '全部场景');
      const [line, setLine] = React.useState(savedGame.line ?? '');
      const [sid, setSid] = React.useState(savedGame.sid ?? null);
      const [records, setRecords] = React.useState([]);
      const [feedView, setFeedView] = React.useState({ messages: [], running: false });
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [ended, setEnded] = React.useState(savedGame.ended ?? false);
      const [outcome, setOutcome] = React.useState(savedGame.outcome ?? '');
      const [outcomeDirection, setOutcomeDirection] = React.useState(savedGame.outcomeDirection ?? '');
      const [awaiting, setAwaiting] = React.useState(false);
      const [lastLine, setLastLine] = React.useState('');
      React.useEffect(() => { Object.assign(savedGame, { index, nodeIndex, page, gallery, line, sid, ended, outcome, outcomeDirection }); }, [index, nodeIndex, page, gallery, line, sid, ended, outcome, outcomeDirection]);
      const endRef = React.useRef(null);
      const followMessages = React.useRef(true);
      const pendingResultTurn = React.useRef(null);
      const game = index === null ? null : games[index];
      const details = index === null ? null : gameDetails[index];
      const node = game?.nodes[nodeIndex];
      const running = busy || awaiting || feedView.running;
      const rowOf = async () => (await api.describe()).namespaces.find(r => r.ns === ns);
      async function saveRecord(id, changes) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const row = await rowOf();
          try { await api.mutate(ns, Object.entries(changes).map(([key, value]) => ({ op: 'set', path: ['sessions', id, key], value })), row.revision); return; }
          catch (e) { if (attempt === 2 || !/conflict|revision/i.test(e.message)) throw e; }
        }
      }
      React.useEffect(() => {
        if (runtime.workbenches) dialogRef.current.show(); else dialogRef.current.showModal();
        let live = true;
        const read = () => api.describe().then(data => {
          if (!live) return;
          const all = data.namespaces.find(r => r.ns === ns)?.value.sessions || {};
          setRecords(Object.entries(all).filter(([,r]) => r.gameId).map(([id,r]) => ({ id, ...r })).sort((a,b) => (b.gameCreatedAt || 0) - (a.gameCreatedAt || 0)));
        }).catch(e => { if (live) setError(e.message); });
        read(); const dispose = api.subscribe(read);
        return () => { live = false; dispose?.(); };
      }, [api, parentSessionId]);
      React.useEffect(() => {
        if (!sid) return;
        const session = runtime.sessions.binding(sid)?.session;
        if (!session) { setError('演练会话暂未连接，请重新打开这条记录。'); return; }
        let live = true;
        const read = () => {
          if (!live) return;
          const parsed = gameTranscript(session.eventSource.getSnapshot().entries);
          const state = session.getSnapshot();
          const failure = state.openError?.message || state.promptError?.error?.message || state.lastAgentError?.message || parsed.error;
          setFeedView({ ...parsed, running: state.running || state.awaitingFirstTurn || parsed.running });
          const pendingTurn = pendingResultTurn.current;
          const latestReply = [...parsed.messages].reverse().find(m => m.speaker === '现场');
          const found = pendingTurn && !parsed.running && !state.running && latestReply?.id !== 'stream' && parsed.messages.filter(m => m.speaker === '你').length >= pendingTurn ? gameOutcome(latestReply?.text) : null;
          if (found) {
            pendingResultTurn.current = null;
            setOutcome(found.result); setOutcomeDirection(found.direction);
            saveRecord(sid, { gameOutcome: found.result, gameOutcomeDirection: found.direction, gameTurnCount: pendingTurn }).catch(e => { if (live) setError(e.message); });
          }
          if (failure) { setError(failure); setAwaiting(false); }
          if (parsed.running || parsed.messages.at(-1)?.speaker === '现场' || session.eventSource.getSnapshot().entries.at(-1)?.event.type === 'turn/end') setAwaiting(false);
        };
        const a = session.eventSource.subscribe(read); const b = session.subscribe(read);
        session.open().then(async () => {
          // 记录可能来自已归档的游戏会话，重新进入时先恢复事件历史再渲染回看。
          try { await session.resync(); } catch (e) { if (live) setError(e.message); }
          read();
        }).catch(e => { if (live) setError(e.message); }); read();
        return () => { live = false; a(); b(); };
      }, [sid, runtime]);
      React.useEffect(() => {
        if (!sid || !lastLine) return;
        let live = true;
        const timer = setTimeout(async () => {
          const session = runtime.sessions.binding(sid)?.session;
          if (!session) return;
          try {
            await session.resync();
            if (!live) return;
            const parsed = gameTranscript(session.eventSource.getSnapshot().entries);
            const state = session.getSnapshot();
            if (!parsed.messages.length && !state.running && !state.awaitingFirstTurn) {
              setAwaiting(false);
              setError('未同步到本次接话记录，请点击同步回复检查会话。');
            }
          } catch (e) { if (live) { setAwaiting(false); setError(e.message || '同步回复失败'); } }
        }, 15000);
        return () => { live = false; clearTimeout(timer); };
      }, [sid, lastLine, runtime]);
      React.useEffect(() => {
        followMessages.current = true;
      }, [page, sid]);
      React.useEffect(() => {
        const list = endRef.current?.parentElement;
        if (page === '续演' && list && followMessages.current) list.scrollTop = list.scrollHeight;
      }, [feedView.messages, page, outcome, outcomeDirection]);
      function enter(i, n = 0) { setIndex(i); setNodeIndex(n); setPage('前情'); setSid(null); setLine(''); setLastLine(''); setError(''); setEnded(false); setOutcome(''); setOutcomeDirection(''); pendingResultTurn.current = null; setAwaiting(false); setFeedView({ messages: [], running: false }); }
      function resume(record) {
        const i = games.findIndex(g => g.nodes.some(n => n.id === record.gameId));
        if (i < 0) return;
        enter(i, games[i].nodes.findIndex(n => n.id === record.gameId)); setSid(record.id); setEnded(!!record.gameEnded); setOutcome(record.gameOutcome?.length >= 4 && record.gameOutcomeDirection ? record.gameOutcome : ''); setOutcomeDirection(record.gameOutcomeDirection || ''); setPage(record.gameEnded ? '回看' : '续演');
      }
      async function send() {
        if (!line.trim() || sending.current || running || ended) return;
        sending.current = true; followMessages.current = true; setBusy(true); setError('');
        try {
          let id = sid;
          if (!id) {
            const workspace = runtime.workspaces.list.getSnapshot().items.find(w => w.sessionIds.includes(parentSessionId));
            if (!workspace) throw Error('未找到当前工作区');
            id = await runtime.workbenches.create({ workbenchId: 'huaxue', workspaceId: workspace.workspaceId, background: true });
            const selection = await runtime.remote.agentPresets.select(id, 'huashao2');
            if (!selection.ok) throw Error(selection.error.message);
            await saveRecord(id, { activeMemberId: selected, initialMemberId: selected, gameId: node.id, gameParentId: parentSessionId, gameCreatedAt: Date.now(), gameFirstLine: line.trim(), gameEnded: false });
            setSid(id);
          }
          const session = runtime.sessions.binding(id)?.session;
          if (!session) throw Error('游戏会话未连接，请重试');
          await session.open();
          // 首轮创建后给 React 监听 effect 一个机会完成订阅，避免预设回复事件被漏读。
          if (!sid) await new Promise(resolve => setTimeout(resolve, 80));
          const transcriptBefore = gameTranscript(session.eventSource.getSnapshot().entries);
          const turnNumber = transcriptBefore.messages.filter(m => m.speaker === '你').length + 1;
          const userText = line.trim();
          const isResultTurn = turnNumber % 5 === 0;
          const promptText = isResultTurn ? userText + '\n\n【阶段结果】这是第 ' + turnNumber + ' 次接话，也是本阶段的第 5 轮。先正常完成本轮人物对话和现场反应，再依据已经发生的内容选择最贴切的阶段结果。不要结束游戏。总结最近五次用户接话及现场实际反应，相比阶段开始有哪些变化；不能只贴情绪标签，不能把沉默当成同意，不编造已和解、已离席或已确定的方案。回复末尾追加下列七行，每行必须完整，不要输出尖括号或复述规则：\n本轮结果：<6至16字的具体小标题，例如“住宿方案卡住，决定权先说清”>\n现场走向：<两句概括现在谈成了什么、没谈成什么>\n局面变化：<从本阶段起点到现在的变化，引用一个真实接话或动作作依据>\n你的影响：<用户哪句话改变了谁的回应；没有推动也如实说明，不打空泛分数>\n人物态度：<点名二至三位关键人物的当前立场和可观察反应，不猜测内心>\n未解矛盾：<一个尚未解决的具体分歧>\n下一步：<两种可以继续接话的方向及各自可能代价，不替用户决定、不强制结束>' : userText;
          if (isResultTurn) pendingResultTurn.current = turnNumber;
          setAwaiting(true);
          const result = await session.prompt([{ type: 'text', text: promptText }], 'queue');
          if (!result.ok) throw Error(result.error.message);
          setLastLine(userText); setLine(''); setPage('续演');
          await session.resync();
          await saveRecord(id, { gameTurnCount: turnNumber });
          if (!sid) await runtime.workspaces.archiveSession(id);
        } catch (e) { setAwaiting(false); setError(e.message || '发送失败，请重试'); }
        finally { sending.current = false; setBusy(false); }
      }
      async function stop() {
        const session = runtime.sessions.binding(sid)?.session;
        if (!session) return;
        try { const result = await session.cancel(); if (!result.ok) throw Error(result.error.message); setAwaiting(false); }
        catch (e) { setError(e.message); }
      }
      async function finish() {
        if (!sid || running) return;
        try { await saveRecord(sid, { gameEnded: true }); setEnded(true); }
        catch (e) { setError(e.message); }
      }
      const input = h('form', { className: 'hx-play-input', onSubmit: e => { e.preventDefault(); send(); } }, h('textarea', { value: line, onChange: e => setLine(e.target.value), placeholder: '你来接一句…', 'aria-label': '你的接话', maxLength: 4000, disabled: busy || ended, rows: 3 }), h('button', { type: 'submit', className: 'hx-pixel-primary hx-send', disabled: !line.trim() || running || ended, title: '发送接话', 'aria-label': '发送接话' }, '↑'));
      const tabs = h('nav', { className: 'hx-play-tabs', 'aria-label': '演练阶段' }, ['前情', '接话', '续演', '回看'].map(t => h('button', { key: t, 'aria-current': page === t ? 'page' : undefined, onClick: () => setPage(t) }, t)));
      const errorView = error && h('p', { className: 'hx-play-error', role: 'alert' }, error, ' ', sid && h('button', { onClick: () => { setError(''); runtime.sessions.binding(sid)?.session.resync().catch(e => setError(e.message)); } }, '同步回复'));
      let body;
      if (!game) {
        body = h('div', { className: 'hx-play-gallery' }, h('h1', null, gallery === '全部场景' ? '第八位嘉宾' : '你开过的麦。'), h('p', { className: 'hx-play-intro' }, gallery === '全部场景' ? '今天，选一个进去“喷”。' : '演练记录'),
          h('nav', { className: 'hx-play-tabs' }, ['全部场景', '演练记录'].map(t => h('button', { key: t, onClick: () => setGallery(t), 'aria-current': gallery === t ? 'page' : undefined }, t))),
          gallery === '全部场景' ? h('div', { className: 'hx-play-cards' }, games.map((g,i) => h('article', { key: g.title, className: 'hx-pixel-frame hx-scene-card', style: { '--scene-color': ['#e53b33','#bc4c46','#ab4a6f','#cf794e','#e53b33'][i] } },
            h('img', { className: 'hx-scene-art', src: gameArt['game-scene-' + i], alt: '' }), h('h2', null, g.title), h('p', null, gameDetails[i].caption),
            h('div', { className: 'hx-scene-nodes' }, g.nodes.map((n,j) => h('button', { key: n.id, onClick: () => enter(i,j) }, gameDetails[i].nodes[j] || n.title))),
            h('button', { className: 'hx-pixel-primary', onClick: () => enter(i) }, '进入现场 →')))) : h('div', { className: 'hx-play-records' }, records.length ? records.map(r => {
              const i = games.findIndex(g => g.nodes.some(n => n.id === r.gameId));
              if (i < 0) return null;
              return h('article', { key: r.id, className: 'hx-pixel-frame hx-play-record' }, h('img', { src: gameArt['game-scene-' + i], alt: '' }), h('div', null, h('h2', null, games[i].title), h('p', null, r.gameFirstLine || '演练记录'), h('small', null, r.gameEnded ? '已结束' : '进行中')), h('button', { className: r.gameEnded ? '' : 'hx-pixel-primary', onClick: () => resume(r) }, r.gameEnded ? '查看回放' : '继续演练'));
            }) : h('p', { className: 'hx-play-empty' }, '还没有演练记录。')));
      } else {
        const participants = members.filter(m => node.participants.includes(m.name) && !(m.id === 'yang' && node.participants.includes('羊羊不在场')));
        const nodeChoices = details.choices[nodeIndex] || details.choices[0];
        let content;
        if (page === '前情') content = h(React.Fragment, null,
          h('div', { className: 'hx-play-scene-heading' }, h('div', null, h('h1', null, game.title), h('p', null, '剧情摘要 · 非节目原话')), h('img', { src: gameArt['game-scene-' + index], alt: '' })),
          h('p', { className: 'hx-play-summary' }, node.summary), h('h3', null, '接话节点'),
          h('div', { className: 'hx-play-node-tabs' }, game.nodes.map((n,j) => h('button', { key: n.id, disabled: !!sid, 'aria-pressed': j === nodeIndex, onClick: () => { setNodeIndex(j); setLine(''); } }, details.nodes[j] || n.title))),
          h('div', { className: 'hx-play-invitation' }, h('h2', null, '现在，你来接话。'), h('p', null, '大家还没谈拢。你想先把哪件事说清楚？')),
          h('details', { className: 'hx-play-program-notes' }, h('summary', null, '节目走向与资料出处'), h('p', { className: 'hx-play-summary' }, node.outcome), h('h3', null, '资料出处'), h('div', { className: 'hx-play-sources' }, (node.sources || []).map((s,i) => h('p', { key: i }, h('a', { href: s.url, target: '_blank', rel: 'noreferrer' }, s.title), h('small', null, s.window))))),
          h('div', { className: 'hx-play-bottom-actions' }, h('button', { className: 'hx-pixel-primary', onClick: () => setPage('接话') }, '我来接一句')));
        if (page === '接话') content = h(React.Fragment, null,
          h('div', { className: 'hx-play-scene-heading' }, h('div', null, h('h1', null, index === 4 ? '这枕头，你怎么接？' : '这一句，你怎么接？'), h('p', null, details.caption)), h('img', { src: gameArt['game-scene-' + index], alt: '' })),
          h('div', { className: 'hx-play-choices', role: 'radiogroup', 'aria-label': '接话方向' }, nodeChoices.map(([label,text]) => h('label', { key: label, className: line === text ? 'selected' : '' }, h('input', { type: 'radio', name: 'game-choice', checked: line === text, disabled: running || ended, onChange: () => setLine(text) }), h('span', null, h('b', null, label), h('span', null, text))))), input, h('small', null, '你的接话'));
        if (page === '续演') content = h(React.Fragment, null, h('div', { className: 'hx-play-live-title' }, h('h1', null, '现场继续'), h('small', null, ended ? '已结束' : 'AI 虚构续演')),

          h('div', { className: 'hx-play-messages', 'aria-live': 'polite', onScroll: e => { const el = e.currentTarget; followMessages.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64; } }, feedView.messages.length ? feedView.messages.map(m => h(GameMessage, { key: m.id, message: m })) : h('p', { className: 'hx-play-empty' }, lastLine ? '你：' + lastLine : '这一场，等你开麦。'), !feedView.messages.length && outcome && h('div', { className: 'hx-game-outcome', role: 'status' }, h('b', null, '阶段结果：' + outcome), h('p', { style: { whiteSpace: 'pre-line' } }, outcomeDirection)), running && h('p', { role: 'status' }, '正在接话…'), h('div', { ref: endRef })),
          !sid && h('button', { className: 'hx-pixel-primary', onClick: () => setPage('接话') }, '我来接一句'),
          sid && !ended && input,
          sid && h('div', { className: 'hx-play-bottom-actions' }, running ? h('button', { onClick: stop }, '停止生成') : !ended && h('button', { onClick: finish }, '结束本次演练'), ended && h('button', { onClick: () => enter(index,nodeIndex) }, '再试一种说法')));
        if (page === '回看') content = h(React.Fragment, null,
          h('h1', null, '接话历史'),
          !sid && h('div', { className: 'hx-play-records' }, records.filter(r => game.nodes.some(n => n.id === r.gameId)).map(r => h('article', { key: r.id, className: 'hx-play-record' }, h('div', null, h('h2', null, game.nodes.find(n => n.id === r.gameId)?.title), h('p', null, r.gameFirstLine || '演练记录')), h('button', { onClick: () => { resume(r); setPage('回看'); } }, '查看接话历史')))),
          (sid || !records.some(r => game.nodes.some(n => n.id === r.gameId))) && h('div', { className: 'hx-play-history' }, feedView.messages.length ? feedView.messages.map(m => h(GameMessage, { key: m.id, message: m })) : h('p', { className: 'hx-play-empty' }, '这次演练还没有接话记录。')),
          h('div', { className: 'hx-play-bottom-actions' }, h('button', { onClick: () => { setIndex(null); setGallery('演练记录'); } }, '全部演练记录'), sid && !ended && h('button', { className: 'hx-pixel-primary', onClick: () => setPage('续演') }, '继续接话')));
        body = h('div', { className: 'hx-play-layout' }, h('aside', { className: 'hx-pixel-frame hx-play-sidebar' }, h('small', null, '第 ' + String(index+1).padStart(2,'0') + ' 场'), h('h2', null, game.title), h('p', null, details.caption), h('hr'), h('h3', null, '相关成员'), h('div', { className: 'hx-play-members' }, participants.map(m => h('div', { key: m.id }, h('img', { src: m.avatar, alt: '' }), h('span', null, m.name)))), h('hr'), h('h2', { className: 'hx-play-you' }, '你'), h('p', null, '第八位嘉宾'), h('div', { className: 'hx-play-sidebar-actions' }, h('button', { disabled: running, onClick: () => enter(index,nodeIndex) }, '↶ 换一种说法'), h('button', { onClick: () => { setIndex(null); setGallery('全部场景'); } }, '▦ 全部场景'))), h('main', { className: 'hx-pixel-frame hx-play-main' }, tabs, h('div', { className: 'hx-play-content' }, content, errorView)));
      }
      return h('dialog', { ref: dialogRef, className: 'hx-play' + (game ? ' hx-play-detail' : '') + (game && page === '续演' ? ' hx-play-live' : ''), 'aria-label': '第八位嘉宾', onCancel: e => { e.preventDefault(); close(); } }, h('header', { className: 'hx-play-header' }, h('b', null, 'DSH Desktop by Dataelem'), h('strong', null, '第八位嘉宾'), h('small', null, '花少2'), h('button', { onClick: close }, '▦ 返回工作台')), body, !game && errorView, h('footer', { className: 'hx-play-footer', 'aria-hidden': true, 'data-scene': index ?? 'gallery', style: { '--hx-footer-art': 'url(' + JSON.stringify(gameArt['game-scene-' + (index ?? 0)]) + ')' } }));
    }

