import * as host from './src/host.js';
import * as business from './src/business.js';
import { createStateStore, registerStateRoutes } from './src/state.js';
export const name = 'huaxue-workbench';
export const inject = ['connection', 'systemPrompt'];
export async function apply(ctx) {
  const store = await createStateStore(process.env.DSH_HOME);
  ctx.effect(() => ctx.reflect.provide('huaxueState', store));
  ctx.plugin(host);
  ctx.plugin(business);
  registerStateRoutes(ctx, store);
}
