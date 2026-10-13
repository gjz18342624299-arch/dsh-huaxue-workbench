import { test } from 'node:test';
import assert from 'node:assert/strict';
import { members, createTurnResolver, personaText, selectionOps, validateState, messageAttributions, gameText } from '../src/core.js';
import { gameReactions } from '../src/game-personas.js';

test('game assembly includes distinct reactions and isolates the dinner-scene direction', () => {
  const dinner = gameText('S21');
  for (const m of members) assert.ok(dinner.includes(gameReactions[m.id]));
  assert.ok(dinner.includes('本场虚构演绎锚点'));
  assert.ok(!gameText('S04').includes('本场虚构演绎锚点'));
  assert.ok(!personaText('ning').includes('本场虚构演绎锚点'));
  const state = { lastMemberId: 'ning', sessions: { game: { activeMemberId: 'ning', gameId: 'S21' } } };
  const agent = { session: { id: 'game', header: { agentPreset: 'huashao2' }, events: [{ type: 'turn/start', data: { turn: 1 } }] } };
  assert.equal(createTurnResolver(() => state)(agent).text, dinner);
});

test('only the selected persona is loaded and v2.4 is preserved', () => {
  assert.equal(members.length, 7);
  for (const p of members) {
    const text = personaText(p.id);
    assert.ok(text.includes(p.prompt));
    for (const other of members.filter(m => m.id !== p.id)) assert.ok(!text.includes(other.prompt));
    assert.ok(text.includes('花学拆解'));
    assert.ok(text.includes('严格格式'));
  }
});
test('switching preserves an active turn and applies at the next turn, even with the same signal', () => {
  const state = { lastMemberId: 'ning', sessions: { a: { activeMemberId: 'ning' } } };
  const session = { id: 'a', header: { agentPreset: 'huashao2' }, events: [{ type: 'turn/start', data: { turn: 1 } }] };
  const agent = { session };
  const resolve = createTurnResolver(() => state);
  const first = resolve(agent);
  state.sessions.a.activeMemberId = 'qing';
  assert.equal(resolve(agent), first);
  session.events.push({ type: 'turn/start', data: { turn: 2 } });
  assert.equal(resolve(agent).memberId, 'qing');
  assert.equal(first.memberId, 'ning');
});
test('old sessions use their own member; new sessions inherit only the preference', () => {
  const resolve = createTurnResolver(() => ({ lastMemberId: 'yang', sessions: { old: { activeMemberId: 'mao' } } }));
  const agent = id => ({ session: { id, header: { agentPreset: 'huashao2' }, events: [{ type: 'turn/start', data: { turn: 1 } }] } });
  assert.equal(resolve(agent('old')).memberId, 'mao');
  assert.equal(resolve(agent('new')).memberId, 'yang');
  assert.equal(resolve({ session: { header: { agentPreset: 'default' } } }), null);
});
test('selection rejects invalid members and object prototype paths', () => {
  for (const id of ['__proto__', 'constructor', 'prototype', '']) assert.throws(() => selectionOps(id, 'ning'));
  assert.throws(() => selectionOps('a', 'unknown'));
  assert.throws(() => validateState({ lastMemberId: 'unknown', sessions: {} }));
  assert.deepEqual(selectionOps('a', 'qing')[1].path, ['sessions', 'a', 'activeMemberId']);
});
test('native mode selection events override the immutable creation header, including reentry', () => {
  const session = { id: 'a', header: { agentPreset: 'standard' }, events: [] };
  const resolve = createTurnResolver(() => ({ lastMemberId: 'ning', sessions: {} }));
  session.events.push({ type: 'agent-preset/selected', data: { agentPreset: 'huashao2' } }, { type: 'turn/start', data: { turn: 1 } });
  assert.equal(resolve({ session }).memberId, 'ning');
  session.events.push({ type: 'agent-preset/selected', data: { agentPreset: 'standard' } });
  assert.equal(resolve({ session }), null);
  session.events.push({ type: 'agent-preset/selected', data: { agentPreset: 'huashao2' } }, { type: 'turn/start', data: { turn: 2 } });
  assert.equal(resolve({ session }).memberId, 'ning');
});
test('history attribution is recovered from persisted request headers, never the current selection', () => {
  const events = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'request/header', data: { header: { system: personaText('ning') } } },
    { type: 'assistant/message', data: { id: 'm1' } },
    { type: 'turn/start', data: { turn: 2 } },
    { type: 'request/header', data: { header: { system: personaText('qing') } } },
    { type: 'assistant/message', data: { id: 'm2' } }
  ];
  const map = messageAttributions(JSON.parse(JSON.stringify(events)));
  assert.equal(map.m1.memberId, 'ning');
  assert.equal(map.m2.memberId, 'qing');
  events.push({ type: 'turn/start', data: { turn: 3 } }, { type: 'assistant/message', data: { id: 'm3' } });
  assert.equal(messageAttributions(events).m3.memberId, 'qing');
});

test('game archive accepts saved outcomes and rejects invalid result metadata', () => {
  const session = { activeMemberId: 'ning', gameId: 'S21', gameTurnCount: 3, gameOutcome: '保留的演练结果', gameOutcomeDirection: '继续协作' };
  const state = patch => ({ lastMemberId: 'ning', sessions: { game: { ...session, ...patch } } });
  assert.doesNotThrow(() => validateState(state({})));
  for (const gameTurnCount of [-1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => validateState(state({ gameTurnCount })), /演练轮次/);
  for (const key of ['gameOutcome', 'gameOutcomeDirection']) for (const value of [3, 'x'.repeat(10001)]) assert.throws(() => validateState(state({ [key]: value })), /演练结果/);
});
