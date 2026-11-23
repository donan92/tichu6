import {Seats} from './seats.js';
const PROTOCOL = 2;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let library;
async function loadPeer() {
  if(globalThis.Peer) return globalThis.Peer;
  if(!library) library=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./vendor/peerjs-1.5.5.min.js',import.meta.url).href;
    script.onload=()=>globalThis.Peer?resolve(globalThis.Peer):reject(new Error('연결 모듈을 불러오지 못했습니다. 새로고침해 주세요.'));
    script.onerror=()=>{script.remove();library=null;reject(new Error('연결 모듈을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));};
    document.head.append(script);
  });
  return library;
}
export function normalizeCode(value) {
  const code=String(value).replace(/[\s-]/g,'').toUpperCase();
  if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code)) throw new Error('방 코드 10자리를 확인해 주세요. 예: ABCDE-FGHJK');
  return code;
}
export const displayCode=code=>`${code.slice(0,5)}-${code.slice(5)}`;
export function generateCode() {
  const bytes=crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes,b=>ALPHABET[b%32]).join('');
}
const peerId=code=>`tichu6-v2-${code}`;
function errorText(error) {
  return ({'peer-unavailable':'방을 찾을 수 없습니다. 코드를 확인하고 방장이 페이지를 열어 두었는지 확인해 주세요.',
    'unavailable-id':'방 코드가 사용 중입니다. 다시 테이블을 만들어 주세요.',
    'browser-incompatible':'WebRTC를 지원하는 최신 Chrome, Edge 또는 Safari에서 열어 주세요.',
    'network':'공용 연결 서버에 접속하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    'server-error':'공용 연결 서버가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.',
    'socket-error':'공용 연결 서버와 통신하지 못했습니다. 네트워크를 확인해 주세요.',
    'webrtc':'브라우저끼리 연결하지 못했습니다. 다른 네트워크에서 시도해 주세요.'})[error?.type]||'연결에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.';
}
export class Room {
  constructor({onMessage=()=>{},onStatus=()=>{},onError=()=>{},onNotice=()=>{},peerFactory=null}={}) {
    Object.assign(this,{onMessage,onStatus,onError,onNotice,peerFactory});
    this.links=new Map();this.connections=new Set();this.seats=new Seats();this.timers=new Set();
    this.seat=0;this.isHost=true;this.closed=false;this.code='';this.peer=null;this.cancelOpen=null;this.cancelJoin=null;
  }
  later(fn,ms) {const timer=setTimeout(()=>{this.timers.delete(timer);fn();},ms);this.timers.add(timer);return timer;}
  clear(timer) {clearTimeout(timer);this.timers.delete(timer);}
  async initialize(id) {
    const Peer=this.peerFactory||await loadPeer();
    if(this.closed) throw new Error('연결을 취소했습니다.');
    const peer=this.peer=new Peer(id,{secure:true,debug:0,config:{iceServers:[
      {urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]}});
    let reconnects=0;
    peer.on('connection',connection=>{if(this.isHost&&!this.closed)this.accept(connection);else connection.close();});
    return new Promise((resolve,reject)=>{
      let opening=true;
      const timer=this.later(()=>fail(new Error('공용 연결 서버의 응답이 지연됩니다. 잠시 후 다시 시도해 주세요.')),20000);
      const fail=error=>{if(!opening)return;opening=false;this.clear(timer);this.cancelOpen=null;reject(error);};
      this.cancelOpen=()=>fail(new Error('연결을 취소했습니다.'));
      peer.on('open',()=>{
        if(this.closed)return;
        reconnects=0;
        if(opening){opening=false;this.clear(timer);this.cancelOpen=null;resolve();}
        else this.onNotice('공용 연결 서버와 다시 연결되었습니다.');
      });
      peer.on('error',error=>{
        if(this.closed)return;
        const message=errorText(error);
        if(opening)fail(new Error(message));
        else if(this.cancelJoin)this.cancelJoin(new Error(message));
        else this.onError(message);
      });
      peer.on('disconnected',()=>{
        if(this.closed)return;
        this.onNotice('공용 연결 서버 연결이 끊겼습니다. 기존 게임 연결은 유지되며 새 참가자 연결을 다시 시도합니다.');
        if(reconnects++<3)this.later(()=>{if(!this.closed&&peer.disconnected&&!peer.destroyed)peer.reconnect();},1500);
      });
    });
  }
  async host() {
    this.isHost=true;this.seat=0;
    const code=generateCode();
    try {await this.initialize(peerId(code));this.code=code;return displayCode(code);}
    catch(error){this.close();throw error;}
  }
  async join(rawCode) {
    const code=normalizeCode(rawCode);this.isHost=false;this.seat=-1;this.code=code;
    try {
      await this.initialize(undefined);
      if(this.closed)throw new Error('연결을 취소했습니다.');
      return await new Promise((resolve,reject)=>{
        const connection=this.peer.connect(peerId(code),{reliable:true,serialization:'json',metadata:{protocol:PROTOCOL}});
        this.connections.add(connection);
        let waiting=true;
        const timer=this.later(()=>fail(new Error('방장과 직접 연결하지 못했습니다. 방 코드와 네트워크를 확인해 주세요.')),25000);
        const fail=error=>{if(!waiting)return;waiting=false;this.clear(timer);this.cancelJoin=null;reject(error);};
        this.cancelJoin=fail;
        connection.on('data',message=>{
          if(this.closed||!message||typeof message!=='object')return;
          if(message.kind==='rejected'&&waiting){
            try{connection.send({kind:'rejected-ack'});}catch{}
            fail(new Error(message.reason==='full'?'이미 6명이 입장한 방입니다. 빈자리가 생긴 후 다시 시도해 주세요.':message.reason==='started'?'이미 게임이 시작되어 참가할 수 없습니다.':'게임 버전이 다릅니다. 모두 새로고침해 주세요.'));return;
          }
          if(message.kind==='welcome'&&waiting&&message.protocol===PROTOCOL&&Number.isInteger(message.seat)&&message.seat>=1&&message.seat<=5){
            waiting=false;this.clear(timer);this.cancelJoin=null;this.seat=message.seat;this.links.set(0,connection);
            this.monitor(connection,0);this.onStatus(0,'open');resolve(this.seat);return;
          }
          if(!waiting&&this.links.get(0)===connection&&message.kind==='game')this.deliver(0,message.body);
        });
        connection.on('error',error=>{if(waiting)fail(new Error(errorText(error)));});
        connection.on('close',()=>{this.connections.delete(connection);if(waiting)fail(new Error('방장과 연결이 종료되었습니다.'));});
      });
    } catch(error){this.close();throw error;}
  }
  accept(connection) {
    this.connections.add(connection);
    let seat=null,rejected=false;
    // Incomplete connection attempts never reserve player seats.
    const pendingTimer=this.later(()=>{if(seat===null)connection.close();},25000);
    const admit=()=>{
      if(this.closed||seat!==null||rejected)return;
      this.clear(pendingTimer);
      const admission=connection.metadata?.protocol===PROTOCOL?this.seats.admit(connection):{reason:'version'};
      if(admission.reason){
        rejected=true;connection.send({kind:'rejected',reason:admission.reason});
        this.later(()=>connection.close(),1500);return;
      }
      seat=admission.seat;this.links.set(seat,connection);this.monitor(connection,seat);
      connection.send({kind:'welcome',protocol:PROTOCOL,seat});
      this.onStatus(seat,'open');
    };
    connection.on('open',admit);
    connection.on('data',message=>{
      if(this.closed||!message||typeof message!=='object')return;
      if(rejected){if(message.kind==='rejected-ack')connection.close();return;}
      if(seat!==null&&this.links.get(seat)===connection&&message.kind==='game')this.deliver(seat,message.body);
    });
    connection.on('close',()=>{this.clear(pendingTimer);this.connections.delete(connection);});
    connection.on('error',()=>{if(seat===null){this.clear(pendingTimer);connection.close();}});
    if(connection.open)admit();
  }
  monitor(connection,seat) {
    connection.on('close',()=>{
      if(this.closed||this.links.get(seat)!==connection)return;
      this.links.delete(seat);this.seats.release(connection);this.onStatus(seat,'closed');
    });
    connection.on('error',()=>{if(!this.closed&&this.links.get(seat)===connection){connection.close();}});
    connection.peerConnection?.addEventListener('connectionstatechange',()=>{
      if(this.closed||this.links.get(seat)!==connection)return;
      const status=connection.peerConnection.connectionState;
      if(['disconnected','failed','connected'].includes(status))this.onStatus(seat,status);
    });
  }
  deliver(seat,body) {
    if(!body||typeof body!=='object'||JSON.stringify(body).length>150000)return;
    this.onMessage(seat,body);
  }
  lock() {this.seats.lock();}
  connected(seat) {
    const c=this.links.get(seat),state=c?.peerConnection?.connectionState;
    return !!c?.open&&!['disconnected','failed','closed'].includes(state);
  }
  send(seat,body) {
    const c=this.links.get(seat);if(!this.connected(seat))return false;
    try{c.send({kind:'game',body});return true;}catch{return false;}
  }
  close() {
    if(this.closed)return;this.closed=true;
    this.cancelOpen?.();this.cancelJoin?.(new Error('연결을 취소했습니다.'));
    for(const timer of this.timers)clearTimeout(timer);this.timers.clear();
    for(const connection of this.connections)connection.close();
    this.connections.clear();this.links.clear();this.peer?.destroy();
  }
}
