import z from '@deepseek-ai/schemastery';
export const name = 'local-workbenches';
export const inject = ['huaxueState'];
export function apply(ctx) {
  const state = ctx.huaxueState.register('dsh-workbenches', z.object({
    activeId: z.string().default(''),
    recent: z.dict(z.string()).default({}),
    bindings: z.dict(z.string()).default({}),
    installed: z.dict(z.boolean()).default({}),
    pinned: z.array(z.string()).default([]),
    workspace: z.dict(z.string()).default({})
  }), { validate(value) {
    for (const field of ['recent', 'bindings', 'installed', 'workspace']) {
      for (const key of Object.keys(value[field])) if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('无效工作台或会话标识');
    }
    if (new Set(value.pinned).size !== value.pinned.length) throw Error('工作台入口不能重复');
  } });
  ctx.effect(() => ctx.reflect.provide('workbenches', {
    protocolVersion: 1,
    owner: sessionId => state.get().bindings[sessionId],
    installed: id => state.get().installed[id] === true
  }));
}
