/* ==================== RACE 3.0 — MANUAL DRAG SYSTEM ====================
   Газ держится кнопкой, передачи переключаются вручную, старт — с выбором
   аккуратного сцепления или шлифовки. Скорость тахометра зависит от тюнинга.
   Никакой скрытой "рандомной победы": итог определяется действиями игрока.
*/
let raceCtx=null;
const GEAR_LABELS=['N','1','2','3','4','5','6'];

function raceTuneProfile(car){
  const upg=typeof getUpg==='function'?getUpg(car.id):{};
  const sum=Object.values(upg||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const engine=Number(upg.engine||0), trans=Number(upg.transmission||0), turbo=Number(upg.turbo||0);
  return {sum, engine, trans, turbo, rpmRate:1+sum*.075+engine*.03, shiftWindow:12+trans*2.5, launchGrip:Math.min(.98,.64+trans*.04), accel:1+engine*.025+turbo*.035};
}
function prepareRace(target,mode){
  let opp;
  if(mode==='pvp'){
    opp={id:target.id,name:(target.challenger_name||'Игрок')+' 🎮',power:target.power,reward:target.stake*2,pvp:true,stake:target.stake,row:target};
  }else{
    const list=mode==='tour'?tournamentsDB:opponentsDB;
    opp=list.find(o=>String(o.id)===String(target));
  }
  const car=carsDB.find(c=>c.id===state.activeCarId);
  if(!car||!opp)return;
  if(state.licenseSuspended){
    showToast('🚫 Права изъяты. Заработай через подработку или восстанови права.');
    switchTab('duel-select'); return;
  }
  const fee=opp.pvp?opp.stake:entryFeeFor(opp);
  const fuelCost=opp.pvp?18:fuelCostFor(opp);
  if(state.coins<fee){
    showToast('Недостаточно SYND для входа');
    switchTab('jobs'); return;
  }
  if(getFuel(car.id)<fuelCost){showToast('Недостаточно топлива');openDetail(car.id);return;}
  const profile=raceTuneProfile(car);
  const route=['Промзона','Ночной проспект','Портовый обход','Тоннель','Старая эстакада'][Math.floor(Math.random()*5)];
  const eventRoll=Math.random();
  const radarChance=opp.pvp?0:0.18+(opp.boss?.08:0);
  raceCtx={opp,mode,fee,fuelCost,useNitro:false,profile,route,
    eventRoll,radarChance,radar:false,gas:false,brake:false,gear:1,rpm:1200,
    speed:0,distance:0,aiDistance:0,aiSpeed:0,finished:false,launchMode:null,
    shiftCount:0,goodShifts:0,perfectShifts:0,errors:0,lastTs:0,loop:null,
    maxSpeed:Math.round(145+getEffectivePower(car)*.24),redline:8500};
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-race').classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
  renderRaceBrief();
}
function renderRaceBrief(){
  const c=raceCtx,car=carsDB.find(x=>x.id===state.activeCarId),o=c.opp;
  const el=document.getElementById('race-content');
  el.innerHTML='<div class="race3"><div class="race-event-badge"><span>НОВАЯ ЛИНИЯ · '+c.route+'</span><b>СЦЕНАРИЙ #'+(1+Math.floor(Math.random()*99))+'</b></div>'+
    '<div class="race3-top"><div class="race3-driver"><b>ВЫ</b><span>'+escapeHtml(car.name)+'</span></div><div class="race3-vs">VS</div><div class="race3-driver" style="text-align:right;"><b>'+escapeHtml(o.name)+'</b><span>'+o.power+' л.с.</span></div></div>'+
    '<div class="pre-race-box"><div class="pre-race-line"><span>Вход</span><b>'+fmt(c.fee)+' SYND</b></div><div class="pre-race-line"><span>Топливо</span><b>'+c.fuelCost+'%</b></div><div class="pre-race-line"><span>Победа</span><b style="color:var(--gold)">+'+fmt(o.reward)+' SYND</b></div>'+
    '<div class="pre-race-line"><span>Радар</span><b style="color:var(--text-muted)">не гарантирован</b></div></div>'+
    '<button class="big-btn" onclick="beginLaunch()">ВЫЕХАТЬ НА ЛИНИЮ</button><button class="btn btn-ghost" style="margin-top:8px;" onclick="switchTab(\'duel-select\')">ОТМЕНА</button></div>';
}
function beginLaunch(){
  const car=carsDB.find(c=>c.id===state.activeCarId),c=raceCtx;
  state.coins-=c.fee;state.stats.totalSpent+=c.fee;state.fuel[car.id]=Math.max(0,getFuel(car.id)-c.fuelCost);
  if(c.useNitro){state.nitro--;}
  updateHeader();saveState();
  const el=document.getElementById('race-content');
  el.innerHTML='<div class="race3"><div class="race-event-badge"><span>СТАРТ · '+c.route+'</span><b>ОБОРОТЫ '+Math.round(c.rpm)+' RPM</b></div>'+
    '<div class="launch-panel"><div style="font-size:14px;font-weight:1000;">КАК ТРОНЕМСЯ?</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Шлифовка даёт резкий старт, но перегревает сцепление и съедает сцепление.</div>'+
    '<div class="launch-meter"><div class="launch-zone"></div><div class="launch-marker" id="launch-marker"></div></div>'+
    '<div class="launch-buttons"><button class="launch-btn safe" onclick="chooseLaunch(\'safe\')">АККУРАТНО<br><small>низкие обороты</small></button><button class="launch-btn hard" onclick="chooseLaunch(\'spin\')">ШЛИФОВКА<br><small>агрессивный старт</small></button></div></div></div>';
  c.launchPos=10;c.launchDir=1;
  c.launchIv=setInterval(()=>{const m=document.getElementById('launch-marker');if(!m){clearInterval(c.launchIv);return;}c.launchPos+=c.launchDir*(1.8+c.profile.rpmRate*.25);if(c.launchPos>=90){c.launchPos=90;c.launchDir=-1;}if(c.launchPos<=8){c.launchPos=8;c.launchDir=1;}m.style.left=c.launchPos+'%';},30);
}
function chooseLaunch(mode){
  const c=raceCtx;clearInterval(c.launchIv);c.launchMode=mode;
  if(mode==='spin'){state.raceStats.hardLaunches=(state.raceStats.hardLaunches||0)+1;c.rpm=4300;c.speed=10;c.distance=1.5;c.launchGrip=.78;}
  else{state.raceStats.safeLaunches=(state.raceStats.safeLaunches||0)+1;c.rpm=2200;c.speed=6;c.distance=.8;c.launchGrip=1;}
  showRaceCockpit();
}
function showRaceCockpit(){
  const c=raceCtx,car=carsDB.find(x=>x.id===state.activeCarId),o=c.opp;
  const el=document.getElementById('race-content');
  el.innerHTML='<div class="race3"><div class="race3-top"><div class="race3-driver"><b>'+escapeHtml(car.name)+'</b><span id="race-pow">'+getEffectivePower(car)+' л.с.</span></div><div class="race3-vs">VS</div><div class="race3-driver" style="text-align:right;"><b>'+escapeHtml(o.name)+'</b><span>'+o.power+' л.с.</span></div></div>'+
    '<div class="race-map"><div class="map-label start">START</div><div class="map-label finish">FINISH</div><div class="map-start"></div><div class="map-finish"></div><div class="map-road"><div class="map-car" id="map-me" style="left:3%"></div><div class="map-car ai" id="map-ai" style="left:3%"></div></div></div>'+
    '<div class="race-event-badge"><span id="race-status">ГАЗ ДЛЯ РАЗГОНА · ПЕРЕКЛЮЧАЙ В ЗОНЕ</span><b id="race-route">'+c.route+'</b></div>'+
    '<div class="cockpit3"><div class="tacho3"><div style="font-size:8px;color:var(--text-muted);font-weight:900;">TACHOMETER</div><div class="gear3" id="race-gear">1</div><div class="tacho-num3" id="race-rpm">2200</div><div class="tacho-bar3"><i id="rpm-fill"></i></div></div><div class="speed3"><span>SPEED</span><strong id="race-speed">0</strong><span>KM/H</span></div></div>'+
    '<div class="race-controls"><button class="race-control brake" id="brake-btn" onpointerdown="raceHold(\'brake\',true)" onpointerup="raceHold(\'brake\',false)" onpointercancel="raceHold(\'brake\',false)">ТОРМОЗ<small>сброс оборотов</small></button><button class="race-control gas" id="gas-btn" onpointerdown="raceHold(\'gas\',true)" onpointerup="raceHold(\'gas\',false)" onpointercancel="raceHold(\'gas\',false)">ГАЗ<small>держи для тяги</small></button><button class="race-control shift" onclick="manualShift()">ПЕРЕДАЧА ↑<small>переключить</small></button></div>'+
    '<div class="shift-mini" id="shift-help">1-я передача · красная зона начинается с 85%</div></div>';
  c.gas=false;c.brake=false;c.lastTs=performance.now();c.aiDistance=Math.max(0,c.distance-2);
  c.loop=setInterval(raceTick,50);
  if(state.settings.sound) showToast(c.launchMode==='spin'?'🔥 ШЛИФОВКА!':'🟢 Чистый старт');
}
function raceHold(type,on){
  if(!raceCtx||raceCtx.finished)return;
  raceCtx[type]=on;
  const b=document.getElementById(type==='gas'?'gas-btn':'brake-btn');if(b)b.classList.toggle('active',on);
}
function manualShift(){
  const c=raceCtx;if(!c||c.finished)return;
  const p=c.rpm/c.redline;
  c.shiftCount++;
  if(p>=.72&&p<=.9){
    c.goodShifts++;c.perfectShifts+=p>=.82&&p<=.89?1:0;c.rpm*=.56;c.speed+=4+c.gear*1.4;
    c.gear=Math.min(6,c.gear+1);
    document.getElementById('race-status').innerText=c.perfectShifts>0&&p>=.82?'ИДЕАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ':'ХОРОШЕЕ ПЕРЕКЛЮЧЕНИЕ';
  }else if(p>.9){
    c.errors++;c.rpm*=.42;c.speed=Math.max(0,c.speed-3);c.gear=Math.min(6,c.gear+1);
    document.getElementById('race-status').innerText='ПОЗДНО · ПРОВАЛ ТЯГИ';c.errors++;
  }else{
    c.errors++;c.rpm=Math.min(c.redline,c.rpm*1.08);c.speed=Math.max(0,c.speed-1);
    document.getElementById('race-status').innerText='РАНО · ПЕРЕКЛЮЧИЛСЯ В НАТЯГ';
  }
  c.gear=Math.max(1,c.gear);updateRaceHUD();
}
function raceTick(){
  const c=raceCtx;if(!c||c.finished)return;
  const dt=.05,p=c.profile;
  const gearRatio=[0,.48,.68,.84,1,1.12,1.2][c.gear]||1;
  if(c.gas){
    const rpmGain=(920*p.rpmRate*gearRatio)*dt;
    c.rpm+=rpmGain;
    if(c.rpm>c.redline){c.rpm=c.redline;c.speed=Math.max(0,c.speed-2.2);c.errors+=.02;}
    const traction=(c.launchMode==='spin'&&c.distance<7?c.launchGrip:.96);
    const band=Math.max(.15,Math.min(1,(c.rpm/ c.redline)));
    c.speed += (5.4*p.accel*gearRatio*traction*(.45+band))*dt*3.2;
  }else{
    c.rpm-=520*dt;c.speed=Math.max(0,c.speed-1.8*dt*10);
  }
  if(c.brake){c.rpm=Math.max(1000,c.rpm-1800*dt);c.speed=Math.max(0,c.speed-8*dt);}
  c.speed=Math.min(c.maxSpeed,c.speed);
  const distanceGain=(c.speed/Math.max(c.maxSpeed,1))*1.65*dt;
  c.distance=Math.min(100,c.distance+distanceGain);
  const aiBase=.78+(c.opp.power/Math.max(getEffectivePower(carsDB.find(x=>x.id===state.activeCarId)),1))*.20;
  const aiSkill=.88+Math.random()*.15;
  c.aiSpeed=Math.min(c.maxSpeed*1.02,c.maxSpeed*aiBase*aiSkill);
  c.aiDistance=Math.min(100,c.aiDistance+(c.aiSpeed/Math.max(c.maxSpeed,1))*1.62*dt);
  updateRaceHUD();
  if(c.distance>=100||c.aiDistance>=100){finishRace(c.distance>=100,c);}
}
function updateRaceHUD(){
  const c=raceCtx;if(!c)return;
  const rpm=document.getElementById('race-rpm'),rf=document.getElementById('rpm-fill'),gear=document.getElementById('race-gear'),sp=document.getElementById('race-speed'),me=document.getElementById('map-me'),ai=document.getElementById('map-ai');
  if(rpm)rpm.innerText=Math.round(c.rpm);
  if(rf)rf.style.width=Math.min(100,c.rpm/c.redline*100)+'%';
  if(gear)gear.innerText=c.gear;
  if(sp)sp.innerText=Math.round(c.speed);
  if(me)me.style.left=Math.min(94,3+c.distance*.91)+'%';
  if(ai)ai.style.left=Math.min(94,3+c.aiDistance*.91)+'%';
  const help=document.getElementById('shift-help');
  if(help)help.innerText='Передача '+c.gear+' · '+Math.round(c.rpm)+' RPM · '+(c.rpm/c.redline>=.82?'ПЕРЕКЛЮЧАЙ СЕЙЧАС':'набирай обороты');
}
function finishRace(playerWins,c){
  if(c.finished)return;c.finished=true;clearInterval(c.loop);
  const car=carsDB.find(x=>x.id===state.activeCarId),opp=c.opp;
  state.stats.races++;state.condition[car.id]=Math.max(0,getCondition(car.id)-(c.errors>2?5:3));
  state.raceStats.perfectShifts=(state.raceStats.perfectShifts||0)+c.perfectShifts;
  const performance=Math.max(0,Math.min(1,(c.goodShifts*2+c.perfectShifts*2-c.errors)/(Math.max(3,c.shiftCount*2))));
  let reward=0,xp=0;
  if(playerWins){
    state.stats.wins++;state.winStreak=(state.winStreak||0)+1;
    const streak=Math.min(.25,state.winStreak*.05);
    reward=Math.round((opp.reward*(1+.08*performance))*(1+streak));
    if(c.perfectShifts>=2)reward+=Math.round(opp.reward*.12);
    xp=(opp.boss||c.mode==='tour')?40:16;
    if(c.launchMode==='spin'&&c.goodShifts>=2)reward+=Math.round(opp.reward*.05);
    if(opp.pvp)resolvePvpChallenge(opp.row,true,reward);
  }else{
    state.stats.losses++;state.winStreak=0;reward=Math.round(opp.reward*.04)+15;xp=4;
    if(opp.pvp)resolvePvpChallenge(opp.row,false,0);
  }
  const id=String(opp.id);state.raceHistory=(state.raceHistory||[]).filter(x=>x!==id);state.raceHistory.push(id);state.raceHistory=state.raceHistory.slice(-8);
  addXP(xp);awardMoney(reward,playerWins?'ПОБЕДА В ЗАЕЗДЕ':'УТЕШИТЕЛЬНЫЙ ПРИЗ');
  const el=document.getElementById('race-content');
  el.innerHTML='<div class="race3"><div class="result-box '+(playerWins?'win':'lose')+'"><div class="result-title">'+(playerWins?'🏆 ФИНИШ ПЕРВЫМ':'💥 ФИНИШ ВТОРЫМ')+'</div>'+
    '<div class="result-sub">'+(playerWins?'Твой контроль газа и передач решил заезд.':'Соперник удержал темп. В следующий раз держи газ и не пропускай красную зону.')+'</div>'+
    '<div class="result-reward">+'+fmt(reward)+' SYND</div><div class="xp-gain-box">⭐ +'+xp+' XP · Идеальных переключений: '+c.perfectShifts+'</div></div>'+
    '<div class="list-container"><button class="btn btn-select" onclick="switchTab(\'duel-select\')">НОВАЯ СЛУЧАЙНАЯ ПАРА</button><button class="btn btn-ghost" onclick="switchTab(\'garage\')">В ГАРАЖ</button></div></div>';
  updateHeader();saveState();checkAchievements();
  /* Радар — только событие, а не обязательная часть каждого заезда. */
  if(!opp.pvp&&Math.random()<c.radarChance){
    state.raceStats.radarEvents=(state.raceStats.radarEvents||0)+1;
    setTimeout(triggerPoliceStop,700);
  }
}
function triggerPoliceStop(){
  const root=document.getElementById('police-modal-root');if(!root)return;
  state.raceStats.policeStops=(state.raceStats.policeStops||0)+1;
  const line=POLICE_LINES[Math.floor(Math.random()*POLICE_LINES.length)];
  root.innerHTML='<div class="modal-overlay"><div class="police-modal"><div class="police-lights"><span></span><span></span></div><div class="police-title">🚓 РАДАР СРАБОТАЛ</div><div class="police-line">'+line+'</div>'+
    '<button class="big-btn police-opt negotiate" onclick="policeChoice(\'negotiate\')">🤝 Договориться</button><button class="big-btn police-opt pay" onclick="policeChoice(\'pay\')">💳 Заплатить штраф ('+fmt(POLICE_BASE_FINE)+' SYND)</button><button class="big-btn police-opt refuse" onclick="policeChoice(\'refuse\')">🙅 Спорить</button></div></div>';
}
function closePoliceModal(){const r=document.getElementById('police-modal-root');if(r)r.innerHTML='';}
function policeChoice(choice){
  let resultHtml='';
  if(choice==='pay'){const fine=POLICE_BASE_FINE;state.coins=Math.max(0,state.coins-fine);state.stats.finesPaid+=fine;state.stats.finesCount++;resultHtml='<div class="police-line">Штраф оплачен. Можно ехать дальше.</div><div class="result-reward">-'+fmt(fine)+' SYND</div>';}
  else if(choice==='negotiate'){if(Math.random()<.55){const bribe=Math.round(POLICE_BASE_FINE*.4)+Math.round(Math.random()*80);state.coins=Math.max(0,state.coins-bribe);resultHtml='<div class="police-line">Инспектор махнул рукой. Вопрос закрыт.</div><div class="result-reward">-'+fmt(bribe)+' SYND</div>';}else{const fine=Math.round(POLICE_BASE_FINE*1.8);state.coins=Math.max(0,state.coins-fine);state.stats.finesPaid+=fine;state.stats.finesCount++;resultHtml='<div class="police-line">Договориться не вышло. Штраф увеличен.</div><div class="result-reward">-'+fmt(fine)+' SYND</div>';}}
  else{if(Math.random()<.35){resultHtml='<div class="police-line">Инспектор не стал связываться.</div><div class="result-reward" style="color:var(--green)">Уехал без штрафа</div>';}else{state.hasLicense=false;state.licenseSuspended=true;state.licenseSuspendCount=(state.licenseSuspendCount||0)+1;resultHtml='<div class="police-line">Права изъяты. Но игра не загнала тебя в тупик: заработок доступен в Подработке и Банке.</div><div class="result-reward">🚫 '+fmt(licensePrice())+' SYND на восстановление</div>';}}
  updateHeader();saveState();
  const root=document.getElementById('police-modal-root');
  root.innerHTML='<div class="modal-overlay"><div class="police-modal"><div class="police-title">🚓 РЕШЕНИЕ ДПС</div>'+resultHtml+'<button class="big-btn" style="margin-top:10px;" onclick="closePoliceModal();switchTab(\'profile\')">ПОНЯТНО</button></div></div>';
}
function buyBackLicense(){
  const price=licensePrice();
  if(state.coins<price){
    showToast('Не хватает SYND. Открой Подработку — деньги можно получить без прав.');
    switchTab('jobs'); return;
  }
  if(!confirm('Восстановить права за '+fmt(price)+' SYND?'))return;
  state.coins-=price;state.stats.totalSpent+=price;state.hasLicense=true;state.licenseSuspended=false;
  showToast('✅ Права восстановлены');updateHeader();saveState();renderProfile();
}
