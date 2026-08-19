/* ==================== STATE / STORAGE 5.0 ==================== */
const SAVE_KEY = 'autosyndicate_save_v5';
const LEGACY_SAVE_KEYS = ['autosyndicate_save_v2'];
const MAX_SAVE_BYTES = 256 * 1024;
let state = defaultState();
let telegramInitData = '';

function defaultState(){
  return {
    playerName: 'Гонщик', playerPhoto:null, playerId:null,
    coins:1500, xp:0, level:1, nitro:2,
    ownedCars:[1], activeCarId:1, upgrades:{}, fuel:{}, condition:{},
    vehicleInstances:{}, plates:{}, tuningHistory:{}, caseHistory:[],
    stats:{races:0,wins:0,losses:0,bossWins:0,totalEarned:0,totalSpent:0,finesPaid:0,finesCount:0,casinoWagered:0,casinoWon:0,blackjackWins:0,casesOpened:0},
    jobCooldowns:{}, achievements:{}, dailyStreak:0, lastDailyClaim:0,
    settings:{sound:true,animations:true,haptics:true,reducedMotion:false,compactHud:false},
    logoTaps:0, secretBonusAt:0, duelSub:'normal',
    claimedSaleIds:[], claimedTransferIds:[], claimedPvpIds:[], bankSentLog:[],
    hasLicense:true, licenseSuspended:false, licenseSuspendCount:0,
    winStreak:0, raceHistory:[], tournamentRuns:{},
    raceStats:{perfectStarts:0,perfectShifts:0,hardLaunches:0,safeLaunches:0,radarEvents:0,policeStops:0,nitroUses:0},
    heat:0, districtRep:0, districtWins:{},
    contracts:{day:'',items:{}}, recentRaces:[],
    detailTargetId:null,tuneTargetId:null,
    createdAt:Date.now(), lastSaved:0
  };
}

function finiteNumber(v,fallback=0,min=-Infinity,max=Infinity){
  const n=Number(v); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
function intNumber(v,fallback=0,min=-2147483648,max=2147483647){
  return Math.trunc(finiteNumber(v,fallback,min,max));
}
function safeText(v,fallback='',max=80){
  if(typeof v!=='string') return fallback;
  return v.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,max) || fallback;
}
function safePhotoUrl(v){
  if(typeof v!=='string' || v.length>800) return null;
  try{ const u=new URL(v); return (u.protocol==='https:'||u.protocol==='http:')?u.href:null; }catch(_){ return null; }
}
function safePlayerId(v){const x=safeText(v,'',96);return /^(tg_[0-9]{1,24}|guest_[A-Za-z0-9-]{8,80})$/.test(x)?x:null;}
function plainObject(v){ return !!v && typeof v==='object' && !Array.isArray(v) && Object.getPrototypeOf(v)===Object.prototype; }
function safeIdArray(v,max=500){
  if(!Array.isArray(v)) return [];
  return [...new Set(v.slice(0,max).map(x=>intNumber(x,NaN,1,100000)).filter(Number.isFinite))];
}
function validCarIds(){
  return typeof carsDB!=='undefined' ? new Set(carsDB.map(c=>c.id)) : null;
}
function normalizeRecordNumbers(src,min=0,max=1e9){
  const out={}; if(!plainObject(src)) return out;
  Object.keys(src).slice(0,300).forEach(k=>{ if(/^[\w-]{1,40}$/.test(k)) out[k]=finiteNumber(src[k],0,min,max); });
  return out;
}
function normalizeUpgrades(src){
  const out={}; if(!plainObject(src))return out;
  Object.keys(src).slice(0,100).forEach(k=>{
    if(!/^\d{1,6}$/.test(k)||!plainObject(src[k]))return;
    out[k]={engine:intNumber(src[k].engine,0,0,5),turbo:intNumber(src[k].turbo,0,0,5),gearbox:intNumber(src[k].gearbox??src[k].transmission,0,0,5),tires:intNumber(src[k].tires,0,0,5)};
  });return out;
}
function normalizeAchievements(src){
  const out={};if(!plainObject(src))return out;Object.keys(src).slice(0,200).forEach(k=>{if(/^[\w-]{1,64}$/.test(k)&&src[k])out[k]=true;});return out;
}
function normalizeTournamentRuns(src){
  const out={};if(!plainObject(src))return out;Object.keys(src).slice(0,100).forEach(k=>{const r=src[k];if(!plainObject(r))return;out[safeText(k,'',40)]={day:safeText(r.day,'',16),count:intNumber(r.count,0,0,3),next:intNumber(r.next,0,0,Date.now()+365*86400000)};});return out;
}
function normalizeContracts(src){
  if(!plainObject(src))return {day:'',items:{}};const out={day:safeText(src.day,'',16),items:{}};if(plainObject(src.items))Object.keys(src.items).slice(0,50).forEach(k=>{const r=src.items[k];if(plainObject(r)&&/^[\w-]{1,64}$/.test(k))out.items[k]={progress:intNumber(r.progress,0,0,1000),claimed:r.claimed===true};});return out;
}
function normalizeState(raw){
  const b=defaultState(), s=plainObject(raw)?raw:{};
  const stats=plainObject(s.stats)?s.stats:{};
  const raceStats=plainObject(s.raceStats)?s.raceStats:{};
  const settings=plainObject(s.settings)?s.settings:{};
  const carSet=validCarIds();
  let owned=safeIdArray(s.ownedCars,100);
  if(carSet) owned=owned.filter(id=>carSet.has(id));
  if(!owned.length) owned=[1];
  let active=intNumber(s.activeCarId,owned[0],1,100000);
  if(!owned.includes(active)) active=owned[0];

  const out={
    ...b,
    playerName:safeText(s.playerName,'Гонщик',48),
    playerPhoto:safePhotoUrl(s.playerPhoto),
    playerId:safePlayerId(s.playerId),
    coins:intNumber(s.coins,b.coins,0,1_000_000_000),
    xp:intNumber(s.xp,0,0,10_000_000), level:intNumber(s.level,1,1,999), nitro:intNumber(s.nitro,2,0,9999),
    ownedCars:owned, activeCarId:active,
    upgrades:normalizeUpgrades(s.upgrades), fuel:normalizeRecordNumbers(s.fuel,0,100), condition:normalizeRecordNumbers(s.condition,0,100),
    stats:{
      races:intNumber(stats.races,0,0,1e9), wins:intNumber(stats.wins,0,0,1e9), losses:intNumber(stats.losses,0,0,1e9), bossWins:intNumber(stats.bossWins,0,0,1e9),
      totalEarned:intNumber(stats.totalEarned,0,0,1e12), totalSpent:intNumber(stats.totalSpent,0,0,1e12),
      finesPaid:intNumber(stats.finesPaid,0,0,1e12), finesCount:intNumber(stats.finesCount,0,0,1e9),
      casinoWagered:intNumber(stats.casinoWagered,0,0,1e12), casinoWon:intNumber(stats.casinoWon,0,0,1e12), blackjackWins:intNumber(stats.blackjackWins,0,0,1e9), casesOpened:intNumber(stats.casesOpened,0,0,1e9)
    },
    jobCooldowns:normalizeRecordNumbers(s.jobCooldowns,0,Date.now()+365*86400000), achievements:normalizeAchievements(s.achievements),
    dailyStreak:intNumber(s.dailyStreak,0,0,9999), lastDailyClaim:intNumber(s.lastDailyClaim,0,0,Date.now()+86400000),
    settings:{sound:settings.sound!==false,animations:settings.animations!==false,haptics:settings.haptics!==false,reducedMotion:settings.reducedMotion===true,compactHud:settings.compactHud===true},
    logoTaps:intNumber(s.logoTaps,0,0,4), secretBonusAt:intNumber(s.secretBonusAt,0,0,Date.now()+86400000),
    duelSub:['normal','tour','pvp'].includes(s.duelSub)?s.duelSub:'normal',
    claimedSaleIds:safeIdArray(s.claimedSaleIds,500),claimedTransferIds:safeIdArray(s.claimedTransferIds,500),claimedPvpIds:safeIdArray(s.claimedPvpIds,500),
    bankSentLog:Array.isArray(s.bankSentLog)?s.bankSentLog.slice(-200).filter(x=>plainObject(x)).map(x=>({to:safeText(x.to,'',96),amount:intNumber(x.amount,0,0,1e7),ts:intNumber(x.ts,0,0,Date.now()+86400000)})).filter(x=>x.to&&x.amount):[],
    hasLicense:s.hasLicense!==false,licenseSuspended:s.licenseSuspended===true,licenseSuspendCount:intNumber(s.licenseSuspendCount,0,0,1000),
    winStreak:intNumber(s.winStreak,0,0,1e6),raceHistory:Array.isArray(s.raceHistory)?s.raceHistory.slice(-20).map(x=>safeText(String(x),'',40)).filter(Boolean):[],
    tournamentRuns:normalizeTournamentRuns(s.tournamentRuns),
    raceStats:{
      perfectStarts:intNumber(raceStats.perfectStarts,0,0,1e9),perfectShifts:intNumber(raceStats.perfectShifts,0,0,1e9),hardLaunches:intNumber(raceStats.hardLaunches,0,0,1e9),safeLaunches:intNumber(raceStats.safeLaunches,0,0,1e9),radarEvents:intNumber(raceStats.radarEvents,0,0,1e9),policeStops:intNumber(raceStats.policeStops,0,0,1e9),nitroUses:intNumber(raceStats.nitroUses,0,0,1e9)
    },
    heat:intNumber(s.heat,0,0,5),districtRep:intNumber(s.districtRep,0,0,1e9),districtWins:normalizeRecordNumbers(s.districtWins,0,1e9),
    contracts:normalizeContracts(s.contracts),
    recentRaces:Array.isArray(s.recentRaces)?s.recentRaces.slice(-12).filter(plainObject).map(r=>({
      ts:intNumber(r.ts,Date.now(),0,Date.now()+86400000),won:r.won===true,opponent:safeText(r.opponent,'Соперник',60),route:safeText(r.route,'Маршрут',40),time:finiteNumber(r.time,0,0,999),topSpeed:finiteNumber(r.topSpeed,0,0,500),perfectShifts:intNumber(r.perfectShifts,0,0,10),nitroUsed:r.nitroUsed===true
    })):[],
    detailTargetId:Number.isFinite(Number(s.detailTargetId))?intNumber(s.detailTargetId,null,1,100000):null,
    tuneTargetId:Number.isFinite(Number(s.tuneTargetId))?intNumber(s.tuneTargetId,null,1,100000):null,
    createdAt:intNumber(s.createdAt,Date.now(),0,Date.now()),lastSaved:intNumber(s.lastSaved,0,0,Date.now()+86400000)
  };
  // Never allow impossible derived stats to break profile math.
  out.stats.wins=Math.min(out.stats.wins,out.stats.races);
  out.stats.losses=Math.min(out.stats.losses,out.stats.races);
  return out;
}

function saveState(){
  try{
    state=normalizeState(state); state.lastSaved=Date.now();
    localStorage.setItem(SAVE_KEY,JSON.stringify(state));
    const el=document.getElementById('last-saved-text'); if(el)el.innerText=new Date(state.lastSaved).toLocaleTimeString('ru-RU');
  }catch(e){ console.warn('save failed',e); }
}
function loadState(){
  try{
    let raw=localStorage.getItem(SAVE_KEY);
    if(!raw){ for(const key of LEGACY_SAVE_KEYS){ raw=localStorage.getItem(key); if(raw)break; } }
    if(!raw || raw.length>MAX_SAVE_BYTES){ state=defaultState(); return; }
    state=normalizeState(JSON.parse(raw));
    localStorage.setItem(SAVE_KEY,JSON.stringify(state));
  }catch(e){ console.warn('load failed, using defaults',e); state=defaultState(); }
}
function manualSave(){ saveState(); showToast(' Прогресс сохранён'); }
function exportSave(){
  saveState();
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='autosyndicate_carbon_save.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);showToast(' Сохранение экспортировано');
}
function importSave(evt){
  const file=evt.target.files&&evt.target.files[0]; if(!file)return;
  if(file.size>MAX_SAVE_BYTES){showToast(' Файл слишком большой');evt.target.value='';return;}
  const reader=new FileReader();
  reader.onload=e=>{try{state=normalizeState(JSON.parse(String(e.target.result||'')));saveState();applyUiSettings();showToast(' Сохранение импортировано');switchTab('profile');}catch(_){showToast(' Неверный файл сохранения');}finally{evt.target.value='';}};
  reader.readAsText(file);
}
function resetProgress(){
  if(!confirm('Точно сбросить весь прогресс? Это действие необратимо.'))return;
  if(!confirm('Последнее предупреждение: машины, деньги и достижения будут удалены. Продолжить?'))return;
  localStorage.removeItem(SAVE_KEY);LEGACY_SAVE_KEYS.forEach(k=>localStorage.removeItem(k));state=defaultState();applyUiSettings();showToast(' Прогресс сброшен');switchTab('garage');
}
function applyUiSettings(){
  document.body.classList.toggle('reduce-motion',!!state.settings.reducedMotion);
  document.body.classList.toggle('compact-race-hud',!!state.settings.compactHud);
}
window.addEventListener('beforeunload',saveState);
setInterval(()=>{const racing=document.getElementById('screen-race')?.classList.contains('active');if(!racing)saveState();},30000);

/* ==================== TELEGRAM CONTEXT ==================== */
function initTelegram(){
  try{
    if(window.Telegram&&window.Telegram.WebApp){
      const tg=window.Telegram.WebApp; tg.ready();tg.expand();telegramInitData=typeof tg.initData==='string'?tg.initData:'';
      const u=tg.initDataUnsafe&&tg.initDataUnsafe.user;
      if(u){
        if(u.first_name&&(state.playerName==='Гонщик'||!state.playerName))state.playerName=safeText(u.first_name,'Гонщик',48);
        if(u.photo_url)state.playerPhoto=safePhotoUrl(u.photo_url);
        if(u.id)state.playerId='tg_'+String(u.id).replace(/[^0-9]/g,'').slice(0,24);
      }
    }
  }catch(e){console.warn('telegram init failed',e);}
  if(!state.playerId){
    let local=localStorage.getItem('autosyndicate_local_id');
    if(!/^guest_[a-zA-Z0-9-]{8,80}$/.test(local||'')){
      const id=(globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
      local='guest_'+id;localStorage.setItem('autosyndicate_local_id',local);
    }
    state.playerId=local;
  }
  applyUiSettings();
}
function escapeAttrLocal(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function avatarHTML(){
  const rawLetter=(state.playerName||'Г').charAt(0).toUpperCase();
  const letter=escapeAttrLocal(/^[0-9A-ZА-ЯЁ]$/i.test(rawLetter)?rawLetter:'Г');
  if(state.playerPhoto)return '<img src="'+escapeAttrLocal(state.playerPhoto)+'" alt="avatar" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.textContent=\''+letter+'\'">';
  return letter;
}
function updateAvatarUI(){
  const h=document.getElementById('header-avatar');if(h)h.innerHTML=avatarHTML();
  const p=document.getElementById('avatar-letter');if(p)p.innerHTML=avatarHTML();
  const n=document.getElementById('nav-profile-ic');if(n&&state.playerPhoto)n.innerHTML='<div class="nav-avatar"><img src="'+escapeAttrLocal(state.playerPhoto)+'" referrerpolicy="no-referrer" onerror="this.closest(\'.nav-avatar\').remove()"></div>';
}
