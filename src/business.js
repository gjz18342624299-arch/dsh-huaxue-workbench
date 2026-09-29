import z from '@deepseek-ai/schemastery';
import { createTurnResolver, NAMESPACE, sessionEvents, validateState } from './core.js';

export const name = 'huaxue-workbench';
export const inject = ['huaxueState', 'systemPrompt'];
// Official workbench identity (owner/repository from the package repository),
// plus the legacy local id kept read-only for sessions bound before the
// official host existed.
const OFFICIAL_ID = 'gjz18342624299-arch/dsh-huaxue-workbench';
const LEGACY_NAMESPACE = 'dsh-workbenches';
const LEGACY_ID = 'huaxue';
export function apply(ctx) {
  const scope = ctx.huaxueState.register(NAMESPACE, z.object({
    lastMemberId: z.string().default('ning'),
    skin: z.object({ image: z.string().default(''), opacity: z.number().default(0.15), position: z.string().default('center'), fit: z.string().default('cover'), filename: z.string().default('') }).default({ image: '', opacity: 0.15, position: 'center', fit: 'cover', filename: '' }),
    sessions: z.dict(z.object({ activeMemberId: z.string().required(), initialMemberId: z.string(), gameId: z.string(), gameParentId: z.string(), gameCreatedAt: z.number(), gameFirstLine: z.string(), gameEnded: z.boolean(), turnMembers: z.dict(z.string()).default({}), switchNotice: z.object({ memberId: z.string(), afterTurn: z.number() }).default({}) })).default({})
  }), { validate: validateState });
  const legacyBindings = () => {
    try { return ctx.huaxueState.get(LEGACY_NAMESPACE)?.bindings || {}; } catch { return {}; }
  };
  // Ownership comes from the official host first; the legacy local map and
  // our own game records only authorize sessions this workbench created.
  // The official read is async, so it is cached: the resolver below must stay
  // synchronous and is created once to keep its per-turn attribution cache.
  let ownershipCache;
  const ownershipService = () => { try { return ctx.get('desktopWorkbenchOwnership'); } catch { return undefined; } };
  const refreshOwnership = async () => {
    const service = ownershipService();
    if (!service) return;
    try { ownershipCache = await service.read(); } catch { /* keep the previous cache */ }
  };
  const ownerOf = sessionId => {
    if (!sessionId) return undefined;
    const binding = ownershipCache?.sessionBindings?.[sessionId];
    if (binding) return binding === OFFICIAL_ID ? LEGACY_ID : binding;
    const legacy = legacyBindings()[sessionId];
    if (legacy) return legacy;
    if (scope.get().sessions[sessionId]?.gameId) return LEGACY_ID;
    return undefined;
  };
  ctx.effect(() => {
    const service = ownershipService();
    refreshOwnership();
    return typeof service?.onChange === 'function' ? service.onChange(() => refreshOwnership()) : undefined;
  }, 'huaxue.ownership');
  const resolve = createTurnResolver(() => scope.get(), ownerOf, () => true);
  ctx.on('system-prompt/assemble', async (assembly, context, next) => {
    const agent = context?.agent ?? (context?.scope?.session ? context.scope : undefined);
    if (!agent) return next();
    // Bindings are written right before the first prompt; never let a stale
    // cache decide the very first turn.
    await refreshOwnership();
    const snapshot = resolve(agent);
    if (!snapshot) return next();
    // Persist the resolved turn identity, including recoverable historical turns.
    // Settings may change during a reply; attribution must never follow that change.
    const turnMembers = {};
    let historicalTurn;
    for (const event of sessionEvents(agent.session)) {
      if (event.type === 'turn/start') historicalTurn = event.data.turn;
      if ((event.type === 'request/header' || event.type === 'system/message') && historicalTurn !== undefined) {
        const system = event.type === 'system/message' ? JSON.stringify(event.data.message) : event.data.header?.system;
        const match = typeof system === 'string' && system.match(/\[huaxue:[^:\]]+:(mao|qing|ning|chen|jing|yang|zheng)\]/);
        if (match) turnMembers[historicalTurn] = match[1];
      }
    }
    turnMembers[snapshot.turn] = snapshot.memberId;
    if (!scope.get().sessions[snapshot.sessionId]) {
      const descriptor = ctx.huaxueState.describe().find(d => d.ns === NAMESPACE);
      try {
        await ctx.huaxueState.mutate(NAMESPACE, [{ op: 'set', path: ['sessions', snapshot.sessionId, 'activeMemberId'], value: snapshot.memberId }], descriptor.revision);
      } catch (error) {
        if (error.code !== 'SETTINGS_CONFLICT' || !scope.get().sessions[snapshot.sessionId]) throw error;
      }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = scope.get().sessions[snapshot.sessionId]?.turnMembers || {};
      const ops = Object.entries(turnMembers).filter(([turn, id]) => current[turn] !== id).map(([turn, id]) => ({ op: 'set', path: ['sessions', snapshot.sessionId, 'turnMembers', turn], value: id }));
      if (!ops.length) break;
      try {
        const descriptor = ctx.huaxueState.describe().find(d => d.ns === NAMESPACE);
        await ctx.huaxueState.mutate(NAMESPACE, ops, descriptor.revision); break;
      } catch (error) { if (error.code !== 'SETTINGS_CONFLICT' || attempt === 2) throw error; }
    }
    const resolved = await next();
    const persona = resolved.sections.find(s => s.name === 'deployment:persona-prefix');
    return {
      ...resolved,
      sections: [...resolved.sections.filter(s => s.name !== 'deployment:persona-prefix'), { ...(persona ?? { name: 'deployment:persona-prefix' }), text: snapshot.text }]
    };
  }, { global: true });
}
