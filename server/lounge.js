import {newGame,startRound,act,botAction,view,points} from '../src/game.js';
const GRACE=45000,TTL=86400000;
const segmenter=new Intl.Segmenter('ko',{granularity:'grapheme'});
export function nickname(input){
 if(typeof input!=='string'||input.length>80)throw new Error('닉네임은 1~5자로 입력하세요.');
 const name=input.normalize('NFC').trim();
 if(!name||[...segmenter.segment(name)].length>5||/[\p{Cc}\p{Cf}<>]/u.test(name))throw new Error('닉네임은 1~5자이며 제어문자나 꺾쇠는 사용할 수 없습니다.');
 return name;
}
export function publicView(s){
 return {phase:s.phase,round:s.round,scores:s.scores,revision:s.revision,names:s.names,log:s.log,
 counts:s.hands.map(h=>h.length),ready:s.ready||[],calls:s.calls||[],played:s.played||[],finish:s.finish||[],top:s.top||null,
 turn:s.turn??null,last:s.last??null,passed:s.passed||[],wish:s.wish||null,delta:s.delta||null,
 exchangeReady:(s.exchanges||[]).map(Boolean),capturedPoints:(s.captured||[]).map(points),seat:-1,hand:[]};
}
function title(){const a=['달빛','푸른','노을','별빛','고요한','즐거운'];const b=['정원','다락방','카드숲','테이블','찻집','마루'];const n=crypto.getRandomValues(new Uint32Array(3));return `${a[n[0]%a.length]} ${b[n[1]%b.length]} ${String(n[2]%1000).padStart(3,'0')}`;}
export class Lounge {
 constructor(ctx){this.ctx=ctx;this.data={rooms:{}};ctx.blockConcurrencyWhile(async()=>{this.data=await ctx.storage.get('lounge')||{rooms:{}};});ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 sockets(){return this.ctx.getWebSockets().filter(s=>s.readyState===1);}
 users(){return this.sockets().filter(s=>s.deserializeAttachment()?.hash);}
 attachment(ws){return ws.deserializeAttachment()||{};}
 online(room){return room.members.map(m=>!!m&&this.users().some(ws=>{const a=this.attachment(ws);return a.hash===m.hash&&a.room===room.id&&!a.watch;}));}
 async persist(){await this.ctx.storage.put('lounge',this.data);}
 async exclusive(fn){let error;await this.ctx.blockConcurrencyWhile(async()=>{try{await fn();}catch(e){error=e;}});if(error)throw error;}
 send(ws,msg){try{ws.send(JSON.stringify(msg));}catch{}}
 async fetch(request){
  if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('WebSocket required',{status:426});
  if(this.sockets().length>=40)return new Response('Too many connections',{status:429});
  const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1]);pair[1].serializeAttachment({created:Date.now(),window:Date.now(),requests:0});await this.schedule();
  return new Response(null,{status:101,webSocket:pair[0]});
 }
 directory(hash){return Object.values(this.data.rooms).map(r=>({id:r.id,title:r.title,phase:r.state.phase,round:r.state.round,scores:r.state.scores,players:r.members.filter(Boolean).length,online:this.online(r).filter(Boolean).length,spectators:this.users().filter(ws=>{const a=this.attachment(ws);return a.room===r.id&&a.watch;}).length,mine:r.members.some(m=>m?.hash===hash)}));}
 broadcast(){
  const users=this.users();
  for(const ws of users){const a=this.attachment(ws),r=this.data.rooms[a.room];
   this.send(ws,{type:'directory',rooms:this.directory(a.hash),count:users.length});
   if(!r){this.send(ws,{type:'hall'});continue;}
   const seat=a.watch?-1:r.members.findIndex(m=>m?.hash===a.hash);const online=this.online(r);
   const snapshot=publicView(r.state);if(seat>=0){snapshot.seat=seat;snapshot.hand=view(r.state,seat).hand;}
   this.send(ws,{type:'state',value:{...snapshot,roomId:r.id,title:r.title,spectator:seat<0,leader:online.findIndex(Boolean),offline:online.map(x=>!x),paused:false},online});
  }
 }
 refreshPresence(){
  const now=Date.now();for(const r of Object.values(this.data.rooms)){const online=this.online(r);r.members.forEach((m,i)=>{if(m){if(online[i])m.offlineSince=null;else m.offlineSince??=now;}});if(online.some(Boolean))r.lastActive=now;}
 }
 activeMembership(hash){return Object.values(this.data.rooms).find(r=>r.members.some(m=>m?.hash===hash)&&!['lobby','matchEnd'].includes(r.state.phase));}
 leaveWaiting(hash,except){for(const r of Object.values(this.data.rooms))if(r.id!==except&&['lobby','matchEnd'].includes(r.state.phase)){r.members=r.members.map((m,i)=>{if(m?.hash!==hash)return m;r.state.names[i]=`빈자리`;return null;});}}
 enter(ws,id,watch,name){
  const a=this.attachment(ws),r=this.data.rooms[id];if(!r)throw new Error('방이 종료되었습니다.');
  const own=r.members.findIndex(m=>m?.hash===a.hash);
  if(own>=0){watch=false;r.state.names[own]=name;}
  if(!watch&&own<0){
   const active=this.activeMembership(a.hash);if(active&&active.id!==id)throw new Error('진행 중인 내 게임에 먼저 복귀해 주세요. 다른 방은 관전할 수 있습니다.');
   if(r.state.phase!=='lobby')throw new Error('진행 중인 방은 관전만 가능합니다.');
   const seat=r.members.indexOf(null);if(seat<0)throw new Error('플레이어 6명이 모두 찼습니다. 관전으로 입장해 주세요.');
   r.members[seat]={hash:a.hash,offlineSince:null};r.state.names[seat]=name;
  }
  this.leaveWaiting(a.hash,id);a.room=id;a.watch=watch;a.name=name;ws.serializeAttachment(a);r.lastActive=Date.now();
 }
 async webSocketMessage(ws,raw){
  try{
   if(typeof raw!=='string'||raw.length>4096){this.send(ws,{type:'error',message:'요청 크기를 초과했습니다.'});ws.close(1009,'Payload too large');return;}
   let a=this.attachment(ws);const now=Date.now();if(now-(a.window||0)>=10000){a.window=now;a.requests=0;}a.requests=(a.requests||0)+1;ws.serializeAttachment(a);
   if(a.requests>30){this.send(ws,{type:'error',message:'요청이 너무 빠릅니다. 잠시 후 다시 접속하세요.'});ws.close(4008,'Rate limited');return;}
   const msg=JSON.parse(raw);if(!msg||Array.isArray(msg)||typeof msg.type!=='string')throw new Error('잘못된 요청입니다.');
   if(msg.type==='hello'){
    if(a.hash)throw new Error('이미 접속했습니다.');
    const name=nickname(msg.name);if(typeof msg.token!=='string'||!/^[a-f0-9]{64}$/.test(msg.token))throw new Error('유효한 참가 키가 필요합니다.');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(msg.token));const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    await this.exclusive(async()=>{
     const existing=this.users().find(s=>this.attachment(s).hash===hash);
     if(!existing&&this.users().length>=30)throw new Error('전체 접속자 30명이 모두 찼습니다. 잠시 후 다시 입장해 주세요.');
     const old=existing?this.attachment(existing):null;
     if(existing){existing.serializeAttachment({created:now});existing.close(4001,'Replaced');}
     a={...a,hash,name,room:null,watch:false};ws.serializeAttachment(a);
     const resume=typeof msg.roomId==='string'?msg.roomId:old?.room;
     if(resume&&this.data.rooms[resume]){
      const r=this.data.rooms[resume];if(r.members.some(m=>m?.hash===hash)||msg.watch===true)this.enter(ws,resume,msg.watch===true,name);
     }
     this.refreshPresence();await this.persist();this.send(ws,{type:'welcome'});this.broadcast();
    });
   }else{
    if(!a.hash)throw new Error('먼저 대기실에 입장하세요.');
    await this.exclusive(async()=>{
     a=this.attachment(ws);if(!a.hash)throw new Error('연결이 교체되었습니다.');
     if(msg.type==='create'){
      const name=nickname(msg.name);if(this.activeMembership(a.hash))throw new Error('진행 중인 내 게임에 먼저 복귀해 주세요.');
      if(Object.keys(this.data.rooms).length>=5)throw new Error('방은 최대 5개까지 만들 수 있습니다.');
      // A participant may own only one waiting seat; creation never adds a sixth room.
      const id=crypto.randomUUID();this.data.rooms[id]={id,title:title(),state:newGame(Array(6).fill('빈자리')),members:Array(6).fill(null),lastActive:Date.now()};this.enter(ws,id,false,name);
     }else if(msg.type==='join'){
      if(typeof msg.roomId!=='string'||! /^[a-f0-9-]{36}$/.test(msg.roomId)||typeof msg.watch!=='boolean')throw new Error('방과 입장 방식을 확인하세요.');this.enter(ws,msg.roomId,msg.watch,nickname(msg.name));
     }else if(msg.type==='leave'){
      this.leaveWaiting(a.hash,null);a.room=null;a.watch=false;ws.serializeAttachment(a);
     }else if(msg.type==='action'){
      const r=this.data.rooms[a.room],seat=r?.members.findIndex(m=>m?.hash===a.hash);
      if(!r||a.watch||seat<0)throw new Error('관전자는 게임에 행동할 수 없습니다.');
      if(!Number.isSafeInteger(msg.revision)||msg.revision!==r.state.revision)throw new Error('상태가 바뀌었습니다. 다시 선택해 주세요.');
      const action=msg.action;if(!action||Array.isArray(action)||!['start','next','grand','exchange','tichu','pass','collect','play'].includes(action.type))throw new Error('허용되지 않은 행동입니다.');
      if(action.type==='grand'&&typeof action.call!=='boolean')throw new Error('선언 여부는 참/거짓이어야 합니다.');
      if(['play','exchange'].includes(action.type)&&(!Array.isArray(action.ids)||action.ids.length>18||action.ids.some(id=>typeof id!=='string'||id.length>30)))throw new Error('카드 목록을 확인하세요.');
      for(const field of ['target','wish','phoenixRank'])if(action[field]!=null&&(!Number.isInteger(action[field])||action[field]<0||action[field]>14))throw new Error('선택 값을 확인하세요.');
      if(['start','next'].includes(action.type)){
       const online=this.online(r);if(seat!==online.findIndex(Boolean))throw new Error('진행 담당자만 시작할 수 있습니다.');
       if(!r.members.every(Boolean)||r.state.phase==='lobby'&&!online.every(Boolean))throw new Error('6명이 모두 입장해야 합니다.');
       r.state=startRound(structuredClone(r.state));
      }else r.state=act(r.state,seat,action);
      r.lastActive=Date.now();
     }else throw new Error('지원하지 않는 요청입니다.');
     this.refreshPresence();this.cleanup();await this.persist();this.broadcast();
    });
   }
   await this.schedule();
  }catch(error){
   const expected=error instanceof SyntaxError?'잘못된 메시지 형식입니다.':error instanceof TypeError||error instanceof RangeError?'잘못된 요청입니다.':error.message;
   this.send(ws,{type:'error',message:expected});if(!this.attachment(ws).hash)ws.close(4003,'Admission rejected');
  }
 }
 cleanup(){
  for(const [id,r] of Object.entries(this.data.rooms))if(!r.members.some(Boolean)||Date.now()-r.lastActive>=TTL&&!this.online(r).some(Boolean)){
   delete this.data.rooms[id];for(const ws of this.users()){const a=this.attachment(ws);if(a.room===id){a.room=null;a.watch=false;ws.serializeAttachment(a);}}
  }
 }
 async disconnected(ws){
  await this.exclusive(async()=>{ws.serializeAttachment({created:Date.now()});this.refreshPresence();await this.persist();this.broadcast();});await this.schedule();
 }
 async webSocketClose(ws,code){try{ws.close(code===1000?1000:1001);}catch{}await this.disconnected(ws);}
 async webSocketError(ws){try{ws.close(1011);}catch{}await this.disconnected(ws);}
 async schedule(){
  const now=Date.now();let at=Infinity;
  for(const ws of this.sockets())if(!this.attachment(ws).hash)at=Math.min(at,(this.attachment(ws).created||now)+10000);
  for(const r of Object.values(this.data.rooms)){
   at=Math.min(at,r.lastActive+TTL);const online=this.online(r),s=r.state;
   r.members.forEach((m,i)=>{if(!m||online[i])return;const needs=s.phase==='lobby'||online.some(Boolean)&&(s.phase==='grand'&&!s.ready[i]||s.phase==='exchange'&&!s.exchanges[i]||s.phase==='play'&&s.turn===i||s.phase==='trick'&&s.last===i);if(needs)at=Math.min(at,Math.max(now+2000,(m.offlineSince??now)+GRACE));});
  }
  if(Number.isFinite(at))await this.ctx.storage.setAlarm(Math.max(now+1000,at));else await this.ctx.storage.deleteAlarm();
 }
 async alarm(){
  await this.exclusive(async()=>{
   const now=Date.now();for(const ws of this.sockets())if(!this.attachment(ws).hash&&now-(this.attachment(ws).created||0)>=10000)ws.close(4003,'Handshake timeout');
   this.refreshPresence();
   for(const r of Object.values(this.data.rooms)){
    const s=r.state,online=this.online(r),eligible=i=>r.members[i]&&!online[i]&&now-(r.members[i].offlineSince??now)>=GRACE;
    if(s.phase==='lobby'){r.members=r.members.map((m,i)=>{if(!eligible(i))return m;s.names[i]='빈자리';return null;});}
    else if(online.some(Boolean)){
     const seat=s.phase==='grand'?s.ready.findIndex((x,i)=>!x&&eligible(i)):s.phase==='exchange'?s.exchanges.findIndex((x,i)=>!x&&eligible(i)):s.phase==='play'?s.turn:s.phase==='trick'?s.last:-1;
     if(seat>=0&&eligible(seat))r.state=act(s,seat,botAction(s,seat));
    }
   }
   this.cleanup();await this.persist();this.broadcast();
  });await this.schedule();
 }
}
