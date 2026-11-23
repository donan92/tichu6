import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Room,generateCode,normalizeCode,displayCode} from '../src/peer.js';
class Connection extends EventEmitter {
  constructor(metadata={protocol:2}) {super();this.metadata=metadata;this.open=false;this.closed=false;this.sent=[];}
  send(message) {this.sent.push(message);queueMicrotask(()=>{if(!this.other?.closed)this.other?.emit('data',structuredClone(message));});}
  close() {if(this.closed)return;this.closed=true;this.open=false;this.emit('close');this.other?.close();}
}
function network() {
  const peers=new Map();let sequence=0;
  return class Peer extends EventEmitter {
    constructor(id) {super();this.id=id||`guest-${++sequence}`;this.connections=[];peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
    connect(id,{metadata}) {
      const a=new Connection(metadata);this.connections.push(a);const remote=peers.get(id);
      if(!remote){queueMicrotask(()=>this.emit('error',{type:'peer-unavailable'}));return a;}
      const b=new Connection(metadata);remote.connections.push(b);a.other=b;b.other=a;
      queueMicrotask(()=>{remote.emit('connection',b);a.open=b.open=true;a.emit('open');b.emit('open');});return a;
    }
    destroy() {this.destroyed=true;peers.delete(this.id);for(const c of this.connections)c.close();}
  };
}
test('single room codes are normalized and generated in the accepted alphabet',()=>{
 assert.equal(normalizeCode('abcde-fghjk'),'ABCDEFGHJK');assert.equal(normalizeCode(' ABCDE FGHJK '),'ABCDEFGHJK');
 assert.throws(()=>normalizeCode('123'));assert.throws(()=>normalizeCode('ABCDE-00000'));
 for(let i=0;i<100;i++){const code=generateCode();assert.equal(normalizeCode(displayCode(code)),code);}
});
test('five guests use the same code; the seventh player is refused without receiving state',async t=>{
 const peerFactory=network(),host=new Room({peerFactory});const rooms=[host];t.after(()=>rooms.forEach(r=>r.close()));
 const code=await host.host();const guests=Array.from({length:5},()=>new Room({peerFactory}));rooms.push(...guests);
 assert.deepEqual(await Promise.all(guests.map(g=>g.join(code))),[1,2,3,4,5]);
 assert.equal(host.links.size,5);assert.ok(guests.every(g=>g.connected(0)));
 let delivered=0;const extra=new Room({peerFactory,onMessage:()=>delivered++});rooms.push(extra);
 await assert.rejects(extra.join(code),/이미 6명/);assert.equal(delivered,0);assert.equal(extra.links.size,0);assert.equal(host.links.size,5);
});
test('lobby departures allow reusing exactly the freed seat; started games reject newcomers',async t=>{
 const peerFactory=network(),host=new Room({peerFactory}),a=new Room({peerFactory}),b=new Room({peerFactory}),c=new Room({peerFactory});
 t.after(()=>[host,a,b,c].forEach(r=>r.close()));const code=await host.host();assert.equal(await a.join(code),1);a.close();assert.equal(await b.join(code),1);
 host.lock();b.close();await assert.rejects(c.join(code),/이미 게임이 시작/);assert.equal(host.seats.members.size,1);
});
test('welcome precedes private game state and data is mapped to the assigned connection seat',async t=>{
 const peerFactory=network();let host;const received=[],actions=[];
 host=new Room({peerFactory,onStatus:(seat,status)=>{if(status==='open')host.send(seat,{type:'state',seat});},onMessage:(seat,body)=>actions.push({seat,body})});
 const guest=new Room({peerFactory,onMessage:(seat,body)=>received.push({seat,body})});t.after(()=>{guest.close();host.close();});
 await guest.join(await host.host());await Promise.resolve();assert.deepEqual(received,[{seat:0,body:{type:'state',seat:1}}]);
 guest.send(0,{type:'action',seat:5});await Promise.resolve();assert.equal(actions[0].seat,1);assert.equal(actions[0].body.seat,5);
});
test('full and incompatible connections cannot submit game commands',()=>{
 let actions=0;const host=new Room({onMessage:()=>actions++});
 const connections=Array.from({length:6},()=>new Connection());for(const c of connections){host.accept(c);c.open=true;c.emit('open');}
 connections[5].emit('data',{kind:'game',body:{type:'action'}});assert.equal(actions,0);assert.equal(connections[5].sent[0].reason,'full');
 const old=new Connection({protocol:1});host.accept(old);old.open=true;old.emit('open');old.emit('data',{kind:'game',body:{type:'action'}});
 assert.equal(old.sent[0].reason,'version');assert.equal(actions,0);host.close();
});
test('unknown rooms produce a clear error and clean up resources',async()=>{
 const guest=new Room({peerFactory:network()});await assert.rejects(guest.join('ABCDE-FGHJK'),/방을 찾을 수 없습니다/);assert.equal(guest.closed,true);assert.equal(guest.timers.size,0);
});
test('signaling timeouts fail instead of leaving room creation pending forever',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});class Silent extends EventEmitter {destroy(){this.destroyed=true;}}
 const room=new Room({peerFactory:Silent}),result=room.host(),rejected=assert.rejects(result,/응답이 지연/);
 t.mock.timers.tick(20000);await rejected;assert.equal(room.closed,true);assert.equal(room.timers.size,0);
});
test('closing during connection setup cancels the operation and timers',async()=>{
 class Silent extends EventEmitter {destroy(){this.destroyed=true;}}
 const room=new Room({peerFactory:Silent}),result=room.host();room.close();await assert.rejects(result,/취소/);assert.equal(room.timers.size,0);
});
