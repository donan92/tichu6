// Generates an isolated LOCAL-ONLY instrumented source copy. Never deployed.
import { cp, mkdir, readFile, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
const source = path.resolve(process.argv[2] || '.');
const dest = path.resolve(process.argv[3] || '/tmp/tichu-perf-fixture');
if (!dest.startsWith('/tmp/') && !dest.startsWith('/private/tmp/'))
  throw Error('Temporary destination required');
await mkdir(dest, { recursive: true });
for (const dir of ['server', 'src'])
  await cp(path.join(source, dir), path.join(dest, dir), { recursive: true });
await writeFile(
  path.join(dest, 'metrics.js'),
  `import { AsyncLocalStorage } from 'node:async_hooks';
export const scope = new AsyncLocalStorage();
export function bump(key, n=1) { const m=scope.getStore(); if(m) m[key]=(m[key]||0)+n; }
export function context(ctx,m) {
 const storage=new Proxy(ctx.storage,{get(t,k){const v=Reflect.get(t,k,t);if(typeof v!=='function')return v;return (...args)=>{
  bump('storage.'+String(k));
  if(k==='put') {const entries=typeof args[0]==='string'?[[args[0],args[1]]]:Object.entries(args[0]);for(const [key,value] of entries){bump('write.'+key);bump('writeBytes.'+key,new TextEncoder().encode(JSON.stringify(value)).length);}}
  return v.apply(t,args);
 };}});
 return new Proxy(ctx,{get(t,k){if(k==='storage')return storage;if(k==='blockConcurrencyWhile')return fn=>t.blockConcurrencyWhile(()=>scope.run(m,fn));const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}});
}
`,
);
async function change(file, fn) {
  const p = path.join(dest, file);
  await writeFile(p, fn(await readFile(p, 'utf8')));
}
await change(
  'src/game.js',
  (s) =>
    `import { bump } from '../metrics.js';\n` +
    s.replace(
      /export function botAction\(([^)]*)\) \{/,
      '$&\n  bump("bot.compute");',
    ),
);
await change(
  'server/transport/connections.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    s.replace(
      'ws.send(JSON.stringify(message));',
      `const encoded=JSON.stringify(message); ws.send(encoded); bump('ws.messages'); bump('ws.bytes',new TextEncoder().encode(encoded).length);`,
    ),
);
await change(
  'server/room/snapshots.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    s.replace('broadcast() {', `broadcast() { bump('broadcast');`),
);
await change(
  'server/game/executor.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    s.replace(
      'private async request(id: string, payload: object) {',
      `private async request(id: string, payload: object) { bump('engine.requests');`,
    ),
);
await writeFile(
  path.join(dest, 'entry.ts'),
  `import app from './server/worker.ts';
import { Lounge as BaseLounge } from './server/lounge.ts';
import { RoomEngine as BaseEngine } from './server/game/room-engine.ts';
export { GameRoom } from './server/game-room.js';
import { scope, context, bump } from './metrics.js';
function measured(Base) { return class extends Base {
 metrics; seenRooms = new Set(); constructor(ctx,env) { const m={}; super(context(ctx,m),env);this.metrics=m;setTimeout(()=>{},3600000); }
 async fetch(req) {if(new URL(req.url).pathname==='/__metrics')return Response.json({counts:this.metrics,rooms:[...this.seenRooms]});return scope.run(this.metrics,()=>super.fetch(req));}
 async webSocketMessage(...args){return scope.run(this.metrics,async()=>{bump('ws.incoming');await super.webSocketMessage(...args);for(const id of Object.keys(this.data?.rooms||{}))this.seenRooms.add(id);});}
 async webSocketClose(...args){return scope.run(this.metrics,()=>super.webSocketClose(...args));}
 async webSocketError(...args){return scope.run(this.metrics,()=>super.webSocketError(...args));}
 async alarm(){return scope.run(this.metrics,async()=>{bump('alarm.fired');return super.alarm();});}
}; }
export const Lounge=measured(BaseLounge); export const RoomEngine=measured(BaseEngine);
export default {async fetch(req,env,ctx){
 if(new URL(req.url).pathname==='/__metrics'){
  const l=await (await env.LOUNGE.get(env.LOUNGE.idFromName('public-v1')).fetch('https://local/__metrics')).json();
  const counts={...l.counts};for(const id of l.rooms){const e=await(await env.ROOM_ENGINES.get(env.ROOM_ENGINES.idFromName(id)).fetch('https://local/__metrics')).json();for(const [k,v]of Object.entries(e.counts)) counts[k]=(counts[k]||0)+v;}
  return Response.json(counts);
 }
 return app.fetch(req,env,ctx);
}};
`,
);
const worker = await readFile(path.join(source, 'server/worker.ts'), 'utf8');
const legacy = worker.match(/export \{ GameRoom \} from ['"]([^'"]+)/)?.[1];
if (legacy)
  await change('entry.ts', (s) =>
    s.replace(
      './server/game-room.js',
      './server/' + legacy.replace(/^\.\//, ''),
    ),
  );
const loungeName = worker.match(/idFromName\(['"]([^'"]+)['"]\)/)?.[1];
if (!loungeName) throw Error('Find lounge namespace name');
await change('entry.ts', (s) =>
  s.replace("idFromName('public-v1')", `idFromName('${loungeName}')`),
);
await writeFile(
  path.join(dest, 'wrangler.json'),
  JSON.stringify(
    {
      name: 'tichu-perf-local',
      main: 'entry.ts',
      compatibility_date: '2026-11-01',
      compatibility_flags: ['nodejs_compat'],
      durable_objects: {
        bindings: [
          { name: 'LOUNGE', class_name: 'Lounge' },
          { name: 'ROOM_ENGINES', class_name: 'RoomEngine' },
          { name: 'ROOMS', class_name: 'GameRoom' },
        ],
      },
      migrations: [
        { tag: 'v1', new_sqlite_classes: ['Lounge', 'RoomEngine', 'GameRoom'] },
      ],
      ratelimits: [
        {
          name: 'CONNECTION_LIMIT',
          namespace_id: '640401',
          simple: { limit: 120, period: 60 },
        },
      ],
    },
    null,
    2,
  ),
);
await symlink(
  path.join(source, 'node_modules'),
  path.join(dest, 'node_modules'),
  'dir',
).catch((e) => {
  if (e.code !== 'EEXIST') throw e;
});
console.log(dest);
