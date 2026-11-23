import {newGame,startRound,act,view,team,partners,LABEL,kindName,classify,beats,botAction} from './game.js';
import {Room,savedRoom} from './server-room.js?v=0.4.0';
const root=document.querySelector('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const suit=['◆','♠','●','✦'], special={mahjong:'새',dog:'개',phoenix:'봉',dragon:'용'};
let directory={rooms:[],count:0};
let mode='home',room=null,state=null,v=null,selected=[],online=Array(6).fill(false),busy=false,pending=false;
let drafts={name:'',roomCode:new URLSearchParams(location.hash.slice(1)).get('room')||'',output:'',wish:'',target:'',phoenixRank:''};
let signalNote='',signalError='',leaving=false;
let statuses=Array(6).fill('대기 중'),noticeTimer,botTimer;
const me=()=>mode==='demo'?0:(room?.seat??-1);
const allOnline=()=>mode==='demo'||online.every(Boolean);
function notify(message) {const el=document.querySelector('#notice');el.textContent=message;el.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('show'),6000);}
function button(text,action,disabled=false,cls='') {return `<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;}
function card(c,interactive=false,index=-1) {
  const pick=selected.indexOf(c.id),name=c.special?special[c.special]:(LABEL[c.rank]||c.rank),icon=c.special?({mahjong:'雀',dog:'犬',phoenix:'鳳',dragon:'龍'}[c.special]):suit[c.suit];
  const label=c.special?name:`${['비취','검','탑','별'][c.suit]} ${name}`;
  const inside=`<span class="card-corner">${name}<small>${c.special?'6T':suit[c.suit]}</small></span><span class="card-symbol">${icon}</span><span class="card-bottom">${name}</span>${pick>=0&&interactive?`<span class="pick">${pick+1}</span>`:''}`;
  return interactive?`<button class="card suit-${c.suit} ${c.special?'special':''} ${pick>=0?'selected':''}" data-card="${c.id}" aria-label="${esc(label)}${index>=0?` (${index+1}번째 카드)`:''}" aria-pressed="${pick>=0}">${inside}</button>`:`<div class="card suit-${c.suit} ${c.special?'special':''}" aria-label="${esc(label)}">${inside}</div>`;
}
function header() {return `<header><a class="brand" href="#" data-action="home">6<span>T</span><small>티추, 여섯이서.</small></a><div class="header-right"><span class="connection-label">${mode==='home'?'108 CARDS · 6 PLAYERS':mode==='demo'?'연습 테이블':room?.connected()?'서버 연결됨':'재접속 대기'}</span>${mode!=='home'?button(mode==='hall'?'접속 종료':'대기실로','home',false,'quiet'):''}</div></header>`;}
function rules() {return `<details class="rules"><summary>이 테이블의 규칙과 연결 안내</summary><div class="rule-grid"><section><h3>함께 정한 6T</h3><p>일반 카드 두 벌 + 용·봉·개·새 각 1장. 총 108장을 18장씩 나누고 A–B–A–B–A–B 순서로 진행합니다.</p><p>같은 숫자 <b>정확히 4장</b>, 또는 같은 문양의 연속 5장 이상이 폭탄입니다. 같은 크기·숫자의 폭탄은 서로 이기지 못합니다. 봉은 폭탄에 쓸 수 없습니다.</p></section><section><h3>이번 버전의 기본 규칙</h3><p>첫 8장을 보고 그랜드 티추(±200)를 결정합니다. 팀원 두 명에게 한 장씩 교환하고, 첫 카드를 내기 전 티추(±100)를 선언할 수 있습니다.</p><p>트리플 승리 300점, 목표 1,000점. 더블 덱의 일반 카드 점수 합은 200점입니다. 개는 팀원 중 한 명을 선택하고, 용은 상대 한 명에게 트릭을 줍니다.</p></section><section><h3>서버에서 이어지는 게임</h3><p>대기실에서 원하는 방을 골라 플레이하거나 관전합니다. 서버가 게임을 저장하므로 방장이 나가도 방은 유지됩니다. 같은 브라우저에서 새로고침하거나 방 목록에서 ‘복귀’를 누르면 자기 자리로 돌아옵니다.</p><p>연결이 끊기면 45초 뒤 봇이 대신 진행하며 복귀하면 다시 직접 플레이합니다. 대기실의 끊긴 자리는 45초 후 비워집니다. 모두 나간 방은 마지막 활동 후 24시간 보관됩니다. 브라우저 데이터를 지우면 참가 키도 사라집니다.</p></section></div></details>`;}
function home() {
  const samples=[{id:'hero-a',rank:14,suit:0},{id:'hero-p',rank:15,suit:-1,special:'phoenix'},{id:'hero-d',rank:16,suit:-1,special:'dragon'}];
  return `<main class="landing"><section class="hero"><div><span class="eyebrow">THREE ON YOUR SIDE.</span><h1>여섯이 모이면,<br>새로운 <em>티추.</em></h1><p class="hero-copy">두 벌의 카드. 세 명의 팀원.<br>친구들과 브라우저에서 바로 만나는 6인 티추.</p><div class="hero-tags"><span>3 vs 3 팀 플레이</span><span>공개 대기실에서 만나기</span><span>설치 없이 시작</span></div></div><div class="hero-cards" aria-hidden="true">${samples.map(c=>card(c)).join('')}<span class="orbit">A · B · A · B · A · B</span></div></section><section class="entry"><div class="entry-title"><span class="eyebrow">TAKE A SEAT</span><h2>테이블에 앉으세요</h2></div><div class="entry-form"><label>닉네임 (1~5자)<input id="name" maxlength="80" placeholder="어떻게 불러드릴까요?" value="${esc(drafts.name)}" autocomplete="nickname"></label><div class="entry-actions">${button(busy?'접속 중…':'대기실 입장','enterHall',busy,'primary')}${button('혼자 연습하기','demo',false,'quiet')}</div><p class="muted">전체 30명 · 방 5개 · 방마다 플레이어 6명, 관전도 가능합니다.</p></div></section>${rules()}<footer>6T · v0.4.0 · 친구들과 즐기는 작은 카드 테이블 <span>CLOUDFLARE / WEBSOCKET</span></footer></main>`;
}
const phaseLabel=phase=>({lobby:'모집 중',grand:'그랜드 선언',exchange:'카드 교환',play:'플레이 중',trick:'트릭 확정',roundEnd:'라운드 종료',matchEnd:'경기 종료'}[phase]||phase);
function hall(){return `<main class="lobby"><div class="page-heading"><div><span class="eyebrow">PUBLIC LOUNGE</span><h1>함께할 테이블을 골라요</h1><p>플레이어와 관전자를 합쳐 최대 30명 · 방은 최대 5개</p></div><span class="counter">${directory.count}<small> / 30</small></span></div>${signalError?`<p class="warning" role="alert">${esc(signalError)}</p>`:''}<section class="panel hall-tools"><label>방에서 사용할 닉네임 (1~5자)<input id="name" maxlength="80" value="${esc(drafts.name)}" autocomplete="nickname"></label>${button('랜덤 제목으로 방 만들기','createRoom',!room?.connected()||directory.rooms.length>=5,'primary')}<span>${directory.rooms.length} / 5개 방</span></section><div class="room-list">${directory.rooms.map(r=>`<article class="panel room-tile"><span class="eyebrow">${phaseLabel(r.phase)} · ROUND ${r.round}</span><h2>${esc(r.title)}</h2><p>플레이어 ${r.players}/6 · 연결 ${r.online}명 · 관전 ${r.spectators}명</p><p>TEAM A ${r.scores[0]} : ${r.scores[1]} TEAM B</p><div class="entry-actions"><button class="primary" data-action="joinRoom" data-room="${esc(r.id)}" ${!room?.connected()||!r.mine&&(r.phase!=='lobby'||r.players>=6)?'disabled':''}>${r.mine?'복귀':'플레이 참가'}</button><button data-action="watchRoom" data-room="${esc(r.id)}" ${!room?.connected()?'disabled':''}>관전</button></div></article>`).join('')||'<section class="panel empty-rooms"><h2>첫 테이블을 열어 보세요</h2><p>방 제목은 자동으로 만들어집니다.</p></section>'}</div><p class="muted">진행 중인 내 게임은 복귀할 수 있습니다. 관전에는 손패가 공개되지 않습니다.</p>${rules()}</main>`;}
function lobby(){return `<main class="lobby"><div class="page-heading"><div><span class="eyebrow">${v?.spectator?'SPECTATING':'YOUR TABLE'}</span><h1>${esc(v?.title||'연결 중…')}</h1><p>${v?.spectator?'관전 중 · 게임이 시작되면 실시간으로 공개 상태를 볼 수 있습니다.':'6명이 모이면 진행 담당자가 시작할 수 있습니다.'}</p></div><span class="counter">${online.filter(Boolean).length}<small> / 6</small></span></div>${signalError?`<p class="warning" role="alert">${esc(signalError)}</p>`:''}<section class="panel"><h2>테이블 좌석</h2><div class="roster">${Array.from({length:6},(_,i)=>`<div class="roster-row"><span class="avatar team-${team(i)}">${i+1}</span><div><b>${esc(v?.names[i]||'빈자리')}</b><small>TEAM ${team(i)?'B':'A'}${i===v?.leader?' · 진행 담당':''}${i===me()?' · 나':''}</small></div><span class="seat-status">${online[i]?'연결됨':'대기 중'}</span></div>`).join('')}</div>${!v?.spectator&&me()===v?.leader?button('6명 모두 모였어요 · 시작','start',!allOnline()||!room?.connected(),'primary wide'):''}</section>${rules()}</main>`;}
const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
function controls() {
  if(v.spectator)return '<div class="action-message"><h3>관전 중</h3><p>공개 카드·점수·차례·남은 장수만 표시합니다.</p></div>';
  const seat=me(),locked=pending||v.paused;
  if(v.phase==='grand') return `<div class="action-message"><h3>${v.ready[seat]?'다른 플레이어의 결정을 기다립니다.':'첫 8장, 승부를 걸어볼까요?'}</h3><p>그랜드 티추는 이번 라운드에서 가장 먼저 손패를 비우면 +200, 실패하면 −200점입니다.</p></div><div class="action-buttons">${button('그랜드 티추 선언','grandYes',locked||v.ready[seat],'accent')}${button('선언 없이 계속','grandNo',locked||v.ready[seat],'primary')}</div>`;
  if(['roundEnd','matchEnd'].includes(v.phase)) return `<div class="action-message"><h3>${v.phase==='matchEnd'?`${v.scores[0]>v.scores[1]?'A':'B'} 팀 승리!`:'라운드가 끝났어요.'}</h3><p>이번 라운드 A ${v.delta[0]>0?'+':''}${v.delta[0]} · B ${v.delta[1]>0?'+':''}${v.delta[1]}</p></div><div>${(mode==='demo'||me()===v.leader)&&v.phase==='roundEnd'?button('다음 라운드','next',locked,'primary'):button('테이블 나가기','home',false,'quiet')}</div>`;
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
  const seat=Math.max(0,me());
  return `<main class="game"><div class="game-bar"><div><span class="eyebrow">${mode==='demo'?'PRACTICE TABLE':v.spectator?'SPECTATING':esc(v.title||'FRIENDS TABLE')}</span><h2>ROUND ${String(v.round).padStart(2,'0')} <span>1,000점 승부</span></h2></div><div class="score"><span class="team-a">TEAM A <b>${v.scores[0]}</b></span><i>:</i><span class="team-b"><b>${v.scores[1]}</b> TEAM B</span></div></div>${v.paused?'<div class="warning" role="alert">서버에 다시 연결하고 있습니다. 게임은 서버에 저장되어 있으며 연결되면 복구됩니다.</div>':''}<section class="table" aria-label="6인 게임 테이블">${v.names.map((name,i)=>`<div class="player pos-${(i-seat+6)%6} ${v.phase==='play'&&v.turn===i?'active':''}"><div class="avatar team-${team(i)}">${v.finish.includes(i)?`${v.finish.indexOf(i)+1}등`:i+1}</div><div><b>${esc(name)}${!v.spectator&&i===seat?' <span class="you">나</span>':''}${v.offline?.[i]?' · 연결 대기/봇':''}</b><small>TEAM ${team(i)?'B':'A'} · ${v.counts[i]}장${v.calls[i]?` · ${v.calls[i]===200?'그랜드':'티추'}`:''}</small></div></div>`).join('')}<div class="table-center">${v.top?`<span class="eyebrow">${esc(v.names[v.last])} · ${kindName(v.top.kind)}</span><div class="played-cards">${v.top.cards.map(c=>card(c)).join('')}</div><span class="table-note">${v.phase==='trick'?'트릭 확정 대기':`패스 ${v.passed.length}명`}</span>`:`<div class="table-mark">6T</div><p class="table-note">${v.phase==='grand'?'좋은 패가 오기를.':v.phase==='exchange'?'함께 이길 카드를 나눠요.':v.phase==='roundEnd'||v.phase==='matchEnd'?'다음 승부를 기다리며.':'새로운 트릭을 시작하세요.'}</p>`}${v.wish?`<span class="wish-badge">새의 소원 · ${LABEL[v.wish]||v.wish}</span>`:''}</div></section><section class="hand-panel"><div class="hand-heading"><div><span class="eyebrow">YOUR HAND</span><b>${v.spectator?'관전 화면':'내 카드'} <span>${v.hand.length}장${v.phase==='grand'?' / 첫 8장':''}</span></b></div>${button('선택 해제','clear',!selected.length,'quiet')}</div><div class="hand">${v.hand.map((c,i)=>card(c,true,i)).join('')||(v.spectator?'<p class="empty-hand">다른 플레이어의 손패는 공개하지 않습니다.</p>':'<p class="empty-hand">카드를 모두 내려놓았습니다. 팀원을 응원하세요.</p>')}</div><div class="controls">${controls()}</div></section><details class="activity"><summary>진행 기록 <span>${esc(v.log.at(-1)||'')}</span></summary><ol>${v.log.slice().reverse().map(l=>`<li>${esc(l)}</li>`).join('')}</ol></details>${rules()}</main>`;
}
function render() {
  const focus=document.activeElement?.id,position=document.activeElement?.selectionStart;
  root.innerHTML=(leaving?`<div class="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title"><div><h2 id="leave-title">테이블을 나갈까요?</h2><p>게임은 서버에 유지됩니다. 같은 브라우저에서 이전 방으로 복귀할 수 있습니다.</p>${button('계속 플레이','cancelLeave')}${button('테이블 나가기','confirmLeave',false,'accent')}</div></div>`:'')+header()+(mode==='home'?home():mode==='hall'?hall():v&&v.phase!=='lobby'?game():lobby());
  if(focus) {const el=document.getElementById(focus);if(el&&el.tagName!=='SELECT'){el.focus();if(typeof position==='number'&&el.setSelectionRange) el.setSelectionRange(position,position);}}
}
function publish(){v={...view(state,0),paused:false};selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();scheduleBot();}
function receive(_seat,msg){
 if(msg.type==='directory'){directory={rooms:msg.rooms,count:msg.count};if(mode==='hall')render();}
 if(msg.type==='hall'){mode='hall';v=null;pending=false;render();}
 if(msg.type==='state'){mode='join';v=msg.value;online=msg.online;pending=false;signalError='';selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();}
 if(msg.type==='error'){pending=false;notify(msg.message);render();}
}
function validName(){const name=drafts.name.normalize('NFC').trim();if(!name||[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(name)].length>5)throw new Error('닉네임을 1~5자로 입력해 주세요.');return name;}
async function enterHall(){
 if(busy)return;const name=validName();busy=true;signalError='';room?.close();
 const active=new Room({onMessage:(...args)=>{if(room===active)receive(...args);},onError:message=>{if(room!==active)return;signalError=message;pending=false;notify(message);render();},onNotice:message=>{if(room!==active)return;signalNote=message;},onStatus:(_seat,status)=>{if(room!==active)return;pending=false;if(v)v.paused=status!=='open';render();}});room=active;render();
 try{await active.open(name);}catch(error){signalError=error.message;notify(error.message);}finally{busy=false;render();}
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
  if(mode!=='demo') {if(v?.spectator)throw new Error('관전 중에는 행동할 수 없습니다.');if(pending) return;pending=room.send(0,{type:'action',revision:v.revision,action});if(!pending) throw new Error('서버에 연결되어 있지 않습니다.');render();}
  else {if(!allOnline()) throw new Error('모든 참가자가 연결되어야 진행할 수 있습니다.');state=act(state,0,action);selected=[];publish();}
}
root.addEventListener('input',e=>{if(e.target.id in drafts) drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;});
root.addEventListener('change',e=>{if(e.target.id in drafts){drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(e.target.id==='phoenixRank') render();}});
root.addEventListener('click',async e=>{
  const c=e.target.closest('[data-card]');
  if(c) {const id=c.dataset.card;selected=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];render();return;}
  const el=e.target.closest('[data-action]');if(!el||el.disabled) return;e.preventDefault();const action=el.dataset.action;
  try {
    if(action==='cancelLeave') {leaving=false;render();return;}
    if(action==='home'&&mode!=='home') {leaving=true;render();return;}
    if(action==='home'||action==='confirmLeave'){
     leaving=false;selected=[];pending=false;clearTimeout(botTimer);
     if(mode!=='hall'&&mode!=='demo'&&mode!=='home'&&room?.connected()){room.request({type:'leave'});return;}
     room?.close();room=null;mode='home';state=null;v=null;busy=false;render();return;
    }
    if(action==='enterHall'){await enterHall();return;}
    if(action==='createRoom'){room.request({type:'create',name:validName()});return;}
    if(action==='joinRoom'||action==='watchRoom'){room.request({type:'join',roomId:el.dataset.room,watch:action==='watchRoom',name:validName()});return;}
    if(action==='demo'){mode='demo';state=startRound(newGame([drafts.name||'나','하늘봇','도담봇','여울봇','노을봇','바다봇']));online.fill(true);publish();return;}
    if(action==='start'||action==='next') {if(mode!=='demo'){submit({type:action});return;}startRound(state);selected=[];publish();return;}
    if(action==='clear') {selected=[];render();return;}
    if(action==='grandYes'||action==='grandNo') submit({type:'grand',call:action==='grandYes'});
    if(action==='exchange') submit({type:'exchange',ids:selected});
    if(action==='tichu') submit({type:'tichu'});
    if(action==='pass') submit({type:'pass'});
    if(action==='collect') submit({type:'collect',target:Number(document.querySelector('#target')?.value)});
    if(action==='play') submit({type:'play',ids:selected,wish:drafts.wish?Number(drafts.wish):null,target:Number(document.querySelector('#target')?.value),phoenixRank:Number(drafts.phoenixRank)||null});
  } catch(err) {notify(err.message);}
});

const previous=savedRoom();
if(previous)drafts.name=previous.name||'';
render();
if(previous&&drafts.name)enterHall().catch(error=>notify(error.message));
