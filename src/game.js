import {AppError,event} from './messages.js';
// The rules engine has no DOM or networking dependencies.
export const LABEL = {1:'1',11:'J',12:'Q',13:'K',14:'A'};
export const team = seat => seat % 2;
export const partners = seat => [(seat+2)%6,(seat+4)%6];
export function deck() {
  const cards=[];
  for(let copy=0;copy<2;copy++) for(let suit=0;suit<4;suit++) for(let rank=2;rank<=14;rank++) cards.push({id:`${copy}-${suit}-${rank}`,rank,suit});
  for(const [special,rank] of [['mahjong',1],['dog',0],['phoenix',15],['dragon',16]]) cards.push({id:special,special,rank,suit:-1});
  return cards;
}
export function shuffle(cards) {
  const a=[...cards], n=new Uint32Array(1);
  for(let i=a.length-1;i>0;i--) {const bound=Math.floor(4294967296/(i+1))*(i+1); do {globalThis.crypto.getRandomValues(n);} while(n[0]>=bound); const j=n[0]%(i+1); [a[i],a[j]]=[a[j],a[i]];}
  return a;
}
export const sortCards = cards => [...cards].sort((a,b)=>a.rank-b.rank || a.suit-b.suit || a.id.localeCompare(b.id));
export const points = cards => cards.reduce((p,c)=>p+(c.special==='dragon'?25:c.special==='phoenix'?-25:c.rank===5?5:c.rank===10||c.rank===13?10:0),0);
const consecutive = a => a.every((v,i)=>i===0||v===a[i-1]+1);
function ordinary(cards, ranks, wild) {
  const count=new Map(); ranks.forEach(r=>count.set(r,(count.get(r)||0)+1));
  const keys=[...count.keys()].sort((a,b)=>a-b), groups=[...count.values()], n=ranks.length;
  if(n===4 && keys.length===1 && keys[0]>=2 && !wild) return {kind:'bomb',power:keys[0],size:n,bomb:1};
  if(n>=5 && keys.length===n && consecutive(keys)) {
    const bomb=!wild && cards.every(c=>!c.special && c.suit===cards[0].suit);
    return {kind:bomb?'bomb':'straight',power:keys.at(-1),size:n,bomb:bomb?2:0};
  }
  if(keys[0]<2) return null;
  if(n===2 && keys.length===1) return {kind:'pair',power:keys[0],size:n,bomb:0};
  if(n===3 && keys.length===1) return {kind:'triple',power:keys[0],size:n,bomb:0};
  if(n===5 && keys.length===2 && groups.includes(3) && groups.includes(2)) return {kind:'fullhouse',power:keys.find(k=>count.get(k)===3),size:n,bomb:0};
  if(n>=4 && n%2===0 && groups.every(v=>v===2) && consecutive(keys)) return {kind:'pairs',power:keys.at(-1),size:n,bomb:0};
  return null;
}
export function beats(play, top) {
  if(!play) return false;
  if(!top) return true;
  if(play.bomb) {
    if(!top.bomb) return true;
    return play.bomb>top.bomb || (play.bomb===top.bomb && (play.size>top.size || (play.size===top.size && play.power>top.power)));
  }
  return !top.bomb && play.kind===top.kind && play.size===top.size && play.power>top.power;
}
export function classify(cards, top=null, phoenixRank=null) {
  if(!cards.length || new Set(cards.map(c=>c.id)).size!==cards.length) return null;
  if(cards.length===1) {
    const c=cards[0];
    if(c.special==='dog') return top?null:{kind:'dog',power:0,size:1,bomb:0};
    return {kind:'single',power:c.special==='phoenix'?(top?.kind==='single'?Math.min(top.power+.5,15):1.5):c.rank,size:1,bomb:0};
  }
  if(cards.some(c=>c.special==='dragon'||c.special==='dog')) return null;
  const wild=cards.some(c=>c.special==='phoenix'), ranks=cards.filter(c=>c.special!=='phoenix').map(c=>c.rank);
  if(!wild) return ordinary(cards,ranks,false);
  const options=(phoenixRank?[phoenixRank]:Array.from({length:13},(_,i)=>i+2)).filter(r=>Number.isInteger(r)&&r>=2&&r<=14).map(r=>{const p=ordinary(cards,[...ranks,r],true); return p?{...p,phoenixRank:r}:null;}).filter(p=>p && beats(p,top));
  return options.sort((a,b)=>b.power-a.power)[0]||null;
}
// Generate representative legal shapes, not all 2^18 physical subsets.
// A rank with duplicate suits only needs one representative except for flush bombs.
export function legalPlays(hand, top=null, wish=null) {
  const result=[], seen=new Set(), pools=new Map(), phoenix=hand.find(c=>c.special==='phoenix');
  for(const c of hand.filter(c=>!c.special||c.special==='mahjong')) {if(!pools.has(c.rank)) pools.set(c.rank,[]); pools.get(c.rank).push(c);}
  const add = cards => {
    if(wish && !cards.some(c=>!c.special && c.rank===wish)) return;
    const p=classify(cards,top); if(!p||!beats(p,top)) return;
    const key=cards.map(c=>c.id).sort().join('|'); if(!seen.has(key)){seen.add(key);result.push({cards,play:p});}
  };
  hand.forEach(c=>add([c]));
  const shape = needs => {
    let cards=[],missing=0;
    for(const [r,n] of needs) {const p=pools.get(r)||[];cards.push(...p.slice(0,n));missing+=Math.max(0,n-p.length);}
    if(missing===0) add(cards);
    else if(missing===1 && phoenix && !needs.some(([r])=>r===1)) add([...cards,phoenix]);
  };
  for(let r=2;r<=14;r++) {
    for(const n of [2,3,4]) shape([[r,n]]);
    for(let s=2;s<=14;s++) if(s!==r) shape([[r,3],[s,2]]);
  }
  for(let lo=1;lo<=14;lo++) for(let hi=lo+4;hi<=14;hi++) {
    const ranks=Array.from({length:hi-lo+1},(_,i)=>lo+i);
    // Mahjong must be real; phoenix can replace another rank in a 1-low straight.
    let cards=[],missing=[]; for(const r of ranks) {const c=pools.get(r)?.[0];if(c) cards.push(c);else missing.push(r);}
    if(!missing.length) add(cards);else if(missing.length===1 && missing[0]!==1 && phoenix) add([...cards,phoenix]);
    for(let suit=0;suit<4;suit++) {const same=ranks.map(r=>hand.find(c=>!c.special && c.rank===r && c.suit===suit));if(same.every(Boolean)) add(same);}
  }
  for(let lo=2;lo<=13;lo++) for(let hi=lo+1;hi<=14;hi++) shape(Array.from({length:hi-lo+1},(_,i)=>[lo+i,2]));
  return result;
}
export function newGame(names=['Player1','Player2','Player3','Player4','Player5','Player6']) {
  return {names:names.map(n=>String(n).slice(0,20)),phase:'lobby',round:0,scores:[0,0],revision:0,log:[],hands:Array.from({length:6},()=>[])};
}
const fail = (code,params) => {throw new AppError(code,params);};
const log = (s,message) => {s.log.push(message);s.log=s.log.slice(-40);};
const nextActive = (s,seat) => {for(let i=1;i<=6;i++) {const n=(seat+i)%6;if(s.hands[n].length) return n;} return seat;};
export function startRound(s, cards=shuffle(deck())) {
  if(!['lobby','roundEnd'].includes(s.phase)) fail('error.roundStart');
  s.round++;s.phase='grand';s.hands=Array.from({length:6},(_,i)=>sortCards(cards.slice(i*18,i*18+18)));
  // Preserve the actual first eight dealt cards separately from sorted hands.
  s.first=Array.from({length:6},(_,i)=>cards.slice(i*18,i*18+8).map(c=>c.id));
  s.ready=Array(6).fill(false);s.calls=Array(6).fill(0);s.played=Array(6).fill(false);s.exchanges=Array(6).fill(null);
  s.captured=Array.from({length:6},()=>[]);s.finish=[];s.top=null;s.pile=[];s.passed=[];s.wish=null;s.turn=null;s.last=null;s.delta=null;
  log(s,event('log.roundStart',{round:s.round}));s.revision++;return s;
}
function finishRound(s) {
  const delta=[0,0];
  const triple=s.finish.length>=3 && s.finish.slice(0,3).every(i=>team(i)===team(s.finish[0]));
  if(triple) delta[team(s.finish[0])]=300;
  else {
    const loser=s.hands.findIndex(h=>h.length);
    if(loser>=0) {s.captured[s.finish[0]].push(...s.captured[loser]);s.captured[loser]=[];delta[1-team(loser)]+=points(s.hands[loser]);}
    s.captured.forEach((p,i)=>delta[team(i)]+=points(p));
  }
  s.calls.forEach((call,i)=>{if(call) delta[team(i)]+=i===s.finish[0]?call:-call;});
  s.delta=delta;s.scores=s.scores.map((n,i)=>n+delta[i]);
  s.phase=Math.max(...s.scores)>=1000 && s.scores[0]!==s.scores[1]?'matchEnd':'roundEnd';
  log(s,event(triple?'log.tripleEnd':'log.roundEnd',{a:delta[0],b:delta[1]}));
}
function ending(s) {return s.finish.length>=5 || (s.finish.length>=3 && s.finish.slice(0,3).every(i=>team(i)===team(s.finish[0])));}
function collect(s,recipient) {
  s.captured[recipient].push(...s.pile);s.pile=[];
  log(s,event('log.collect',{name:s.names[recipient]}));
  if(ending(s)) {finishRound(s);return;}
  s.turn=s.hands[s.last].length?s.last:nextActive(s,s.last);s.top=null;s.passed=[];s.phase='play';
}
// All mutations are validated on a clone: invalid actions are atomic.
export function act(state, seat, action) {
  if(!Number.isInteger(seat)||seat<0||seat>5 || !action || typeof action.type!=='string') fail('error.invalidRequest');
  const s=structuredClone(state), h=s.hands[seat];
  if(action.type==='grand') {
    if(s.phase!=='grand'||s.ready[seat]||typeof action.call!=='boolean') fail('error.grandPhase');
    s.ready[seat]=true;s.calls[seat]=action.call?200:0;
    if(action.call) log(s,event('log.grand',{name:s.names[seat]}));
    if(s.ready.every(Boolean)) {s.phase='exchange';log(s,event('log.exchange'));}
  } else if(action.type==='exchange') {
    if(s.phase!=='exchange'||s.exchanges[seat]) fail('error.exchangePhase');
    if(!Array.isArray(action.ids)||action.ids.length!==2||new Set(action.ids).size!==2||!action.ids.every(id=>h.some(c=>c.id===id))) fail('error.twoCards');
    s.exchanges[seat]=action.ids;
    if(s.exchanges.every(Boolean)) {
      const transfers=[];s.exchanges.forEach((ids,i)=>ids.forEach((id,j)=>transfers.push({from:i,to:partners(i)[j],card:s.hands[i].find(c=>c.id===id)})));
      transfers.forEach(({from,card})=>s.hands[from]=s.hands[from].filter(c=>c.id!==card.id));
      transfers.forEach(({to,card})=>s.hands[to].push(card));s.hands=s.hands.map(sortCards);
      s.phase='play';s.turn=s.hands.findIndex(hand=>hand.some(c=>c.special==='mahjong'));log(s,event('log.lead',{name:s.names[s.turn]}));
    }
  } else if(action.type==='tichu') {
    if(!['exchange','play','trick'].includes(s.phase)||s.calls[seat]||s.played[seat]) fail('error.tichuPhase');
    s.calls[seat]=100;log(s,event('log.tichu',{name:s.names[seat]}));
  } else if(action.type==='play') {
    if(!['play','trick'].includes(s.phase)||!h.length) fail('error.playPhase');
    if(!Array.isArray(action.ids)||!action.ids.length||new Set(action.ids).size!==action.ids.length) fail('error.selectCards');
    const cards=action.ids.map(id=>h.find(c=>c.id===id));if(cards.some(c=>!c)) fail('error.ownership');
    const p=classify(cards,s.top,action.phoenixRank||null);if(!p||!beats(p,s.top)) fail('error.combination');
    const inTurn=s.phase==='play' && s.turn===seat;
    if(!inTurn && (!p.bomb||!s.top)) fail('error.outOfTurn');
    if(inTurn && s.wish && !cards.some(c=>!c.special&&c.rank===s.wish) && legalPlays(h,s.top,s.wish).length) fail('error.fulfillWish',{rank:LABEL[s.wish]||s.wish});
    if(cards.some(c=>c.special==='mahjong') && action.wish!=null && (!Number.isInteger(action.wish)||action.wish<2||action.wish>14)) fail('error.wishRange');
    if(p.kind==='dog' && !partners(seat).includes(action.target)) fail('error.dogTarget');
    s.hands[seat]=h.filter(c=>!action.ids.includes(c.id));s.played[seat]=true;
    if(!s.hands[seat].length) {s.finish.push(seat);log(s,event('log.finish',{name:s.names[seat],place:s.finish.length}));}
    if(cards.some(c=>c.special==='mahjong')) s.wish=action.wish??null;
    if(cards.some(c=>!c.special&&c.rank===s.wish)) s.wish=null;
    if(p.kind==='dog') {
      s.captured[seat].push(...cards);s.turn=s.hands[action.target].length?action.target:nextActive(s,action.target);
      log(s,event('log.dog',{name:s.names[seat],target:s.names[s.turn]}));if(ending(s)) finishRound(s);
    } else {
      s.top={...p,cards};s.pile.push(...cards);s.last=seat;s.passed=[];s.turn=nextActive(s,seat);s.phase='play';
      log(s,event('log.play',{name:s.names[seat],kind:p.kind,count:cards.length}));
      if(ending(s)) {if(s.finish.slice(0,3).length===3 && s.finish.slice(0,3).every(i=>team(i)===team(s.finish[0]))) finishRound(s);else s.phase='trick';}
    }
  } else if(action.type==='pass') {
    if(s.phase!=='play'||s.turn!==seat||!s.top) fail('error.leadPass');
    if(s.wish&&legalPlays(h,s.top,s.wish).length) fail('error.wishPass');
    if(!s.passed.includes(seat)) s.passed.push(seat);
    const other=s.hands.map((hand,i)=>hand.length&&i!==s.last?i:-1).filter(i=>i>=0);
    if(other.every(i=>s.passed.includes(i))) {s.phase='trick';s.turn=s.last;}
    else s.turn=nextActive(s,seat);
  } else if(action.type==='collect') {
    if(s.phase!=='trick'||seat!==s.last) fail('error.collector');
    const dragon=s.top.cards.length===1&&s.top.cards[0].special==='dragon';
    if(dragon && (!Number.isInteger(action.target)||action.target<0||action.target>5||team(action.target)===team(seat))) fail('error.dragonTarget');
    collect(s,dragon?action.target:seat);
  } else fail('error.unknownRequest');
  s.revision++;return s;
}
export function view(s,seat) {
  const {hands,first,exchanges,captured,...pub}=s;
  const hand=s.phase==='grand'?hands[seat].filter(c=>first[seat].includes(c.id)):hands[seat];
  return {...pub,seat,hand,counts:hands.map(h=>h.length),exchangeReady:(exchanges||[]).map(Boolean),capturedPoints:(captured||[]).map(points)};
}
export function kindName(kind) {return 'kind.'+kind;}
export function botAction(s,seat) {
  if(s.phase==='grand') return {type:'grand',call:false};
  if(s.phase==='exchange') return {type:'exchange',ids:s.hands[seat].slice(0,2).map(c=>c.id)};
  if(s.phase==='trick') return {type:'collect',target:(seat+1)%6};
  const desired=s.wish?legalPlays(s.hands[seat],s.top,s.wish):[];
  const options=desired.length?desired:legalPlays(s.hands[seat],s.top);
  options.sort((a,b)=>(a.play.bomb-b.play.bomb)||(s.top? a.play.power-b.play.power : b.cards.length-a.cards.length));
  if(!options.length) return {type:'pass'};
  const o=options[0];return {type:'play',ids:o.cards.map(c=>c.id),target:partners(seat)[0],wish:14};
}
