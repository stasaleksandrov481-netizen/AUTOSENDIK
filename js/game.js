/* ==================== FUEL / CONDITION ==================== */
function getFuel(carId){ if(state.fuel[carId]===undefined) state.fuel[carId]=100; return state.fuel[carId]; }
function getCondition(carId){ if(state.condition[carId]===undefined) state.condition[carId]=100; return state.condition[carId]; }
function fuelPricePerUnit(car){ return Math.max(1, Math.round(car.price/2500)+1); }
function repairPricePerUnit(car){ return Math.max(2, Math.round(car.price/1400)+2); }
function refuelCar(carId){
  const car=carsDB.find(c=>c.id===carId);
  const need = 100-getFuel(carId);
  if(need<=0){ showToast("Бак уже полон"); return; }
  const cost = need*fuelPricePerUnit(car);
  if(state.coins<cost){ showToast("Недостаточно денег на заправку"); return; }
  state.coins-=cost; state.stats.totalSpent+=cost; state.fuel[carId]=100;
  showToast("⛽ Заправлено за "+fmt(cost)+" 💰");
  saveState(); openDetail(carId);
}
function repairCar(carId){
  const car=carsDB.find(c=>c.id===carId);
  const need = 100-getCondition(carId);
  if(need<=0){ showToast("Машина в идеальном состоянии"); return; }
  const cost = need*repairPricePerUnit(car);
  if(state.coins<cost){ showToast("Недостаточно денег на ремонт"); return; }
  state.coins-=cost; state.stats.totalSpent+=cost; state.condition[carId]=100;
  showToast("🛠️ Отремонтировано за "+fmt(cost)+" 💰");
  saveState(); openDetail(carId);
}

/* ==================== XP / LEVEL ==================== */
function xpNeeded(lvl){ return 80+lvl*45; }
function addXP(n){
  state.xp+=n;
  let leveled=false;
  while(state.xp>=xpNeeded(state.level)){ state.xp-=xpNeeded(state.level); state.level++; leveled=true; }
  if(leveled){ const bonus=state.level*50; awardMoney(bonus,'ПОВЫШЕНИЕ УРОВНЯ'); showToast("⭐ Новый уровень! Теперь LVL "+state.level); }
  updateHeader();
}


/* ==================== UTIL ==================== */
function fmt(n){ return Math.round(n).toLocaleString('ru-RU'); }
function showToast(msg){
  const t=document.createElement('div');
  t.className='toast'; t.innerText=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
function flashResult(el, win){
  if(!state.settings.animations || !el) return;
  el.classList.remove('win-flash','lose-flash');
  void el.offsetWidth;
  el.classList.add(win?'win-flash':'lose-flash');
}
function tapLogo(){
  state.logoTaps=(state.logoTaps||0)+1;
  if(state.logoTaps<5) return;
  state.logoTaps=0;
  const now=Date.now();
  if(now-(state.secretBonusAt||0)<24*60*60*1000){ showToast('Синдикат уже выдал скрытый бонус сегодня.'); saveState(); return; }
  state.secretBonusAt=now; state.coins+=250; state.stats.totalEarned+=250; state.nitro+=1;
  showToast('🎁 Тайник синдиката: +250 SYND и 1 нитро');
  haptic('success'); updateHeader(); saveState(); checkAchievements();
}

/* ==================== NAV ==================== */
const TAB_MAP = {garage:0,shop:1,'duel-select':2,casino:3,profile:4};
function switchTab(tabId){
  if(raceCtx && !raceCtx.finished && document.getElementById('screen-race')?.classList.contains('active') && tabId!=='race'){
    if(!confirm('Заезд ещё не закончен. Покинуть трассу? Вход и топливо не возвращаются.')) return;
    raceCtx.finished=true; if(raceCtx.raf) cancelAnimationFrame(raceCtx.raf); if(raceCtx.launchIv) clearInterval(raceCtx.launchIv);
  }
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));
  const target=document.getElementById('screen-'+tabId); if(!target) return;
  target.classList.add('active');
  const buttons=document.querySelectorAll('.nav-btn'); if(TAB_MAP[tabId]!==undefined && buttons[TAB_MAP[tabId]]) buttons[TAB_MAP[tabId]].classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
  if(tabId==='garage')renderGarage();
  if(tabId==='shop')renderShop();
  if(tabId==='duel-select')renderOpponents();
  if(tabId==='jobs')renderJobs();
  if(tabId==='profile')renderProfile();
  if(tabId==='casino')renderCasinoHub();
  if(tabId==='achievements')renderAchievements();
  if(tabId==='cases')renderCases();
  if(tabId==='leaderboard')renderLeaderboard();
  if(tabId==='settings')renderSettings();
  if(tabId==='market')openMarket();
  if(tabId==='chat')openChat();
  if(tabId==='bank')openBank();
  if(tabId==='districts')renderDistricts();
  if(tabId==='contracts')renderContracts();
  saveState();
}
function switchDuelSub(sub){
  state.duelSub=sub;
  document.getElementById('dsub-normal').classList.toggle('active', sub==='normal');
  document.getElementById('dsub-tour').classList.toggle('active', sub==='tour');
  document.getElementById('dsub-pvp').classList.toggle('active', sub==='pvp');
  document.getElementById('opponent-list').style.display = sub==='pvp' ? 'none' : '';
  document.getElementById('pvp-wrap').style.display = sub==='pvp' ? '' : 'none';
  if(sub==='pvp'){
    const car=carsDB.find(c=>c.id===state.activeCarId);
    document.getElementById('pvp-my-power').innerText = car ? getEffectivePower(car)+' л.с.' : '—';
    openPvp();
  } else {
    renderOpponents();
  }
}

function updateHeader(){
  const coins=document.getElementById('coins-display'),lvl=document.getElementById('lvl-display');
  if(coins)coins.innerText=fmt(state.coins); if(lvl)lvl.innerText=state.level;
}

/* ==================== GARAGE / SHOP ==================== */
function renderGarage(){
  updateHeader();
  const container=document.getElementById('garage-list'); if(!container)return;
  document.getElementById('garage-count').innerText=state.ownedCars.length+' машин';
  renderGarageTools(); container.innerHTML='';
  let myCars=carsDB.filter(c=>state.ownedCars.includes(c.id));
  if(garageSort==='power') myCars.sort((a,b)=>getEffectivePower(b)-getEffectivePower(a));
  else if(garageSort==='condition') myCars.sort((a,b)=>getCondition(b.id)-getCondition(a.id));
  else myCars.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  myCars.forEach(car=>{
    const isActive=state.activeCarId===car.id,eff=getEffectivePower(car),fuel=getFuel(car.id),cond=getCondition(car.id);
    container.innerHTML+='<div class="car-card" style="'+(isActive?'border-color:var(--accent);':'')+'">'+
      '<div class="car-thumb" onclick="openDetail('+car.id+')">'+carArtSVG(car)+'<div class="tier-badge">'+car.tier+'</div><div class="power-badge">'+eff+' л.с.</div></div>'+
      '<div class="car-info-box"><div class="car-title">'+car.name+'</div><div class="car-stats"><div>Статус: <span style="color:'+(isActive?'var(--accent-2)':'var(--green)')+'">'+(isActive?'АКТИВНА':'В ГАРАЖЕ')+'</span></div><div>⛽ <span style="color:'+(fuel<25?'var(--danger)':'#fff')+'">'+fuel+'%</span></div><div>🔧 <span style="color:'+(cond<40?'var(--danger)':'#fff')+'">'+cond+'%</span></div></div>'+
      '<div class="btn-row">'+(!isActive?'<button class="btn btn-select" onclick="selectCar('+car.id+')">ВЫБРАТЬ</button>':'<button class="btn btn-select selected-mark" disabled>АКТИВНА</button>')+'<button class="btn btn-ghost" onclick="openDetail('+car.id+')">КАРТОЧКА</button></div></div></div>';
  });
}

function renderShop(){
  updateHeader(); const container=document.getElementById('shop-list'); if(!container)return;
  renderShopToolbar(); container.innerHTML='';
  let list=carsDB.filter(c=>shopCategory==='all'||c.cat===shopCategory);
  if(shopSort==='power')list=list.slice().sort((a,b)=>b.power-a.power); else list=list.slice().sort((a,b)=>a.price-b.price);
  list.forEach(car=>{
    const isOwned=state.ownedCars.includes(car.id),canAfford=state.coins>=car.price;
    container.innerHTML+='<div class="car-card"><div class="car-thumb" onclick="openDetail('+car.id+')">'+carArtSVG(car)+'<div class="tier-badge">'+car.tier+'</div><div class="power-badge">'+car.power+' л.с.</div></div>'+
      '<div class="car-info-box"><div class="car-title">'+car.name+'</div><div class="car-stats"><span>'+CAT_LABELS[car.cat]+'</span><span>'+(car.price===0?'Стартовая':fmt(car.price)+' SYND')+'</span></div><div class="btn-row">'+
      (isOwned?'<button class="btn btn-buy" disabled>В ГАРАЖЕ</button>':'<button class="btn btn-buy" '+(canAfford?'':'disabled')+' onclick="buyCar('+car.id+')">'+(canAfford?'КУПИТЬ':'НЕ ХВАТАЕТ')+'</button>')+'<button class="btn btn-ghost" onclick="openDetail('+car.id+')">КАРТОЧКА</button></div></div></div>';
  });
}
function buyCar(carId){
  const car=carsDB.find(c=>c.id===carId); if(!car||state.ownedCars.includes(carId))return;
  if(state.coins<car.price){showToast('Недостаточно SYND');haptic('error');return;}
  state.coins-=car.price;state.stats.totalSpent+=car.price;state.ownedCars.push(carId);getFuel(carId);getCondition(carId);getUpg(carId);
  showToast('🚗 В гараже: '+car.name);haptic('success');recordContractEvent('buy',1);updateHeader();renderShop();saveState();checkAchievements();
}
function selectCar(carId){
  if(!state.ownedCars.includes(carId))return; state.activeCarId=carId;showToast('✅ Активная машина изменена');haptic('light');renderGarage();saveState();
}

/* ==================== CAR DETAIL ==================== */
function openDetail(carId){
  state.detailTargetId=carId;
  const car=carsDB.find(c=>c.id===carId);
  const isOwned=state.ownedCars.includes(carId);
  const eff=getEffectivePower(car);
  const powerPct=Math.min(100, Math.round(eff/1500*100));
  const fuel=getFuel(carId), cond=getCondition(carId);
  let html = '<div class="detail-hero">'+carArtSVG(car)+'<div class="detail-hero-text"><h2>'+car.name+'</h2><div style="color:var(--text-muted);font-weight:800;font-size:12px;text-transform:uppercase;">'+car.tier+'</div></div></div>'+
    '<div class="flavor-box">"'+car.flavor+'"</div>'+
    '<div class="stat-row"><div class="stat-line"><span>Мощность</span><b>'+eff+' л.с.'+(eff!==car.power?' (баз. '+car.power+')':'')+'</b></div><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:'+powerPct+'%;background:var(--accent);"></div></div>'+
    '<div class="stat-line" style="margin-top:8px;"><span>Класс</span><b>'+CAT_LABELS[car.cat]+'</b></div>'+
    '<div class="stat-line"><span>Цена</span><b>'+(car.price===0?'Стартовая':fmt(car.price)+' 💰')+'</b></div></div>';

  if(isOwned){
    html += '<div class="resource-row">'+
      '<div class="resource-box"><div class="resource-head"><span>⛽ Топливо</span><b>'+fuel+'%</b></div><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:'+fuel+'%;background:var(--blue);"></div></div></div>'+
      '<div class="resource-box"><div class="resource-head"><span>🔧 Состояние</span><b>'+cond+'%</b></div><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:'+cond+'%;background:'+(cond<40?'var(--accent)':'var(--green)')+';"></div></div></div>'+
    '</div>'+
    '<div class="btn-row" style="max-width:520px;width:100%;margin-bottom:10px;">'+
      '<button class="btn btn-ghost" onclick="refuelCar('+carId+')">ЗАПРАВИТЬ</button>'+
      '<button class="btn btn-ghost" onclick="repairCar('+carId+')">РЕМОНТ</button>'+
    '</div>'+
    '<div class="list-container" style="max-width:520px;">'+
      (state.activeCarId!==carId ? '<button class="btn btn-select" onclick="selectCar('+carId+')">СДЕЛАТЬ АКТИВНОЙ</button>' : '<button class="btn btn-select selected-mark" disabled>АКТИВНАЯ МАШИНА</button>')+
      '<button class="btn btn-gold" onclick="openTune('+carId+')">🔧 ТЮНИНГ</button>'+
    '</div>';
  } else {
    const canAfford = state.coins>=car.price;
    html += '<div class="list-container" style="max-width:520px;"><button class="btn btn-buy" '+(canAfford?'':'disabled')+' onclick="buyCar('+carId+');openDetail('+carId+')">'+(canAfford?'КУПИТЬ ЗА '+fmt(car.price)+' 💰':'НЕДОСТАТОЧНО СРЕДСТВ')+'</button></div>';
  }
  document.getElementById('detail-content').innerHTML = html;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-cardetail').classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
}
function goBackFromDetail(){
  if(state.ownedCars.includes(state.detailTargetId)) switchTab('garage'); else switchTab('shop');
}

/* ==================== TUNING ==================== */
function openTune(carId){
  state.tuneTargetId=carId;
  const car=carsDB.find(c=>c.id===carId);
  document.getElementById('tune-car-title').innerText = "Тюнинг: "+car.name;
  const upg=getUpg(carId);
  const container=document.getElementById('tune-list');
  container.innerHTML='';
  TUNE_TYPES.forEach(t=>{
    const lvl=upg[t.key];
    const maxed = lvl>=t.hpPerStage.length;
    const price = maxed? 0 : tuneStagePrice(car,lvl);
    const canAfford = state.coins>=price;
    let dots='';
    for(let i=0;i<t.hpPerStage.length;i++) dots+='<div class="dot '+(i<lvl?'filled':'')+'"></div>';
    container.innerHTML += '<div class="tune-row">'+
      '<div><div class="tune-name">'+t.icon+' '+t.name+' <span style="color:var(--text-muted);font-weight:700;font-size:10.5px;">Ст.'+lvl+'/'+t.hpPerStage.length+'</span></div>'+
      '<div class="tune-desc">'+t.desc+'</div><div class="tune-level-dots">'+dots+'</div></div>'+
      '<button class="tune-btn '+(maxed?'maxed':'')+'" '+(maxed||!canAfford?'disabled':'')+' onclick="upgradeTune('+carId+',\''+t.key+'\')">'+(maxed?'МАКС':fmt(price)+' 💰')+'</button>'+
    '</div>';
  });
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-tune').classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
}
function upgradeTune(carId, key){
  const car=carsDB.find(c=>c.id===carId);
  const upg=getUpg(carId);
  const t=TUNE_TYPES.find(x=>x.key===key);
  if(upg[key]>=t.hpPerStage.length) return;
  const price=tuneStagePrice(car,upg[key]);
  if(state.coins<price){ showToast("Недостаточно денег"); return; }
  state.coins-=price; state.stats.totalSpent+=price;
  upg[key]++;
  showToast("🔧 "+t.name+" улучшена до стадии "+upg[key]);
  updateHeader(); openTune(carId); saveState();
  checkAchievements();
}

/* ==================== DUEL SELECT ==================== */
function renderOpponents(){
  updateHeader();
  const container=document.getElementById('opponent-list');
  container.innerHTML='';
  const car=carsDB.find(c=>c.id===state.activeCarId);
  if(!car){ container.innerHTML='<div class="no-car-msg">Сначала выберите активную машину в гараже.</div>'; return; }
  if(state.licenseSuspended){
    container.innerHTML='<div class="sell-picker" style="border-color:#63333e;"><div style="font-size:18px;">🚫</div><b style="display:block;margin:6px 0;">Права временно изъяты</b><div class="empty-note" style="padding:0;text-align:left;">Но это не тупик. Можно заработать через подработку или получить перевод в банке.</div><div class="btn-row" style="margin-top:10px;"><button class="btn btn-gold" onclick="switchTab(\'jobs\')">ПОДРАБОТКА</button><button class="btn btn-ghost" onclick="switchTab(\'bank\')">БАНК</button></div></div>';
    return;
  }
  const list=state.duelSub==='tour'?tournamentsDB:opponentsDB;
  const myPower=getEffectivePower(car);
  const history=state.raceHistory||[];
  const available=list.filter(o=>state.level>=o.unlockLevel);
  if(state.duelSub==='tour'){
    const now=Date.now();
    const dayKey=new Date().toISOString().slice(0,10);
    const statusText=(o)=>{
      const r=state.tournamentRuns[String(o.id)]||{};
      if(r.day!==dayKey) return {count:0,next:0,day:dayKey};
      return {count:Number(r.count)||0,next:Number(r.next)||0,day:dayKey};
    };
    const locked=available.filter(o=>statusText(o).count>=3 || statusText(o).next>now);
    if(available.length && locked.length===available.length){
      const soon=Math.min(...locked.map(o=>Math.max(0,(statusText(o).next-now)/60000)).filter(x=>x>0));
      container.innerHTML='<div class="empty-note">🏁 Все турнирные попытки на сегодня использованы.<br><span style="font-size:10px;">Новые попытки появятся завтра'+(Number.isFinite(soon)?' или после восстановления кулдауна.':'')+'</span></div>';
      return;
    }
  }
  let pool=available.filter(o=>!history.slice(-3).includes(String(o.id)));
  if(state.duelSub==='tour'){
    const now=Date.now(), dayKey=new Date().toISOString().slice(0,10);
    pool=available.filter(o=>{
      const r=state.tournamentRuns[String(o.id)]||{};
      const count=r.day===dayKey?(Number(r.count)||0):0;
      const next=r.day===dayKey?(Number(r.next)||0):0;
      return count<3 && next<=now;
    });
  }
  if(pool.length<3 && state.duelSub!=='tour') pool=available;
  pool=pool.slice().sort(()=>Math.random()-.5).slice(0,Math.min(5,pool.length));
  if(!pool.length){ container.innerHTML='<div class="empty-note">Пока нет доступных соперников.</div>'; return; }
  const routeNames=['Промзона','Ночной проспект','Портовый обход','Тоннель','Старая эстакада'];
  const route=routeNames[Math.floor(Math.random()*routeNames.length)];
  container.innerHTML='<div class="race-event-badge"><span>СЕГОДНЯ НА ЛИНИИ</span><b>'+route+'</b></div>';
  pool.forEach((opp,idx)=>{
    const winChance=Math.max(5,Math.min(95,Math.round(50+(myPower-opp.power)/Math.max(opp.power,1)*100)));
    const fee=entryFeeFor(opp);
    const recent=history.includes(String(opp.id));
    const tourStatus=state.duelSub==='tour' ? (state.tournamentRuns[String(opp.id)]||{}) : null;
    const dayKey=new Date().toISOString().slice(0,10);
    const tourCount=state.duelSub==='tour' && tourStatus && tourStatus.day===dayKey ? (Number(tourStatus.count)||0) : 0;
    const tourRewardMult=state.duelSub==='tour' ? ([1,.72,.48][Math.min(2,tourCount)]||.48) : 1;
    const shownReward=Math.round(opp.reward*tourRewardMult);
    const buttonDisabled=state.duelSub==='tour' && tourCount>=3;
    container.innerHTML += '<div class="opp-card '+(opp.boss?'boss ':'')+'roulette-choice" style="animation-delay:'+idx*70+'ms">'+
      '<div class="opp-scan"></div>'+
      '<div class="opp-head"><span class="opp-name">'+(opp.boss?'👑 ':'')+escapeHtml(opp.name)+'</span><span class="opp-power">'+opp.power+' л.с.</span></div>'+
      (opp.boss?'<div class="boss-badge" style="position:static;display:inline-block;width:fit-content;">БОСС</div>':'')+
      '<div style="font-size:11.5px;color:var(--text-muted);font-style:italic;">'+escapeHtml(opp.taunt)+'</div>'+
      '<div class="odds-bar-bg"><div class="odds-win" style="width:'+winChance+'%"></div><div class="odds-lose" style="width:'+(100-winChance)+'%"></div></div>'+
      '<div class="opp-foot"><span>Победа: <b style="color:var(--green)">'+winChance+'%</b></span><span>Вход: <b>-'+fmt(fee)+'</b></span><span>Приз: <b>+'+fmt(shownReward)+'</b></span></div>'+
      (state.duelSub==='tour'?'<div style="font-size:10px;color:var(--gold);text-align:center;">Турнир: попытка '+(tourCount+1)+'/3 · выплата ×'+tourRewardMult.toFixed(2)+'</div>':'')+
      '<button class="btn btn-select" '+(buttonDisabled?'disabled':'')+' onclick="prepareRace(\''+String(opp.id).replace(/'/g,"\\'")+'\', \''+(state.duelSub==='tour'?'tour':'normal')+'\')">ВЫЕХАТЬ</button>'+
      (recent?'<div style="font-size:9px;color:var(--text-muted);text-align:center;">Недавняя встреча</div>':'')+
    '</div>';
  });
}


function renderJobs(){
  updateHeader();
  const container=document.getElementById('jobs-list');
  container.innerHTML='';
  const now=Date.now();
  jobsDB.forEach(job=>{
    const readyAt = state.jobCooldowns[job.id] || 0;
    const remaining = Math.max(0, Math.ceil((readyAt-now)/1000));
    const ready = remaining<=0;
    container.innerHTML += '<div class="job-card">'+
        '<div class="job-head"><span class="job-name">'+job.name+'</span><span class="job-reward">+'+fmt(job.reward)+' 💰</span></div>'+
        '<div class="job-desc">'+job.desc+'</div>'+
        '<button class="job-btn" id="job-btn-'+job.id+'" onclick="doJob(\''+job.id+'\')" '+(ready?'':'disabled')+'>'+(ready ? 'ВЫПОЛНИТЬ' : 'Отдых: '+remaining+'с')+'</button>'+
      '</div>';
  });
}
function doJob(jobId){
  const job=jobsDB.find(j=>j.id===jobId),now=Date.now(); if(!job)return;
  const readyAt=state.jobCooldowns[jobId]||0;if(now<readyAt)return;
  awardMoney(job.reward,job.name);addXP(job.xp||5);state.jobCooldowns[jobId]=now+job.cooldown*1000;
  if(jobId==='wash') reduceHeat(1); recordContractEvent('job',1); haptic('success');
  showToast('💼 '+job.name+': +'+fmt(job.reward)+' SYND');updateHeader();renderJobs();saveState();
}
setInterval(()=>{
  if(document.getElementById('screen-jobs').classList.contains('active')) renderJobs();
},1000);

/* ==================== CASINO HUB ==================== */
function renderCasinoHub(){
  updateHeader();
  const c = document.getElementById('casino-hub-list');
  c.innerHTML =
    '<div class="casino-card" onclick="switchTab(\'blackjack\')"><div class="casino-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="12" height="17" rx="2"/><rect x="10" y="2" width="12" height="17" rx="2" fill="#191922"/></svg></div><div class="casino-info"><b>Блэкджек 21</b><span>Обыграй дилера, набери 21</span></div></div>'+
    '<div class="casino-card" onclick="switchTab(\'roulette\')"><div class="casino-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg></div><div class="casino-info"><b>Рулетка</b><span>Красное, чёрное или число</span></div></div>'+
    '<div class="casino-card" onclick="switchTab(\'slots\')"><div class="casino-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5M16 4v5"/></svg></div><div class="casino-info"><b>Слоты «777»</b><span>Крути барабаны на джекпот</span></div></div>'+
    '<div class="casino-card" onclick="switchTab(\'dice\')"><div class="casino-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg></div><div class="casino-info"><b>Кости</b><span>Загадай шанс — забери выплату</span></div></div>'+
    '<div style="width:100%;max-width:520px;text-align:center;color:var(--text-muted);font-size:11px;font-weight:700;margin-top:6px;">Всего поставлено: '+fmt(state.stats.casinoWagered)+' 💰 · Выиграно: '+fmt(state.stats.casinoWon)+' 💰</div>';
}
function clampBet(input, min){
  let v = parseInt(input.value)||0;
  if(v<min) v=min;
  if(v>state.coins) v=state.coins;
  input.value=v;
  return v;
}

/* ==================== BLACKJACK ==================== */
let bj = null;
let rltSpinning=false,slotsSpinning=false,diceRolling=false;
function bjAdjustBet(delta){ const i=document.getElementById('bj-bet-input'); i.value=(parseInt(i.value)||0)+delta; clampBet(i,10); }
function bjMaxBet(){ document.getElementById('bj-bet-input').value=state.coins; clampBet(document.getElementById('bj-bet-input'),10); }
function bjNewDeck(){
  const suits=['♠','♥','♦','♣']; const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  let d=[];
  suits.forEach(s=>ranks.forEach(r=>d.push({r,s})));
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function bjCardValue(hand){
  let total=0, aces=0;
  hand.forEach(c=>{
    if(c.r==='A'){ total+=11; aces++; }
    else if(['J','Q','K'].includes(c.r)) total+=10;
    else total+=parseInt(c.r);
  });
  while(total>21 && aces>0){ total-=10; aces--; }
  return total;
}
function bjRenderCard(c, hidden){
  if(hidden) return '<div class="card-el back"></div>';
  const red = c.s==='♥'||c.s==='♦';
  return '<div class="card-el '+(red?'red':'black')+'">'+c.r+'<br>'+c.s+'</div>';
}
function bjRenderHands(hideDealer){
  document.getElementById('bj-player-cards').innerHTML = bj.player.map(c=>bjRenderCard(c,false)).join('');
  document.getElementById('bj-dealer-cards').innerHTML = bj.dealer.map((c,idx)=>bjRenderCard(c, hideDealer && idx===1)).join('');
  document.getElementById('bj-player-score').innerText = bjCardValue(bj.player);
  document.getElementById('bj-dealer-score').innerText = hideDealer ? '?' : bjCardValue(bj.dealer);
}
function bjDeal(){
  if(bj && !bj.done)return;
  const bet = clampBet(document.getElementById('bj-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();
  const deck=bjNewDeck();
  bj = { deck, bet, player:[deck.pop(),deck.pop()], dealer:[deck.pop(),deck.pop()], done:false, doubled:false };
  document.getElementById('bj-message').innerText='';
  document.getElementById('bj-bet-panel').style.display='none';
  const ap=document.getElementById('bj-action-panel');
  ap.style.display='flex';
  const canDouble = state.coins>=bet;
  ap.innerHTML = '<button class="btn btn-select" onclick="bjHit()">ЕЩЁ</button>'+
    '<button class="btn btn-ghost" onclick="bjStand()">ХВАТИТ</button>'+
    '<button class="btn btn-gold" '+(canDouble?'':'disabled')+' onclick="bjDouble()">УДВОИТЬ</button>';
  bjRenderHands(true);
  if(bjCardValue(bj.player)===21){ bjStand(); }
}
function bjHit(){
  if(bj.done) return;
  bj.player.push(bj.deck.pop());
  bjRenderHands(true);
  if(bjCardValue(bj.player)>21){ bjEnd('bust'); }
  else if(bjCardValue(bj.player)===21){ bjStand(); }
}
function bjDouble(){
  if(bj.done || state.coins<bj.bet) return;
  state.coins-=bj.bet; state.stats.casinoWagered+=bj.bet; updateHeader();
  bj.bet*=2; bj.doubled=true;
  bj.player.push(bj.deck.pop());
  bjRenderHands(true);
  if(bjCardValue(bj.player)>21){ bjEnd('bust'); } else { bjStand(); }
}
function bjStand(){
  if(bj.done) return;
  while(bjCardValue(bj.dealer)<17){ bj.dealer.push(bj.deck.pop()); }
  bjRenderHands(false);
  const p=bjCardValue(bj.player), d=bjCardValue(bj.dealer);
  if(d>21 || p>d) bjEnd('win');
  else if(p===d) bjEnd('push');
  else bjEnd('lose');
}
function bjEnd(result){
  bj.done=true;
  bjRenderHands(false);
  const msg=document.getElementById('bj-message');
  const isBlackjack = bj.player.length===2 && bjCardValue(bj.player)===21;
  let payout=0, text='';
  if(result==='win' || result==='bust'){
    if(result==='bust'){ text='💥 ПЕРЕБОР — вы проиграли'; msg.style.color='var(--accent)'; payout=0; }
    else {
      state.stats.blackjackWins=(state.stats.blackjackWins||0)+1;
      payout = isBlackjack ? Math.round(bj.bet*2.5) : bj.bet*2;
      text = isBlackjack ? '🃏 БЛЭКДЖЕК! +'+fmt(payout-bj.bet)+' 💰' : '🏆 ПОБЕДА! +'+fmt(payout-bj.bet)+' 💰';
      msg.style.color='var(--green)';
    }
  } else if(result==='push'){ payout=bj.bet; text='🤝 НИЧЬЯ — ставка возвращена'; msg.style.color='var(--text-muted)'; }
  else { text='💥 ДИЛЕР СИЛЬНЕЕ — вы проиграли'; msg.style.color='var(--accent)'; payout=0; }
  msg.innerText=text;
  if(payout>0){ state.coins+=payout; state.stats.casinoWon+=Math.max(0,payout-bj.bet); }
  updateHeader();
  flashResult(document.querySelector('#screen-blackjack .game-table'), payout>bj.bet || payout===bj.bet);
  document.getElementById('bj-action-panel').style.display='none';
  document.getElementById('bj-bet-panel').style.display='block';
  saveState(); checkAchievements();
}

/* ==================== ROULETTE ==================== */
const RLT_RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
let rltSelection = null;
function rltAdjustBet(delta){ const i=document.getElementById('rlt-bet-input'); i.value=(parseInt(i.value)||0)+delta; clampBet(i,10); }
function rltMaxBet(){ document.getElementById('rlt-bet-input').value=state.coins; clampBet(document.getElementById('rlt-bet-input'),10); }
function rltInit(){
  const grid=document.getElementById('rlt-grid');
  let html='';
  for(let n=0;n<=36;n++){
    const color = n===0?'green':(RLT_RED.includes(n)?'red':'black');
    html += '<div class="rlt-num '+color+'" onclick="rltSelectNumber('+n+')" id="rlt-n-'+n+'">'+n+'</div>';
  }
  grid.innerHTML=html;
  const outside=document.getElementById('rlt-outside');
  outside.innerHTML = ['red:Красное','black:Чёрное','even:Чёт','odd:Нечёт','low:1-18','high:19-36'].map(x=>{
    const [key,label]=x.split(':');
    return '<div onclick="rltSelectOutside(\''+key+'\')" id="rlt-o-'+key+'">'+label+'</div>';
  }).join('');
}
function rltClearSelection(){
  document.querySelectorAll('.rlt-num').forEach(e=>e.classList.remove('selected'));
  document.querySelectorAll('.rlt-outside div').forEach(e=>e.classList.remove('selected'));
}
function rltSelectNumber(n){ rltClearSelection(); rltSelection={type:'number', value:n}; document.getElementById('rlt-n-'+n).classList.add('selected'); }
function rltSelectOutside(key){ rltClearSelection(); rltSelection={type:'outside', value:key}; document.getElementById('rlt-o-'+key).classList.add('selected'); }
function rltSpin(){
  if(rltSpinning)return;
  if(!rltSelection){ showToast("Выберите ставку: число, цвет или диапазон"); return; }
  const bet = clampBet(document.getElementById('rlt-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();rltSpinning=true;
  const resEl=document.getElementById('rlt-result');
  resEl.style.background='#1a1a24'; resEl.innerText='...';
  setTimeout(()=>{
    const n = Math.floor(Math.random()*37);
    const color = n===0?'green':(RLT_RED.includes(n)?'red':'black');
    resEl.innerText=n;
    resEl.style.background = color==='green'?'var(--green)':(color==='red'?'#b91c1c':'#1a1a24');
    let win=false, mult=0;
    if(rltSelection.type==='number' && rltSelection.value===n){ win=true; mult=35; }
    else if(rltSelection.type==='outside'){
      if(rltSelection.value==='red' && color==='red'){ win=true; mult=1; }
      else if(rltSelection.value==='black' && color==='black'){ win=true; mult=1; }
      else if(rltSelection.value==='even' && n!==0 && n%2===0){ win=true; mult=1; }
      else if(rltSelection.value==='odd' && n%2===1){ win=true; mult=1; }
      else if(rltSelection.value==='low' && n>=1 && n<=18){ win=true; mult=1; }
      else if(rltSelection.value==='high' && n>=19 && n<=36){ win=true; mult=1; }
    }
    const table = document.querySelector('#screen-roulette');
    if(win){
      const payout = bet + bet*mult;
      state.coins+=payout; state.stats.casinoWon += payout-bet;
      showToast("🎉 Выигрыш! +"+fmt(payout-bet)+" 💰");
      flashResult(table, true);
    } else {
      showToast("😔 Не повезло. Число: "+n);
      flashResult(table, false);
    }
    rltSpinning=false;updateHeader(); saveState(); checkAchievements();
  }, 900);
}

/* ==================== SLOTS ==================== */
const SLOT_SYMBOLS = ['🍒','🍋','🔔','⭐','💎','7️⃣'];
const SLOT_WEIGHTS = [30,26,20,13,8,3];
function slotsAdjustBet(delta){ const i=document.getElementById('slots-bet-input'); i.value=(parseInt(i.value)||0)+delta; clampBet(i,10); }
function slotsMaxBet(){ document.getElementById('slots-bet-input').value=state.coins; clampBet(document.getElementById('slots-bet-input'),10); }
function weightedSymbol(){
  const total = SLOT_WEIGHTS.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<SLOT_SYMBOLS.length;i++){ if(r<SLOT_WEIGHTS[i]) return SLOT_SYMBOLS[i]; r-=SLOT_WEIGHTS[i]; }
  return SLOT_SYMBOLS[0];
}
const SLOT_PAYOUTS = {'🍒':3,'🍋':4,'🔔':6,'⭐':10,'💎':20,'7️⃣':50};
function slotsSpin(){
  if(slotsSpinning)return;
  const bet = clampBet(document.getElementById('slots-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();slotsSpinning=true;
  const reels=[document.getElementById('reel0'),document.getElementById('reel1'),document.getElementById('reel2')];
  reels.forEach(r=>r.classList.add('spin'));
  document.getElementById('slots-message').innerText='';
  let ticks=0;
  const iv=setInterval(()=>{
    reels.forEach(r=>r.innerText=weightedSymbol());
    ticks++;
    if(ticks>12){
      clearInterval(iv);
      const final=[weightedSymbol(),weightedSymbol(),weightedSymbol()];
      reels.forEach((r,i)=>{ r.innerText=final[i]; r.classList.remove('spin'); });
      let payout=0, msg='';
      if(final[0]===final[1] && final[1]===final[2]){
        payout = bet*SLOT_PAYOUTS[final[0]];
        msg = '🎰 ДЖЕКПОТ! '+final[0]+final[0]+final[0]+' — x'+SLOT_PAYOUTS[final[0]];
      } else if(final[0]===final[1] || final[1]===final[2] || final[0]===final[2]){
        payout = Math.round(bet*1.5);
        msg = '✨ Пара совпала — небольшой выигрыш';
      } else { msg='Не повезло, крутите ещё'; }
      const table=document.querySelector('#screen-slots');
      if(payout>0){ state.coins+=payout; state.stats.casinoWon+=payout-bet; flashResult(table,true); }
      else { flashResult(table,false); }
      document.getElementById('slots-message').innerText=msg;
      document.getElementById('slots-message').style.color = payout>0?'var(--green)':'var(--text-muted)';
      slotsSpinning=false;updateHeader(); saveState(); checkAchievements();
    }
  },80);
}

/* ==================== DICE ==================== */
function diceUpdate(){
  const target = parseInt(document.getElementById('dice-slider').value);
  document.getElementById('dice-target').innerText = target;
  const chance = target-1;
  const mult = (97/chance).toFixed(2);
  document.getElementById('dice-chance').innerText = chance+'%';
  document.getElementById('dice-mult').innerText = 'x'+mult;
}
function diceAdjustBet(delta){ const i=document.getElementById('dice-bet-input'); i.value=(parseInt(i.value)||0)+delta; clampBet(i,10); }
function diceMaxBet(){ document.getElementById('dice-bet-input').value=state.coins; clampBet(document.getElementById('dice-bet-input'),10); }
function diceRoll(){
  if(diceRolling)return;
  const bet = clampBet(document.getElementById('dice-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  const target = parseInt(document.getElementById('dice-slider').value);
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();diceRolling=true;
  const resEl=document.getElementById('dice-result');
  resEl.innerText='...'; resEl.style.color='var(--text-muted)';
  setTimeout(()=>{
    const roll = Math.floor(Math.random()*100)+1;
    resEl.innerText=roll;
    const win = roll<target;
    const table=document.querySelector('#screen-dice');
    if(win){
      const mult = 97/(target-1);
      const payout = Math.round(bet*mult);
      state.coins+=payout; state.stats.casinoWon+=payout-bet;
      resEl.style.color='var(--green)';
      showToast("🎲 Выигрыш! +"+fmt(payout-bet)+" 💰");
      flashResult(table,true);
    } else {
      resEl.style.color='var(--accent)';
      showToast("🎲 Мимо. Выпало: "+roll);
      flashResult(table,false);
    }
    diceRolling=false;updateHeader(); saveState(); checkAchievements();
  }, 500);
}

/* ==================== ACHIEVEMENTS ==================== */
const achievementsDB = [
  { id:'first_win', name:'Первая кровь', desc:'Выиграй свою первую дуэль', icon:'🏆', reward:100, check:s=>s.stats.wins>=1 },
  { id:'ten_wins', name:'Ветеран трассы', desc:'Одержи 10 побед', icon:'🥇', reward:500, check:s=>s.stats.wins>=10 },
  { id:'five_cars', name:'Коллекционер', desc:'Владей 5 машинами одновременно', icon:'🚘', reward:400, check:s=>s.ownedCars.length>=5 },
  { id:'all_cars', name:'Весь гараж синдиката', desc:'Собери все машины в игре', icon:'🏁', reward:5000, check:s=>s.ownedCars.length>=27 },
  { id:'lvl10', name:'Авторитет района', desc:'Достигни 10 уровня', icon:'⭐', reward:600, check:s=>s.level>=10 },
  { id:'first_fine', name:'Знакомство с ДПС', desc:'Получи первый штраф от полиции', icon:'🚓', reward:50, check:s=>s.stats.finesCount>=1 },
  { id:'bj_win', name:'Карточный игрок', desc:'Выиграй раунд в блэкджек', icon:'🃏', reward:150, check:s=>(s.stats.blackjackWins||0)>=1 },
  { id:'max_tune', name:'Гараж мечты', desc:'Прокачай тюнинг любой машины до максимума во всех категориях', icon:'🔧', reward:800, check:s=>Object.values(s.upgrades).some(u=>u && TUNE_TYPES.every(t=>u[t.key]>=t.hpPerStage.length)) },
  { id:'earn50k', name:'Барон подполья', desc:'Заработай суммарно 50 000 💰', icon:'💰', reward:1000, check:s=>s.stats.totalEarned>=50000 },
  { id:'daily7', name:'Верный синдикату', desc:'Забирай ежедневную награду 7 дней подряд', icon:'📅', reward:700, check:s=>s.dailyStreak>=7 },
  { id:'secret_car', name:'Тень подполья', desc:'Стань владельцем мифической машины', icon:'👻', reward:1500, check:s=>s.ownedCars.includes(26)||s.ownedCars.includes(27) },
  { id:'boss_slayer', name:'Убийца боссов', desc:'Победи одного из боссов подполья', icon:'👑', reward:2000, check:s=>(s.stats.bossWins||0)>=1 }
];
function checkAchievements(){
  let any=false;
  achievementsDB.forEach(a=>{
    if(state.achievements[a.id]) return;
    let passed=false;
    try{ passed = a.check(state); }catch(e){ passed=false; }
    if(passed){
      state.achievements[a.id]=true;
      state.coins += a.reward;
      showToast('🏅 Достижение: '+a.name+' (+'+fmt(a.reward)+' 💰)');
      any=true;
    }
  });
  if(any){ updateHeader(); saveState(); }
  const sub=document.getElementById('ach-progress-sub');
  if(sub) sub.innerText = Object.keys(state.achievements).length+'/'+achievementsDB.length;
}
function renderAchievements(){
  const c=document.getElementById('ach-list');
  c.innerHTML='';
  achievementsDB.forEach(a=>{
    const done = !!state.achievements[a.id];
    c.innerHTML += '<div class="ach-card '+(done?'done':'')+'">'+
      '<div class="ach-ic">'+a.icon+'</div>'+
      '<div class="ach-body"><b>'+a.name+'</b><span>'+a.desc+'</span></div>'+
      '<div class="ach-reward">'+(done?'✅':'+'+fmt(a.reward))+'</div>'+
    '</div>';
  });
}

/* ==================== CASES ==================== */
const casesDB = [
  { id:'bronze', name:'Бронзовый кейс', icon:'🥉', price:300, desc:'Немного монет или заряд нитро' },
  { id:'silver', name:'Серебряный кейс', icon:'🥈', price:1200, desc:'Хорошая пачка денег и шанс на нитро' },
  { id:'gold', name:'Золотой кейс', icon:'🥇', price:4000, desc:'Крупный куш и редкий шанс на мифическую машину' }
];
function renderCases(){
  const c=document.getElementById('cases-list');
  c.innerHTML='';
  casesDB.forEach(cs=>{
    c.innerHTML += '<div class="case-card"><div class="case-ic">'+cs.icon+'</div><div class="case-name">'+cs.name+'</div><div class="case-desc">'+cs.desc+'</div>'+
      '<button class="btn btn-gold" '+(state.coins<cs.price?'disabled':'')+' onclick="openCase(\''+cs.id+'\')">ОТКРЫТЬ ЗА '+fmt(cs.price)+' 💰</button></div>';
  });
}
function openCase(caseId){
  const cs = casesDB.find(c=>c.id===caseId);
  if(state.coins<cs.price){ showToast("Недостаточно денег"); return; }
  state.coins-=cs.price; state.stats.totalSpent+=cs.price; state.stats.casesOpened++;
  const r = Math.random();
  let resultMsg='';
  if(caseId==='bronze'){
    if(r<0.6){ const c=Math.round(cs.price*(0.5+Math.random())); state.coins+=c; resultMsg='+'+fmt(c)+' 💰'; }
    else if(r<0.9){ state.nitro+=1; resultMsg='+1 заряд нитро ⚡'; }
    else { const c=Math.round(cs.price*2.5); state.coins+=c; resultMsg='Удача! +'+fmt(c)+' 💰'; }
  } else if(caseId==='silver'){
    if(r<0.5){ const c=Math.round(cs.price*(0.6+Math.random())); state.coins+=c; resultMsg='+'+fmt(c)+' 💰'; }
    else if(r<0.85){ state.nitro+=2; resultMsg='+2 заряда нитро ⚡'; }
    else { const c=Math.round(cs.price*3); state.coins+=c; resultMsg='Крупная удача! +'+fmt(c)+' 💰'; }
  } else {
    if(r<0.45){ const c=Math.round(cs.price*(0.6+Math.random())); state.coins+=c; resultMsg='+'+fmt(c)+' 💰'; }
    else if(r<0.8){ state.nitro+=3; resultMsg='+3 заряда нитро ⚡'; }
    else if(r<0.985){ const c=Math.round(cs.price*3.5); state.coins+=c; resultMsg='Джекпот! +'+fmt(c)+' 💰'; }
    else {
      const secretIds=[26,27].filter(id=>!state.ownedCars.includes(id));
      if(secretIds.length>0){
        const id=secretIds[Math.floor(Math.random()*secretIds.length)];
        state.ownedCars.push(id);
        resultMsg='🌟 ЛЕГЕНДАРНЫЙ ДРОП! Машина "'+carsDB.find(c=>c.id===id).name+'" теперь ваша!';
      } else { const c=Math.round(cs.price*5); state.coins+=c; resultMsg='Джекпот! +'+fmt(c)+' 💰'; }
    }
  }
  showToast('🎁 '+resultMsg);
  updateHeader(); renderCases(); saveState(); checkAchievements();
}

/* ==================== LEADERBOARD ==================== */
/* ==================== LEADERBOARD — REAL PLAYERS ==================== */
async function renderLeaderboard(){
  const c=document.getElementById('lb-list');
  if(!c)return;
  c.innerHTML='<div class="empty-note">Загрузка игроков…</div>';
  if(typeof syncPlayerProfile==='function') await syncPlayerProfile();
  const rows=typeof loadPlayerLeaderboard==='function' ? await loadPlayerLeaderboard() : [];
  if(!rows.length){
    c.innerHTML='<div class="empty-note">Пока нет сохранённых профилей игроков. Запусти игру ещё раз после настройки таблицы Supabase.</div>';
    return;
  }
  c.innerHTML='';
  rows.forEach((r,i)=>{
    const races=Number(r.races)||0,wins=Number(r.wins)||0,wr=races?Math.round(wins/races*100):0;
    const owned=Array.isArray(r.owned_cars)?r.owned_cars:[];
    const carNames=owned.map(id=>carsDB.find(c=>String(c.id)===String(id))).filter(Boolean).map(c=>c.name);
    const me=String(r.id)===String(state.playerId);
    const rankCls=i===0?'top1':i===1?'top2':i===2?'top3':'';
    const row=document.createElement('div');
    row.className='lb-row '+(me?'me':'');
    row.onclick=()=>openPublicProfileData(r);
    row.innerHTML='<div class="lb-rank '+rankCls+'">#'+(i+1)+'</div>'+
      '<div class="lb-name">'+escapeHtml(r.name||'Гонщик')+(me?' <small style="color:var(--green)">ВЫ</small>':'')+
      '<small style="display:block;color:var(--text-muted);font-size:8px;">LVL '+(Number(r.level)||1)+' · '+wr+'% WR · '+carNames.length+' машин</small>'+
      '<div class="player-lb-cars">'+(carNames.slice(0,4).map(x=>'<span class="player-lb-car">'+escapeHtml(x)+'</span>').join('')+(carNames.length>4?'<span class="player-lb-car">+'+(carNames.length-4)+'</span>':''))+'</div></div>'+
      '<div class="lb-val">'+fmt(Number(r.balance)||0)+' <small>SYND</small></div>';
    c.appendChild(row);
  });
}



/* ==================== CARBON CAREER / HEAT / CONTRACTS 5.0 ==================== */
let garageSort='name',shopCategory='all',shopSort='price';
const DISTRICTS=[
  {id:'downtown',name:'Даунтаун',unlockLevel:1,target:0,next:350,desc:'Плотный трафик, короткие прямые и первые серьёзные вызовы.'},
  {id:'industrial',name:'Промзона',unlockLevel:4,target:350,next:1200,desc:'Широкие дороги, портовые развязки и быстрые машины.'},
  {id:'canyon',name:'Каньон',unlockLevel:8,target:1200,next:3000,desc:'Ошибка стоит дорого. Здесь репутация решает больше мощности.'},
  {id:'silverton',name:'Сильвертон',unlockLevel:13,target:3000,next:6000,desc:'Финальный район синдиката: боссы, высокий HEAT и большие ставки.'}
];
const CONTRACT_POOL=[
  {id:'races3',event:'race',target:3,reward:320,name:'На линии',desc:'Заверши 3 уличных заезда.'},
  {id:'wins2',event:'win',target:2,reward:450,name:'Без права на ошибку',desc:'Выиграй 2 заезда.'},
  {id:'shift4',event:'perfectShift',target:4,reward:390,name:'Идеальная КПП',desc:'Сделай 4 идеальных переключения.'},
  {id:'job2',event:'job',target:2,reward:260,name:'Запасной план',desc:'Выполни 2 подработки.'},
  {id:'nitro1',event:'nitro',target:1,reward:220,name:'На полном баллоне',desc:'Используй нитро в заезде.'},
  {id:'buy1',event:'buy',target:1,reward:300,name:'Расширение гаража',desc:'Купи одну машину.'}
];
function haptic(type='light'){
  if(!state.settings?.haptics)return;
  try{const h=window.Telegram?.WebApp?.HapticFeedback;if(!h)return;if(type==='success'||type==='error'||type==='warning')h.notificationOccurred(type);else h.impactOccurred(type==='heavy'?'heavy':type==='medium'?'medium':'light');}catch(_){ }
}
function renderGarageTools(){
  const active=carsDB.find(c=>c.id===state.activeCarId),q=document.getElementById('garage-quick-service'),tb=document.getElementById('garage-toolbar');if(!active||!q||!tb)return;
  const fuel=getFuel(active.id),cond=getCondition(active.id);
  q.innerHTML='<div class="quick-service-card" onclick="quickRefuelActive()"><span>Быстрый сервис · топливо</span><b>⛽ '+fuel+'% · до полного</b></div><div class="quick-service-card" onclick="quickRepairActive()"><span>Быстрый сервис · состояние</span><b>🔧 '+cond+'% · ремонт</b></div>';
  tb.innerHTML=['name','power','condition'].map(k=>'<button class="carbon-chip '+(garageSort===k?'active':'')+'" onclick="setGarageSort(\''+k+'\')">'+({name:'ПО НАЗВАНИЮ',power:'МОЩНОСТЬ',condition:'СОСТОЯНИЕ'}[k])+'</button>').join('');
}
function setGarageSort(v){garageSort=['name','power','condition'].includes(v)?v:'name';renderGarage();}
function quickRefuelActive(){const car=carsDB.find(c=>c.id===state.activeCarId);if(car)refuelCar(car.id);}
function quickRepairActive(){const car=carsDB.find(c=>c.id===state.activeCarId);if(car)repairCar(car.id);}
function renderShopToolbar(){
  const tb=document.getElementById('shop-toolbar');if(!tb)return;const cats=[['all','ВСЕ'],['street','STREET'],['jdm','JDM'],['muscle','MUSCLE'],['sport','SPORT'],['super','SUPER'],['hyper','HYPER'],['legend','BOSS']];
  tb.innerHTML=cats.map(([k,n])=>'<button class="carbon-chip '+(shopCategory===k?'active':'')+'" onclick="setShopCategory(\''+k+'\')">'+n+'</button>').join('')+'<button class="carbon-chip '+(shopSort==='power'?'active':'')+'" onclick="toggleShopSort()">'+(shopSort==='power'?'↓ МОЩНОСТЬ':'↑ ЦЕНА')+'</button>';
}
function setShopCategory(v){shopCategory=v;renderShop();}function toggleShopSort(){shopSort=shopSort==='price'?'power':'price';renderShop();}
function addHeat(n=1){state.heat=Math.max(0,Math.min(5,(Number(state.heat)||0)+n));}
function reduceHeat(n=1){state.heat=Math.max(0,(Number(state.heat)||0)-n);}
function heatLabel(){return ['ЧИСТО','ЗАМЕЧЕН','В РОЗЫСКЕ','ГОРЯЧО','ОБЛАВА','МАКС. РОЗЫСК'][state.heat]||'ЧИСТО';}
function renderHeatStrip(id){const el=document.getElementById(id);if(!el)return;el.innerHTML='<div class="heat-head"><span>POLICE HEAT · '+heatLabel()+'</span><b>'+state.heat+'/5</b></div><div class="heat-bars">'+[1,2,3,4,5].map(i=>'<i class="'+(i<=state.heat?'on':'')+'"></i>').join('')+'</div>';}
function dayKeyLocal(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function hashDay(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function getActiveContracts(){const day=dayKeyLocal(),seed=hashDay(day);return CONTRACT_POOL.slice().sort((a,b)=>((hashDay(a.id)^seed)-(hashDay(b.id)^seed))).slice(0,3);}
function ensureContracts(){const day=dayKeyLocal();if(state.contracts?.day!==day)state.contracts={day,items:{}};if(!state.contracts.items||typeof state.contracts.items!=='object')state.contracts.items={};}
function contractStatus(c){ensureContracts();const row=state.contracts.items[c.id]||{};const progress=Math.min(c.target,Math.max(0,Number(row.progress)||0));return{progress,done:progress>=c.target,claimed:row.claimed===true};}
function recordContractEvent(event,amount=1){ensureContracts();let changed=false;getActiveContracts().filter(c=>c.event===event).forEach(c=>{const row=state.contracts.items[c.id]||{progress:0,claimed:false};if(row.claimed)return;row.progress=Math.min(c.target,(Number(row.progress)||0)+Math.max(0,Number(amount)||0));state.contracts.items[c.id]=row;changed=true;});if(changed)saveState();}
function renderContracts(){ensureContracts();const c=document.getElementById('contract-list');if(!c)return;const now=new Date(),next=new Date(now);next.setHours(24,0,0,0);document.getElementById('contract-reset-label').innerText='Сброс через '+Math.max(1,Math.ceil((next-now)/3600000))+' ч';c.innerHTML='';getActiveContracts().forEach(x=>{const st=contractStatus(x),pct=Math.round(st.progress/x.target*100);c.innerHTML+='<div class="contract-card"><div class="contract-top"><div class="contract-name">'+x.name+'</div><div class="contract-reward">+'+fmt(x.reward)+' SYND</div></div><div class="contract-desc">'+x.desc+'</div><div class="contract-progress"><i style="width:'+pct+'%"></i></div><div class="contract-foot"><span>'+st.progress+' / '+x.target+'</span><span>'+(st.claimed?'ПОЛУЧЕНО':st.done?'ГОТОВО':'В ПРОЦЕССЕ')+'</span></div>'+(st.done&&!st.claimed?'<button class="btn btn-select" style="margin-top:9px;" onclick="claimContract(\''+x.id+'\')">ЗАБРАТЬ НАГРАДУ</button>':'')+'</div>';});}
function claimContract(id){ensureContracts();const c=getActiveContracts().find(x=>x.id===id);if(!c)return;const st=contractStatus(c);if(!st.done||st.claimed)return;state.contracts.items[id].claimed=true;awardMoney(c.reward,'КОНТРАКТ · '+c.name);haptic('success');saveState();renderContracts();}
function currentDistrict(){let d=DISTRICTS[0];for(const x of DISTRICTS)if(state.level>=x.unlockLevel)d=x;return d;}
function recordCareerRace(won,opp){recordContractEvent('race',1);if(won){recordContractEvent('win',1);const gain=Math.max(18,Math.min(180,Math.round((Number(opp?.power)||200)/8)));state.districtRep=(state.districtRep||0)+gain;const d=currentDistrict();state.districtWins[d.id]=(Number(state.districtWins[d.id])||0)+1;addHeat(1);}else if(state.heat>0&&Math.random()<.28)reduceHeat(1);saveState();}
function renderDistricts(){renderHeatStrip('district-heat');const c=document.getElementById('district-grid');if(!c)return;document.getElementById('district-rep-label').innerText=fmt(state.districtRep)+' REP';c.innerHTML='';DISTRICTS.forEach(d=>{const locked=state.level<d.unlockLevel,pct=d.next<=d.target?100:Math.max(0,Math.min(100,(state.districtRep-d.target)/(d.next-d.target)*100));const wins=Number(state.districtWins[d.id])||0;c.innerHTML+='<div class="district-card '+(locked?'locked':'')+'"><div class="district-kicker">'+(locked?'LOCKED · LVL '+d.unlockLevel:'TERRITORY // '+d.id.toUpperCase())+'</div><h3>'+d.name+'</h3><div class="district-desc">'+d.desc+'</div><div class="district-progress"><i style="width:'+pct+'%"></i></div><div class="district-meta"><span>'+Math.round(pct)+'% КОНТРОЛЯ</span><span>'+wins+' ПОБЕД</span></div></div>';});}
function recordRaceTelemetry(payload){if(!payload)return;state.recentRaces=Array.isArray(state.recentRaces)?state.recentRaces:[];state.recentRaces.push(payload);state.recentRaces=state.recentRaces.slice(-12);}
function renderRecentRaceSummary(){const root=document.getElementById('recent-race-summary');if(!root)return;const r=state.recentRaces?.[state.recentRaces.length-1];if(!r){root.innerHTML='';return;}root.innerHTML='<div class="contract-card"><div class="contract-top"><div class="contract-name">Последний заезд · '+escapeHtml(r.route)+'</div><div class="contract-reward" style="color:'+(r.won?'var(--green)':'var(--danger)')+'">'+(r.won?'ПОБЕДА':'ПОРАЖЕНИЕ')+'</div></div><div class="contract-desc">'+escapeHtml(r.opponent)+' · '+Number(r.time).toFixed(2)+' c · '+Math.round(r.topSpeed)+' км/ч · идеальных SHIFT: '+r.perfectShifts+(r.nitroUsed?' · NITRO':'')+'</div></div>';}
/* ==================== SETTINGS ==================== */
function renderSettings(){
  const map={sound:'set-sound',animations:'set-anim',haptics:'set-haptics',reducedMotion:'set-reduced-motion',compactHud:'set-compact-hud'};
  Object.entries(map).forEach(([key,id])=>document.getElementById(id)?.classList.toggle('on',!!state.settings[key]));
  const el=document.getElementById('last-saved-text');if(el)el.innerText=state.lastSaved?new Date(state.lastSaved).toLocaleTimeString('ru-RU'):'—';
}
function toggleSetting(key){
  if(!(key in state.settings))return;state.settings[key]=!state.settings[key];applyUiSettings();haptic('light');renderSettings();saveState();
}

/* ==================== DAILY REWARD ==================== */
const DAILY_REWARDS = [150,200,300,400,600,800,1200];
function checkDailyEligible(){
  const now=Date.now();
  const hours = (now-state.lastDailyClaim)/3600000;
  return state.lastDailyClaim===0 || hours>=20;
}
function openDailyModal(force){
  if(!force && !checkDailyEligible()) return;
  const now=Date.now();
  const hours = (now-state.lastDailyClaim)/3600000;
  const eligible = state.lastDailyClaim===0 || hours>=20;
  const missedStreak = state.lastDailyClaim!==0 && hours>48;
  const dayIndex = missedStreak ? 0 : (state.dailyStreak % 7);
  let strip='';
  for(let i=0;i<7;i++){
    const claimed = i<dayIndex;
    const today = i===dayIndex;
    strip += '<div class="daily-day '+(claimed?'claimed':'')+' '+(today?'today':'')+'">Д'+(i+1)+'<br>'+DAILY_REWARDS[i]+'</div>';
  }
  const root=document.getElementById('daily-modal-root');
  root.innerHTML = '<div class="modal-overlay" id="daily-overlay"><div class="modal-box">'+
    '<div style="font-size:40px;">📅</div>'+
    '<div style="font-size:17px;font-weight:900;margin:8px 0;">Ежедневная награда</div>'+
    '<div style="color:var(--text-muted);font-size:12px;font-weight:700;">День '+(dayIndex+1)+' из 7</div>'+
    '<div class="daily-strip">'+strip+'</div>'+
    (eligible ? '<button class="btn btn-gold" onclick="claimDaily('+dayIndex+')">ЗАБРАТЬ +'+fmt(DAILY_REWARDS[dayIndex])+' 💰</button>'
              : '<div style="color:var(--text-muted);font-size:12px;font-weight:700;margin-bottom:8px;">Уже забрано сегодня — заходи позже</div>')+
    '<button class="btn btn-ghost" style="margin-top:8px;" onclick="closeDailyModal()">Закрыть</button>'+
  '</div></div>';
}
function claimDaily(dayIndex){
  const now=Date.now();
  const hours = (now-state.lastDailyClaim)/3600000;
  const missedStreak = state.lastDailyClaim!==0 && hours>48;
  state.dailyStreak = missedStreak ? 1 : state.dailyStreak+1;
  awardMoney(DAILY_REWARDS[dayIndex],'ЕЖЕДНЕВНАЯ НАГРАДА');
  state.lastDailyClaim = now;
  showToast('📅 Награда дня: +'+fmt(DAILY_REWARDS[dayIndex])+' 💰');
  updateHeader(); closeDailyModal(); saveState(); checkAchievements();
  const sub=document.getElementById('daily-hub-sub'); if(sub) sub.innerText='Уже забрано';
}
function closeDailyModal(){ document.getElementById('daily-modal-root').innerHTML=''; }

/* ==================== PROFILE ==================== */
function renderProfile(){
  updateHeader();updateAvatarUI();ensureContracts();
  document.getElementById('profile-name').innerText=state.playerName;document.getElementById('profile-lvl').innerText=state.level;document.getElementById('p-balance').innerText=fmt(state.coins);document.getElementById('p-cars').innerText=state.ownedCars.length;document.getElementById('p-races').innerText=state.stats.races;
  const wr=state.stats.races>0?Math.round(state.stats.wins/state.stats.races*100):0;document.getElementById('p-winrate').innerText=wr+'%';document.getElementById('p-wins').innerText=state.stats.wins;document.getElementById('p-losses').innerText=state.stats.losses;document.getElementById('p-earned').innerText=fmt(state.stats.totalEarned);document.getElementById('p-fines').innerText=state.stats.finesCount;
  const need=xpNeeded(state.level);document.getElementById('xp-text').innerText=state.xp+'/'+need;document.getElementById('xp-fill').style.width=Math.round(state.xp/need*100)+'%';document.getElementById('ach-progress-sub').innerText=Object.keys(state.achievements).length+'/'+achievementsDB.length;document.getElementById('hub-nitro-count').innerText=state.nitro;document.getElementById('daily-hub-sub').innerText=checkDailyEligible()?'Забрать!':'Уже забрано';
  const activeContracts=getActiveContracts(),done=activeContracts.filter(c=>contractStatus(c).done).length;document.getElementById('contract-progress-sub').innerText=done+'/'+activeContracts.length+' выполнено';document.getElementById('district-progress-sub').innerText=fmt(state.districtRep)+' REP';
  renderHeatStrip('profile-heat'); renderRecentRaceSummary();
  const licBox=document.getElementById('license-status-box');if(licBox){
    if(state.licenseSuspended)licBox.innerHTML='<div class="pre-race-line"><span>🚫 Водительские права изъяты</span></div><div class="empty-note" style="padding:4px 0 10px;text-align:left;">Заезды недоступны, пока не восстановишь права.</div><button class="big-btn" onclick="buyBackLicense()">ВОССТАНОВИТЬ · '+fmt(licensePrice())+' SYND</button>';
    else licBox.innerHTML='<div class="pre-race-line"><span>✅ Права в порядке</span><b style="color:var(--green)">ДОПУСК К ЗАЕЗДАМ</b></div>';
  }
}


/* ==================== ECONOMY / PUBLIC PROFILES 3.0 ==================== */
function awardMoney(amount, reason){
  amount=Math.max(0,Math.round(amount));
  if(!amount) return;
  state.coins+=amount; state.stats.totalEarned+=amount;
  updateHeader();
  const root=document.getElementById('money-modal-root');
  if(root && state.settings.animations){
    root.innerHTML='<div class="money-burst"><div class="money-burst-card"><div class="money-symbol">₳</div><div class="money-amount">+'+fmt(amount)+'</div><div class="money-label">SYNDICATE CREDIT · '+escapeHtml(reason||'НАГРАДА')+'</div></div></div>';
    setTimeout(()=>{ if(root) root.innerHTML=''; },900);
    for(let i=0;i<7;i++){
      const el=document.createElement('div'); el.className='money-fly'; el.innerText='₳ '+fmt(Math.max(1,Math.round(amount/7)));
      el.style.left=(40+Math.random()*20)+'%'; el.style.top=(42+Math.random()*10)+'%';
      el.style.setProperty('--dx',(Math.random()*180-90)+'px'); el.style.setProperty('--dy',(-80-Math.random()*100)+'px');
      document.body.appendChild(el); setTimeout(()=>el.remove(),1100);
    }
  }
}
function openPublicProfile(name,val,wins,races,cars,profile){
  const root=document.getElementById('public-profile-root'); if(!root)return;
  const wr=races?Math.round(wins/races*100):0;
  const list=Array.isArray(cars)?cars:[].concat(cars||[]).filter(Boolean);
  const ownedHtml=list.length ? list.map(x=>'<span class="player-lb-car">'+escapeHtml(x)+'</span>').join('') : '<span style="color:var(--text-muted);font-size:10px;">Нет данных</span>';
  const balance=profile ? Number(profile.balance)||0 : Number(val)||0;
  const level=profile ? Number(profile.level)||1 : 1;
  root.innerHTML='<div class="modal-overlay" onclick="if(event.target===this)closePublicProfile()"><div class="public-profile">'+
    '<div class="pp-head"><div class="public-avatar">'+escapeHtml((name||'Г').charAt(0).toUpperCase())+'</div><div><div style="font-size:18px;font-weight:1000;">'+escapeHtml(name)+'</div><div style="color:var(--text-muted);font-size:10px;font-weight:900;">УРОВЕНЬ '+level+' · УЧАСТНИК СИНДИКАТА</div></div></div>'+
    '<div class="pp-grid"><div class="pp-stat"><span>Баланс</span><b>'+fmt(balance)+' SYND</b></div><div class="pp-stat"><span>Заработано</span><b>'+fmt(val)+' SYND</b></div><div class="pp-stat"><span>Победы</span><b>'+wins+'</b></div><div class="pp-stat"><span>Заезды</span><b>'+races+'</b></div><div class="pp-stat"><span>Win rate</span><b>'+wr+'%</b></div></div>'+
    '<div class="pp-stat" style="margin-top:8px;"><span>Машины игрока</span><div class="player-lb-cars" style="margin-top:8px;">'+ownedHtml+'</div></div>'+
    '<button class="btn btn-ghost" style="margin-top:12px;" onclick="closePublicProfile()">ЗАКРЫТЬ</button></div></div>';
}
function openPublicProfileData(p){
  const owned=Array.isArray(p.owned_cars)?p.owned_cars:[];
  const cars=owned.map(id=>carsDB.find(c=>String(c.id)===String(id))).filter(Boolean);
  openPublicProfile(p.name,p.total_earned||0,p.wins||0,p.races||0,cars.map(c=>c.name),p);
}

function closePublicProfile(){const r=document.getElementById('public-profile-root');if(r)r.innerHTML='';}
