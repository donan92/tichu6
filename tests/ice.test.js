import test from 'node:test';
import assert from 'node:assert/strict';
import {gatherCandidates, candidateSummary, ICE_WAIT_MS} from '../src/ice.js';
import {Room} from '../src/peer.js';
const local='a=candidate:1 1 udp 2122260223 peer.local 50000 typ host\r\n';
const publicCandidate='a=candidate:2 1 udp 1686052607 203.0.113.1 50000 typ srflx raddr 192.168.0.2 rport 50000\r\n';
function peer(sdp=local,state='gathering') {return Object.assign(new EventTarget(),{localDescription:{type:'offer',sdp:'v=0\r\n'+sdp},iceGatheringState:state,connectionState:'new'});}
test('STUN timeout returns collected local candidates instead of rejecting',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const pc=peer();const result=gatherCandidates(pc);t.mock.timers.tick(ICE_WAIT_MS);
 assert.deepEqual(await result,{count:1,publicAddress:false,partial:true});assert.equal(pc.connectionState,'new');
});
test('one responding STUN is enough even if another never finishes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const pc=peer(local+publicCandidate),result=gatherCandidates(pc);t.mock.timers.tick(ICE_WAIT_MS);
 assert.deepEqual(await result,{count:2,publicAddress:true,partial:true});
});
test('completed ICE resolves immediately with no timeout',async()=>{
 assert.deepEqual(await gatherCandidates(peer(local,'complete')),{count:1,publicAddress:false,partial:false});
});
test('completed ICE event uses newly gathered public candidate',async()=>{
 const pc=peer(),result=gatherCandidates(pc);pc.localDescription.sdp+=publicCandidate;pc.iceGatheringState='complete';pc.dispatchEvent(new Event('icegatheringstatechange'));
 assert.equal((await result).publicAddress,true);
});
test('no candidates is an actionable error, never an unusable invite',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const result=gatherCandidates(peer(''));const rejected=assert.rejects(result,/연결 주소를 찾지 못했습니다/);t.mock.timers.tick(ICE_WAIT_MS);await rejected;
});
test('closing while collecting cancels promptly',async()=>{
 const pc=peer(),result=gatherCandidates(pc),rejected=assert.rejects(result,/취소/);pc.connectionState='closed';pc.dispatchEvent(new Event('connectionstatechange'));await rejected;
});
test('candidate diagnostics distinguish local and public addresses without exposing them',()=>{
 assert.deepEqual(candidateSummary(peer(local)),{count:1,publicAddress:false});assert.equal(candidateSummary(peer(local+publicCandidate)).publicAddress,true);
});
test('invite generation serializes usable partial candidates and explains limitations',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let notice='';const room=new Room({onNotice:value=>notice=value});
 const result=room.code(peer(),{v:1,type:'offer',seat:1,token:'test-token'});t.mock.timers.tick(ICE_WAIT_MS);
 const decoded=JSON.parse(atob(await result));assert.ok(decoded.sdp.sdp.includes('typ host'));assert.equal(decoded.seat,1);assert.match(notice,/같은 Wi-Fi/);
});
test('invalid pasted codes fail before creating a connection',async()=>{
 const room=new Room({});await assert.rejects(room.join('not-a-code'),/연결 코드를/);assert.equal(room.links.size,0);
});
