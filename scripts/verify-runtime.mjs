import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const app = process.argv[2]; if (!app) throw Error('Pass the DSH resources/app directory');
const installed = pathToFileURL(app.replace(/[\\/]$/, '') + '/package.json').href;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@deepseek-ai/') || specifier === 'yaml') return nextResolve(specifier, { ...context, parentURL: installed });
  return nextResolve(specifier, context);
} });
const { Context } = await import('@deepseek-ai/cordis');
const { default: Settings } = await import('@deepseek-ai/dsh-settings');
const { default: SystemPrompt, renderPrompt } = await import('@deepseek-ai/dsh-system-prompt');
const plugin = await import('../src/business.js');
const { NAMESPACE, selectionOps } = await import('../src/core.js');
class MemorySettings extends Settings {
  writable = true;
  async load() { return {}; }
  async persist(value) { return value; }
}
const ctx = new Context();
try {
  await ctx.plugin(MemorySettings);
  await ctx.plugin(SystemPrompt, { personaPrefix: 'BASE PERSONA' });
  await ctx.plugin(await import('../src/host.js'));
  await ctx.plugin(plugin);
  const agent = { session: { id: 'native-test', header: { agentPreset: 'standard' }, events: [{ type: 'agent-preset/selected', data: { agentPreset: 'huashao2' } }, { type: 'turn/start', data: { turn: 1 } }] } };
  const { assembleContextFor } = await import('@deepseek-ai/dsh-agent');
  // Mirror the installed Session API: no public .events property.
  const events = agent.session.events;
  delete agent.session.events;
  agent.session.snapshotEvents = () => Object.freeze([...events]);
  const first = await ctx.systemPrompt.assemble(assembleContextFor(agent));
  assert.ok(renderPrompt(first).includes('[huaxue:dialogue-v2.4:ning]'));
  assert.ok(renderPrompt(first).includes('DeepSeek Harness'));
  assert.ok(!renderPrompt(first).includes('BASE PERSONA'));
  assert.equal(first.sections.filter(s => s.name === 'deployment:persona-prefix').length, 1);
  await ctx.settings.mutate(NAMESPACE, selectionOps(agent.session.id, 'qing'));
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({ agent })).includes('[huaxue:dialogue-v2.4:ning]'));
  events.push({ type: 'turn/start', data: { turn: 2 } });
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({ agent })).includes('[huaxue:dialogue-v2.4:qing]'));
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({})).includes('BASE PERSONA'));
  await assert.rejects(ctx.settings.mutate(NAMESPACE, selectionOps('native-test', 'mao'), -1));
  assert.equal(ctx.settings.get(NAMESPACE).sessions['native-test'].activeMemberId, 'qing');
  assert.deepEqual(ctx.settings.get(NAMESPACE).sessions['native-test'].turnMembers, { '1': 'ning', '2': 'qing' });
  await ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['sessions', 'native-test', 'switchNotice'], value: { memberId: 'qing', afterTurn: 1 } }]);
  assert.deepEqual(ctx.settings.get(NAMESPACE).sessions['native-test'].switchNotice, { memberId: 'qing', afterTurn: 1 });
  await ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['skin'], value: { image: '', opacity: .25, position: 'bottom', fit: 'contain', filename: '' } }]);
  assert.equal(ctx.settings.get(NAMESPACE).skin.fit, 'contain');
  assert.equal(ctx.settings.get(NAMESPACE).skin.position, 'bottom');
  await assert.rejects(ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['skin', 'fit'], value: 'invalid' }]));
  await ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['sessions', 'native-test', 'gameId'], value: 'S08' }]);
  events.push({ type: 'turn/start', data: { turn: 3 } });
  const gamePrompt = renderPrompt(await ctx.systemPrompt.assemble(assembleContextFor(agent)));
  assert.ok(gamePrompt.includes('[huaxue-game:S08]'));
  assert.ok(gamePrompt.includes('羊羊不在酒店'));
  assert.ok(!gamePrompt.includes('observedOutcome'));
  await ctx.settings.mutate('dsh-workbenches', [
    { op: 'set', path: ['installed','huaxue'], value: true },
    { op: 'set', path: ['bindings','bound-standard'], value: 'huaxue' },
    { op: 'set', path: ['bindings','other-workbench'], value: 'other' }
  ]);
  const bound = { session: { id: 'bound-standard', header: { agentPreset: 'standard' }, snapshotEvents: () => [] } };
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({ agent: bound })).includes('[huaxue:'));
  await ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['sessions','bound-standard'], value: {activeMemberId:'ning', gameId:'S08'} }]);
  const standardGame = {session:{id:'bound-standard', header:{agentPreset:'standard'}, snapshotEvents:()=>[]}};
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({agent:standardGame})).includes('[huaxue-game:S08]'));
  const other = { session: { id: 'other-workbench', header: { agentPreset: 'huashao2' }, snapshotEvents: () => [] } };
  assert.ok(!renderPrompt(await ctx.systemPrompt.assemble({ agent: other })).includes('[huaxue:'));
  // Official ownership host: repository-derived identity authorizes sessions;
  // foreign owners keep their sessions isolated even with a legacy preset.
  const ownershipData = { sessionBindings: { 'official-bound': 'gjz18342624299-arch/dsh-huaxue-workbench', 'foreign-bound': 'acme/elsewhere' } };
  ctx.reflect.provide('desktopWorkbenchOwnership', { read: async () => ownershipData });
  const officialBound = { session: { id: 'official-bound', header: { agentPreset: 'standard' }, snapshotEvents: () => [] } };
  assert.ok(renderPrompt(await ctx.systemPrompt.assemble({ agent: officialBound })).includes('[huaxue:'));
  const foreign = { session: { id: 'foreign-bound', header: { agentPreset: 'huashao2' }, snapshotEvents: () => [] } };
  assert.ok(!renderPrompt(await ctx.systemPrompt.assemble({ agent: foreign })).includes('[huaxue:'));
  console.log('Installed DSH runtime: host workbench service, standard-preset persona binding, cross-workbench isolation, settings validation, turn snapshots and switching PASS');
} finally { await ctx.fiber.dispose(); }
