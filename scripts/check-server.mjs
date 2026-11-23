import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
const base=process.env.TEST_API||'http://localhost:8787';
const sockets=[];
async function connect(code,token=randomBytes(32).toString('hex')){
 const ws=new WebSocket(base.replace(/^http/,'ws')+'/rooms/'+code);sockets.push(ws);
 const client={ws,token,messages:[],value:null};
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);client.messages.push(m);if(m.type==='state')client.value=m.value;});
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.send(JSON.stringify({type:'hello',token,name:'테스트'}));
 await until(()=>client.messages.some(m=>m.type==='welcome'||m.type==='error'));
 client.seat=client.messages.find(m=>m.type==='welcome')?.seat;return client;
}
async function until(fn,ms=10000){const end=Date.now()+ms;while(!fn()){if(Date.now()>end)throw new Error('Timed out');await new Promise(r=>setTimeout(r,30));}}
function action(c,a,revision=c.value.revision){c.ws.send(JSON.stringify({type:'action',action:a,revision}));}
try{
 const response=await fetch(base+'/rooms',{method:'POST'});assert.equal(response.status,200);const {code}=await response.json();
 const players=await Promise.all(Array.from({length:6},()=>connect(code)));
 assert.deepEqual(players.map(p=>p.seat).sort(),[0,1,2,3,4,5]);players.sort((a,b)=>a.seat-b.seat);
 const extra=await connect(code);assert.match(extra.messages[0].message,/6명/);assert.equal(extra.value,null);
 await until(()=>players.every(p=>p.value));
 action(players[1],{type:'start'});await until(()=>players[1].messages.some(m=>m.type==='error'));assert.equal(players[1].value.phase,'lobby');
 action(players[0],{type:'start'});await until(()=>players.every(p=>p.value.phase==='grand'));
 assert.equal(players[0].value.hand.length,8);assert.equal('hands' in players[0].value,false);
 const oldHand=players[0].value.hand,oldRevision=players[0].value.revision;
 players[0].ws.close();await until(()=>players[1].value.leader===1);
 action(players[1],{type:'grand',call:false});await until(()=>players[1].value.ready[1]);
 const restored=await connect(code,players[0].token);await until(()=>restored.value);assert.equal(restored.seat,0);assert.deepEqual(restored.value.hand,oldHand);assert.ok(restored.value.revision>oldRevision);
 const before=restored.value.revision;action(restored,{type:'grand',call:false},before);action(restored,{type:'grand',call:true},before);
 await until(()=>restored.messages.some(m=>m.type==='error'));assert.equal(restored.value.revision,before+1);assert.equal(restored.value.calls[0],0);
 if(process.argv.includes('--offline')){players[2].ws.close();console.log('Waiting for offline grace period...');await until(()=>players[1].value.ready[2],65000);const back=await connect(code,players[2].token);await until(()=>back.value);assert.equal(back.seat,2);assert.equal(back.value.ready[2],true);console.log('PASS: real alarm advanced offline player; returning player reclaimed seat');}
 const late=await connect(code);assert.equal(late.seat,undefined);assert.match(late.messages[0].message,/시작/);
 const replacement=await connect(code,restored.token);await until(()=>restored.ws.readyState===3);assert.equal(replacement.seat,0);
 console.log('PASS: six simultaneous joins, capacity, start authorization, private hands, host departure, reconnect same hand, stale/duplicate rejection, late join refusal, socket takeover');
}finally{for(const ws of sockets)ws.close();}
