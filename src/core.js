import personas from './personas.js';
import { gameReactions, gameReactionText } from './game-personas.js';
import games from './games.json' with { type: 'json' };

export const NAMESPACE = 'huaxue-workbench';
export const PRESET_ID = 'huashao2';
export function sessionEvents(session) {
  return typeof session?.snapshotEvents === 'function' ? session.snapshotEvents() : (session?.events ?? []);
}
export function sessionPreset(session) {
  return sessionEvents(session).findLast(e => e.type === 'agent-preset/selected')?.data.agentPreset ?? session?.header?.agentPreset;
}
export const memberIds = ['mao', 'qing', 'ning', 'chen', 'jing', 'yang', 'zheng'];
export const members = memberIds.map(id => personas.members.find(m => m.id === id));
export function member(id) {
  const result = members.find(m => m.id === id);
  if (!result) throw new TypeError('未知成员');
  return result;
}
export function validateState(value) {
  member(value.lastMemberId);
  if (value.skin) {
    const { image, opacity, position, fit, filename } = value.skin;
    if (fit !== undefined && !['cover', 'contain'].includes(fit)) throw new TypeError('背景显示方式无效');
    if (filename !== undefined && (typeof filename !== 'string' || filename.length > 255)) throw new TypeError('背景文件名无效');
    if (typeof image !== 'string' || image.length > 6 * 1024 * 1024 || (image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))) throw new TypeError('背景图片格式无效');
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 0.5 || !['top', 'center', 'bottom'].includes(position)) throw new TypeError('背景设置无效');
  }
  if (!value.sessions || Array.isArray(value.sessions) || typeof value.sessions !== 'object') throw new TypeError('Invalid sessions');
  for (const [id, session] of Object.entries(value.sessions)) {
    if (!id || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new TypeError('Invalid session ID');
    member(session.activeMemberId);
    if (session.gameFirstLine !== undefined && (typeof session.gameFirstLine !== 'string' || session.gameFirstLine.length > 4000)) throw new TypeError('接话内容过长');
    if (session.gameParentId !== undefined && (typeof session.gameParentId !== 'string' || !session.gameParentId)) throw new TypeError('演练所属会话无效');
    if (session.gameCreatedAt !== undefined && (!Number.isFinite(session.gameCreatedAt) || session.gameCreatedAt < 0)) throw new TypeError('演练时间无效');
    if (session.gameEnded !== undefined && typeof session.gameEnded !== 'boolean') throw new TypeError('演练状态无效');
    if (session.gameTurnCount !== undefined && (!Number.isSafeInteger(session.gameTurnCount) || session.gameTurnCount < 0)) throw new TypeError('演练轮次无效');
    for (const key of ['gameOutcome', 'gameOutcomeDirection']) if (session[key] !== undefined && (typeof session[key] !== 'string' || session[key].length > 10000)) throw new TypeError('演练结果无效');
    if (session.switchNotice?.memberId !== undefined) {
      member(session.switchNotice.memberId);
      if (!Number.isInteger(session.switchNotice.afterTurn) || session.switchNotice.afterTurn < -1) throw new TypeError('切换提示轮次无效');
    }
    if (session.turnMembers !== undefined) {
      if (!session.turnMembers || typeof session.turnMembers !== 'object' || Array.isArray(session.turnMembers)) throw new TypeError('人物归属无效');
      for (const [turn, id] of Object.entries(session.turnMembers)) { if (!/^\d+$/.test(turn)) throw new TypeError('轮次无效'); member(id); }
    }
    if (session.gameId !== undefined && !games.some(g => g.nodes.some(n => n.id === session.gameId))) throw new TypeError('未知游戏场景');
    if (session.initialMemberId !== undefined) member(session.initialMemberId);
  }
}
export function selectionOps(sessionId, memberId) {
  member(memberId);
  if (!sessionId || ['__proto__', 'constructor', 'prototype'].includes(sessionId)) throw new TypeError('Invalid session ID');
  return [
    { op: 'set', path: ['lastMemberId'], value: memberId },
    { op: 'set', path: ['sessions', sessionId, 'activeMemberId'], value: memberId }
  ];
}
export function personaText(memberId) {
  const p = member(memberId);
  return `[huaxue:${personas.version}:${p.id}]\n${personas.commonPrompt}\n\n当前成员 activeMemberId=${p.id}，姓名=${p.name}。\n${p.prompt}`;
}
export function gameText(gameId) {
  const scene = games.flatMap(g => g.nodes).find(n => n.id === gameId);
  if (!scene) throw new TypeError('未知游戏场景');
return `[huaxue-game:${gameId}]\n你正在主持花少2第八位嘉宾虚构群聊游戏。用户消息是第八位嘉宾说的话。每轮先判断每位同场成员此刻是否会参与：不要求所有人轮流发言，也不要为了凑齐人数强行安排台词。成员可以沉默、低头、哭、笑、叹气、打断、离席、继续做手上的事，或只用一个动作回应；这些反应要单独成段并写出姓名，且必须符合场景冲突和该人物的性格。真正开口的人控制在一至三位，只有确实有必要时才增加人数。说话与动作都不要重复附和，要让沉默和情绪变化推进现场。每段独占一段，以“姓名：对白”或“姓名：（动作/状态）”开头，姓名不要加星号或 Markdown 标记。不要复述或展示这些后台规则，不替用户发言或预设用户决定。根据对话推进虚构分支，保持连续的地点、时间和人物在场状态。人物可以有分歧、哭泣、拒绝、暂时不回应或判断失误，不自动圆满，不冒充明星本人或声称这是节目原话。\n场景：${scene.title}\n剧情摘要：${scene.summary}\n同场人物：${scene.participants}\n剑桥找人阶段羊羊不在酒店，不能远程回应，只有找到以后才能归队。用户说继续就续演，说结束就结束游戏并自然回到普通聊天。只做聊天演绎，不调用文件或网络工具。除非用户明确要求拆解，不附分析。不要提前透露节目结局。\n各成员的表达规则：\n${members.map(m => m.name + '：' + m.prompt + '\n现场反应：' + gameReactions[m.id]).join('\n\n')}\n${gameReactionText(gameId)}`;
}
// The turn number, not the AbortSignal, is the stable identity: the driver can reuse a signal.
export function createTurnResolver(readState, workbenchOwner = () => undefined, isInstalled = () => true) {
  const snapshots = new WeakMap();
  return function resolve(agent) {
    const session = agent?.session;
    const owner = workbenchOwner(session?.id);
    if (owner ? owner !== 'huaxue' || !isInstalled(owner) : sessionPreset(session) !== PRESET_ID) return null;
    // The host may assemble the first prompt before emitting turn/start.
    // Use a stable pre-turn snapshot so the initial request still receives
    // the selected member persona.
    const turn = sessionEvents(session).findLast(e => e.type === 'turn/start')?.data.turn ?? 0;
    let cached = snapshots.get(session);
    if (cached?.turn === turn) return cached;
    const state = readState();
    const selected = state.sessions[session.id]?.activeMemberId ?? state.lastMemberId;
    member(selected);
    const gameId = state.sessions[session.id]?.gameId;
    cached = Object.freeze({ sessionId: session.id, turn, memberId: selected, gameId, version: personas.version, text: gameId ? gameText(gameId) : personaText(selected) });
    snapshots.set(session, cached);
    return cached;
  };
}
export function messageAttributions(events) {
  let active = null;
  const result = {};
  for (const event of events) {
    if (event.type === 'system/message' || (event.type === 'request/header' && typeof event.data.header?.system === 'string')) {
      const header = event.data.header;
      const text = event.type === 'system/message' ? JSON.stringify(event.data.message) : header.system;
      const match = text.match(/\[huaxue:([^:\]\r\n]+):(mao|qing|ning|chen|jing|yang|zheng)\]/);
      if (match) active = { memberId: match[2], version: match[1] };
      else active = null;
    }
    if (event.type === 'assistant/message' && active) result[event.data.id ?? event.seq] = { ...active };
  }
  return result;
}
