/* ==================== RACE 4.0 — SMOOTH DRAG SYSTEM ====================
   Архитектура:
   - requestAnimationFrame вместо setInterval
   - физика не пересоздаёт DOM
   - 6 передач, 6-я — физический предел
   - честный баланс машины + старт + переключения
   - две маленькие зоны: жёлтая / зелёная
*/
let raceCtx=null;
let speedFX={fov:1,shake:0};
const GEAR_LABELS=['N','1','2','3','4','5','6'];

function raceTuneProfile(car){
  const upg=typeof getUpg==='function'?getUpg(car.id):{};
  const sum=Object.values(upg||{}).reduce((a,b)=>a+(Number(b)||0),0);
  const engine=Number(upg.engine||0), trans=Number(upg.gearbox||0), turbo=Number(upg.turbo||0);
  const grip=Number(upg.tires||upg.grip||0);
  /* КПП расширяет окна, двигатель/турбо ускоряют набор оборотов. */
  const transLevel=Math.max(0,trans);
  const greenWidth=Math.min(0.095,0.028+transLevel*.010);
  const yellowWidth=Math.min(0.15,greenWidth+0.028+transLevel*.006);
  return {
    sum,engine,trans,turbo,grip,
    rpmRate:1.15+sum*.065+engine*.035+turbo*.055,
    greenWidth,yellowWidth,
    launchGrip:Math.min(.98,.70+transLevel*.025+grip*.025),
    accel:1.18+engine*.025+turbo*.045,
    shiftRecovery:Math.min(.72,.52+transLevel*.035)
  };
}
function prepareRace(target,mode){
  let opp;
  if(mode==='pvp'){
    opp={id:target.id,name:(target.challenger_name||'Игрок')+' 🎮',power:target.power,reward:target.stake*2,pvp:true,stake:target.stake,row:target};
  }else{
    const list=mode==='tour'?tournamentsDB:opponentsDB;
    opp=list.find(o=>String(o.id)===String(target));
  }
  if(mode==='tour' && opp){
    const now=Date.now(), dayKey=new Date().toISOString().slice(0,10), key=String(opp.id);
    const r=state.tournamentRuns[key]||{};
    const count=r.day===dayKey?(Number(r.count)||0):0;
    const next=r.day===dayKey?(Number(r.next)||0):0;
    if(count>=3){showToast('🏁 Этот турнир уже сыгран 3 раза сегодня.');renderOpponents();return;}
    if(next>now){showToast('⏳ Следующая попытка будет доступна через '+Math.ceil((next-now)/60000)+' мин.');renderOpponents();return;}
  }
  const car=carsDB.find(c=>c.id===state.activeCarId);
  if(!car||!opp)return;
  if(state.licenseSuspended){showToast('🚫 Права изъяты. Заработай через подработку или восстанови права.');switchTab('duel-select');return;}
  const fee=opp.pvp?opp.stake:entryFeeFor(opp),fuelCost=opp.pvp?18:fuelCostFor(opp);
  if(state.coins<fee){showToast('Недостаточно SYND для входа');switchTab('jobs');return;}
  if(getFuel(car.id)<fuelCost){showToast('Недостаточно топлива');openDetail(car.id);return;}
  if(mode==='tour'){
    const now=Date.now(), dayKey=new Date().toISOString().slice(0,10), key=String(opp.id);
    const r=state.tournamentRuns[key]||{};
    const count=r.day===dayKey?(Number(r.count)||0):0;
    const next=r.day===dayKey?(Number(r.next)||0):0;
    state.tournamentRuns[key]={day:dayKey,count:count+1,next:now+15*60*1000};
    saveState();
  }
  const profile=raceTuneProfile(car);
  const route=['Промзона','Ночной проспект','Портовый обход','Тоннель','Старая эстакада'][Math.floor(Math.random()*5)];
  const radarChance=opp.pvp?0:Math.min(.48,0.08+(opp.boss?.06:0)+(Number(state.heat)||0)*.055);
  const rawPower=getEffectivePower(car);
  const maxSpeed=Math.round(Math.max(170,Math.min(380,175+rawPower*.115)));
  const aiMaxSpeed=Math.round(Math.max(165,Math.min(380,175+(Number(opp.power)||rawPower)*.115)));
  const trackLength=1200;
  raceCtx={
    opp,mode,fee,fuelCost,useNitro:false,profile,route,radarChance,
    radar:false,gas:false,brake:false,gear:1,rpm:1100,speed:0,distance:0,
    aiDistance:0,aiSpeed:0,aiGear:1,aiRpm:1200,aiShiftTimer:0,aiSkill:0,aiFinishedAt:0,playerFinishedAt:0,lastLead:0,lastPassAt:0,trackLength:trackLength,
    finished:false,launchMode:null,shiftCount:0,goodShifts:0,perfectShifts:0,errors:0,elapsed:0,actionTimer:0,actionText:'',
    lastTs:0,raf:null,launchIv:null,uiTimer:0,uiInterval:0,displayRpm:null,displaySpeed:null,
    maxSpeed,aiMaxSpeed,redline:8500,startLocked:false,startTimer:0,nitroActive:false,nitroTimer:0,nitroUsed:false,topSpeed:0
  };
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-race').classList.add('active');
  document.getElementById('main-scroll').scrollTop=0;
  renderRaceBrief();
}
function renderRaceBrief(){
  const c=raceCtx,car=carsDB.find(x=>x.id===state.activeCarId),o=c.opp;
  document.getElementById('race-content').innerHTML=
  '<div class="race3"><div class="race-event-badge"><span>НОВАЯ ЛИНИЯ · '+c.route+'</span><b>СЦЕНАРИЙ #'+(1+Math.floor(Math.random()*99))+'</b></div>'+
  '<div class="race3-top"><div class="race3-driver"><b>ВЫ</b><span>'+escapeHtml(car.name)+'</span></div><div class="race3-vs">VS</div><div class="race3-driver" style="text-align:right;"><b>'+escapeHtml(o.name)+'</b><span>'+o.power+' л.с.</span></div></div>'+
  '<div class="pre-race-box"><div class="pre-race-line"><span>Вход</span><b>'+fmt(c.fee)+' SYND</b></div><div class="pre-race-line"><span>Топливо</span><b>'+c.fuelCost+'%</b></div><div class="pre-race-line"><span>Победа</span><b style="color:var(--gold)">+'+fmt(o.reward)+' SYND</b></div><div class="pre-race-line"><span>Радар</span><b style="color:var(--text-muted)">случайное событие</b></div></div>'+
  '<button class="big-btn" onclick="beginLaunch()">ВЫЕХАТЬ НА ЛИНИЮ</button><button class="btn btn-ghost" style="margin-top:8px;" onclick="switchTab(\'duel-select\')">ОТМЕНА</button></div>';
}
function beginLaunch(){
  const car=carsDB.find(c=>c.id===state.activeCarId),c=raceCtx;
  state.coins-=c.fee;state.stats.totalSpent+=c.fee;state.fuel[car.id]=Math.max(0,getFuel(car.id)-c.fuelCost);
  updateHeader();saveState();
  document.getElementById('race-content').innerHTML=
  '<div class="race3"><div class="race-event-badge"><span>СТАРТ · '+c.route+'</span><b>ПОДБЕРИ ОБОРОТЫ</b></div>'+
  '<div class="launch-panel"><div style="font-size:14px;font-weight:1000;">ЛОВИ ЗЕЛЁНУЮ ЗОНУ</div><div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Жёлтая — хороший старт. Зелёная — идеальный. Ошибка даёт сопернику преимущество.</div>'+
  '<div class="launch-meter"><div class="launch-zone yellow"></div><div class="launch-zone green"></div><div class="launch-marker" id="launch-marker"></div></div>'+
  '<div class="launch-rpm" id="launch-rpm">1 100 RPM</div>'+
  '<div class="launch-buttons"><button class="launch-btn safe" onclick="chooseLaunch(\'safe\')">АККУРАТНО<br><small>контроль сцепления</small></button><button class="launch-btn hard" onclick="chooseLaunch(\'spin\')">ШЛИФОВКА<br><small>максимум старта</small></button></div></div></div>';
  c.launchPos=15;c.launchDir=1;
  c.launchIv=setInterval(()=>{
    const m=document.getElementById('launch-marker'),r=document.getElementById('launch-rpm');
    if(!m){clearInterval(c.launchIv);return;}
    c.launchPos+=c.launchDir*(1.45+c.profile.rpmRate*.18);
    if(c.launchPos>=90){c.launchPos=90;c.launchDir=-1;}
    if(c.launchPos<=8){c.launchPos=8;c.launchDir=1;}
    m.style.left=c.launchPos+'%';
    if(r)r.textContent=Math.round(900+c.launchPos/100*7600).toLocaleString('fi-FI')+' RPM';
  },32);
}
function chooseLaunch(mode){
  const c=raceCtx;if(!c)return;
  clearInterval(c.launchIv);
  c.launchMode=mode;
  const pos=c.launchPos/100;
  const center=0.67;
  const error=Math.abs(pos-center);
  const quality=Math.max(0,1-error/.30);
  if(quality>=.90){state.raceStats.perfectStarts=(state.raceStats.perfectStarts||0)+1;haptic('success');}
  if(mode==='spin'){
    state.raceStats.hardLaunches=(state.raceStats.hardLaunches||0)+1;
    c.rpm=4700+quality*900;c.speed=10+quality*8;c.distance=1.2+quality*1.2;
    c.launchGrip=Math.max(.76,c.profile.launchGrip-(1-quality)*.12);
  }else{
    state.raceStats.safeLaunches=(state.raceStats.safeLaunches||0)+1;
    c.rpm=2600+quality*1900;c.speed=7+quality*8;c.distance=.8+quality*1.4;
    c.launchGrip=.98;
  }
  /* AI старт не идеальный по умолчанию. Его шанс зависит от силы машины. */
  const myPower=getEffectivePower(carsDB.find(x=>x.id===state.activeCarId));
  const powerRatio=Math.max(.78,Math.min(1.22,c.opp.power/Math.max(myPower,1)));
  c.aiSkill=Math.max(.92,Math.min(1.02,.97+(powerRatio-1)*.04+(Math.random()-.5)*.06));
  c.aiDistance=Math.max(0,c.distance-(Math.random()*1.4));
  c.aiStartDelay=0.85+Math.random()*0.55;
  c.aiSpeed=0;c.aiGear=1;c.aiRpm=2600+Math.random()*1700;
  showRaceCockpit();
}
function showRaceCockpit(){
  const c=raceCtx,car=carsDB.find(x=>x.id===state.activeCarId),o=c.opp;
  document.getElementById('race-content').innerHTML=
  '<div class="race3"><div class="race3-top"><div class="race3-driver"><b>'+escapeHtml(car.name)+'</b><span>'+getEffectivePower(car)+' л.с.</span></div><div class="race3-vs">VS</div><div class="race3-driver" style="text-align:right;"><b>'+escapeHtml(o.name)+'</b><span>'+o.power+' л.с.</span></div></div>'+
  '<div class="race-start-light" id="race-start-light"><div class="traffic-light"><i class="tl-red on"></i><i class="tl-yellow"></i><i class="tl-green"></i></div><b id="race-start-text">ГОТОВЬСЯ</b></div>'+
  '<div class="race-map"><div class="speed-effects" id="speed-effects"></div><div class="map-label start">START</div><div class="map-label finish">FINISH</div><div class="map-start"></div><div class="map-finish"></div><div class="map-road"><div class="map-car" id="map-me" style="left:3%"><span>YOU</span></div><div class="map-car ai" id="map-ai" style="left:3%"><span>RIVAL</span></div><div class="race-gap" id="race-gap">СТАРТ</div></div></div>'+
  '<div class="race-event-badge"><span id="race-status">ГАЗ ДЛЯ РАЗГОНА · ЛОВИ ЗОНУ</span><b id="race-route">'+c.route+'</b></div><div class="race-lead" id="race-lead">Позиция: РОВНО · до финиша '+c.trackLength+' м</div>'+'<div class="race-action" id="race-action"></div>'+

  '<div class="cockpit3"><div class="analog-gauge tacho3"><div class="gauge-caption">RPM ×1000</div><div class="dial zone-dial" id="rpm-dial"><div class="dial-ticks"></div><div class="dial-needle" id="rpm-needle"></div><div class="dial-hub"></div><div class="gear3" id="race-gear">1</div><div class="gauge-center"><b id="race-rpm">1.1</b><span>×1000</span></div></div><div class="gauge-scale"><span>0</span><span>4</span><span>8.5</span></div></div>'+
  '<div class="analog-gauge speed3"><div class="gauge-caption">SPEED</div><div class="dial speed-dial zone-dial" id="speed-dial"><div class="dial-ticks"></div><div class="dial-needle speed-needle" id="speed-needle"></div><div class="dial-hub"></div><div class="gauge-center"><b id="race-speed">0</b><span>KM/H</span></div></div><div class="gauge-scale"><span>0</span><span>'+c.maxSpeed+'</span></div></div></div>'+
  '<div class="race-controls"><button class="race-control pedal brake" id="brake-btn" onpointerdown="raceHold(\'brake\',true)" onpointerup="raceHold(\'brake\',false)" onpointercancel="raceHold(\'brake\',false)" onpointerleave="raceHold(\'brake\',false)"><span class="pedal-face">BRAKE</span><small>ТОРМОЗ</small></button><button class="race-control pedal gas" id="gas-btn" onpointerdown="raceHold(\'gas\',true)" onpointerup="raceHold(\'gas\',false)" onpointercancel="raceHold(\'gas\',false)" onpointerleave="raceHold(\'gas\',false)"><span class="pedal-face">GAS</span><small>ГАЗ</small></button><button class="race-control shift" id="shift-btn" onclick="manualShift()"><span class="shift-face">↑</span><small id="shift-label">SHIFT · 1→2</small></button><button class="race-control nitro" id="nitro-btn" onclick="useRaceNitro()"><span class="nitro-face">N₂O</span><small id="nitro-label">'+state.nitro+' ЗАРЯД.</small><div class="race-nitro-bar"><i id="nitro-bar-fill"></i></div></button></div>'+
  '<div class="shift-mini" id="shift-help">Жёлтая — хорошо · зелёная — идеально</div></div>';
  c.gas=false;c.brake=false;c.startLocked=true;c.startTimer=0;c.lastTs=performance.now();c.uiTimer=0;
  updateRaceZones();updateRaceHUD();
  startTrafficLight();
  c.raf=requestAnimationFrame(raceFrame);
  if(state.settings.sound)showToast(c.launchMode==='spin'?'🔥 ШЛИФОВКА!':'🟢 Чистый старт');
}
function startTrafficLight(){
  const c=raceCtx;if(!c)return;
  const root=document.getElementById('race-start-light');
  const red=root&&root.querySelector('.tl-red'),yellow=root&&root.querySelector('.tl-yellow'),green=root&&root.querySelector('.tl-green'),text=document.getElementById('race-start-text');
  if(!root)return;
  root.classList.add('show');
  const steps=[
    ()=>{ if(red)red.classList.add('on'); if(yellow)yellow.classList.remove('on'); if(green)green.classList.remove('on'); if(text)text.innerText='ГОТОВЬСЯ'; },
    ()=>{ if(red)red.classList.add('on'); if(yellow)yellow.classList.add('on'); if(green)green.classList.remove('on'); if(text)text.innerText='НА СТАРТ'; },
    ()=>{ if(red)red.classList.remove('on'); if(yellow)yellow.classList.remove('on'); if(green)green.classList.add('on'); if(text)text.innerText='ПОЕХАЛИ'; showAction('GREEN LIGHT · ПОЕХАЛИ!'); },
    ()=>{ c.startLocked=false; c.startTimer=0; if(root)root.classList.remove('show'); }
  ];
  steps[0]();
  setTimeout(steps[1],650);
  setTimeout(steps[2],1250);
  setTimeout(steps[3],1850);
}
function showAction(text){
  const c=raceCtx;if(!c)return;
  c.actionText=text;c.actionTimer=1.35;
  const el=document.getElementById('race-action');
  if(el){el.textContent='⚡ '+text;el.classList.remove('show');void el.offsetWidth;el.classList.add('show');}
}

function raceHold(type,on){
  if(!raceCtx||raceCtx.finished)return;
  raceCtx[type]=on;
  const b=document.getElementById(type==='gas'?'gas-btn':'brake-btn');
  if(b)b.classList.toggle('active',on);
}
function manualShift(){
  const c=raceCtx;if(!c||c.finished)return;
  if(c.gear>=6){
    c.gear=6;
    const status=document.getElementById('race-status');if(status)status.innerText='6-Я ПЕРЕДАЧА · МАКСИМУМ';
    updateRaceHUD();return;
  }
  const p=c.rpm/c.redline;
  c.shiftCount++;
  const g=c.profile.greenWidth,y=c.profile.yellowWidth;
  const perfectCenter=.72;
  const perfect=Math.abs(p-perfectCenter)<=g;
  const good=Math.abs(p-perfectCenter)<=y;
  c.gear=Math.min(6,c.gear+1);
  if(perfect){
    c.perfectShifts++;c.goodShifts++;recordContractEvent('perfectShift',1);haptic('success');showAction('ИДЕАЛЬНЫЙ SHIFT!');c.rpm=Math.max(3000,c.rpm*c.profile.shiftRecovery);
    showShiftText('ИДЕАЛЬНОЕ ПЕРЕКЛЮЧЕНИЕ',true);
  }else if(good){
    c.goodShifts++;haptic('medium');showAction('ХОРОШЕЕ ПЕРЕКЛЮЧЕНИЕ');c.rpm=Math.max(2700,c.rpm*c.profile.shiftRecovery*.94);
    showShiftText('ХОРОШЕЕ ПЕРЕКЛЮЧЕНИЕ',false);
  }else if(p>.92){
    c.errors++;haptic('warning');showAction('ПОЗДНИЙ SHIFT · ПОТЕРЯ ТЯГИ');c.rpm=Math.max(3000,c.rpm*.54);showShiftText('ПОЗДНО · ПОТЕРЯ ТЯГИ',false);
  }else{
    c.errors++;haptic('warning');showAction('РАННИЙ SHIFT · ПОТЕРЯ ТЯГИ');c.rpm=Math.max(2100,c.rpm*.68);showShiftText('РАНО · ПОТЕРЯ ТЯГИ',false);
  }
  updateRaceHUD();
}
function showShiftText(text,perfect){
  const status=document.getElementById('race-status');if(status)status.innerText=text;
  const root=document.getElementById('race-content');
  if(root){root.classList.remove('shift-flash');void root.offsetWidth;root.classList.add(perfect?'perfect-shift-flash':'shift-flash');}
}
function raceFrame(now){
  const c=raceCtx;if(!c||c.finished)return;
  let dt=(now-(c.lastTs||now))/1000;
  c.lastTs=now;
  dt=Math.max(.001,Math.min(.034,dt));
  simulateRace(dt);
  c.uiTimer+=dt;
  /* Физика каждый кадр, DOM — максимум ~30 раз/сек. Стрелки получают transform. */
  if(c.uiTimer>=.033){c.uiTimer=0;updateRaceHUD();}
  if(!c.finished)c.raf=requestAnimationFrame(raceFrame);
}
function simulateRace(dt){
  const c=raceCtx;
  if(c.startLocked) return;
  c.elapsed+=dt;
  if(c.nitroTimer>0){c.nitroTimer=Math.max(0,c.nitroTimer-dt);c.nitroActive=c.nitroTimer>0;}
  if(c.actionTimer>0){ c.actionTimer-=dt; if(c.actionTimer<=0){ const a=document.getElementById('race-action'); if(a)a.classList.remove('show'); } }
  const p=c.profile,gear=c.gear;
  const ratios=[0,.58,.72,.82,.90,.96,1];
  const ratio=ratios[gear];
  const rpmNorm=c.rpm/c.redline;
  if(c.gas&&!c.brake){
    const gain=1450*p.rpmRate*(.72+ratio*.36)*dt;
    if(gear<6)c.rpm=Math.min(c.redline*1.015,c.rpm+gain);
    else c.rpm=Math.min(c.redline*.995,c.rpm+gain*.20);
    const band=Math.max(.15,Math.min(1,rpmNorm));
    const launchTraction=(c.launchMode==='spin'&&c.distance<9)?c.launchGrip:.99;
    /* Сильный старт + быстрый набор скорости, без улиточного темпа. */
    const nitroBoost=c.nitroActive?1.34:1;
    const baseAccel=(c.maxSpeed*.92)*p.accel*ratio*(.52+band*.82)*launchTraction*nitroBoost;
    const resistance=.020*c.speed*c.speed/c.maxSpeed;
    c.speed+=Math.max(0,baseAccel-resistance)*dt;
    if(gear===6){
      /* 6-я передача — длинная: скорость не прыгает к максимальной
         только из-за включения 6-й. Она продолжает расти физически. */
      c.rpm=Math.min(c.redline*.995,c.rpm);
    }
  }else{
    c.rpm=Math.max(1100,c.rpm-1050*dt);
    c.speed=Math.max(0,c.speed-5.5*dt);
  }
  if(c.brake){
    c.rpm=Math.max(1100,c.rpm-3000*dt);
    c.speed=Math.max(0,c.speed-70*dt);
  }
  const speedCap=c.nitroActive?Math.min(400,c.maxSpeed*1.045):c.maxSpeed;
  c.speed=Math.max(0,Math.min(speedCap,c.speed));
  c.topSpeed=Math.max(c.topSpeed||0,c.speed);
  /* Реальная дистанция: км/ч -> м/с. Финиш только на физическом конце 1200 м. */
  c.distance=Math.min(c.trackLength,c.distance+(c.speed/3.6)*dt);

  /* AI тоже движется по той же физической дистанции. Он может быть впереди/сзади,
     но не завершает раунд сам по себе: результат фиксируется только после того,
     как игрок пересёк физическую финишную линию. */
  const myPower=getEffectivePower(carsDB.find(x=>x.id===state.activeCarId));
  const ratioPower=Math.max(.72,Math.min(1.28,c.opp.power/Math.max(myPower,1)));
  const aiPace=Math.max(.88,Math.min(1.02,.95+(ratioPower-1)*.12));
  const targetVariation=1+Math.sin(c.elapsed*.63)*.025+Math.sin(c.elapsed*1.71)*.012;
  const aiTarget=Math.min(c.aiMaxSpeed*.985,c.aiMaxSpeed*aiPace*c.aiSkill*targetVariation);
  c.aiSpeed+=((aiTarget-c.aiSpeed)*1.25*dt);
  if(c.elapsed<c.aiStartDelay)c.aiSpeed*=Math.max(0,1-dt*5);
  c.aiSpeed=Math.max(0,Math.min(c.aiMaxSpeed*.985,c.aiSpeed));
  c.aiDistance=Math.min(c.trackLength,c.aiDistance+(c.aiSpeed/3.6)*dt);

  /* Важно: соперник, пересёкший финиш, не закрывает экран. Игрок обязан
     физически доехать до конца, и только тогда определяется победитель. */
  if(c.aiDistance>=c.trackLength && !c.aiFinishedAt){
    c.aiFinishedAt=c.elapsed;
    showAction('СОПЕРНИК ПЕРЕСЁК ФИНИШ · ДОЕЗЖАЙ ДО КОНЦА');
    const status=document.getElementById('race-status');if(status)status.innerText='СОПЕРНИК УЖЕ НА ФИНИШЕ · ДОЕЗЖАЙ ДО КОНЦА';
  }
  if(c.distance>=c.trackLength){
    c.playerFinishedAt=c.elapsed;
    finishRace(!c.aiFinishedAt || c.playerFinishedAt<=c.aiFinishedAt,c);return;
  }
}
function useRaceNitro(){
  const c=raceCtx;if(!c||c.finished||c.startLocked)return;
  if(c.nitroUsed){showAction('NITRO УЖЕ ИСПОЛЬЗОВАНО');return;}
  if(state.nitro<=0){showAction('НЕТ ЗАРЯДОВ N₂O');haptic('error');return;}
  state.nitro--;c.nitroUsed=true;c.nitroActive=true;c.nitroTimer=2.4;state.raceStats.nitroUses=(state.raceStats.nitroUses||0)+1;
  recordContractEvent('nitro',1);showAction('N₂O · ПОЛНЫЙ БУСТ');haptic('heavy');saveState();updateRaceHUD();
}

function updateRaceZones(){
  const c=raceCtx;if(!c)return;
  const greenDeg=Math.max(7,Math.min(28,c.profile.greenWidth*360));
  const yellowDeg=Math.max(greenDeg+8,Math.min(52,c.profile.yellowWidth*360));
  /* Индикатор центрирован вокруг 72% шкалы. Только две маленькие зоны. */
  const center=0.72*264-132;
  const start=center-yellowDeg/2,end=center+yellowDeg/2;
  const gs=center-greenDeg/2,ge=center+greenDeg/2;
  const d=document.getElementById('rpm-dial');
  if(d){
    d.style.setProperty('--yellow-start',start+'deg');
    d.style.setProperty('--yellow-end',end+'deg');
    d.style.setProperty('--green-start',gs+'deg');
    d.style.setProperty('--green-end',ge+'deg');
  }
  const speedDial=document.getElementById('speed-dial');
  if(speedDial){
    speedDial.style.setProperty('--yellow-start','999deg');
    speedDial.style.setProperty('--yellow-end','1000deg');
    speedDial.style.setProperty('--green-start','1001deg');
    speedDial.style.setProperty('--green-end','1002deg');
  }
}
function updateRaceHUD(){
  const c=raceCtx;if(!c)return;
  const rpmEl=document.getElementById('race-rpm'),gear=document.getElementById('race-gear'),sp=document.getElementById('race-speed'),me=document.getElementById('map-me'),ai=document.getElementById('map-ai');
  if(rpmEl)rpmEl.innerText=(c.rpm/1000).toFixed(1);
  /* Визуальные стрелки инерционные: реальные RPM/скорость меняются сразу,
     но стрелка догоняет значение плавно, поэтому после переключения нет резкого скачка. */
  const smoothK=0.22;
  if(c.displayRpm==null)c.displayRpm=c.rpm;
  if(c.displaySpeed==null)c.displaySpeed=c.speed;
  c.displayRpm += (c.rpm-c.displayRpm)*smoothK;
  c.displaySpeed += (c.speed-c.displaySpeed)*smoothK;
  const rpmNeedle=document.getElementById('rpm-needle');
  if(rpmNeedle)rpmNeedle.style.transform='rotate('+(-132+(c.displayRpm/c.redline)*264)+'deg)';
  const speedNeedle=document.getElementById('speed-needle');
  if(speedNeedle)speedNeedle.style.transform='rotate('+(-132+(c.displaySpeed/Math.max(c.maxSpeed,1))*264)+'deg)';
  const fx=document.getElementById('speed-effects');if(fx)fx.classList.toggle('fast',c.speed>c.maxSpeed*.55);
  if(gear)gear.innerText=c.gear;
  if(sp)sp.innerText=Math.round(c.speed);
  const mePct=Math.max(0,Math.min(100,c.distance/c.trackLength*100));
  const aiPct=Math.max(0,Math.min(100,c.aiDistance/c.trackLength*100));
  if(me){me.style.left=(4+mePct*.92)+'%';me.style.transform='translateX(-50%)';}
  if(ai){ai.style.left=(4+aiPct*.92)+'%';ai.style.transform='translateX(-50%)';}
  const gapEl=document.getElementById('race-gap');
  const leadEl=document.getElementById('race-lead');
  const gap=c.distance-c.aiDistance;
  const leadSign=gap>2?1:gap<-2?-1:0;
  if(leadSign!==c.lastLead && c.elapsed>1.2){
    if(leadSign===1) showAction('ОБГОН! ТЫ ВЫШЕЛ ВПЕРЁД');
    else if(leadSign===-1) showAction('ТЕБЯ ОБОШЛИ! НАЖИМАЙ И ОТЫГРЫВАЙСЯ');
    c.lastLead=leadSign;
  }
  if(gapEl){
    if(Math.abs(gap)<2) gapEl.innerText='РОВНО · БОРЬБА ЗА ПОЗИЦИЮ';
    else if(gap>0) gapEl.innerText='YOU +'+Math.abs(gap).toFixed(1)+' м ВПЕРЕДИ';
    else gapEl.innerText='RIVAL +'+Math.abs(gap).toFixed(1)+' м ВПЕРЕДИ';
  }
  if(leadEl){
    const remain=Math.max(0,c.trackLength-c.distance);
    leadEl.innerText=(gap>2?'ТЫ ВПЕРЕДИ · ':gap<-2?'СОПЕРНИК ВПЕРЕДИ · ':'РОВНО · ')+'до финиша '+Math.ceil(remain)+' м';
  }
  const help=document.getElementById('shift-help');
  if(help)help.innerText=c.gear>=6?'6-я передача · МАКСИМУМ · держи газ':'Передача '+c.gear+' · жёлтая — хорошо · зелёная — идеально';
  const sb=document.getElementById('shift-btn');if(sb)sb.classList.toggle('locked',c.gear>=6);
  const sl=document.getElementById('shift-label');if(sl)sl.innerText=c.gear>=6?'6 · MAX':('SHIFT · '+c.gear+'→'+Math.min(6,c.gear+1));
  const nb=document.getElementById('nitro-btn'),nl=document.getElementById('nitro-label'),nf=document.getElementById('nitro-bar-fill');
  if(nb)nb.classList.toggle('used',c.nitroUsed||state.nitro<=0);if(nl)nl.innerText=c.nitroUsed?'ИСПОЛЬЗОВАНО':state.nitro+' ЗАРЯД.';if(nf)nf.style.width=(c.nitroActive?Math.round(c.nitroTimer/2.4*100):0)+'%';
}
function finishRace(playerWins,c){
  if(c.finished)return;
  c.finished=true;
  if(c.raf)cancelAnimationFrame(c.raf);
  if(c.launchIv)clearInterval(c.launchIv);
  const car=carsDB.find(x=>x.id===state.activeCarId),opp=c.opp;
  state.stats.races++;state.condition[car.id]=Math.max(0,getCondition(car.id)-(c.errors>2?5:3));
  state.raceStats.perfectShifts=(state.raceStats.perfectShifts||0)+c.perfectShifts;
  const performance=Math.max(0,Math.min(1,(c.goodShifts*2+c.perfectShifts*2-c.errors)/(Math.max(3,c.shiftCount*2))));
  let reward=0,xp=0;
  const tourRun = c.mode==='tour' ? (state.tournamentRuns[String(opp.id)]||{}) : null;
  const todayKey = new Date().toISOString().slice(0,10);
  const completedAttempt = c.mode==='tour' && tourRun && tourRun.day===todayKey ? Math.max(1,Number(tourRun.count)||1) : 1;
  const tourRewardMult = c.mode==='tour' ? ([1,.72,.48][Math.min(2,completedAttempt-1)]||.48) : 1;
  if(playerWins){
    state.stats.wins++;if(opp.boss)state.stats.bossWins=(state.stats.bossWins||0)+1;state.winStreak=(state.winStreak||0)+1;
    /* Экономика прозрачная: выплата РОВНО такая, какая была показана до старта.
       Никаких скрытых бонусов за серию, идеальные переключения или старт. */
    reward=Math.max(0,Math.round(opp.reward*tourRewardMult));
    xp=(opp.boss||c.mode==='tour')?40:16;
    if(opp.pvp)resolvePvpChallenge(opp.row,true,reward);
  }else{
    state.stats.losses++;state.winStreak=0;reward=0;xp=4;
    if(opp.pvp)resolvePvpChallenge(opp.row,false,0);
  }
  const id=String(opp.id);state.raceHistory=(state.raceHistory||[]).filter(x=>x!==id);state.raceHistory.push(id);state.raceHistory=state.raceHistory.slice(-8);
  recordCareerRace(playerWins,opp);recordRaceTelemetry({ts:Date.now(),won:playerWins,opponent:opp.name,route:c.route,time:c.elapsed,topSpeed:c.topSpeed||c.speed,perfectShifts:c.perfectShifts,nitroUsed:c.nitroUsed});
  addXP(xp);awardMoney(reward,playerWins?'ПОБЕДА В ЗАЕЗДЕ':'УТЕШИТЕЛЬНЫЙ ПРИЗ');
  const el=document.getElementById('race-content');
  el.innerHTML='<div class="race3"><div class="result-box '+(playerWins?'win':'lose')+'"><div class="result-title">'+(playerWins?'🏆 ФИНИШ ПЕРВЫМ':'💥 ФИНИШ ВТОРЫМ')+'</div>'+
    '<div class="result-sub">'+(playerWins?'Ты пересёк физическую линию FINISH первым.':'Ты пересёк физическую линию FINISH после соперника.')+'</div>'+
    '<div class="result-reward">'+(reward>0?'+':'')+fmt(reward)+' SYND</div>'+
    '<div class="xp-gain-box">⭐ +'+xp+' XP · '+c.elapsed.toFixed(2)+' c · MAX '+Math.round(c.topSpeed||c.speed)+' км/ч · PERFECT SHIFT '+c.perfectShifts+'</div></div>'+
    '<div class="list-container"><button class="btn btn-select" onclick="switchTab(\'duel-select\')">НОВАЯ СЛУЧАЙНАЯ ПАРА</button><button class="btn btn-ghost" onclick="switchTab(\'garage\')">В ГАРАЖ</button></div></div>';
  updateHeader();saveState();checkAchievements();
  if(!opp.pvp&&Math.random()<c.radarChance){state.raceStats.radarEvents=(state.raceStats.radarEvents||0)+1;setTimeout(triggerPoliceStop,700);}
}
function triggerPoliceStop(){
  const root=document.getElementById('police-modal-root');if(!root)return;
  state.raceStats.policeStops=(state.raceStats.policeStops||0)+1;haptic('warning');
  const line=POLICE_LINES[Math.floor(Math.random()*POLICE_LINES.length)];
  root.innerHTML='<div class="modal-overlay"><div class="police-modal"><div class="police-lights"><span></span><span></span></div><div class="police-title">🚓 РАДАР СРАБОТАЛ</div><div class="police-line">'+line+'</div>'+
    '<button class="big-btn police-opt negotiate" onclick="policeChoice(\'negotiate\')">🤝 Договориться</button><button class="big-btn police-opt pay" onclick="policeChoice(\'pay\')">💳 Заплатить штраф ('+fmt(POLICE_BASE_FINE)+' SYND)</button><button class="big-btn police-opt refuse" onclick="policeChoice(\'refuse\')">🙅 Спорить</button></div></div>';
}
function closePoliceModal(){const r=document.getElementById('police-modal-root');if(r)r.innerHTML='';}
function policeChoice(choice){
  let resultHtml='';
  if(choice==='pay'){const fine=POLICE_BASE_FINE;state.coins=Math.max(0,state.coins-fine);reduceHeat(2);state.stats.finesPaid+=fine;state.stats.finesCount++;resultHtml='<div class="police-line">Штраф оплачен. Можно ехать дальше.</div><div class="result-reward">-'+fmt(fine)+' SYND</div>';}
  else if(choice==='negotiate'){if(Math.random()<.55){const bribe=Math.round(POLICE_BASE_FINE*.4)+Math.round(Math.random()*80);state.coins=Math.max(0,state.coins-bribe);reduceHeat(1);resultHtml='<div class="police-line">Инспектор махнул рукой. Вопрос закрыт.</div><div class="result-reward">-'+fmt(bribe)+' SYND</div>';}else{const fine=Math.round(POLICE_BASE_FINE*1.8);state.coins=Math.max(0,state.coins-fine);state.stats.finesPaid+=fine;state.stats.finesCount++;resultHtml='<div class="police-line">Договориться не вышло. Штраф увеличен.</div><div class="result-reward">-'+fmt(fine)+' SYND</div>';}}
  else{if(Math.random()<.35){resultHtml='<div class="police-line">Инспектор не стал связываться.</div><div class="result-reward" style="color:var(--green)">Уехал без штрафа</div>';}else{state.hasLicense=false;state.licenseSuspended=true;state.licenseSuspendCount=(state.licenseSuspendCount||0)+1;resultHtml='<div class="police-line">Права изъяты. Но игра не загнала тебя в тупик: заработок доступен в Подработке и Банке.</div><div class="result-reward">🚫 '+fmt(licensePrice())+' SYND на восстановление</div>';}}
  updateHeader();saveState();
  const root=document.getElementById('police-modal-root');
  root.innerHTML='<div class="modal-overlay"><div class="police-modal"><div class="police-title">🚓 РЕШЕНИЕ ДПС</div>'+resultHtml+'<button class="big-btn" style="margin-top:10px;" onclick="closePoliceModal();switchTab(\'profile\')">ПОНЯТНО</button></div></div>';
}
function buyBackLicense(){
  const price=licensePrice();
  if(state.coins<price){showToast('Не хватает SYND. Открой Подработку — деньги можно получить без прав.');switchTab('jobs');return;}
  if(!confirm('Восстановить права за '+fmt(price)+' SYND?'))return;
  state.coins-=price;state.stats.totalSpent+=price;state.hasLicense=true;state.licenseSuspended=false;
  showToast('✅ Права восстановлены');updateHeader();saveState();renderProfile();
}


/* Desktop controls: W/↑ gas, S/↓ brake, Space/E shift, N/Shift nitro. */
(function bindRaceKeyboard(){
  const active=()=>document.getElementById('screen-race')?.classList.contains('active')&&raceCtx&&!raceCtx.finished;
  window.addEventListener('keydown',e=>{
    if(!active()||e.repeat)return;
    if(['ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();
    if(e.code==='KeyW'||e.code==='ArrowUp')raceHold('gas',true);
    if(e.code==='KeyS'||e.code==='ArrowDown')raceHold('brake',true);
    if(e.code==='Space'||e.code==='KeyE')manualShift();
    if(e.code==='KeyN'||e.code==='ShiftLeft'||e.code==='ShiftRight')useRaceNitro();
  },{passive:false});
  window.addEventListener('keyup',e=>{
    if(!active())return;
    if(e.code==='KeyW'||e.code==='ArrowUp')raceHold('gas',false);
    if(e.code==='KeyS'||e.code==='ArrowDown')raceHold('brake',false);
  });
})();
