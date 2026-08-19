/* ==================== DEFAULT STATE ==================== */
function defaultState(){
  return {
    playerName: "Гонщик",
    playerPhoto: null,
    playerId: null,
    coins: 1500,
    xp: 0,
    level: 1,
    nitro: 2,
    ownedCars: [1],
    activeCarId: 1,
    upgrades: {},
    fuel: {},
    condition: {},
    stats: { races:0, wins:0, losses:0, totalEarned:0, totalSpent:0, finesPaid:0, finesCount:0, casinoWagered:0, casinoWon:0, casesOpened:0 },
    jobCooldowns: {},
    achievements: {},
    dailyStreak: 0,
    lastDailyClaim: 0,
    settings: { sound:true, animations:true },
    logoTaps: 0,
    duelSub: 'normal',
    claimedSaleIds: [],
    claimedTransferIds: [],
    claimedPvpIds: [],
    bankSentLog: [],
    hasLicense: true,
    licenseSuspended: false,
    licenseSuspendCount: 0,
    winStreak: 0,
    raceHistory: [],
    tournamentRuns: {},
    raceStats: {perfectStarts:0, perfectShifts:0, hardLaunches:0, safeLaunches:0, radarEvents:0, policeStops:0},
    detailTargetId: null,
    tuneTargetId: null,
    createdAt: Date.now(),
    lastSaved: 0
  };
}
let state = defaultState();

/* ==================== SAVE / LOAD ==================== */
const SAVE_KEY = 'autosyndicate_save_v2';
function saveState(){
  try{
    state.lastSaved = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    const el = document.getElementById('last-saved-text');
    if(el) el.innerText = new Date(state.lastSaved).toLocaleTimeString('ru-RU');
  }catch(e){ console.warn('save failed', e); }
}
function loadState(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return;
    const saved = JSON.parse(raw);
    const base = defaultState();
    state = Object.assign(base, saved);
    state.stats = Object.assign(base.stats, saved.stats||{});
    state.settings = Object.assign(base.settings, saved.settings||{});
    state.upgrades = saved.upgrades || {};
    state.fuel = saved.fuel || {};
    state.condition = saved.condition || {};
    state.jobCooldowns = saved.jobCooldowns || {};
    state.achievements = saved.achievements || {};
    state.claimedSaleIds = Array.isArray(saved.claimedSaleIds) ? saved.claimedSaleIds : [];
    state.claimedTransferIds = Array.isArray(saved.claimedTransferIds) ? saved.claimedTransferIds : [];
    state.claimedPvpIds = Array.isArray(saved.claimedPvpIds) ? saved.claimedPvpIds : [];
    state.bankSentLog = Array.isArray(saved.bankSentLog) ? saved.bankSentLog : [];
    state.raceHistory = Array.isArray(saved.raceHistory) ? saved.raceHistory : [];
    state.tournamentRuns = saved.tournamentRuns && typeof saved.tournamentRuns === 'object' ? saved.tournamentRuns : {};
    state.raceStats = Object.assign(base.raceStats, saved.raceStats||{});
    if(!Array.isArray(state.ownedCars) || state.ownedCars.length===0) state.ownedCars=[1];
  }catch(e){ console.warn('load failed, using defaults', e); state = defaultState(); }
}
function manualSave(){ saveState(); showToast("💾 Прогресс сохранён"); }
function exportSave(){
  saveState();
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'autosyndicate_save.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast("📤 Файл сохранения скачан");
}
function importSave(evt){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      const saved = JSON.parse(e.target.result);
      const base = defaultState();
      state = Object.assign(base, saved);
      state.stats = Object.assign(base.stats, saved.stats||{});
      state.settings = Object.assign(base.settings, saved.settings||{});
      saveState();
      showToast("📥 Сохранение импортировано");
      switchTab('profile');
    }catch(err){ showToast("⚠️ Неверный файл сохранения"); }
  };
  reader.readAsText(file);
}
function resetProgress(){
  if(!confirm("Точно сбросить весь прогресс? Это действие необратимо.")) return;
  if(!confirm("Последнее предупреждение: все машины, деньги и достижения будут удалены. Продолжить?")) return;
  localStorage.removeItem(SAVE_KEY);
  state = defaultState();
  showToast("🗑️ Прогресс сброшен");
  switchTab('garage');
}
window.addEventListener('beforeunload', saveState);
setInterval(()=>{ const racing=document.getElementById('screen-race')?.classList.contains('active'); if(!racing) saveState(); }, 20000);

/* ==================== TELEGRAM SYNC ==================== */
function initTelegram(){
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.expand();
      const u = window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user;
      if (u){
        if(u.first_name && (state.playerName==='Гонщик' || !state.playerName)) state.playerName = u.first_name;
        if(u.photo_url) state.playerPhoto = u.photo_url;
        if(u.id) state.playerId = 'tg_'+u.id;
      }
    }
  } catch(e) {}
  if(!state.playerId){
    // фоллбек для тестов вне Telegram — стабильный id в этом браузере
    let local = localStorage.getItem('autosyndicate_local_id');
    if(!local){ local = 'guest_'+Math.random().toString(36).slice(2,10); localStorage.setItem('autosyndicate_local_id', local); }
    state.playerId = local;
  }
}
function avatarHTML(){
  const letter = (state.playerName||'Г').charAt(0).toUpperCase();
  if(state.playerPhoto) return '<img src="'+state.playerPhoto+'" alt="avatar" onerror="this.parentElement.innerHTML=\''+letter+'\'">';
  return letter;
}
function updateAvatarUI(){
  const h = document.getElementById('header-avatar'); if(h) h.innerHTML = avatarHTML();
  const p = document.getElementById('avatar-letter'); if(p) p.innerHTML = avatarHTML();
  const n = document.getElementById('nav-profile-ic');
  if(n){
    if(state.playerPhoto){ n.innerHTML = '<div class="nav-avatar"><img src="'+state.playerPhoto+'" onerror="this.parentElement.parentElement.innerHTML=\'\'"></div>'; }
  }
}

