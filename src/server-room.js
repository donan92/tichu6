import {AppError,event as messageEvent} from './messages.js';
// Tokens stay in browser storage and the encrypted handshake, never URLs.
export const API=['localhost','127.0.0.1'].includes(location.hostname)?'http://localhost:8787':'https://tichu6-server.kelp-swaths-7q.workers.dev';
const KEY='tichu6-session-v4';
export function savedRoom(){try{const value=JSON.parse(localStorage.getItem(KEY)||'null');return value&&/^[a-f0-9]{64}$/.test(value.token)?value:null;}catch{return null;}}
export class Room {
 constructor({onMessage=()=>{},onStatus=()=>{},onError=()=>{},onNotice=()=>{}}={}){Object.assign(this,{onMessage,onStatus,onError,onNotice});this.seat=-1;this.closed=false;this.ready=false;this.attempt=0;}
 remember(){try{localStorage.setItem(KEY,JSON.stringify({token:this.token,name:this.name,roomId:this.roomId,watch:this.watch}));}catch{this.onNotice(messageEvent('connection.storage'));}}
 async open(name){
  const saved=savedRoom();this.token=saved?.token||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
  this.name=name||saved?.name;this.roomId=saved?.roomId||null;this.watch=saved?.watch===true;this.remember();
  return new Promise((resolve,reject)=>{this.resolve=resolve;this.reject=reject;this.connect();});
 }
 connect(){
  if(this.closed)return;this.ready=false;
  const socket=this.socket=new WebSocket(API.replace(/^http/,'ws')+'/lounge');let welcomed=false;
  const timeout=setTimeout(()=>socket.close(),15000);
  socket.onopen=()=>socket.send(JSON.stringify({type:'hello',token:this.token,name:this.name,roomId:this.roomId,watch:this.watch}));
  socket.onmessage=event=>{
   if(this.closed||socket!==this.socket)return;this.lastSeen=Date.now();if(event.data==='pong')return;
   let msg;try{msg=JSON.parse(event.data);}catch{return;}
   if(msg.type==='welcome'){
    welcomed=true;this.ready=true;clearTimeout(timeout);this.attempt=0;this.lastSeen=Date.now();this.onStatus(-1,'open');this.onNotice(messageEvent('connection.welcome'));this.resolve?.();this.resolve=null;this.reject=null;
    clearInterval(this.heartbeat);this.heartbeat=setInterval(()=>{if(Date.now()-this.lastSeen>45000)socket.close();else if(socket.readyState===1)socket.send('ping');},15000);
   }else if(msg.type==='error'&&!welcomed){this.closed=true;this.reject?.(new AppError(msg.code||'error.internal',msg.params));this.onError(msg);socket.close();}
   else {
    if(msg.type==='state'){this.seat=msg.value.seat;this.roomId=msg.value.roomId;this.watch=msg.value.spectator;this.remember();}
    if(msg.type==='hall'){this.seat=-1;this.roomId=null;this.watch=false;this.remember();}
    this.onMessage(this.seat,msg);
   }
  };
  socket.onclose=event=>{
   clearTimeout(timeout);if(this.closed||socket!==this.socket)return;clearInterval(this.heartbeat);this.ready=false;
   this.onStatus(this.seat,'closed');
   if([4001,4003,4008].includes(event.code)){this.closed=true;this.onError({code:event.code===4001?'error.otherTab':'error.disconnected'});return;}
   if(++this.attempt>5&&this.reject){this.reject(new AppError('error.connectFailed'));this.reject=null;this.closed=true;return;}
   this.onNotice(messageEvent('connection.retry'));this.timer=setTimeout(()=>this.connect(),Math.min(1000*2**Math.min(this.attempt,4),15000));
  };
  socket.onerror=()=>socket.close();
 }
 send(_seat,body){if(!this.connected())return false;this.socket.send(JSON.stringify(body));return true;}
 request(body){if(!this.send(0,body))throw new AppError('error.waitConnection');if(body.name){this.name=body.name;this.remember();}}
 connected(){return this.ready&&this.socket?.readyState===1;}
 close(){this.closed=true;this.ready=false;clearTimeout(this.timer);clearInterval(this.heartbeat);this.socket?.close();this.reject?.(new AppError('error.cancelled'));}
}
