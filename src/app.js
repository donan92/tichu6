import LanguageDetector from 'i18next-browser-languagedetector';
import {createTranslator,languages,translateEvent,translateRoom} from './i18n.js';
import {AppError,event} from './messages.js';
import {newGame,startRound,act,view,team,partners,LABEL,classify,beats,botAction} from './game.js';
import {Room,savedRoom} from './server-room.js';
const i18n=createTranslator();
const detector=new LanguageDetector();
detector.init({languageUtils:i18n.services.languageUtils},{order:['localStorage','navigator'],lookupLocalStorage:'tichu6-language',caches:['localStorage']});
const detected=detector.detect();
await i18n.changeLanguage(i18n.services.languageUtils.getBestMatchFromCodes(Array.isArray(detected)?detected:[detected])||'en');
const root=document.querySelector('#app');
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(key,params)=>esc(i18n.t(key,params));
const text=value=>translateEvent(i18n,value?.code?value:value?.message||value);
const title=value=>esc(translateRoom(i18n,value));
const kind=value=>t('kind.'+value);
const name=value=>value?esc(value):t('common.empty');
const suit=['◆','♠','●','✦'];
let directory={rooms:[],count:0};
let mode='home',room=null,state=null,v=null,selected=[],online=Array(6).fill(false),busy=false,pending=false;
let drafts={name:'',wish:'',target:'',phoenixRank:''};
let signalNote='',signalError='',leaving=false,noticeTimer,botTimer,lastNotice=null;
const me=()=>mode==='demo'?0:(room?.seat??-1);
const allOnline=()=>mode==='demo'||online.every(Boolean);
function notify(message){lastNotice=message;const el=document.querySelector('#notice');el.textContent=text(message);el.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{el.classList.remove('show');lastNotice=null;},6000);}
function button(label,action,disabled=false,cls=''){return `<button class="${cls}" data-action="${action}" ${disabled?'disabled':''}>${label}</button>`;}
function card(c,interactive=false,index=-1){
 const pick=selected.indexOf(c.id),rank=LABEL[c.rank]||c.rank;
 const label=c.special?i18n.t('card.'+c.special):i18n.t('card.label',{suit:i18n.t('card.suit.'+c.suit),rank});
 const display=c.special?t('card.short.'+c.special):esc(rank),icon=c.special?({mahjong:'雀',dog:'犬',phoenix:'鳳',dragon:'龍'}[c.special]):suit[c.suit];
 const inside=`<span class="card-corner">${display}<small>${c.special?'6T':suit[c.suit]}</small></span><span class="card-symbol">${icon}</span><span class="card-bottom">${display}</span>${pick>=0&&interactive?`<span class="pick">${pick+1}</span>`:''}`;
 return interactive?`<button class="card suit-${c.suit} ${c.special?'special':''} ${pick>=0?'selected':''}" data-card="${c.id}" aria-label="${index>=0?t('card.position',{card:label,position:index+1}):esc(label)}" aria-pressed="${pick>=0}">${inside}</button>`:`<div class="card suit-${c.suit} ${c.special?'special':''}" aria-label="${esc(label)}">${inside}</div>`;
}
function updateHeader(){
 // Keep the native select attached: replacing it while its picker closes can
 // leave a detached popup on mobile browsers and disrupt keyboard focus.
 if(!root.querySelector('header'))root.innerHTML=`<header><a class="brand" href="#" data-action="home">6<span>T</span><small></small></a><div class="header-right"><label class="language-picker"><span></span><select id="language">${Object.entries(languages).map(([id,l])=>`<option value="${id}">${esc(l.label)}</option>`).join('')}</select></label><span class="connection-label"></span><button class="quiet" data-action="home" id="header-home"></button></div></header><div id="screen"></div>`;
 const header=root.querySelector('header'),select=header.querySelector('#language');
 header.querySelector('.brand small').textContent=i18n.t('app.tagline');
 header.querySelector('.language-picker>span').textContent=i18n.t('app.language');
 select.setAttribute('aria-label',i18n.t('app.language'));
 if(select.value!==i18n.resolvedLanguage)select.value=i18n.resolvedLanguage;
 header.querySelector('.connection-label').textContent=i18n.t(mode==='home'?'app.summary':mode==='demo'?'connection.practice':room?.connected()?'connection.connected':'connection.reconnecting');
 const back=header.querySelector('#header-home');back.hidden=mode==='home';back.textContent=i18n.t(mode==='hall'?'connection.disconnect':'connection.lounge');
}

function rules(){return `<details class="rules"><summary>${t('rules.title')}</summary><div class="rule-grid">${[['deckTitle','deck','bombs'],['gameTitle','calls','scoring'],['serverTitle','server','reconnect']].map(([a,b,c])=>`<section><h3>${t('rules.'+a)}</h3><p>${t('rules.'+b)}</p><p>${t('rules.'+c)}</p></section>`).join('')}</div></details>`;}
function nicknameInput(key){return `<label>${t(key)}<input id="name" maxlength="8" pattern="[A-Za-z0-9]{1,8}" autocapitalize="none" spellcheck="false" placeholder="${t('home.placeholder')}" value="${esc(drafts.name)}" autocomplete="nickname"></label>`;}
function home(){const samples=[{id:'hero-a',rank:14,suit:0},{id:'hero-p',rank:15,suit:-1,special:'phoenix'},{id:'hero-d',rank:16,suit:-1,special:'dragon'}];return `<main class="landing"><section class="hero"><div><span class="eyebrow">${t('home.eyebrow')}</span><h1>${t('home.headline')}</h1><p class="hero-copy">${t('home.description')}</p><div class="hero-tags">${['teams','public','install'].map(k=>`<span>${t('home.'+k)}</span>`).join('')}</div></div><div class="hero-cards" aria-hidden="true">${samples.map(c=>card(c)).join('')}<span class="orbit">A · B · A · B · A · B</span></div></section><section class="entry"><div class="entry-title"><h2>${t('home.seat')}</h2></div><div class="entry-form">${nicknameInput('home.nickname')}<div class="entry-actions">${button(t(busy?'connection.connecting':'home.enter'),'enterHall',busy,'primary')}${button(t('home.practice'),'demo',false,'quiet')}</div><p class="muted">${t('home.capacity')}</p></div></section>${rules()}<footer>6T · v0.5.1 · ${t('app.footer')}</footer></main>`;}
function hall(){return `<main class="lobby"><div class="page-heading"><div><span class="eyebrow">${t('lounge.label')}</span><h1>${t('lounge.title')}</h1><p>${t('lounge.capacity')}</p></div><span class="counter">${directory.count}<small> / 30</small></span></div>${signalError?`<p class="warning" role="alert">${esc(text(signalError))}</p>`:''}<section class="panel hall-tools">${nicknameInput('lounge.nickname')}${button(t('lounge.createRoom'),'createRoom',!room?.connected()||directory.rooms.length>=5,'primary')}<span>${t('lounge.roomCount',{count:directory.rooms.length})}</span></section><div class="room-list">${directory.rooms.map(r=>`<article class="panel room-tile"><span class="eyebrow">${t('phase.'+r.phase)} · ${t('common.round',{round:r.round})}</span><h2>${title(r.title)}</h2><p>${t('lounge.roomMembers',r)}</p><p>${t('common.team',{team:'A'})} ${r.scores[0]} : ${r.scores[1]} ${t('common.team',{team:'B'})}</p><div class="entry-actions"><button class="primary" data-action="joinRoom" data-room="${esc(r.id)}" ${!room?.connected()||!r.mine&&(r.phase!=='lobby'||r.players>=6)?'disabled':''}>${t(r.mine?'lounge.rejoin':'lounge.join')}</button><button data-action="watchRoom" data-room="${esc(r.id)}" ${!room?.connected()?'disabled':''}>${t('lounge.watch')}</button></div></article>`).join('')||`<section class="panel empty-rooms"><h2>${t('lounge.emptyTitle')}</h2><p>${t('lounge.emptyDescription')}</p></section>`}</div><p class="muted">${t('lounge.hint')}</p>${rules()}</main>`;}
function lobby(){return `<main class="lobby"><div class="page-heading"><div><span class="eyebrow">${t(v?.spectator?'room.spectating':'room.yours')}</span><h1>${v?.title?title(v.title):t('connection.connecting')}</h1><p>${t(v?.spectator?'room.watchHint':'room.startHint')}</p></div><span class="counter">${online.filter(Boolean).length}<small> / 6</small></span></div>${signalError?`<p class="warning" role="alert">${esc(text(signalError))}</p>`:''}<section class="panel"><h2>${t('room.seats')}</h2><div class="roster">${Array.from({length:6},(_,i)=>`<div class="roster-row"><span class="avatar team-${team(i)}">${i+1}</span><div><b>${name(v?.names[i])}</b><small>${t('common.team',{team:team(i)?'B':'A'})}${i===v?.leader?' · '+t('common.coordinator'):''}${i===me()?' · '+t('common.you'):''}</small></div><span class="seat-status">${t(online[i]?'common.online':'common.waiting')}</span></div>`).join('')}</div>${!v?.spectator&&me()===v?.leader?button(t('room.start'),'start',!allOnline()||!room?.connected(),'primary wide'):''}</section>${rules()}</main>`;}
const options=(values,current)=>values.map(([value,label])=>`<option value="${value}" ${String(current)===String(value)?'selected':''}>${esc(label)}</option>`).join('');
const messageBox=(heading,body)=>`<div class="action-message"><h3>${heading}</h3><p>${body}</p></div>`;
function controls(){
 if(v.spectator)return messageBox(t('room.spectating'),t('play.spectatorHint'));
 const seat=me(),locked=pending||v.paused;
 if(v.phase==='grand')return messageBox(t(v.ready[seat]?'play.grandWaiting':'play.grandPrompt'),t('play.grandHelp'))+`<div class="action-buttons">${button(t('play.grandYes'),'grandYes',locked||v.ready[seat],'accent')}${button(t('play.grandNo'),'grandNo',locked||v.ready[seat],'primary')}</div>`;
 if(['roundEnd','matchEnd'].includes(v.phase))return messageBox(v.phase==='matchEnd'?t('play.winner',{team:v.scores[0]>v.scores[1]?'A':'B'}):t('play.roundOver'),t('play.delta',{a:v.delta[0],b:v.delta[1]}))+`<div>${(mode==='demo'||me()===v.leader)&&v.phase==='roundEnd'?button(t('play.next'),'next',locked,'primary'):button(t('play.leave'),'home',false,'quiet')}</div>`;
 if(v.phase==='exchange')return messageBox(t(v.exchangeReady[seat]?'play.exchangeWaiting':'play.exchangePrompt'),t('play.exchangeHelp',{first:v.names[partners(seat)[0]],second:v.names[partners(seat)[1]]}))+`<div class="action-buttons">${button(t('play.tichu'),'tichu',locked||!!v.calls[seat],'quiet')}${button(t('play.exchange',{count:selected.length}),'exchange',locked||v.exchangeReady[seat]||selected.length!==2,'primary')}</div>`;
 if(v.phase==='trick'&&v.last===seat){const dragon=v.top?.cards[0]?.special==='dragon';return messageBox(t(dragon?'play.dragonPrompt':'play.collectPrompt'),t('play.collectHelp'))+`<div class="action-buttons">${dragon?`<label>${t('play.recipient')}<select id="target">${options(v.names.map((n,i)=>[i,n]).filter(([i])=>team(i)!==team(seat)),drafts.target)}</select></label>`:''}${button(t(dragon?'play.giveTrick':'play.collect'),'collect',locked,'primary')}</div>`;}
 const chosen=v.hand.filter(c=>selected.includes(c.id)),combo=classify(chosen,v.top,Number(drafts.phoenixRank)||null),specialOptions=[];
 if(chosen.some(c=>c.special==='mahjong'))specialOptions.push(`<label>${t('play.wish')}<select id="wish">${options([['',i18n.t('play.noWish')],...Array.from({length:13},(_,i)=>[i+2,LABEL[i+2]||i+2])],drafts.wish)}</select></label>`);
 if(chosen.some(c=>c.special==='dog'))specialOptions.push(`<label>${t('play.dogTarget')}<select id="target">${options(partners(seat).map(i=>[i,v.names[i]]),drafts.target)}</select></label>`);
 if(chosen.length>1&&chosen.some(c=>c.special==='phoenix'))specialOptions.push(`<label>${t('play.phoenixRank')}<select id="phoenixRank">${options([['',i18n.t('play.automatic')],...Array.from({length:13},(_,i)=>[i+2,LABEL[i+2]||i+2])],drafts.phoenixRank)}</select></label>`);
 return messageBox(v.phase==='trick'?t('play.collectWaiting'):v.turn===seat?t('play.yourTurn'):t('play.turn',{name:v.names[v.turn]}),chosen.length?t('play.selection',{count:selected.length,kind:i18n.t(combo?'kind.'+combo.kind:'play.invalidCombo')}):t('play.selectHint'))+`<div class="action-buttons">${specialOptions.join('')}${button(t('play.tichuShort'),'tichu',locked||v.played[seat]||!!v.calls[seat],'quiet')}${button(t('play.pass'),'pass',locked||v.turn!==seat||v.phase!=='play'||!v.top)}${button(t(combo?.bomb?'play.bomb':'play.cards'),'play',locked||!combo||!beats(combo,v.top)||(v.turn!==seat||v.phase==='trick')&&!combo.bomb,'primary')}</div>`;
}
function game(){const seat=Math.max(0,me());return `<main class="game"><div class="game-bar"><div><span class="eyebrow">${mode==='demo'?t('connection.practice'):v.spectator?t('room.spectating'):title(v.title)}</span><h2>${t('common.round',{round:v.round})} <span>${t('play.target')}</span></h2></div><div class="score"><span class="team-a">${t('common.team',{team:'A'})} <b>${v.scores[0]}</b></span><i>:</i><span class="team-b"><b>${v.scores[1]}</b> ${t('common.team',{team:'B'})}</span></div></div>${v.paused?`<div class="warning" role="alert">${t('connection.restoring')}</div>`:''}<section class="table" aria-label="${t('play.tableLabel')}">${v.names.map((n,i)=>`<div class="player pos-${(i-seat+6)%6} ${v.phase==='play'&&v.turn===i?'active':''}"><div class="avatar team-${team(i)}">${v.finish.includes(i)?t('play.finish',{place:v.finish.indexOf(i)+1}):i+1}</div><div><b>${name(n)}${!v.spectator&&i===seat?` <span class="you">${t('common.you')}</span>`:''}${v.offline?.[i]?' · '+t('play.offline'):''}</b><small>${t('common.team',{team:team(i)?'B':'A'})} · ${t('play.cardCount',{count:v.counts[i]})}${v.calls[i]?' · '+t(v.calls[i]===200?'play.grand':'play.tichuShort'):''}</small></div></div>`).join('')}<div class="table-center">${v.top?`<span class="eyebrow">${name(v.names[v.last])} · ${kind(v.top.kind)}</span><div class="played-cards">${v.top.cards.map(c=>card(c)).join('')}</div><span class="table-note">${v.phase==='trick'?t('play.collectWaiting'):t('play.passes',{count:v.passed.length})}</span>`:`<div class="table-mark">6T</div><p class="table-note">${t(v.phase==='grand'?'play.goodLuck':v.phase==='exchange'?'play.share':['roundEnd','matchEnd'].includes(v.phase)?'play.waitRound':'play.lead')}</p>`}${v.wish?`<span class="wish-badge">${t('play.wishRank',{rank:LABEL[v.wish]||v.wish})}</span>`:''}</div></section><section class="hand-panel"><div class="hand-heading"><div><b>${t(v.spectator?'play.spectatorView':'play.hand')} <span>${t('play.cardCount',{count:v.hand.length})}${v.phase==='grand'?' / '+t('play.firstEight'):''}</span></b></div>${button(t('play.clear'),'clear',!selected.length,'quiet')}</div><div class="hand">${v.hand.map((c,i)=>card(c,true,i)).join('')||`<p class="empty-hand">${t(v.spectator?'play.private':'play.finished')}</p>`}</div><div class="controls">${controls()}</div></section><details class="activity"><summary>${t('play.history')} <span>${esc(text(v.log.at(-1)||''))}</span></summary><ol>${v.log.slice().reverse().map(l=>`<li>${esc(text(l))}</li>`).join('')}</ol></details>${rules()}</main>`;}
function render(){
 const focus=document.activeElement?.id,position=document.activeElement?.selectionStart;
 document.documentElement.lang=i18n.resolvedLanguage;document.title=i18n.t('app.title');
 updateHeader();
 root.querySelector('#screen').innerHTML=(leaving?`<div class="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title"><div><h2 id="leave-title">${t('leave.title')}</h2><p>${t('leave.description')}</p>${button(t('leave.cancel'),'cancelLeave')}${button(t('play.leave'),'confirmLeave',false,'accent')}</div></div>`:'')+(mode==='home'?home():mode==='hall'?hall():v&&v.phase!=='lobby'?game():lobby());
 if(lastNotice)document.querySelector('#notice').textContent=text(lastNotice);
 if(focus){const el=document.getElementById(focus);if(el){if(document.activeElement!==el)el.focus({preventScroll:true});if(el.tagName!=='SELECT'&&typeof position==='number'&&el.setSelectionRange)el.setSelectionRange(position,position);}}
}
function publish(){v={...view(state,0),paused:false};selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();scheduleBot();}
function receive(_seat,msg){
 if(msg.type==='directory'){directory={rooms:msg.rooms,count:msg.count};if(mode==='hall')render();}
 if(msg.type==='hall'){mode='hall';v=null;pending=false;render();}
 if(msg.type==='state'){mode='join';v=msg.value;online=msg.online;pending=false;signalError='';selected=selected.filter(id=>v.hand.some(c=>c.id===id));render();}
 if(msg.type==='error'){pending=false;notify(msg);render();}
}
function validName(){if(!/^[A-Za-z0-9]{1,8}$/.test(drafts.name))throw new AppError('error.invalidNickname');return drafts.name;}
async function enterHall(){
 if(busy)return;const name=validName();busy=true;signalError='';room?.close();
 const active=new Room({onMessage:(...args)=>{if(room===active)receive(...args);},onError:message=>{if(room!==active)return;signalError=message;pending=false;notify(message);render();},onNotice:message=>{if(room!==active)return;signalNote=message;},onStatus:(_seat,status)=>{if(room!==active)return;pending=false;if(v)v.paused=status!=='open';render();}});room=active;render();
 try{await active.open(name);}catch(error){signalError=error;notify(error);}finally{busy=false;render();}
}
function scheduleBot() {
  clearTimeout(botTimer);if(mode!=='demo'||!state) return;
  let seat=-1;
  if(state.phase==='grand') seat=state.ready.findIndex((ready,i)=>i>0&&!ready);
  else if(state.phase==='exchange') seat=state.exchanges.findIndex((ready,i)=>i>0&&!ready);
  else if(state.phase==='play') seat=state.turn;
  else if(state.phase==='trick') seat=state.last;
  if(seat>0) botTimer=setTimeout(()=>{try{state=act(state,seat,botAction(state,seat));publish();}catch(e){notify(event('error.practice',{message:text(e)}));}},800);
}
function submit(action) {
  if(mode!=='demo') {if(v?.spectator)throw new AppError('error.spectator');if(pending) return;pending=room.send(0,{type:'action',revision:v.revision,action});if(!pending) throw new AppError('error.notConnected');render();}
  else {if(!allOnline()) throw new AppError('error.allOnline');state=act(state,0,action);selected=[];publish();}
}
root.addEventListener('input',e=>{if(e.target.id in drafts) drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;});
root.addEventListener('change',async e=>{if(e.target.id==='language'){await i18n.changeLanguage(e.target.value);detector.cacheUserLanguage(i18n.resolvedLanguage);render();return;}if(e.target.id in drafts){drafts[e.target.id]=e.target.type==='checkbox'?e.target.checked:e.target.value;if(e.target.id==='phoenixRank') render();}});
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
    if(action==='demo'){mode='demo';state=startRound(newGame([drafts.name||'You','SkyBot','StarBot','RiverBot','SunBot','SeaBot']));online.fill(true);publish();return;}
    if(action==='start'||action==='next') {if(mode!=='demo'){submit({type:action});return;}startRound(state);selected=[];publish();return;}
    if(action==='clear') {selected=[];render();return;}
    if(action==='grandYes'||action==='grandNo') submit({type:'grand',call:action==='grandYes'});
    if(action==='exchange') submit({type:'exchange',ids:selected});
    if(action==='tichu') submit({type:'tichu'});
    if(action==='pass') submit({type:'pass'});
    if(action==='collect') submit({type:'collect',target:Number(document.querySelector('#target')?.value)});
    if(action==='play') submit({type:'play',ids:selected,wish:drafts.wish?Number(drafts.wish):null,target:Number(document.querySelector('#target')?.value),phoenixRank:Number(drafts.phoenixRank)||null});
  } catch(err) {notify(err);}
});

const previous=savedRoom();
if(previous)drafts.name=previous.name||'';
render();
if(previous&&drafts.name)enterHall().catch(error=>notify(error));
