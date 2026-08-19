/* ==================== ЗАЕЗД 2.0 (реакция + переключения + случайные события) ==================== */
let raceCtx = null;
const GEAR_LABELS = ['N','1','2','3','4','5'];

function prepareRace(target, mode){
  let opp;
  if(mode==='pvp'){
    opp = { id: target.id, name: (target.challenger_name||'Игрок')+' 🎮', power: target.power,
      reward: target.stake*2, pvp:true, stake: target.stake, row: target };
  } else {
    const list = mode==='tour' ? tournamentsDB : opponentsDB;
    opp = list.find(o=>String(o.id)===String(target));
  }
  const car = carsDB.find(c=>c.id===state.activeCarId);
  if(!car || !opp) return;

  if(state.licenseSuspended){
    showToast('🚫 Права изъяты — заезды недоступны, пока не восстановишь права');
    switchTab('duel-select');
    return;
  }

  const fee = opp.pvp ? opp.stake : entryFeeFor(opp);
  const fuelCost = opp.pvp ? 18 : fuelCostFor(opp);
  const fuel = getFuel(car.id);
  raceCtx = { opp, mode, fee, fuelCost, useNitro:false };

  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-race').classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
  const canAfford = state.coins>=fee;
  const enoughFuel = fuel>=fuelCost;
  const el=document.getElementById('race-content');
  el.innerHTML = '<div class="pre-race-box">'+
    '<div class="vs-banner">'+car.name+' <b>VS</b> '+opp.name+'</div>'+
    '<div class="pre-race-line"><span>'+(opp.pvp?'Ставка (твоя доля)':'Вход в заезд')+'</span><b>'+fmt(fee)+' 💰</b></div>'+
    '<div class="pre-race-line"><span>Расход топлива</span><b>'+fuelCost+'% (у вас '+fuel+'%)</b></div>'+
    '<div class="pre-race-line"><span>Награда за победу</span><b style="color:var(--gold)">+'+fmt(opp.reward)+' 💰</b></div>'+
    (state.winStreak>1?'<div class="pre-race-line"><span>🔥 Серия побед</span><b style="color:var(--accent)">x'+state.winStreak+' (+'+Math.min(25,state.winStreak*5)+'% к награде)</b></div>':'')+
    '<div class="nitro-toggle" id="nitro-toggle" onclick="toggleNitroUse()"><div class="n-left">⚡ Нитро (заряды: '+state.nitro+')</div><div class="switch" id="nitro-switch"><div class="knob"></div></div></div>'+
    '</div>'+
    '<button class="big-btn" style="margin-top:14px;" '+(canAfford&&enoughFuel?'':'disabled')+' onclick="startRace()">'+(canAfford?(enoughFuel?'СТАРТ':'НЕДОСТАТОЧНО ТОПЛИВА'):'НЕДОСТАТОЧНО ДЕНЕГ')+'</button>'+
    '<button class="btn btn-ghost" style="margin-top:8px;" onclick="switchTab(\'duel-select\')">Отмена</button>';
}
function toggleNitroUse(){
  if(state.nitro<=0){ showToast("Нет зарядов нитро"); return; }
  raceCtx.useNitro=!raceCtx.useNitro;
  document.getElementById('nitro-toggle').classList.toggle('on', raceCtx.useNitro);
  document.getElementById('nitro-switch').classList.toggle('on', raceCtx.useNitro);
}
function startRace(){
  const car=carsDB.find(c=>c.id===state.activeCarId);
  const opp = raceCtx.opp;
  state.coins -= raceCtx.fee; state.stats.totalSpent += raceCtx.fee;
  state.fuel[car.id] = Math.max(0, getFuel(car.id)-raceCtx.fuelCost);
  if(raceCtx.useNitro){ state.nitro--; }
  updateHeader();

  const myPower = getEffectivePower(car);
  let winChance = Math.max(5, Math.min(95, Math.round(50 + (myPower-opp.power)/opp.power*100)));
  if(raceCtx.useNitro) winChance = Math.min(97, winChance+8);
  raceCtx.winChance = winChance;
  raceCtx.skillScore = 0;
  raceCtx.perfectRun = true;
  raceCtx.riskChoice = false;
  raceCtx.speed = 0;
  raceCtx.maxSpeed = Math.round(140 + myPower/4);

  const el=document.getElementById('race-content');
  el.innerHTML = '<div class="countdown-box" id="countdown">3</div>';
  let n=3;
  const cd = setInterval(()=>{
    n--;
    const cdEl=document.getElementById('countdown');
    if(!cdEl){ clearInterval(cd); return; }
    if(n>0){ cdEl.innerText=n; }
    else if(n===0){ cdEl.innerText='GO!'; }
    else { clearInterval(cd); showReactionStart(); }
  },600);
}
function cockpitHTML(){
  return '<div class="cockpit">'+
    '<div class="gauge-box"><div class="gauge-label">Тахометр</div><div class="gauge-readout" id="tacho-readout"><span id="tacho-num">10</span><span class="unit">×100 об/мин</span></div><div class="gear-indicator" id="gear-indicator">'+GEAR_LABELS[0]+'</div></div>'+
    '<div class="gauge-box"><div class="gauge-label">Спидометр</div><div class="gauge-readout"><span id="speedo-num">0</span><span class="unit">км/ч</span></div></div>'+
  '</div>';
}
function updateSpeedoDisplay(){
  const el=document.getElementById('speedo-num'); if(el) el.innerText=Math.round(raceCtx.speed);
}

/* ---- Раунд 1: реакция на старте ---- */
function showReactionStart(){
  const el=document.getElementById('race-content');
  el.innerHTML = cockpitHTML()+
    '<div class="shift-panel">'+
    '<div class="shift-title">СТАРТОВЫЕ ОГНИ</div>'+
    '<div class="lights-row" id="lights-row">'+
      '<div class="light" id="light-0"></div><div class="light" id="light-1"></div><div class="light" id="light-2"></div>'+
    '</div>'+
    '<button class="big-btn" id="react-btn" onclick="hitReaction()">СТАРТ!</button>'+
    '<div class="shift-feedback" id="shift-feedback"></div>'+
  '</div>';
  raceCtx.reactArmed=false;
  raceCtx.reactFalseStart=false;
  let lit=0;
  const seq=setInterval(()=>{
    if(lit<3){ const l=document.getElementById('light-'+lit); if(l) l.classList.add('on'); lit++; }
    else{
      clearInterval(seq);
      const delay=600+Math.random()*1400;
      raceCtx.reactTimeout=setTimeout(()=>{
        const row=document.getElementById('lights-row');
        if(row) row.classList.add('go');
        raceCtx.reactArmed=true;
        raceCtx.reactStartTs=Date.now();
      }, delay);
    }
  },380);
}
function hitReaction(){
  if(raceCtx.reactFalseStart) return;
  const btn=document.getElementById('react-btn'); if(btn) btn.disabled=true;
  const fb=document.getElementById('shift-feedback');
  if(!raceCtx.reactArmed){
    clearTimeout(raceCtx.reactTimeout);
    raceCtx.reactFalseStart=true;
    raceCtx.perfectRun=false;
    raceCtx.speed = Math.max(0, raceCtx.speed - raceCtx.maxSpeed*0.12);
    fb.innerText='ФАЛЬСТАРТ!'; fb.style.color='var(--accent)';
    setTimeout(()=>{ showShiftSequence(); }, 700);
    return;
  }
  const ms = Date.now()-raceCtx.reactStartTs;
  let quality, speedGain, points;
  if(ms<260){ quality='ИДЕАЛЬНЫЙ СТАРТ! '+ms+'мс'; speedGain=0.34; points=3; }
  else if(ms<450){ quality='ХОРОШИЙ СТАРТ '+ms+'мс'; speedGain=0.22; points=2; }
  else { quality='ВЯЛЫЙ СТАРТ '+ms+'мс'; speedGain=0.08; points=0; raceCtx.perfectRun=false; }
  raceCtx.skillScore += points;
  raceCtx.speed = Math.min(raceCtx.maxSpeed, raceCtx.speed + raceCtx.maxSpeed*speedGain);
  updateSpeedoDisplay();
  fb.innerText=quality; fb.style.color = points===3?'var(--green)':points===2?'var(--gold)':'var(--accent)';
  setTimeout(()=>{ showShiftSequence(); }, 700);
}

/* ---- Раунд 2: переключения передач (2 раунда, каждый раз разные по сложности) ---- */
function showShiftSequence(){
  const el=document.getElementById('race-content');
  raceCtx.shiftIndex=0; raceCtx.shiftTotal=2; raceCtx.shiftResults=[];
  el.innerHTML = cockpitHTML()+
    '<div class="shift-panel">'+
    '<div class="shift-title">ПЕРЕКЛЮЧЕНИЕ '+(raceCtx.shiftIndex+1)+' / '+raceCtx.shiftTotal+'</div>'+
    '<div class="shift-bar-bg"><div class="shift-zone" id="shift-zone"></div><div class="shift-marker" id="shift-marker"></div></div>'+
    '<button class="big-btn" id="shift-btn" onclick="hitShift()">ПЕРЕКЛЮЧИТЬ</button>'+
    '<div class="shift-feedback" id="shift-feedback"></div>'+
    '<div class="shift-dots" id="shift-dots"></div>'+
  '</div>';
  runShiftRound();
}
function runShiftRound(){
  // каждый раунд рандомно то узкая+быстрая зона, то широкая+медленная — для разнообразия
  const hard = Math.random()<0.5;
  const zoneWidth = hard ? (9+Math.random()*6) : (16+Math.random()*8);
  const speed = hard ? (4.2+Math.random()*1.4) : (2.2+Math.random()*1.2);
  const zoneStart = 20+Math.random()*(96-zoneWidth-20);
  const zoneEl=document.getElementById('shift-zone');
  zoneEl.style.left=zoneStart+'%'; zoneEl.style.width=zoneWidth+'%';
  raceCtx.zoneStart=zoneStart; raceCtx.zoneEnd=zoneStart+zoneWidth; raceCtx.markerSpeed=speed;
  raceCtx.markerPos=0; raceCtx.markerDir=1;
  const gearEl=document.getElementById('gear-indicator');
  if(gearEl) gearEl.innerText=GEAR_LABELS[raceCtx.shiftIndex+1];
  clearInterval(raceCtx.markerIv);
  raceCtx.markerIv = setInterval(()=>{
    const m=document.getElementById('shift-marker');
    if(!m){ clearInterval(raceCtx.markerIv); return; }
    raceCtx.markerPos += raceCtx.markerDir*raceCtx.markerSpeed;
    if(raceCtx.markerPos>=98){ raceCtx.markerPos=98; raceCtx.markerDir=-1; }
    if(raceCtx.markerPos<=0){ raceCtx.markerPos=0; raceCtx.markerDir=1; }
    m.style.left=raceCtx.markerPos+'%';
    const rpm = Math.round(10 + raceCtx.markerPos*0.72);
    const tachoNum=document.getElementById('tacho-num');
    const tachoBox=document.getElementById('tacho-readout');
    if(tachoNum){ tachoNum.innerText=rpm; }
    if(tachoBox){ tachoBox.classList.toggle('redline', raceCtx.markerPos>88); }
  },16);
}
function hitShift(){
  clearInterval(raceCtx.markerIv);
  const pos=raceCtx.markerPos;
  let quality, points, cls, speedGain;
  const mid=(raceCtx.zoneStart+raceCtx.zoneEnd)/2;
  if(pos>=raceCtx.zoneStart && pos<=raceCtx.zoneEnd){
    if(Math.abs(pos-mid)<3.5){ quality='ИДЕАЛЬНО!'; points=3; cls='p'; speedGain=0.30; }
    else { quality='ХОРОШО'; points=2; cls='g'; speedGain=0.18; }
  } else { quality='ПРОМАХ'; points=0; cls='m'; speedGain=0.05; raceCtx.perfectRun=false; }
  raceCtx.skillScore += points;
  raceCtx.shiftResults.push(cls);
  raceCtx.speed = Math.min(raceCtx.maxSpeed, raceCtx.speed + raceCtx.maxSpeed*speedGain);
  updateSpeedoDisplay();
  const fb=document.getElementById('shift-feedback');
  fb.innerText=quality;
  fb.style.color = cls==='p'?'var(--green)':cls==='g'?'var(--gold)':'var(--accent)';
  let dotsHtml='';
  raceCtx.shiftResults.forEach(c=>{ dotsHtml+='<div class="d '+c+'"></div>'; });
  document.getElementById('shift-dots').innerHTML=dotsHtml;

  raceCtx.shiftIndex++;
  document.getElementById('shift-btn').disabled=true;
  setTimeout(()=>{
    if(raceCtx.shiftIndex>=raceCtx.shiftTotal){ showRandomEvent(); }
    else{
      const titleEl=document.querySelector('.shift-title');
      if(titleEl) titleEl.innerText='ПЕРЕКЛЮЧЕНИЕ '+(raceCtx.shiftIndex+1)+' / '+raceCtx.shiftTotal;
      document.getElementById('shift-btn').disabled=false;
      runShiftRound();
    }
  }, 500);
}

/* ---- Раунд 3: случайное событие для разнообразия ---- */
function showRandomEvent(){
  const el=document.getElementById('race-content');
  const roll = Math.random();
  if(raceCtx.useNitro && roll<0.5){
    // окно нитро
    el.innerHTML = cockpitHTML()+
      '<div class="shift-panel">'+
      '<div class="shift-title">⚡ ОКНО НИТРО</div>'+
      '<div class="shift-bar-bg"><div class="shift-zone" id="shift-zone" style="left:38%;width:22%;background:rgba(56,189,248,.35);border-color:var(--blue);"></div><div class="shift-marker" id="shift-marker"></div></div>'+
      '<button class="big-btn" id="shift-btn" onclick="hitNitroWindow()">АКТИВИРОВАТЬ</button>'+
      '<div class="shift-feedback" id="shift-feedback"></div>'+
    '</div>';
    raceCtx.zoneStart=38; raceCtx.zoneEnd=60; raceCtx.markerPos=0; raceCtx.markerDir=1; raceCtx.markerSpeed=3.6;
    clearInterval(raceCtx.markerIv);
    raceCtx.markerIv=setInterval(()=>{
      const m=document.getElementById('shift-marker'); if(!m){ clearInterval(raceCtx.markerIv); return; }
      raceCtx.markerPos += raceCtx.markerDir*raceCtx.markerSpeed;
      if(raceCtx.markerPos>=98){ raceCtx.markerPos=98; raceCtx.markerDir=-1; }
      if(raceCtx.markerPos<=0){ raceCtx.markerPos=0; raceCtx.markerDir=1; }
      m.style.left=raceCtx.markerPos+'%';
    },16);
  } else if(roll<0.75){
    // радар ДПС впереди — выбор риска
    el.innerHTML = cockpitHTML()+
      '<div class="shift-panel">'+
      '<div class="shift-title">📡 РАДАР ВПЕРЕДИ</div>'+
      '<div class="shift-feedback" style="color:var(--text-muted);font-size:12px;margin-bottom:10px;">Заметил ДПС с радаром на обочине. Что делаешь?</div>'+
      '<button class="big-btn" style="margin-bottom:8px;" onclick="raceEventChoice(\'safe\')">Сбросить газ (безопасно)</button>'+
      '<button class="big-btn" style="background:var(--accent);" onclick="raceEventChoice(\'risk\')">Жать дальше (риск, +скорость)</button>'+
    '</div>';
  } else {
    // спокойный отрезок — сразу в финишную прямую
    showRaceAnimation();
  }
}
function hitNitroWindow(){
  clearInterval(raceCtx.markerIv);
  const pos=raceCtx.markerPos;
  const fb=document.getElementById('shift-feedback');
  if(pos>=raceCtx.zoneStart && pos<=raceCtx.zoneEnd){
    raceCtx.speed = Math.min(raceCtx.maxSpeed*1.15, raceCtx.speed + raceCtx.maxSpeed*0.35);
    raceCtx.skillScore += 2;
    fb.innerText='НИТРО! ОГОНЬ!'; fb.style.color='var(--blue)';
  } else {
    fb.innerText='Мимо окна нитро'; fb.style.color='var(--accent)'; raceCtx.perfectRun=false;
  }
  updateSpeedoDisplay();
  setTimeout(showRaceAnimation, 650);
}
function raceEventChoice(choice){
  if(choice==='risk'){
    raceCtx.riskChoice=true;
    raceCtx.speed = Math.min(raceCtx.maxSpeed, raceCtx.speed + raceCtx.maxSpeed*0.12);
    raceCtx.skillScore += 1;
    showToast('💨 Прижал педаль — но радар мог тебя срисовать');
  } else {
    showToast('🚗 Сбросил скорость, целее будешь');
  }
  showRaceAnimation();
}

/* ---- Финишная прямая ---- */
function showRaceAnimation(){
  const el=document.getElementById('race-content');
  el.innerHTML = cockpitHTML()+
    '<div class="progress-track">'+
    '<div class="racer-row-label"><span>ВЫ</span><span class="racer-speed" id="player-speed-label">0 км/ч</span></div>'+
    '<div class="racer-track"><div class="track-bg"></div><div class="track-fill player" id="player-fill-final" style="width:0%"></div><span class="finish-flag">🏁</span></div>'+
    '<div class="racer-row-label"><span>СОПЕРНИК</span><span class="racer-speed" id="ai-speed-label">0 км/ч</span></div>'+
    '<div class="racer-track"><div class="track-bg"></div><div class="track-fill ai" id="ai-fill-final" style="width:0%"></div><span class="finish-flag">🏁</span></div>'+
  '</div>';
  document.getElementById('gear-indicator').innerText='5';
  const aiMaxSpeed = Math.round(raceCtx.maxSpeed*(0.82+Math.random()*0.3));
  let winChance = raceCtx.winChance;
  const skillBonus = raceCtx.skillScore*1.6;
  winChance = Math.max(4, Math.min(97, winChance + skillBonus - 6));
  const playerWins = Math.random()*100 < winChance;

  let t=0;
  const iv=setInterval(()=>{
    t+=1;
    const pf=document.getElementById('player-fill-final');
    const af=document.getElementById('ai-fill-final');
    if(!pf){ clearInterval(iv); return; }
    const targetP = playerWins ? 96 : 70+Math.random()*15;
    const targetA = playerWins ? 70+Math.random()*15 : 96;
    const p = Math.min(targetP, t*6 + Math.random()*4);
    const a = Math.min(targetA, t*5.6 + Math.random()*4);
    pf.style.width=p+'%'; af.style.width=a+'%';

    const pSpeed = Math.round(raceCtx.maxSpeed*(p/100));
    const aSpeed = Math.round(aiMaxSpeed*(a/100));
    const psl=document.getElementById('player-speed-label'); if(psl) psl.innerText=pSpeed+' км/ч';
    const asl=document.getElementById('ai-speed-label'); if(asl) asl.innerText=aSpeed+' км/ч';
    const spn=document.getElementById('speedo-num'); if(spn) spn.innerText=pSpeed;
    const tn=document.getElementById('tacho-num'); if(tn) tn.innerText=Math.round(40+Math.random()*35);

    if(t>16){ clearInterval(iv); finishRace(playerWins, Math.round(winChance)); }
  },90);
}

/* ---- Итог заезда: награда, серия побед, PvP-расчёт, шанс ДПС ---- */
function finishRace(playerWins, winChance){
  const car=carsDB.find(c=>c.id===state.activeCarId);
  state.stats.races++;
  const opp = raceCtx.opp;

  const condLoss = 3 + (playerWins?0:2);
  state.condition[car.id] = Math.max(0, getCondition(car.id)-condLoss);

  let title, sub, rewardText, boxClass, xpGain, reward=0;
  if(playerWins){
    state.stats.wins++;
    state.winStreak = (state.winStreak||0)+1;
    const streakBonus = Math.min(0.25, state.winStreak*0.05);
    const perfectBonus = raceCtx.perfectRun ? Math.round(opp.reward*0.15) : 0;
    reward = Math.round((opp.reward + Math.round(raceCtx.skillScore*1.4))*(1+streakBonus)) + perfectBonus;
    state.coins += reward;
    state.stats.totalEarned += reward;
    xpGain = (opp.boss||raceCtx.mode==='tour') ? 40 : 16;
    boxClass='win'; title="🏆 ПОБЕДА!";
    sub = "Шанс на победу был "+winChance+"%."+(raceCtx.perfectRun?' Идеальный заезд без единой ошибки — бонус к награде!':'')+(state.winStreak>1?' Серия побед: x'+state.winStreak+'.':'');
    rewardText = "+"+fmt(reward)+" 💰"+(perfectBonus?' (в т.ч. +'+fmt(perfectBonus)+' за идеальный заезд)':'');
    if(opp.pvp) resolvePvpChallenge(opp.row, true, reward);
  } else {
    state.stats.losses++;
    state.winStreak = 0;
    const consolation = Math.round(opp.reward*0.05)+20;
    reward = consolation;
    state.coins += consolation;
    state.stats.totalEarned += consolation;
    xpGain = 4;
    boxClass='lose'; title="💥 ПОРАЖЕНИЕ"; sub="Соперник оказался сильнее. Прокачай тачку или найди противника послабее.";
    rewardText = "+"+fmt(consolation)+" 💰 (утешительный приз)";
    if(opp.pvp) resolvePvpChallenge(opp.row, false, 0);
  }
  addXP(xpGain);

  const el=document.getElementById('race-content');
  el.innerHTML = '<div class="result-box '+boxClass+'">'+
      '<div class="result-title">'+title+'</div>'+
      '<div class="result-sub">'+sub+'</div>'+
      '<div class="result-reward">'+rewardText+'</div>'+
      '<div class="xp-gain-box">⭐ +'+xpGain+' опыта</div>'+
    '</div>'+
    '<div class="list-container" style="margin-top:14px;" id="race-nav-buttons">'+
      '<button class="btn btn-select" onclick="switchTab(\'duel-select\')">К СПИСКУ СОПЕРНИКОВ</button>'+
      '<button class="btn btn-ghost" onclick="switchTab(\'garage\')">В ГАРАЖ</button>'+
    '</div>';
  flashResult(el, playerWins);
  updateHeader();
  saveState();
  checkAchievements();

  const policeChance = (playerWins?0.16:0.09) + (raceCtx.riskChoice?0.22:0);
  if(!opp.pvp && Math.random()<policeChance){
    setTimeout(triggerPoliceStop, 900);
  }
}

/* ==================== ДПС: ОСТАНОВКА С ВЫБОРОМ ==================== */
function triggerPoliceStop(){
  if(!state.hasLicense && state.licenseSuspended){
    // уже без прав — сразу отягчающее
  }
  const root=document.getElementById('police-modal-root');
  if(!root) return;
  const line = POLICE_LINES[Math.floor(Math.random()*POLICE_LINES.length)];
  root.innerHTML = '<div class="modal-overlay">'+
    '<div class="police-modal">'+
      '<div class="police-lights"><span></span><span></span></div>'+
      '<div class="police-title">🚓 ДПС ОСТАНОВИЛА!</div>'+
      '<div class="police-line">'+line+'</div>'+
      '<button class="big-btn police-opt negotiate" onclick="policeChoice(\'negotiate\')">🤝 Договориться</button>'+
      '<button class="big-btn police-opt pay" onclick="policeChoice(\'pay\')">💳 Заплатить штраф ('+fmt(POLICE_BASE_FINE)+' 💰)</button>'+
      '<button class="big-btn police-opt refuse" onclick="policeChoice(\'refuse\')">🙅 Отказаться / спорить</button>'+
    '</div>'+
  '</div>';
}
function closePoliceModal(){
  const root=document.getElementById('police-modal-root'); if(root) root.innerHTML='';
}
function policeChoice(choice){
  let resultHtml='';
  if(choice==='pay'){
    const fine = POLICE_BASE_FINE;
    state.coins = Math.max(0, state.coins-fine);
    state.stats.finesPaid += fine; state.stats.finesCount++;
    resultHtml = '<div class="police-line">Штраф оплачен официально. Инспектор козырнул и уехал.</div><div class="result-reward">-'+fmt(fine)+' 💰</div>';
  } else if(choice==='negotiate'){
    const success = Math.random() < 0.55;
    if(success){
      const bribe = Math.round(POLICE_BASE_FINE*0.4)+Math.round(Math.random()*80);
      state.coins = Math.max(0, state.coins-bribe);
      resultHtml = '<div class="police-line">«Ну ладно, разъезжаемся тихо-мирно.»</div><div class="result-reward">-'+fmt(bribe)+' 💰 (по-тихому)</div>';
    } else {
      const fine = Math.round(POLICE_BASE_FINE*1.8);
      state.coins = Math.max(0, state.coins-fine);
      state.stats.finesPaid += fine; state.stats.finesCount++;
      resultHtml = '<div class="police-line">«Ты ещё и договориться пытаешься? Штраф в двойном размере.»</div><div class="result-reward">-'+fmt(fine)+' 💰</div>';
    }
  } else { // refuse
    const luck = Math.random();
    if(luck<0.35){
      resultHtml = '<div class="police-line">Инспектору лень возиться с бумагами — махнул рукой, езжай.</div><div class="result-reward" style="color:var(--green)">Отделался без потерь</div>';
    } else {
      state.hasLicense=false; state.licenseSuspended=true; state.licenseSuspendCount=(state.licenseSuspendCount||0)+1;
      resultHtml = '<div class="police-line">«Не хочешь по-хорошему — прав лишу.» Права изъяты.</div><div class="result-reward">🚫 Права изъяты. Выкупить: '+fmt(licensePrice())+' 💰</div>';
    }
  }
  updateHeader(); saveState();
  const root=document.getElementById('police-modal-root');
  root.innerHTML = '<div class="modal-overlay"><div class="police-modal">'+
    '<div class="police-title">🚓 ДПС</div>'+resultHtml+
    '<button class="big-btn" style="margin-top:10px;" onclick="closePoliceModal()">Ехать дальше</button>'+
  '</div></div>';
}
function buyBackLicense(){
  const price=licensePrice();
  if(state.coins<price){ showToast('Недостаточно денег на выкуп прав'); return; }
  if(!confirm('Выкупить права за '+fmt(price)+' 💰?')) return;
  state.coins-=price; state.stats.totalSpent+=price;
  state.hasLicense=true; state.licenseSuspended=false;
  showToast('✅ Права восстановлены, можно снова участвовать в заездах');
  updateHeader(); saveState(); renderProfile();
}
