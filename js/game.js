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
  if(leveled){ showToast("⭐ Новый уровень! Теперь LVL "+state.level); state.coins += state.level*50; }
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
  state.logoTaps++;
  if(state.logoTaps===5){
    state.logoTaps=0;
    state.coins+=250;
    state.nitro+=1;
    showToast("🎁 Секретный бонус синдиката: +250 💰 и 1 нитро");
    updateHeader(); saveState();
    checkAchievements();
  }
}

/* ==================== NAV ==================== */
const TAB_MAP = {garage:0,shop:1,'duel-select':2,casino:3,profile:4};
function switchTab(tabId){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const target = document.getElementById('screen-'+tabId);
  if(target) target.classList.add('active');
  const buttons=document.querySelectorAll('.nav-btn');
  if(TAB_MAP[tabId]!==undefined) buttons[TAB_MAP[tabId]].classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;

  if(tabId==='garage') renderGarage();
  if(tabId==='shop') renderShop();
  if(tabId==='duel-select') renderOpponents();
  if(tabId==='jobs') renderJobs();
  if(tabId==='profile') renderProfile();
  if(tabId==='casino') renderCasinoHub();
  if(tabId==='achievements') renderAchievements();
  if(tabId==='cases') renderCases();
  if(tabId==='leaderboard') renderLeaderboard();
  if(tabId==='settings') renderSettings();
  if(tabId==='market') openMarket();
  if(tabId==='chat') openChat();
  if(tabId==='bank') openBank();
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
  document.getElementById('coins-display').innerText=fmt(state.coins);
  document.getElementById('lvl-display').innerText=state.level;
}

/* ==================== GARAGE / SHOP ==================== */
function renderGarage(){
  updateHeader();
  const container=document.getElementById('garage-list');
  document.getElementById('garage-count').innerText = state.ownedCars.length + " машин";
  container.innerHTML='';
  const myCars=carsDB.filter(c=>state.ownedCars.includes(c.id));
  myCars.forEach(car=>{
    const isActive=state.activeCarId===car.id;
    const eff=getEffectivePower(car);
    const fuel=getFuel(car.id), cond=getCondition(car.id);
    container.innerHTML += '<div class="car-card" style="'+(isActive?'border-color:var(--accent);':'')+'">'+
        '<div class="car-thumb" onclick="openDetail('+car.id+')">'+carArtSVG(car)+
          '<div class="tier-badge">'+car.tier+'</div>'+
          '<div class="power-badge">'+eff+' л.с.</div>'+
        '</div>'+
        '<div class="car-info-box">'+
          '<div class="car-title">'+car.name+'</div>'+
          '<div class="car-stats"><div>Статус: <span style="color:'+(isActive?'var(--accent)':'var(--green)')+'">'+(isActive?'Активна':'В гараже')+'</span></div>'+
          '<div>⛽ <span style="color:'+(fuel<25?'var(--accent)':'#fff')+'">'+fuel+'%</span></div>'+
          '<div>🔧 <span style="color:'+(cond<40?'var(--accent)':'#fff')+'">'+cond+'%</span></div></div>'+
          '<div class="btn-row">'+
            (!isActive ? '<button class="btn btn-select" onclick="selectCar('+car.id+')">ВЫБРАТЬ</button>' : '<button class="btn btn-select selected-mark" disabled>АКТИВНА</button>')+
            '<button class="btn btn-ghost" onclick="openDetail('+car.id+')">КАРТОЧКА</button>'+
          '</div>'+
        '</div></div>';
  });
}

function renderShop(){
  updateHeader();
  const container=document.getElementById('shop-list');
  container.innerHTML='';
  carsDB.forEach(car=>{
    const isOwned=state.ownedCars.includes(car.id);
    const canAfford=state.coins>=car.price;
    container.innerHTML += '<div class="car-card">'+
        '<div class="car-thumb" onclick="openDetail('+car.id+')">'+carArtSVG(car)+
          '<div class="tier-badge">'+car.tier+'</div>'+
          '<div class="power-badge">'+car.power+' л.с.</div>'+
        '</div>'+
        '<div class="car-info-box">'+
          '<div class="car-title">'+car.name+'</div>'+
          '<div class="car-stats"><span>'+CAT_LABELS[car.cat]+'</span><span>'+(car.price===0?'Стартовая':fmt(car.price)+' 💰')+'</span></div>'+
          '<div class="btn-row">'+
            (isOwned ? '<button class="btn btn-buy" disabled>В ГАРАЖЕ</button>' : '<button class="btn btn-buy" '+(canAfford?'':'disabled')+' onclick="buyCar('+car.id+')">КУПИТЬ</button>')+
            '<button class="btn btn-ghost" onclick="openDetail('+car.id+')">КАРТОЧКА</button>'+
          '</div>'+
        '</div></div>';
  });
}
function buyCar(carId){
  const car=carsDB.find(c=>c.id===carId);
  if(state.ownedCars.includes(carId)) return;
  if(state.coins<car.price){ showToast("Недостаточно денег"); return; }
  state.coins-=car.price; state.stats.totalSpent+=car.price;
  state.ownedCars.push(carId);
  getFuel(carId); getCondition(carId); getUpg(carId);
  showToast("🚗 Куплено: "+car.name);
  updateHeader(); renderShop(); saveState();
  checkAchievements();
}
function selectCar(carId){
  state.activeCarId=carId;
  showToast("✅ Активная машина изменена");
  renderGarage(); saveState();
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
  const car = carsDB.find(c=>c.id===state.activeCarId);
  const myPower = car ? getEffectivePower(car) : 0;
  const list = state.duelSub==='tour' ? tournamentsDB : opponentsDB;
  if(!car){ container.innerHTML='<div class="no-car-msg">Сначала выберите активную машину в гараже.</div>'; return; }
  list.forEach(opp=>{
    const unlocked = state.level>=opp.unlockLevel;
    if(!unlocked){
      container.innerHTML += '<div class="opp-card" style="opacity:.55;">'+
        '<div class="opp-head"><span class="opp-name">🔒 ???</span><span class="opp-power">Требуется LVL '+opp.unlockLevel+'</span></div>'+
        '<div class="locked-tag">Заблокировано</div></div>';
      return;
    }
    const winChance = Math.max(5, Math.min(95, Math.round(50 + (myPower-opp.power)/opp.power*100)));
    const fee = entryFeeFor(opp);
    container.innerHTML += '<div class="opp-card '+(opp.boss?'boss':'')+'">'+
      '<div class="opp-head"><span class="opp-name">'+(opp.boss?'👑 ':'')+opp.name+'</span><span class="opp-power">'+opp.power+' л.с.</span></div>'+
      (opp.boss?'<div class="boss-badge" style="position:static;display:inline-block;width:fit-content;">БОСС</div>':'')+
      '<div style="font-size:11.5px;color:var(--text-muted);font-style:italic;">'+opp.taunt+'</div>'+
      '<div class="odds-bar-bg"><div class="odds-win" style="width:'+winChance+'%"></div><div class="odds-lose" style="width:'+(100-winChance)+'%"></div></div>'+
      '<div class="opp-foot"><span>Шанс победы: <b style="color:var(--green)">'+winChance+'%</b></span><span>Вход: <b>-'+fmt(fee)+'</b></span><span>Приз: <b>+'+fmt(opp.reward)+'</b></span></div>'+
      '<button class="btn btn-select" onclick="prepareRace(\''+opp.id+'\', \''+(state.duelSub==='tour'?'tour':'normal')+'\')">К СТАРТУ</button>'+
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
  const job=jobsDB.find(j=>j.id===jobId);
  const now=Date.now();
  const readyAt=state.jobCooldowns[jobId]||0;
  if(now<readyAt) return;
  state.coins+=job.reward;
  state.stats.totalEarned+=job.reward;
  addXP(job.xp||5);
  state.jobCooldowns[jobId]=now+job.cooldown*1000;
  showToast("💼 "+job.name+": +"+fmt(job.reward)+" 💰");
  updateHeader();
  renderJobs();
  saveState();
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
  if(!rltSelection){ showToast("Выберите ставку: число, цвет или диапазон"); return; }
  const bet = clampBet(document.getElementById('rlt-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();
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
    updateHeader(); saveState(); checkAchievements();
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
  const bet = clampBet(document.getElementById('slots-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();
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
      updateHeader(); saveState(); checkAchievements();
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
  const bet = clampBet(document.getElementById('dice-bet-input'),10);
  if(bet>state.coins || bet<10){ showToast("Некорректная ставка"); return; }
  const target = parseInt(document.getElementById('dice-slider').value);
  state.coins-=bet; state.stats.casinoWagered+=bet; updateHeader();
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
    updateHeader(); saveState(); checkAchievements();
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
  { id:'bj_win', name:'Карточный игрок', desc:'Выиграй раунд в блэкджек', icon:'🃏', reward:150, check:s=>s.stats.casinoWon>0 && document.getElementById('bj-message') },
  { id:'max_tune', name:'Гараж мечты', desc:'Прокачай тюнинг любой машины до максимума во всех категориях', icon:'🔧', reward:800, check:s=>Object.values(s.upgrades).some(u=>u && TUNE_TYPES.every(t=>u[t.key]>=t.hpPerStage.length)) },
  { id:'earn50k', name:'Барон подполья', desc:'Заработай суммарно 50 000 💰', icon:'💰', reward:1000, check:s=>s.stats.totalEarned>=50000 },
  { id:'daily7', name:'Верный синдикату', desc:'Забирай ежедневную награду 7 дней подряд', icon:'📅', reward:700, check:s=>s.dailyStreak>=7 },
  { id:'secret_car', name:'Тень подполья', desc:'Стань владельцем мифической машины', icon:'👻', reward:1500, check:s=>s.ownedCars.includes(26)||s.ownedCars.includes(27) },
  { id:'boss_slayer', name:'Убийца боссов', desc:'Победи одного из боссов подполья', icon:'👑', reward:2000, check:s=>s.stats.wins>0 && s.level>=11 }
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
const LB_BOTS = [
  {name:'Барон трассы Вадим', val:184000},{name:'Легенда подполья Дариан', val:142500},
  {name:'Финалист «Полночь»', val:98700},{name:'Августина', val:61200},
  {name:'Тень', val:45300},{name:'Толян с раёна', val:22100},
  {name:'Ночной Гонщик Феникс', val:15400},{name:'Дворовый Стас', val:6200}
];
function renderLeaderboard(){
  const c=document.getElementById('lb-list');
  const rows = LB_BOTS.map(b=>({name:b.name, val:b.val, me:false}));
  rows.push({name: state.playerName+' (вы)', val: state.stats.totalEarned, me:true});
  rows.sort((a,b)=>b.val-a.val);
  c.innerHTML='';
  rows.forEach((r,i)=>{
    const rankCls = i===0?'top1':i===1?'top2':i===2?'top3':'';
    c.innerHTML += '<div class="lb-row '+(r.me?'me':'')+'"><div class="lb-rank '+rankCls+'">#'+(i+1)+'</div><div class="lb-name">'+r.name+'</div><div class="lb-val">'+fmt(r.val)+' 💰</div></div>';
  });
}

/* ==================== SETTINGS ==================== */
function renderSettings(){
  document.getElementById('set-sound').classList.toggle('on', state.settings.sound);
  document.getElementById('set-anim').classList.toggle('on', state.settings.animations);
  const el = document.getElementById('last-saved-text');
  if(el) el.innerText = state.lastSaved ? new Date(state.lastSaved).toLocaleTimeString('ru-RU') : '—';
}
function toggleSetting(key){
  state.settings[key] = !state.settings[key];
  renderSettings(); saveState();
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
  state.coins += DAILY_REWARDS[dayIndex];
  state.lastDailyClaim = now;
  showToast('📅 Награда дня: +'+fmt(DAILY_REWARDS[dayIndex])+' 💰');
  updateHeader(); closeDailyModal(); saveState(); checkAchievements();
  const sub=document.getElementById('daily-hub-sub'); if(sub) sub.innerText='Уже забрано';
}
function closeDailyModal(){ document.getElementById('daily-modal-root').innerHTML=''; }

/* ==================== PROFILE ==================== */
function renderProfile(){
  updateHeader();
  updateAvatarUI();
  document.getElementById('profile-name').innerText = state.playerName;
  document.getElementById('profile-lvl').innerText = state.level;
  document.getElementById('p-balance').innerText = fmt(state.coins);
  document.getElementById('p-cars').innerText = state.ownedCars.length;
  document.getElementById('p-races').innerText = state.stats.races;
  const wr = state.stats.races>0 ? Math.round(state.stats.wins/state.stats.races*100) : 0;
  document.getElementById('p-winrate').innerText = wr+"%";
  document.getElementById('p-wins').innerText = state.stats.wins;
  document.getElementById('p-losses').innerText = state.stats.losses;
  document.getElementById('p-earned').innerText = fmt(state.stats.totalEarned);
  document.getElementById('p-fines').innerText = state.stats.finesCount;
  const need = xpNeeded(state.level);
  document.getElementById('xp-text').innerText = state.xp+'/'+need;
  document.getElementById('xp-fill').style.width = Math.round(state.xp/need*100)+'%';
  document.getElementById('ach-progress-sub').innerText = Object.keys(state.achievements).length+'/'+achievementsDB.length;
  document.getElementById('hub-nitro-count').innerText = state.nitro;
  document.getElementById('daily-hub-sub').innerText = checkDailyEligible() ? 'Забрать!' : 'Уже забрано';
  const licBox = document.getElementById('license-status-box');
  if(licBox){
    if(state.licenseSuspended){
      licBox.innerHTML = '<div class="pre-race-line"><span>🚫 Водительские права изъяты</span></div>'+
        '<div class="empty-note" style="padding:4px 0 10px;text-align:left;">Заезды недоступны, пока не выкупишь права обратно.</div>'+
        '<button class="big-btn" onclick="buyBackLicense()">Выкупить права за '+fmt(licensePrice())+' 💰</button>';
    } else {
      licBox.innerHTML = '<div class="pre-race-line"><span>✅ Права в порядке</span><b style="color:var(--green)">Можно гонять</b></div>';
    }
  }
}

