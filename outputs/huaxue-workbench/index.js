import z from '@deepseek-ai/schemastery';
import { createTurnResolver, NAMESPACE, sessionEvents, validateState } from './core.js';

export const name = 'huaxue-workbench';
export const inject = ['settings', 'systemPrompt', 'workbenches'];
export function apply(ctx) {
  const scope = ctx.settings.register(NAMESPACE, z.object({
    lastMemberId: z.string().default('ning'),
    skin: z.object({ image: z.string().default(''), opacity: z.number().default(0.15), position: z.string().default('center'), fit: z.string().default('cover'), filename: z.string().default('') }).default({ image: '', opacity: 0.15, position: 'center', fit: 'cover', filename: '' }),
    sessions: z.dict(z.object({ activeMemberId: z.string().required(), initialMemberId: z.string(), gameId: z.string(), gameParentId: z.string(), gameCreatedAt: z.number(), gameFirstLine: z.string(), gameEnded: z.boolean(), turnMembers: z.dict(z.string()).default({}), switchNotice: z.object({ memberId: z.string(), afterTurn: z.number() }).default({}) })).default({})
  }), { validate: validateState });
  const resolve = createTurnResolver(() => scope.get(), id => ctx.workbenches.owner(id), id => ctx.workbenches.installed(id));
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const agent = context?.agent ?? (context?.scope?.session ? context.scope : undefined);
    if (!agent) return next();
    const snapshot = resolve(agent);
    if (!snapshot) return next();
    // Persist the resolved turn identity, including recoverable historical turns.
    // Settings may change during a reply; attribution must never follow that change.
    const turnMembers = {};
    let historicalTurn;
    for (const event of sessionEvents(agent.session)) {
      if (event.type === 'turn/start') historicalTurn = event.data.turn;
      if (event.type === 'request/header' && historicalTurn !== undefined) {
        const system = event.data.header?.system;
        const match = typeof system === 'string' && system.match(/\[huaxue:[^:\]]+:(mao|qing|ning|chen|jing|yang|zheng)\]/);
        if (match) turnMembers[historicalTurn] = match[1];
      }
    }
    turnMembers[snapshot.turn] = snapshot.memberId;
    if (!scope.get().sessions[snapshot.sessionId]) {
      const descriptor = ctx.settings.describe().find(d => d.ns === NAMESPACE);
      try {
        await ctx.settings.mutate(NAMESPACE, [{ op: 'set', path: ['sessions', snapshot.sessionId, 'activeMemberId'], value: snapshot.memberId }], descriptor.revision);
      } catch (error) {
        if (error.code !== 'SETTINGS_CONFLICT' || !scope.get().sessions[snapshot.sessionId]) throw error;
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = scope.get().sessions[snapshot.sessionId]?.turnMembers || {};
      const ops = Object.entries(turnMembers).filter(([turn, id]) => current[turn] !== id).map(([turn, id]) => ({ op: 'set', path: ['sessions', snapshot.sessionId, 'turnMembers', turn], value: id }));
      if (!ops.length) break;
      try {
        const descriptor = ctx.settings.describe().find(d => d.ns === NAMESPACE);
        await ctx.settings.mutate(NAMESPACE, ops, descriptor.revision); break;
      } catch (error) { if (error.code !== 'SETTINGS_CONFLICT' || attempt === 2) throw error; }
    }
    const resolved = await next();
    const persona = resolved.sections.find(s => s.name === 'deployment:persona');
    return {
      ...resolved,
      sections: [...resolved.sections.filter(s => s.name !== 'deployment:persona'), { ...(persona ?? { name: 'deployment:persona' }), text: snapshot.text }]
    };
  }, { global: true });
}

