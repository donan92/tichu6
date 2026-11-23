import {newGame,startRound,act,view,team,partners,LABEL,kindName,classify,beats,botAction} from './game.js';
import {Room} from './peer.js';
const root=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const suit=['◆','♠','●','✦'], special={mahjong:'새',dog:'개',phoenix:'봉',dragon:'용'};
let mode='home',room=null,state=null,v=null,selected=[],online=Array(6).fill(false),busy=false,pending=false;
let drafts={name:'',stun:true,inviteSeat:'1',offer:'',answer:'',output:'',wish:'',target:'',phoenixRank:''};
let statuses=Array(6).fill('대기 중'),noticeTimer,botTimer;
const me=()=>mode==='join'?(room?.seat||0):0;
const allOnline=()=>mode==='demo'||online.every(Boolean);
function notify(message) {const el=document.querySelector('#notice');el.textContent=message;el.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('show'),6000);}
function button(text,action,disabled=false,cls='') {return `<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;}
function card(c,interactive=false,index=-1) {
  const pick=selected.indexOf(c.id),name=c.special?special[c.special]:(LABEL[c.rank]||c.rank),icon=c.special?({mahjong:'雀',dog:'犬',phoenix:'鳳',dragon:'龍'}[c.special]):suit[c.suit];
  const label=c.special?name:`${['비취','검','탑','별'][c.suit]} ${name}`;
  const inside=`<span class="card-corner">${name}<small>${c.special?'6T':suit[c.suit]}</small></span><span class="card-symbol">${icon}</span><span class="card-bottom">${name}</span>${pick>=0&&interactive?`<span class="pick">${pick+1}</span>`:''}`;
  return interactive?`<button class="card suit-${c.suit} ${c.special?'special':''} ${pick>=0?'selected':''}" data-card="${c.id}" aria-label="${esc(label)}${index>=0?` (${index+1}번째 카드)`:''}" aria-pressed="${pick>=0}">${inside}</button>`:`<div class="card suit-${c.suit} ${c.special?'special':''}" aria-label="${esc(label)}">${inside}</div>`;
}
function header() {return `<header><a class="brand" href="#" data-action="home">6<span>T</span><small>티추, 여섯이서.</small></a><div class="header-right"><span class="connection-label">${mode==='home'?'108 CARDS · 6 PLAYERS':mode==='demo'?'연습 테이블':mode==='host'?'P2P · 방장':'P2P · 참가자'}</span>${mode!=='home'?button('나가기','home',false,'quiet'):''}</div></header>`;}
function rules() {return `<details class="rules"><summary>이 테이블의 규칙과 연결 안내</summary><div class="rule-grid"><section><h3>함께 정한 6T</h3><p>일반 카드 두 벌 + 용·봉·개·새 각 1장. 총 108장을 18장씩 나누고 A–B–A–B–A–B 순서로 진행합니다.</p><p>같은 숫자 <b>정확히 4장</b>, 또는 같은 문양의 연속 5장 이상이 폭탄입니다. 같은 크기·숫자의 폭탄은 서로 이기지 못합니다. 봉은 폭탄에 쓸 수 없습니다.</p></section><section><h3>이번 버전의 기본 규칙</h3><p>첫 8장을 보고 그랜드 티추(±200)를 결정합니다. 팀원 두 명에게 한 장씩 교환하고, 첫 카드를 내기 전 티추(±100)를 선언할 수 있습니다.</p><p>트리플 승리 300점, 목표 1,000점. 더블 덱의 일반 카드 점수 합은 200점입니다. 개는 팀원 중 한 명을 선택하고, 용은 상대 한 명에게 트릭을 줍니다.</p></section><section><h3>브라우저끼리 연결</h3><p>초대·응답 코드를 메신저 등으로 교환하세요. 방장의 탭을 열어 두어야 합니다. 연결이 끊기면 게임이 멈추며 새로고침 복구와 방장 이전은 지원하지 않습니다.</p><p>공용 STUN은 연결 주소를 찾는 데만 사용합니다. TURN 중계가 없어 일부 공유기·회사망에서는 연결할 수 없습니다. 방장은 전체 패를 관리하므로 서로 신뢰하는 친구들과 플레이하세요.</p></section></div></details>`;}
function home() {
  const samples=[{id:'hero-a',rank:14,suit:0},{id:'hero-p',rank:15,suit:-1,special:'phoenix'},{id:'hero-d',rank:16,suit:-1,special:'dragon'}];
  return `<main class="landing"><section class="hero"><div><span class="eyebrow">THREE ON YOUR SIDE.</span><h1>여섯이 모이면,<br>새로운 <em>티추.</em></h1><p class="hero-copy">두 벌의 카드. 세 명의 팀원.<br>친구들과 브라우저에서 바로 만나는 6인 티추.</p><div class="hero-tags"><span>3 vs 3 팀 플레이</span><span>서버 없는 P2P</span><span>설치 없이 시작</span></div></div><div class="hero-cards" aria-hidden="true">${samples.map(c=>card(c)).join('')}<span class="orbit">A · B · A · B · A · B</span></div></section><section class="entry"><div class="entry-title"><span class="eyebrow">TAKE A SEAT</span><h2>테이블에 앉으세요</h2></div><div class="entry-form"><label>닉네임<input id="name" maxlength="20" placeholder="어떻게 불러드릴까요?" value="${esc(drafts.name)}" autocomplete="nickname"></label><div class="entry-actions">${button('테이블 만들기','host',false,'primary')}${button('초대 코드로 참가','join')}${button('혼자 연습하기','demo',false,'quiet')}</div><label class="checkbox"><input type="checkbox" id="stun" ${drafts.stun?'checked':''}> 공용 STUN으로 인터넷 연결 시도 <span>끄면 같은 네트워크용</span></label></div></section>${rules()}<footer>6T · 친구들과 즐기는 작은 카드 테이블 <span>STATIC WEB / WEBRTC</span></footer></main>`;
}
function lobby() {
  const isHost=mode==='host';
  return `<main class="lobby"><div class="page-heading"><div><span class="eyebrow">${isHost?'YOUR TABLE':'JOIN A TABLE'}</span><h1>${isHost?'친구들을 초대하세요.':'빈자리가 기다리고 있어요.'}</h1><p>초대 코드를 받고 응답 코드를 돌려주면 연결됩니다.</p></div><span class="counter">${online.filter(Boolean).length}<small> / 6</small></span></div><div class="lobby-grid"><section class="panel"><h2>테이블 좌석</h2><div class="roster">${Array.from({length:6},(_,i)=>`<div class="roster-row"><span class="avatar team-${team(i)}">${i+1}</span><div><b>${esc(v?.names[i]||state?.names[i]||`플레이어 ${i+1}`)}</b><small>TEAM ${team(i)?'B':'A'}${i===0?' · 방장':''}${i===me()?' · 나':''}</small></div><span class="seat-status ${online[i]?'connected':''}">${online[i]?'연결됨':esc(statuses[i])}</span></div>`).join('')}</div>${isHost?button('6명 모두 모였어요 · 시작','start',!allOnline(),'primary wide'):''}<p class="muted">A와 B 팀이 한 자리씩 번갈아 앉습니다.</p></section><section class="panel signaling">${isHost?`<span class="step">01 · 초대하기</span><h2>한 명씩 연결해요</h2><label>초대할 좌석<select id="inviteSeat">${[1,2,3,4,5].map(i=>`<option value="${i}" ${drafts.inviteSeat==i?'selected':''}>${i+1}번 · TEAM ${team(i)?'B':'A'} ${online[i]?'(연결됨)':''}</option>`).join('')}</select></label>${button(busy?'연결 주소를 모으는 중…':'초대 코드 만들기','offer',busy||online[Number(drafts.inviteSeat)],'primary wide')}<p class="muted">각 좌석마다 다른 코드를 만들고 해당 친구에게 보내세요.</p>`:`<span class="step">01 · 초대받기</span><h2>방장이 보낸 초대 코드</h2><label>초대 코드<textarea id="offer" placeholder="긴 연결 코드를 여기에 붙여넣으세요" spellcheck="false">${esc(drafts.offer)}</textarea></label>${button(busy?'연결 주소를 모으는 중…':'응답 코드 만들기','makeAnswer',busy||online[0],'primary wide')}`}${drafts.output?`<div class="code-output"><label>${isHost?'친구에게 보낼 초대 코드':'방장에게 돌려줄 응답 코드'}<textarea id="output" readonly spellcheck="false">${esc(drafts.output)}</textarea></label>${button('코드 복사','copy',false,'wide')}</div>`:''}${isHost?`<hr><span class="step">02 · 연결 완료하기</span><label>친구에게 받은 응답 코드<textarea id="answer" placeholder="응답 코드를 붙여넣으세요" spellcheck="false">${esc(drafts.answer)}</textarea></label>${button('응답 적용 · 연결','accept',busy,'wide')}`:`<p class="muted">방장이 응답 코드를 적용한 뒤 6명이 연결되면 게임을 시작합니다.</p>`}</section></div>${rules()}</main>`;
}
const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
function controls() {
  const seat=me(),locked=pending||v.paused;
  if(v.phase==='grand') return `<div class="action-message"><h3>${v.ready[seat]?'다른 플레이어의 결정을 기다립니다.':'첫 8장, 승부를 걸어볼까요?'}</h3><p>그랜드 티추는 이번 라운드에서 가장 먼저 손패를 비우면 +200, 실패하면 −200점입니다.</p></div><div class="action-buttons">${button('그랜드 티추 선언','grandYes',locked||v.ready[seat],'accent')}${button('선언 없이 계속','grandNo',locked||v.ready[seat],'primary')}</div>`;
  if(['roundEnd','matchEnd'].includes(v.phase)) return `<div class="action-message"><h3>${v.phase==='matchEnd'?`${v.scores[0]>v.scores[1]?'A':'B'} 팀 승리!`:'라운드가 끝났어요.'}</h3><p>이번 라운드 A ${v.delta[0]>0?'+':''}${v.delta[0]} · B ${v.delta[1]>0?'+':''}${v.delta[1]}</p></div><div>${me()===0&&mode!=='join'&&v.phase==='roundEnd'?button('다음 라운드','next',locked,'primary'):button('테이블 나가기','home',false,'quiet')}</div>`;
  if(v.phase==='exchange') return `<div class="action-message"><h3>${v.exchangeReady[seat]?'교환 완료를 기다리고 있어요.':'팀원에게 한 장씩, 마음을 전하세요.'}</h3><p>선택한 순서대로 ① ${esc(v.names[partners(seat)[0]])} ② ${esc(v.names[partners(seat)[1]])} 님에게 보냅니다.</p></div><div class="action-buttons">${button('티추 선언','tichu',locked||!!v.calls[seat],'quiet')}${button(`선택한 ${selected.length}/2장 교환`,'exchange',locked||v.exchangeReady[seat]||selected.length!==2,'primary')}</div>`;
  if(v.phase==='trick' && v.last===seat) {
    const dragon=v.top?.cards[0]?.special==='dragon';
    return `<div class="action-message"><h3>${dragon?'용이 가져온 트릭, 상대에게 주세요.':'이번 트릭을 가져올 차례입니다.'}</h3><p>다른 플레이어는 확정 전까지 폭탄으로 끼어들 수 있습니다.</p></div><div class="action-buttons">${dragon?`<label>받을 상대<select id="target">${options(v.names.map((n,i)=>[i,n]).filter(([i])=>team(i)!==team(seat)),drafts.target)}</select></label>`:''}${button(dragon?'상대에게 트릭 전달':'트릭 확정','collect',locked,'primary')}</div>`;
  }
  const chosen=v.hand.filter(c=>selected.includes(c.id)),combo=classify(chosen,v.top,Number(drafts.phoenixRank)||null);
  const specialOptions=[];
  if(chosen.some(c=>c.special==='mahjong')) specialOptions.push(`<label>새의 소원<select id="wish">${options([['','소원 없음'],...Array.from({length:13},(_,i)=>[i+2,LABEL[i+2]||i+2])],drafts.wish)}</select></label>`);
  if(chosen.some(c=>c.special==='dog')) specialOptions.push(`<label>개를 받을 팀원<select id="target">${options(partners(seat).map(i=>[i,v.names[i]]),drafts.target)}</select></label>`);
  if(chosen.length>1&&chosen.some(c=>c.special==='phoenix')) specialOptions.push(`<label>봉의 숫자<select id="phoenixRank">${options([['','자동 판정'],...Array.from({length:13},(_,i)=>[i+2,LABEL[i+2]||i+2])],drafts.phoenixRank)}</select></label>`);
  return `<div class="action-message"><h3>${v.phase==='trick'?'트릭 확정 대기':v.turn===seat?'내 차례입니다.':`${esc(v.names[v.turn])} 님의 차례`}</h3><p>${chosen.length?`${selected.length}장 선택 · ${combo?kindName(combo.kind):'낼 수 없는 조합'}`:'카드를 선택하세요. 차례가 아니어도 폭탄은 낼 수 있어요.'}</p></div><div class="action-buttons">${specialOptions.join('')}${button('티추','tichu',locked||v.played[seat]||!!v.calls[seat],'quiet')}${button('패스','pass',locked||v.turn!==seat||v.phase!=='play'||!v.top)}${button(combo?.bomb?'폭탄 내기':'카드 내기','play',locked||!combo||!beats(combo,v.top)||(v.turn!==seat||v.phase==='trick')&&!combo.bomb,'primary')}</div>`;
}
function game() {
  const seat=me();
  return `<main class="game"><div class="game-bar"><div><span class="eyebrow">${mode==='demo'?'PRACTICE TABLE':'FRIENDS TABLE'}</span><h2>ROUND ${String(v.round).padStart(2,'0')} <span>1,000점 승부</span></h2></div><div class="score"><span class="team-a">TEAM A <b>${v.scores[0]}</b></span><i>:</i><span class="team-b"><b>${v.scores[1]}</b> TEAM B</span></div></div>${v.paused?'<div class="warning" role="alert">연결이 끊겨 진행을 멈췄습니다. 연결 상태가 회복되면 계속할 수 있습니다. 새로고침한 참가자는 이 방에 복구할 수 없습니다.</div>':''}<section class="table" aria-label="6인 게임 테이블">${v.names.map((name,i)=>`<div class="player pos-${(i-seat+6)%6} ${v.phase==='play'&&v.turn===i?'active':''}"><div class="avatar team-${team(i)}">${v.finish.includes(i)?`${v.finish.indexOf(i)+1}등`:i+1}</div><div><b>${esc(name)}${i===seat?' <span class="you">나</span>':''}</b><small>TEAM ${team(i)?'B':'A'} · ${v.counts[i]}장${v.calls[i]?` · ${v.calls[i]===200?'그랜드':'티추'}`:''}</small></div></div>`).join('')}<div class="table-center">${v.top?`<span class="eyebrow">${esc(v.names[v.last])} · ${kindName(v.top.kind)}</span><div class="played-cards">${v.top.cards.map(c=>card(c)).join('')}</div><span class="table-note">${v.phase==='trick'?'트릭 확정 대기':`패스 ${v.passed.length}명`}</span>`:`<div class="table-mark">6T</div><p class="table-note">${v.phase==='grand'?'좋은 패가 오기를.':v.phase==='exchange'?'함께 이길 카드를 나눠요.':v.phase==='roundEnd'||v.phase==='matchEnd'?'다음 승부를 기다리며.':'새로운 트릭을 시작하세요.'}</p>`}${v.wish?`<span class="wish-badge">새의 소원 · ${LABEL[v.wish]||v.wish}</span>`:''}</div></section><section class="hand-panel"><div class="hand-heading"><div><span class="eyebrow">YOUR HAND</span><b>내 카드 <span>${v.hand.length}장${v.phase==='grand'?' / 첫 8장':''}</span></b></div>${button('선택 해제','clear',!selected.length,'quiet')}</div><div class="hand">${v.hand.map((c,i)=>card(c,true,i)).join('')||'<p class="empty-hand">카드를 모두 내려놓았습니다. 팀원을 응원하세요.</p>'}</div><div class="controls">${controls()}</div></section><details class="activity"><summary>진행 기록 <span>${esc(v.log.at(-1)||'')}</span></summary><ol>${v.log.slice().reverse().map(l=>`<li>${esc(l)}</li>`).join('')}</ol></details>${rules()}</main>`;
}
function render() {
  const focus=document.activeElement?.id,position=document.activeElement?.selectionStart;
  root.innerHTML=header()+(mode==='home'?home():v&&v.phase!=='lobby'?game():lobby());
  if(focus) {const el=document.getElementById(focus);if(el&&el.tagName!=='SELECT'){el.focus();if(typeof position==='number'&&el.setSelectionRange) el.setSelectionRange(position,position);}}
}
function publish() {
  online[0]=true;
  if(room) for(let i=1;i<6;i++) online[i]=room.connected(i);
  v={...view(state,0),paused:state.phase!=='lobby'&&!allOnline()};
  if(room) for(let i=1;i<6;i++) room.send(i,{type:'state',value:{...view(state,i),paused:state.phase!=='lobby'&&!allOnline()},online});
  selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();scheduleBot();
}
function receive(seat,msg) {
  if(mode==='host') {
    if(msg.type==='hello' && state.phase==='lobby') {state.names[seat]=String(msg.name||`플레이어 ${seat+1}`).slice(0,20);publish();}
    if(msg.type==='action') {
      try {if(!allOnline()) throw new Error('모든 참가자의 연결을 기다리고 있습니다.');if(msg.revision!==state.revision) throw new Error('게임 상태가 바뀌었습니다. 다시 선택해 주세요.');state=act(state,seat,msg.action);publish();}
      catch(e) {room.send(seat,{type:'error',message:e.message});room.send(seat,{type:'state',value:{...view(state,seat),paused:!allOnline()},online});}
    }
  } else if(mode==='join') {
    if(msg.type==='state' && msg.value?.seat===me()) {v=msg.value;online=msg.online;pending=false;selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();}
    else if(msg.type==='error') {pending=false;notify(msg.message);render();}
  }
}
function setupRoom() {
  room=new Room({stun:drafts.stun,onMessage:receive,onError:notify,onStatus:(seat,status)=>{
    statuses[seat]=({new:'준비 중',connecting:'연결 중',connected:'연결 중',open:'연결됨',disconnected:'연결 끊김',failed:'연결 실패',closed:'연결 종료'}[status]||status);
    if(mode==='host') publish();
    else {online[0]=room.connected(0);if(status==='open') room.send(0,{type:'hello',name:drafts.name||'친구'});if(v) v.paused=!online[0]||v.paused;render();}
    if(status==='failed') notify('직접 연결하지 못했습니다. 새 코드로 다시 시도하거나 다른 네트워크를 사용하세요. TURN 중계는 제공하지 않습니다.');
  }});
}
function scheduleBot() {
  clearTimeout(botTimer);if(mode!=='demo'||!state) return;
  let seat=-1;
  if(state.phase==='grand') seat=state.ready.findIndex((ready,i)=>i>0&&!ready);
  else if(state.phase==='exchange') seat=state.exchanges.findIndex((ready,i)=>i>0&&!ready);
  else if(state.phase==='play') seat=state.turn;
  else if(state.phase==='trick') seat=state.last;
  if(seat>0) botTimer=setTimeout(()=>{try{state=act(state,seat,botAction(state,seat));publish();}catch(e){notify(`연습 플레이 오류: ${e.message}`);}},800);
}
function submit(action) {
  if(mode==='join') {if(pending) return;pending=room.send(0,{type:'action',revision:v.revision,action});if(!pending) throw new Error('방장과 연결되어 있지 않습니다.');render();}
  else {if(!allOnline()) throw new Error('모든 참가자가 연결되어야 진행할 수 있습니다.');state=act(state,0,action);selected=[];publish();}
}
root.addEventListener('input',e=>{if(e.target.id in drafts) drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;});
root.addEventListener('change',e=>{if(e.target.id in drafts){drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(['phoenixRank','inviteSeat'].includes(e.target.id)) render();}});
root.addEventListener('click',async e=>{
  const c=e.target.closest('[data-card]');
  if(c) {const id=c.dataset.card;selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];render();return;}
  const el=e.target.closest('[data-action]');if(!el||el.disabled) return;e.preventDefault();const action=el.dataset.action;
  try {
    if(action==='home') {if(mode!=='home'&&!confirm('테이블을 나가면 현재 게임에 복귀할 수 없습니다. 나갈까요?')) return;clearTimeout(botTimer);room?.close();room=null;mode='home';state=null;v=null;selected=[];pending=false;online=Array(6).fill(false);drafts.output='';drafts.offer='';drafts.answer='';render();return;}
    if(['host','join','demo'].includes(action)) {
      mode=action;selected=[];online=Array(6).fill(false);statuses=Array(6).fill('대기 중');
      if(action==='join') {setupRoom();render();return;}
      state=newGame([drafts.name||'나',...(action==='demo'?['하늘봇','도담봇','여울봇','노을봇','바다봇']:['플레이어 2','플레이어 3','플레이어 4','플레이어 5','플레이어 6'])]);
      if(action==='demo') {online.fill(true);startRound(state);}else setupRoom();publish();return;
    }
    if(action==='copy') {try{await navigator.clipboard.writeText(drafts.output);notify('연결 코드를 복사했습니다.');}catch{document.querySelector('#output')?.select();notify('코드를 선택했습니다. 복사 단축키를 눌러 주세요.');}return;}
    if(['offer','makeAnswer','accept'].includes(action)) {
      busy=true;render();
      try {
        if(action==='offer') drafts.output=await room.offer(Number(drafts.inviteSeat));
        if(action==='makeAnswer') drafts.output=await room.join(drafts.offer);
        if(action==='accept') {await room.answer(drafts.answer);drafts.answer='';notify('응답을 적용했습니다. 연결을 기다려 주세요.');}
      } finally {busy=false;render();}return;
    }
    if(action==='start'||action==='next') {if(!allOnline()) throw new Error('6명이 모두 연결되어야 합니다.');startRound(state);selected=[];publish();return;}
    if(action==='clear') {selected=[];render();return;}
    if(action==='grandYes'||action==='grandNo') submit({type:'grand',call:action==='grandYes'});
    if(action==='exchange') submit({type:'exchange',ids:selected});
    if(action==='tichu') submit({type:'tichu'});
    if(action==='pass') submit({type:'pass'});
    if(action==='collect') submit({type:'collect',target:Number(document.querySelector('#target')?.value)});
    if(action==='play') submit({type:'play',ids:selected,wish:drafts.wish?Number(drafts.wish):null,target:Number(document.querySelector('#target')?.value),phoenixRank:Number(drafts.phoenixRank)||null});
  } catch(err) {notify(err.message);}
});
window.addEventListener('beforeunload',e=>{if(mode!=='home'&&mode!=='demo'){e.preventDefault();e.returnValue='';}});
render();
