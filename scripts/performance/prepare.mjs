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
export const counts = {};
export let epoch;
export function bump(key, n=1) { const m=scope.getStore(); if(m) m[key]=(m[key]||0)+n; }
export function context(ctx,m) {
 epoch ||= crypto.randomUUID();
 const storage=new Proxy(ctx.storage,{get(t,k){const v=Reflect.get(t,k,t);if(typeof v!=='function')return v;return (...args)=>{
  bump('storage.'+String(k));
  if(k==='put') {const entries=typeof args[0]==='string'?[[args[0],args[1]]]:Object.entries(args[0]);for(const [key,value] of entries){bump('write.'+key);bump('writeBytes.'+key,new TextEncoder().encode(JSON.stringify(value)).length);}}
  return v.apply(t,args);
 };}});
 return new Proxy(ctx,{get(t,k){if(k==='storage')return storage;if(k==='blockConcurrencyWhile')return fn=>t.blockConcurrencyWhile(()=>scope.run(m,fn));const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}});
}
`,
);
function instrument(source, pattern, replacement) {
  const matches =
    typeof pattern === 'string'
      ? source.split(pattern).length - 1
      : [...source.matchAll(new RegExp(pattern.source, 'g'))].length;
  if (matches !== 1) throw Error('Instrumentation point changed: ' + pattern);
  return source.replace(pattern, replacement);
}
async function change(file, fn) {
  const p = path.join(dest, file);
  await writeFile(p, fn(await readFile(p, 'utf8')));
}
await change(
  'src/game.js',
  (s) =>
    `import { bump } from '../metrics.js';\n` +
    instrument(
      s,
      /export function botAction\(([^)]*)\) \{/,
      '$&\n  bump("bot.compute");',
    ),
);
await change(
  'server/transport/connections.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    instrument(
      s,
      'ws.send(JSON.stringify(message));',
      `const encoded=JSON.stringify(message); ws.send(encoded); bump('ws.messages'); bump('ws.bytes',new TextEncoder().encode(encoded).length);`,
    ),
);
await change(
  'server/room/snapshots.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    instrument(s, 'broadcast() {', `broadcast() { bump('broadcast');`),
);
await change(
  'server/game/executor.ts',
  (s) =>
    `import { bump } from '../../metrics.js';\n` +
    instrument(
      s,
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
import { scope, context, bump, counts, epoch } from './metrics.js';
function measured(Base) { return class extends Base {
 metrics; constructor(ctx,env) { super(context(ctx,counts),env);this.metrics=counts; }
 async fetch(req) {if(new URL(req.url).pathname==='/__diagnostics') { const r=this.repository; const rooms=Object.values(r?.data.rooms||{}); const bytes=x=>new TextEncoder().encode(JSON.stringify(x)).length; return Response.json({epoch, rooms:rooms.length, sockets:this.ctx.getWebSockets().length, activity:Object.keys(r?.data.activity||{}).length, stateBytes:bytes(r?.data||{}), trainingBytes:bytes(r?.training||{}), trainingSessions:r?.training.sessions.length||0, trainingEvents:r?.training.sessions.reduce((n,s)=>n+s.events.length,0)||0, logEntries:rooms.reduce((n,r)=>n+(r.state.log?.length||0),0), historyEntries:rooms.reduce((n,r)=>n+(r.state.trickHistory?.length||0),0)}); }return scope.run(this.metrics,()=>super.fetch(req));}
 async webSocketMessage(...args){return scope.run(this.metrics,async()=>{bump('ws.incoming');await super.webSocketMessage(...args);});}
 async webSocketClose(...args){return scope.run(this.metrics,()=>super.webSocketClose(...args));}
 async webSocketError(...args){return scope.run(this.metrics,()=>super.webSocketError(...args));}
 async alarm(){return scope.run(this.metrics,async()=>{bump('alarm.fired');return super.alarm();});}
}; }
export const Lounge=measured(BaseLounge); export const RoomEngine=measured(BaseEngine);
export default {async fetch(req,env,ctx){
 if(new URL(req.url).pathname==='/__metrics')return Response.json(counts);
 if(new URL(req.url).pathname==='/__diagnostics')return env.LOUNGE.get(env.LOUNGE.idFromName('public-v1')).fetch('https://local/__diagnostics');
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
// Opt-in clock aging belongs only to the disposable local fixture. Production
// entry points never import this generator or expose these endpoints.
if (process.env.PERF_IDENTITY_EXPIRY === '1') {
  await change('entry.ts', (s) =>
    instrument(
      instrument(
        s,
        'async fetch(req) {if',
        `async fetch(req) {
 if(new URL(req.url).pathname==='/__expireActivity') { if(this.ctx.getWebSockets().some(ws=>ws.readyState===1))return new Response('Close clients first',{status:409});await this.exclusive(async()=>{for(const key of Object.keys(this.data.activity))this.data.activity[key]=Date.now()-86400001;this.lifecycle.cleanup();await this.persist();});return Response.json({activity:Object.keys(this.data.activity).length}); }
 if`,
      ),
      'export default {async fetch(req,env,ctx){',
      `export default {async fetch(req,env,ctx){
 if(new URL(req.url).pathname==='/__expireActivity')return env.LOUNGE.get(env.LOUNGE.idFromName('${loungeName}')).fetch(req);`,
    ),
  );
}
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
