// Manual, non-trickle ICE signaling: no signaling service or game backend.
const VERSION=1;
function pack(value) {return btoa(JSON.stringify(value));}
function unpack(code,type) {
  if(typeof code!=='string'||code.length>100000) throw new Error('연결 코드가 너무 큽니다.');
  let p;try {p=JSON.parse(atob(code.trim()));} catch {throw new Error('연결 코드를 다시 확인하세요.');}
  if(p.v!==VERSION||p.type!==type||!Number.isInteger(p.seat)||p.seat<1||p.seat>5||typeof p.token!=='string'||p.token.length>100||p.sdp?.type!==type||typeof p.sdp?.sdp!=='string') throw new Error('올바른 연결 코드가 아닙니다.');
  return p;
}
async function gathered(pc) {
  if(pc.iceGatheringState==='complete') return;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('연결 주소 수집이 지연됩니다. 다시 시도하거나 STUN 설정을 확인하세요.'));},18000);
    const change=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve();}};
    const cleanup=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',change);};
    pc.addEventListener('icegatheringstatechange',change);change();
  });
}
export class Room {
  constructor({onMessage,onStatus,onError,stun=true}) {Object.assign(this,{onMessage,onStatus,onError,stun});this.links=new Map();this.seat=0;this.isHost=true;}
  create(seat,token) {
    this.links.get(seat)?.pc.close();
    const pc=new RTCPeerConnection({iceServers:this.stun?[{urls:'stun:stun.l.google.com:19302'}]:[]});
    const link={pc,token,channel:null};this.links.set(seat,link);
    pc.onconnectionstatechange=()=>this.onStatus(seat,pc.connectionState);
    const wire=channel=>{
      link.channel=channel;
      channel.onopen=()=>this.onStatus(seat,'open');
      channel.onclose=()=>this.onStatus(seat,'closed');
      channel.onerror=()=>this.onError('데이터 연결 오류가 발생했습니다.');
      channel.onmessage=e=>{
        try {if(typeof e.data!=='string'||e.data.length>150000) throw new Error();const message=JSON.parse(e.data);if(message&&typeof message==='object') this.onMessage(seat,message);}
        catch {this.onError('잘못된 네트워크 메시지를 거부했습니다.');}
      };
    };
    if(this.isHost) wire(pc.createDataChannel('tichu6',{ordered:true}));else pc.ondatachannel=e=>wire(e.channel);
    return link;
  }
  async offer(seat) {
    if(!this.isHost) throw new Error('방장만 초대할 수 있습니다.');
    const token=crypto.randomUUID(),{pc}=this.create(seat,token);
    await pc.setLocalDescription(await pc.createOffer());await gathered(pc);
    return pack({v:VERSION,type:'offer',seat,token,sdp:pc.localDescription.toJSON()});
  }
  async join(code) {
    const p=unpack(code,'offer');this.isHost=false;this.seat=p.seat;
    const {pc}=this.create(0,p.token);
    await pc.setRemoteDescription(p.sdp);await pc.setLocalDescription(await pc.createAnswer());await gathered(pc);
    return pack({v:VERSION,type:'answer',seat:p.seat,token:p.token,sdp:pc.localDescription.toJSON()});
  }
  async answer(code) {
    const p=unpack(code,'answer'),link=this.links.get(p.seat);
    if(!this.isHost||!link||link.token!==p.token) throw new Error('이 방의 최신 초대에 대한 응답이 아닙니다.');
    if(link.pc.signalingState!=='have-local-offer') throw new Error('이미 응답을 적용한 초대입니다.');
    await link.pc.setRemoteDescription(p.sdp);
  }
  send(seat,message) {
    const link=this.links.get(seat);if(link?.channel?.readyState!=='open') return false;
    link.channel.send(JSON.stringify(message));return true;
  }
  connected(seat) {const l=this.links.get(seat);return l?.channel?.readyState==='open'&&l.pc.connectionState==='connected';}
  close() {for(const l of this.links.values()) {l.pc.onconnectionstatechange=null;if(l.channel) l.channel.onclose=null;l.pc.close();}this.links.clear();}
}
