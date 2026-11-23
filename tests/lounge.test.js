import test from 'node:test';
import assert from 'node:assert/strict';
import {Lounge,nickname,publicView} from '../server/lounge.js';
import {newGame,startRound} from '../src/game.js';
globalThis.WebSocketRequestResponsePair=class {};
function socket(){return {readyState:1,a:{created:Date.now(),window:Date.now(),requests:0},messages:[],deserializeAttachment(){return structuredClone(this.a);},serializeAttachment(a){this.a=structuredClone(a);},send(s){this.messages.push(JSON.parse(s));},close(code){this.readyState=3;this.code=code;}};}
async function setup(){let value;const sockets=[];let queue=Promise.resolve();const storage={async get(){return structuredClone(value);},async put(_k,v){value=structuredClone(v);},async setAlarm(){},async deleteAlarm(){}};const ctx={storage,getWebSockets:()=>sockets,setWebSocketAutoResponse(){},blockConcurrencyWhile(fn){const p=queue.then(fn);queue=p.catch(()=>{});return p;}};const hub=new Lounge(ctx);await queue;return {hub,sockets,ctx,ready:()=>queue};}
async function user(f,i,name='Tester'){const ws=socket();f.sockets.push(ws);const token=i.toString(16).padStart(64,'0');await f.hub.webSocketMessage(ws,JSON.stringify({type:'hello',name,token}));return ws;}
const msg=(hub,ws,message)=>hub.webSocketMessage(ws,JSON.stringify(message));
const last=(ws,type)=>ws.messages.filter(m=>m.type===type).at(-1);
test('nicknames accept only 1 to 8 ASCII letters and digits, preserving case',()=>{for(const s of ['a','Z','0','Ab12Cd34','12345678'])assert.equal(nickname(s),s);for(const s of ['', 'Ab1234569','한글','é','Ａ','１','hello!','a_b','a b',' a','a ', 'a\n','😀',null,123])assert.throws(()=>nickname(s));});
test('31 simultaneous identities yield exactly 30 admissions; reconnect takes no extra slot',async()=>{const f=await setup();const users=await Promise.all(Array.from({length:31},(_,i)=>user(f,i+1)));assert.equal(f.hub.users().length,30);assert.equal(users.filter(w=>last(w,'welcome')).length,30);const replacement=await user(f,1);assert.ok(last(replacement,'welcome'));assert.equal(f.hub.users().length,30);assert.equal(users[0].code,4001);});
test('simultaneous room creation cannot exceed five and server supplies nonempty titles',async()=>{const f=await setup();const users=await Promise.all(Array.from({length:6},(_,i)=>user(f,i+1)));await Promise.all(users.map(w=>msg(f.hub,w,{type:'create',name:'Star'})));assert.equal(Object.keys(f.hub.data.rooms).length,5);for(const r of Object.values(f.hub.data.rooms))assert.ok(r.title.adjective&&r.title.noun&&r.title.number);assert.equal(last(users[5],'error').code,'error.roomsFull');});
test('spectators receive no cards, cannot act or spoof a seat, and count globally',async()=>{const f=await setup();const users=await Promise.all(Array.from({length:7},(_,i)=>user(f,i+1)));await msg(f.hub,users[0],{type:'create',name:'Host'});const id=Object.keys(f.hub.data.rooms)[0];for(let i=1;i<6;i++)await msg(f.hub,users[i],{type:'join',roomId:id,watch:false,name:'Friend'});await msg(f.hub,users[6],{type:'join',roomId:id,watch:true,name:'Watcher'});await msg(f.hub,users[0],{type:'action',revision:0,action:{type:'start'}});const snapshot=last(users[6],'state').value;assert.equal(snapshot.seat,-1);assert.deepEqual(snapshot.hand,[]);for(const key of ['hands','first','exchanges','members'])assert.equal(key in snapshot,false);assert.equal(last(users[0],'state').value.hand.length,8);assert.equal(last(users[6],'directory').count,7);await msg(f.hub,users[6],{type:'action',seat:0,revision:1,action:{type:'grand',call:true}});assert.equal(last(users[6],'error').code,'error.spectator');assert.equal(f.hub.data.rooms[id].state.revision,1);assert.equal(f.hub.data.rooms[id].state.ready[0],false);});
test('leaving waiting room frees seat and deletes empty room without leaking identity',async()=>{const f=await setup(),a=await user(f,1);await msg(f.hub,a,{type:'create',name:'Name'});assert.equal(Object.keys(f.hub.data.rooms).length,1);const directory=last(a,'directory');assert.equal(JSON.stringify(directory).includes('hash'),false);await msg(f.hub,a,{type:'leave'});assert.equal(Object.keys(f.hub.data.rooms).length,0);});
test('saved games survive reconstruction, reconnect authenticates original seat',async()=>{const f=await setup(),a=await user(f,1);await msg(f.hub,a,{type:'create',name:'Name'});const id=Object.keys(f.hub.data.rooms)[0];f.hub.data.rooms[id].state=startRound(newGame());await f.hub.persist();const hand=f.hub.data.rooms[id].state.hands[0];a.readyState=3;await f.hub.disconnected(a);const restored=new Lounge(f.ctx);await f.ready();f.hub=restored;const b=socket();f.sockets.push(b);await msg(restored,b,{type:'hello',token:'1'.padStart(64,'0'),name:'Return',roomId:id});assert.equal(last(b,'state').value.seat,0);assert.deepEqual(restored.data.rooms[id].state.hands[0],hand);});
test('oversized and unauthenticated requests are rejected; flooding closes a connection',async()=>{const f=await setup();const a=socket();f.sockets.push(a);await msg(f.hub,a,{type:'create',name:'Name'});assert.equal(a.code,4003);const b=await user(f,2);await f.hub.webSocketMessage(b,'x'.repeat(4097));assert.equal(last(b,'error').code,'error.payload');assert.equal(b.code,1009);const c=await user(f,3);for(let i=0;i<31;i++)await msg(f.hub,c,{type:'unknown'});assert.equal(c.code,4008);assert.equal(Object.keys(f.hub.data.rooms).length,0);});
test('public view excludes private storage even when engine gains extra properties',()=>{const s=startRound(newGame());s.futureSecret='secret';assert.equal('futureSecret' in publicView(s),false);});

test('offline player advances after grace; all-offline rooms pause and expire',async()=>{
 const f=await setup(),a=await user(f,1),b=await user(f,2);
 await msg(f.hub,a,{type:'create',name:'Check'});const id=Object.keys(f.hub.data.rooms)[0];
 await msg(f.hub,b,{type:'join',roomId:id,watch:false,name:'Friend'});
 const r=f.hub.data.rooms[id];r.state=startRound(newGame());
 a.readyState=3;await f.hub.disconnected(a);r.members[0].offlineSince=Date.now()-46000;
 await f.hub.alarm();assert.equal(r.state.ready[0],true);
 b.readyState=3;await f.hub.disconnected(b);r.members[1].offlineSince=Date.now()-46000;
 const revision=r.state.revision;await f.hub.alarm();assert.equal(r.state.revision,revision);
 r.lastActive=Date.now()-86400001;await f.hub.alarm();assert.equal(f.hub.data.rooms[id],undefined);
});
test('invalid actions and stale revisions never change game state',async()=>{
 const f=await setup(),a=await user(f,1);await msg(f.hub,a,{type:'create',name:'Check'});
 const r=Object.values(f.hub.data.rooms)[0];r.state=startRound(newGame());const before=structuredClone(r.state);
 for(const action of [{type:'grand',call:'yes'},{type:'play',ids:[{}]},{type:'start'}]){
  await msg(f.hub,a,{type:'action',revision:r.state.revision,action});assert.deepEqual(r.state,before);
 }
 await msg(f.hub,a,{type:'action',revision:0,action:{type:'grand',call:false}});assert.deepEqual(r.state,before);
});
