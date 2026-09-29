import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

const allowed = new Set(['huaxue-workbench', 'dsh-workbenches']);
export async function createStateStore(home) {
  const directory = join(home, 'huaxue-workbench');
  const file = join(directory, 'state.json');
  let document;
  try { document = JSON.parse(await readFile(file, 'utf8')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    let legacy = {};
    for (const name of ['settings.yaml', 'settings.yaml.imported']) {
      try { legacy = parse(await readFile(join(home, name), 'utf8')) || {}; break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    document = { revision: 0, values: Object.fromEntries([...allowed].filter(ns=>legacy[ns]).map(ns=>[ns,legacy[ns]])) };
  }
  const schemas = new Map();
  let queue = Promise.resolve();
  const store = {
    register(ns, schema, options = {}) {
      if (!allowed.has(ns)) throw Error('Unknown namespace');
      schemas.set(ns, {schema, validate:options.validate});
      const value = schema(document.values[ns] || {});
      options.validate?.(value);
      document.values[ns] = value;
      return { get: () => structuredClone(document.values[ns]) };
    },
    get: ns => structuredClone(document.values[ns]),
    describe: () => [...schemas.keys()].map(ns=>({ns,revision:document.revision,value:structuredClone(document.values[ns])})),
    mutate(ns, ops, revision) {
      const job = queue.then(async()=>{
        if (!schemas.has(ns)) throw Error('Unknown namespace');
        if (revision !== document.revision) throw Object.assign(Error('Settings changed; retry'),{code:'SETTINGS_CONFLICT'});
        if (!Array.isArray(ops) || ops.length > 1000) throw Error('Invalid operations');
        const next = structuredClone(document);
        for (const op of ops) {
          if (!['set','unset'].includes(op.op) || !Array.isArray(op.path) || !op.path.length || op.path.some(p=>typeof p!=='string'||!p||['__proto__','constructor','prototype'].includes(p))) throw Error('Invalid path operation');
          let target = next.values[ns];
          for (const key of op.path.slice(0,-1)) { target[key] ??= {}; target=target[key]; if (!target || typeof target!=='object') throw Error('Invalid path'); }
          const key=op.path.at(-1);
          if(op.op==='set') target[key]=op.value; else delete target[key];
        }
        const {schema,validate}=schemas.get(ns);
        next.values[ns]=schema(next.values[ns]); validate?.(next.values[ns]);
        next.revision++;
        await mkdir(directory,{recursive:true});
        await writeFile(file+'.tmp',JSON.stringify(next));
        await rename(file+'.tmp',file);
        document=next;
        return {value:structuredClone(next.values[ns]),revision:next.revision};
      });
      queue=job.catch(()=>{}); return job;
    }
  };
  return store;
}

export function registerStateRoutes(ctx, store) {
  ctx.connection.fetch.register({path:'/api/huaxue/state',methods:['GET','POST'],requestBody:'buffered',async fetch(request){
    try {
      if(request.method==='GET') return Response.json({namespaces:store.describe()},{headers:{'cache-control':'no-store'}});
      const text=await request.text();
      if(text.length>9*1024*1024) return Response.json({error:'State too large'},{status:413});
      const {ns,ops,revision}=JSON.parse(text);
      return Response.json(await store.mutate(ns,ops,revision));
    } catch(error) { return Response.json({error:error.message,code:error.code},{status:error.code==='SETTINGS_CONFLICT'?409:400}); }
  }});
}
