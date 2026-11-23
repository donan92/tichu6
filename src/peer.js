import {gatherCandidates} from './ice.js';
// Manual, non-trickle ICE signaling: no signaling service or game backend.
const VERSION=1;
function pack(value) {return btoa(JSON.stringify(value));}
function unpack(code,type) {
  if(typeof code!=='string'||code.length>100000) throw new Error('연결 코드가 너무 큽니다.');
  let p;try {p=JSON.parse(atob(code.replace(/\s/g,'')));} catch {throw new Error('연결 코드를 다시 확인하세요.');}
  if(!p||p.v!==VERSION||p.type!==type||!Number.isInteger(p.seat)||p.seat<1||p.seat>5||typeof p.token!=='string'||p.token.length>100||p.sdp?.type!==type||typeof p.sdp?.sdp!=='string') throw new Error('올바른 연결 코드가 아닙니다.');
  return p;
}
export class Room {
  constructor({onMessage,onStatus,onError,onNotice=()=>{},stun=true}) {Object.assign(this,{onMessage,onStatus,onError,onNotice,stun});this.links=new Map();this.seat=0;this.isHost=true;}
  create(seat,token) {
    if(typeof RTCPeerConnection!=='function') throw new Error('이 브라우저는 WebRTC를 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari에서 열어 주세요.');
    this.links.get(seat)?.pc.close();
    const pc=new RTCPeerConnection({iceServers:this.stun?[{urls:'stun:stun.cloudflare.com:3478'},{urls:'stun:stun.l.google.com:19302'}]:[]});
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
    try {
      await pc.setLocalDescription(await pc.createOffer());
      return await this.code(pc,{v:VERSION,type:'offer',seat,token});
    } catch(error) {pc.close();throw error;}
  }
  async join(code) {
    const p=unpack(code,'offer');this.isHost=false;this.seat=p.seat;
    const {pc}=this.create(0,p.token);
    try {
      await pc.setRemoteDescription(p.sdp);await pc.setLocalDescription(await pc.createAnswer());
      return await this.code(pc,{v:VERSION,type:'answer',seat:p.seat,token:p.token});
    } catch(error) {pc.close();throw error;}
  }
  async code(pc, metadata) {
    const result=await gatherCandidates(pc);
    this.onNotice(result.publicAddress
      ? '인터넷 연결 주소가 포함된 코드입니다. 상대에게 전달해 주세요.'
      : '공인 연결 주소를 얻지 못했습니다. 코드는 생성됐지만 같은 Wi-Fi·같은 기기에서만 연결될 수 있습니다. 다른 네트워크의 친구와 연결되지 않으면 네트워크를 변경해 주세요.');
    return pack({...metadata,sdp:{type:pc.localDescription.type,sdp:pc.localDescription.sdp}});
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
