// Reconnection keys are private credentials. Never put them in invitation links.
export const API='https://tichu6-server.kelp-swaths-7q.workers.dev';
const KEY='tichu6-session-v3';
export function savedRoom(){try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch{return null;}}
export function forgetRoom(){localStorage.removeItem(KEY);}
const normalize=value=>{const code=String(value).replace(/[\s-]/g,'').toUpperCase();if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code))throw new Error('방 코드 10자리를 확인해 주세요.');return code;};
const format=code=>code.slice(0,5)+'-'+code.slice(5);
export class Room {
 constructor({onMessage=()=>{},onStatus=()=>{},onError=()=>{},onNotice=()=>{}}={}){Object.assign(this,{onMessage,onStatus,onError,onNotice});this.seat=-1;this.closed=false;this.attempt=0;}
 async host(name){const response=await fetch(API+'/rooms',{method:'POST',signal:AbortSignal.timeout(15000)});const result=await response.json();if(!response.ok)throw new Error(result.error||'방 생성 실패');await this.join(result.code,name);return format(this.code);}
 async join(code,name){
  this.code=normalize(code);const saved=savedRoom();
  this.token=saved?.code===this.code?saved.token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  this.name=name||saved?.name||'친구';
  return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.connect();});
 }
 connect(){
  if(this.closed)return;
  const socket=this.socket=new WebSocket(API.replace(/^http/,'ws')+'/rooms/'+this.code);
  let welcomed=false;const timeout=setTimeout(()=>socket.close(),15000);
  socket.onopen=()=>socket.send(JSON.stringify({type:'hello',token:this.token,name:this.name}));
  socket.onmessage=event=>{
   if(socket!==this.socket)return;
   this.lastSeen=Date.now();if(event.data==='pong')return;
   const msg=JSON.parse(event.data);
   if(msg.type==='welcome'){
    welcomed=true;clearTimeout(timeout);this.seat=msg.seat;this.attempt=0;this.lastSeen=Date.now();
    localStorage.setItem(KEY,JSON.stringify({code:this.code,token:this.token,name:this.name}));
    this.onStatus(this.seat,'open');this.onNotice('서버에 연결되었습니다.');this.resolve?.(this.seat);this.resolve=null;this.reject=null;
    clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(Date.now()-this.lastSeen>45000)socket.close();else if(socket.readyState===1)socket.send('ping');},15000);
   }else if(msg.type==='error'&&!welcomed){this.closed=true;this.reject?.(new Error(msg.message));this.onError(msg.message);socket.close();}
   else this.onMessage(this.seat,msg);
  };
  socket.onclose=event=>{
   clearTimeout(timeout);clearInterval(this.heartbeat);
   if(this.closed||socket!==this.socket)return;
   this.onStatus(this.seat,'closed');
   if(event.code===4001){this.closed=true;this.onError('다른 탭에서 같은 자리로 접속했습니다. 이 탭은 연결을 종료합니다.');return;}
   if(++this.attempt>5&&this.reject){this.reject(new Error('서버에 연결하지 못했습니다. 다시 시도해 주세요.'));this.reject=null;this.closed=true;return;}
   this.onNotice('연결이 끊겼습니다. 같은 자리로 자동 재접속 중입니다.');
   this.timer=setTimeout(()=>this.connect(),Math.min(1000*2**Math.min(this.attempt,4),15000));
  };
  socket.onerror=()=>socket.close();
 }
 send(_seat,body){if(this.socket?.readyState!==1||this.seat<0)return false;this.socket.send(JSON.stringify(body));return true;}
 connected(){return this.socket?.readyState===1&&this.seat>=0;}
 close(){this.closed=true;clearTimeout(this.timer);clearInterval(this.heartbeat);this.socket?.close();this.reject?.(new Error('연결을 취소했습니다.'));}
}
