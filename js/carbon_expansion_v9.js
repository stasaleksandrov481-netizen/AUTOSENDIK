/* ==================== CARBON DISTRICT 9.0 ====================
   Gear-limited drag physics, 60 FPS race FX, deterministic server case rolls,
   SVG slot reels, expanded profiles, friends and clans.
*/
(function(){
  'use strict';
  const V9_VERSION=9;
  const GEAR_CAPS=[0,40,90,150,215,285,380];
  const GEAR_FLOORS=[0,0,31,72,126,184,246];
  const GEAR_TORQUE=[0,1.20,1.04,.89,.76,.65,.56];
  const RARITY_LABEL_V9={common:'COMMON',rare:'RARE',epic:'EPIC',legendary:'LEGENDARY',mythic:'MYTHIC'};
  const CASES_V9={
    bronze:{id:'bronze',name:'Street Case',price:350,weights:[['common',72],['rare',23],['epic',4.7],['legendary',.3]]},
    silver:{id:'silver',name:'Carbon Case',price:1400,weights:[['common',50],['rare',37],['epic',11.8],['legendary',1.2]]},
    gold:{id:'gold',name:'Syndicate Case',price:4500,weights:[['common',35],['rare',42],['epic',20],['legendary',2.7],['mythic',.3]]}
  };
  const CASE_TARGET_INDEX=36;

  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function rand(){if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}return Math.random();}
  function localBuildRating(carId){const u=getUpg(Number(carId));const sum=['engine','turbo','gearbox','tires'].reduce((a,k)=>a+(Number(u[k])||0),0);return Math.round(Math.min(100,sum/20*100));}
  function ensureCaseModalV9(){if(document.getElementById('case-open-modal'))return;const d=document.createElement('div');d.id='case-open-modal';d.className='case-open-modal';document.body.appendChild(d);}
  function jsArg(v){return JSON.stringify(String(v??'')).replace(/</g,'\\u003c').replace(/>/g,'\\u003e');}
  function activeCar(){return carsDB.find(c=>c.id===state.activeCarId)||carsDB[0];}
  function playerRating(){
    const car=activeCar();
    const power=car?getEffectivePower(car):0;
    const build=localBuildRating(car?.id||1);
    return Math.max(0,Math.round((Number(state.level)||1)*45+(Number(state.stats?.wins)||0)*18+(Number(state.districtRep)||0)*.32+power*.38+build*6));
  }

  /* ---------- STATE 9 ---------- */
  const v8DefaultState=defaultState;
  const v8NormalizeState=normalizeState;
  defaultState=function(){
    const s=v8DefaultState();
    s.saveVersion=V9_VERSION;
    s.playerUsername='';
    s.stats=s.stats||{};
    s.stats.best0100=0;
    s.caseAppliedRolls=[];
    return s;
  };
  normalizeState=function(raw){
    const out=v8NormalizeState(raw),src=plainObject(raw)?raw:{},stats=plainObject(src.stats)?src.stats:{};
    out.saveVersion=V9_VERSION;
    out.playerUsername=safeText(src.playerUsername,'',32).replace(/^@/,'').replace(/[^A-Za-z0-9_]/g,'');
    out.stats.best0100=finiteNumber(stats.best0100,0,0,120);
    out.caseAppliedRolls=Array.isArray(src.caseAppliedRolls)?[...new Set(src.caseAppliedRolls.slice(-100).map(x=>safeText(String(x),'',64)).filter(Boolean))]:[];
    return out;
  };
  const v8InitTelegram=initTelegram;
  initTelegram=function(){
    v8InitTelegram();
    try{
      const u=window.Telegram?.WebApp?.initDataUnsafe?.user;
      if(u?.username)state.playerUsername=safeText(String(u.username),'',32).replace(/^@/,'').replace(/[^A-Za-z0-9_]/g,'');
    }catch(_){ }
  };

  /* ---------- RACE PHYSICS 9 ---------- */
  const v8PrepareRace=prepareRace;
  prepareRace=function(target,mode){
    v8PrepareRace(target,mode);
    const c=raceCtx;if(!c)return;
    c.gearCaps=GEAR_CAPS.slice();
    c.gearFloors=GEAR_FLOORS.slice();
    c.trackLength=1050+Math.floor(rand()*180);
    c.zeroTo100=0;c.stalled=false;c.stallTimer=0;c.throttleKick=0;c.throttleWasDown=false;
    c.lastVisualLead=0;c.overtakes=0;c.fxParticles=null;c.fxCanvas=null;c.fxCtx=null;c.fxW=0;c.fxH=0;
    c.aiGear=1;c.aiRpm=1200;c.aiShiftPause=0;
    renderRaceBrief();
  };

  const v8ChooseLaunch=chooseLaunch;
  chooseLaunch=function(mode){
    v8ChooseLaunch(mode);const c=raceCtx;if(!c)return;
    c.launchQuality=clamp(Number(c.launchQuality)||0,0,1);c.launchImpulse=1.02+c.launchQuality*.22;
    c.speed=0;c.distance=0;c.aiSpeed=0;c.aiDistance=0;c.aiStartDelay=.12+rand()*.22;
    c.rpm=2500+c.launchQuality*3100;
  };

  const v8ShowRaceCockpit=showRaceCockpit;
  showRaceCockpit=function(){
    v8ShowRaceCockpit();
    const c=raceCtx;if(!c)return;
    const map=document.querySelector('#race-content .race-map');
    if(map&&!document.getElementById('race-fx-canvas')){
      const canvas=document.createElement('canvas');canvas.id='race-fx-canvas';canvas.className='race-fx-canvas';canvas.setAttribute('aria-hidden','true');map.prepend(canvas);
      c.fxCanvas=canvas;initRaceFx(c);
    }
    const badge=document.querySelector('#race-content .race-event-badge');
    if(badge&&!document.getElementById('race-gap-visual')){
      badge.insertAdjacentHTML('beforebegin','<div class="race-gap-visual" id="race-gap-visual"><div class="gap-title"><span id="gap-side-left">RIVAL</span><b id="gap-time-label">0.00 s</b><span id="gap-side-right">YOU</span></div><div class="gap-track-v9"><i class="gap-center-v9"></i><i class="gap-fill-v9" id="gap-fill-v9"></i><i class="gap-marker-v9" id="gap-marker-v9"></i></div></div>');
    }
    const help=document.getElementById('shift-help');
    if(help)help.innerHTML='1-я: 40 · 2-я: 90 · 3-я: 150 · 4-я: 215 · 5-я: 285 · 6-я: 380 км/ч';
    updateRaceZones();updateRaceHUD();
  };

  function initRaceFx(c){
    const canvas=c.fxCanvas;if(!canvas)return;
    const lowEnd=!!c.fxLowQuality||(navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4)||(navigator.deviceMemory&&navigator.deviceMemory<=4);
    const dpr=Math.min(window.devicePixelRatio||1,lowEnd?1:1.35);
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.floor(rect.width*dpr)),h=Math.max(1,Math.floor(rect.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    c.fxCtx=canvas.getContext('2d',{alpha:true,desynchronized:true});c.fxDpr=dpr;c.fxW=w;c.fxH=h;
    const count=lowEnd?10:16;
    c.fxParticles=Array.from({length:count},(_,i)=>({x:(i+.5)/count,y:rand(),len:.08+rand()*.16,speed:.65+rand()*.8}));
  }
  function renderRaceFx(c,dt){
    if(!c?.fxCtx||!c.fxCanvas||state.settings?.reducedMotion)return;
    const rect=c.fxCanvas.getBoundingClientRect(),dpr=c.fxDpr||1;
    const rw=Math.floor(rect.width*dpr),rh=Math.floor(rect.height*dpr);
    if(Math.abs(rw-c.fxW)>2||Math.abs(rh-c.fxH)>2){initRaceFx(c);}
    const ctx=c.fxCtx,w=c.fxW,h=c.fxH;ctx.clearRect(0,0,w,h);
    const intensity=clamp((c.speed-55)/250,0,1);if(intensity<=.02)return;
    ctx.globalCompositeOperation='source-over';ctx.lineCap='round';
    const cx=w*.5,cy=h*.42;
    for(const p of c.fxParticles){
      p.y+=dt*p.speed*(.55+intensity*2.5);if(p.y>1.12){p.y=-.12;p.x=.04+rand()*.92;}
      const spread=(p.x-.5),nearY=cy+p.y*h*.72,farY=nearY+p.len*h*(.5+intensity*1.2);
      const nearX=cx+spread*w*(.15+p.y*.8),farX=cx+spread*w*(.18+(p.y+p.len)*.92);
      ctx.strokeStyle='rgba(235,240,230,'+(0.10+intensity*.42)+')';ctx.lineWidth=(.6+intensity*1.5)*dpr;
      ctx.beginPath();ctx.moveTo(nearX,nearY);ctx.lineTo(farX,farY);ctx.stroke();
    }
    if(c.nitroActive||intensity>.82){
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.72);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(210,220,205,'+(intensity*.12)+')');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    }
  }

  raceHold=function(type,on){
    if(!raceCtx||raceCtx.finished)return;
    const c=raceCtx;
    if(type==='gas'&&on&&!c.gas){c.throttleKick=.16;const root=document.querySelector('#race-content .race3');if(root){root.classList.remove('throttle-hit');void root.offsetWidth;root.classList.add('throttle-hit');}}
    c[type]=on;
    const b=document.getElementById(type==='gas'?'gas-btn':'brake-btn');if(b)b.classList.toggle('active',on);
  };

  manualShift=function(){
    const c=raceCtx;if(!c||c.finished||c.startLocked)return;
    if(c.gear>=6){showShiftText('6-Я ПЕРЕДАЧА · ФИЗИЧЕСКИЙ ПРЕДЕЛ',false);return;}
    if(c.speed<5&&c.gear===1){
      c.rpm=750;c.stalled=true;c.stallTimer=.72;c.errors++;
      showAction('СТАРТ СО 2-Й ЗАПРЕЩЁН · ДВИГАТЕЛЬ ЗАГЛОХ');showShiftText('ТРОГАТЬСЯ МОЖНО ТОЛЬКО С 1-Й',false);haptic('warning');updateRaceHUD();return;
    }
    const p=c.rpm/c.redline,g=c.profile.greenWidth,y=c.profile.yellowWidth,center=.88;
    const perfect=Math.abs(p-center)<=g,good=Math.abs(p-center)<=y;
    c.shiftCount++;const oldGear=c.gear;c.gear=Math.min(6,c.gear+1);
    if(perfect){
      c.perfectShifts++;c.goodShifts++;c.shiftBoost=1.28+Math.min(.07,c.profile.trans*.012);c.shiftBoostTimer=.62;
      c.speed=Math.min(c.gearCaps[c.gear],c.speed+7.5+c.speed*.035);c.rpm=Math.max(3300,c.rpm*c.profile.shiftRecovery);
      recordContractEvent('perfectShift',1);haptic('success');showAction('PERFECT SHIFT · ИМПУЛЬС ТЯГИ');showShiftText('ЗЕЛЁНАЯ ЗОНА · УСКОРЕНИЕ',true);
    }else if(good){
      c.goodShifts++;c.shiftBoost=1.11;c.shiftBoostTimer=.38;c.speed=Math.min(c.gearCaps[c.gear],c.speed+3.2);c.rpm=Math.max(2900,c.rpm*c.profile.shiftRecovery*.94);
      haptic('medium');showAction('GOOD SHIFT · ТЯГА СОХРАНЕНА');showShiftText('ЖЁЛТАЯ ЗОНА · ХОРОШИЙ SHIFT',false);
    }else{
      c.errors++;const late=p>.96;c.shiftBoost=Math.max(.84,.76+c.profile.trans*.02);c.shiftBoostTimer=.48;c.speed*=Math.max(.90,.845+c.profile.trans*.014);c.rpm=Math.max(late?2600:1900,c.rpm*(late?.50:.61));
      haptic('warning');showAction((late?'ПОЗДНИЙ':'РАННИЙ')+' SHIFT · ПРОВАЛ ТЯГИ');showShiftText((late?'ПОЗДНО':'РАНО')+' · ПОТЕРЯ УСКОРЕНИЯ',false);
    }
    c.aiShiftPause=Math.max(c.aiShiftPause||0,0);
    const status=document.getElementById('race-status');if(status)status.dataset.lastGear=String(oldGear);
    updateRaceHUD();
  };

  function speedToRpm(speed,gear,redline){
    const floor=GEAR_FLOORS[gear]||0,cap=GEAR_CAPS[gear]||380;
    const t=clamp((speed-floor)/Math.max(1,cap-floor),0,1);
    return 1150+t*(redline-1150);
  }
  function torqueCurve(rpmNorm){
    const x=clamp((rpmNorm-.10)/.90,0,1);
    return .72+Math.sin(x*Math.PI)*.34+x*.08;
  }
  function simulateAiV9(c,dt){
    if(c.elapsed<c.aiStartDelay){c.aiRpm=Math.max(900,c.aiRpm-900*dt);return;}
    if(c.aiShiftPause>0){c.aiShiftPause-=dt;c.aiSpeed=Math.max(0,c.aiSpeed-1.2*dt);return;}
    const gear=c.aiGear||1,cap=GEAR_CAPS[gear],myPower=getEffectivePower(activeCar()),powerRatio=clamp((Number(c.opp.power)||myPower)/Math.max(1,myPower),.68,1.38);
    const style=c.rival?.style||'';let aggression=.96+(powerRatio-1)*.16;if(/Агрессив|Контрат|Босс|давлен/i.test(style))aggression+=.05;
    const gap=c.distance-c.aiDistance;if(gap>8)aggression+=clamp(gap/260,0,.07);if(gap<-20)aggression-=.018;if(c.aiSurgeTimer>0){c.aiSurgeTimer-=dt;aggression+=.06;}
    const rpmNorm=c.aiRpm/c.redline,curve=torqueCurve(rpmNorm),gearTorque=GEAR_TORQUE[gear];
    const hpFactor=Math.sqrt(Math.max(120,Number(c.opp.power)||300)/300);
    const limiter=clamp((cap-c.aiSpeed)/13,.035,1);
    const rate=37*hpFactor*gearTorque*curve*aggression*c.aiSkill*limiter;
    c.aiSpeed+=Math.max(0,rate)*dt;
    c.aiSpeed=Math.min(cap,c.aiSpeed);
    const rpmTarget=speedToRpm(c.aiSpeed,gear,c.redline);c.aiRpm+=(rpmTarget-c.aiRpm)*Math.min(1,dt*9);
    if(c.aiSpeed>=cap-1.1&&gear<6){c.aiGear++;c.aiShiftPause=.075+rand()*.075;c.aiRpm=Math.max(3100,c.aiRpm*(.57+clamp(powerRatio-1,-.2,.2)*.08));c.aiSpeed+=1.8+rand()*2.8;}
    c.aiSpeed=Math.min(GEAR_CAPS[c.aiGear],c.aiSpeed,c.aiMaxSpeed);
    c.aiDistance=Math.min(c.trackLength,c.aiDistance+(c.aiSpeed/3.6)*dt);
  }

  simulateRace=function(dt){
    const c=raceCtx;if(!c||c.startLocked)return;c.elapsed+=dt;
    if(c.nitroTimer>0){c.nitroTimer=Math.max(0,c.nitroTimer-dt);c.nitroActive=c.nitroTimer>0;}
    if(c.shiftBoostTimer>0)c.shiftBoostTimer=Math.max(0,c.shiftBoostTimer-dt);else c.shiftBoost+=(1-c.shiftBoost)*Math.min(1,dt*5.5);
    if(c.actionTimer>0){c.actionTimer-=dt;if(c.actionTimer<=0)document.getElementById('race-action')?.classList.remove('show');}
    if(c.gas&&!c.brake&&c.gear>1&&c.speed<5&&!c.stalled){c.stalled=true;c.stallTimer=.72;c.speed=0;c.rpm=750;c.errors=(c.errors||0)+1;showAction('СТАРТ ТОЛЬКО С 1-Й · ДВИГАТЕЛЬ ЗАГЛОХ');}
    if(c.stalled){
      c.stallTimer-=dt;c.speed=0;c.rpm=Math.max(650,c.rpm-280*dt);
      if(c.stallTimer<=0){c.stalled=false;c.gear=1;c.rpm=1100;showAction('ДВИГАТЕЛЬ ПЕРЕЗАПУЩЕН · 1-Я ПЕРЕДАЧА');}
      simulateAiV9(c,dt);
      return;
    }
    const gear=c.gear||1,gearCap=Math.min(GEAR_CAPS[gear],Math.max(1,c.maxSpeed));
    if(c.gas&&!c.brake){
      const rpmNorm=c.rpm/c.redline,curve=torqueCurve(rpmNorm),car=activeCar(),hp=Math.max(120,getEffectivePower(car));
      const hpFactor=Math.sqrt(hp/300),limiter=clamp((gearCap-c.speed)/12,.025,1),nitro=c.nitroActive?1.19:1,boost=c.shiftBoost||1;
      const launchMul=c.distance<28?(c.launchImpulse||1):1,accelMod=1+(Math.max(1,c.profile.accel)-1)*.58;
      let rate=28.5*hpFactor*GEAR_TORQUE[gear]*curve*accelMod*nitro*boost*limiter*launchMul;
      if(c.throttleKick>0){rate*=1.22;c.throttleKick=Math.max(0,c.throttleKick-dt);}
      const aero=Math.max(0,(c.speed/380)*(c.speed/380))*6.5;
      c.speed+=Math.max(0,rate-aero)*dt;
      c.speed=Math.min(gearCap,c.speed);
      const targetRpm=speedToRpm(c.speed,gear,c.redline);c.rpm+=(targetRpm-c.rpm)*Math.min(1,dt*(8.5+c.profile.rpmRate*2.0));
      if(c.speed>=gearCap-.25)c.rpm=Math.min(c.redline,c.rpm+1000*dt);
    }else{
      c.speed=Math.max(0,c.speed-(4.2+c.speed*.012)*dt);const target=speedToRpm(c.speed,gear,c.redline);c.rpm+=(target-c.rpm)*Math.min(1,dt*5.2);c.rpm=Math.max(950,c.rpm);
    }
    if(c.brake){c.speed=Math.max(0,c.speed-(72+c.speed*.05)*dt);c.rpm=Math.max(900,c.rpm-2500*dt);}
    c.speed=Math.max(0,Math.min(gearCap,c.speed));c.topSpeed=Math.max(c.topSpeed||0,c.speed);
    if(!c.zeroTo100&&c.speed>=100)c.zeroTo100=c.elapsed;
    c.distance=Math.min(c.trackLength,c.distance+(c.speed/3.6)*dt);
    simulateAiV9(c,dt);

    c.eventCooldown-=dt;
    if(c.eventCooldown<=0&&c.elapsed>2.2){
      c.eventCooldown=2.6+rand()*3.6;const gap=c.distance-c.aiDistance;
      if(Math.abs(gap)<14&&rand()<.76){c.aiSurgeTimer=.6+rand()*1.0;showAction(gap>=0?'СОПЕРНИК В ЗЕРКАЛЕ · ДЕРЖИ ИДЕАЛЬНЫЙ SHIFT':'СЛИПСТРИМ · ГОТОВЬ ОБГОН');}
      else if(c.speed>180&&rand()<.48){showAction('СКОРОСТНОЙ УЧАСТОК · ДОРОГА СЖИМАЕТСЯ');}
    }
    if(c.aiDistance>=c.trackLength&&!c.aiFinishedAt)c.aiFinishedAt=c.elapsed;
    if(c.distance>=c.trackLength){c.playerFinishedAt=c.elapsed;finishRace(!c.aiFinishedAt||c.playerFinishedAt<=c.aiFinishedAt,c);}
  };

  updateRaceZones=function(){
    const c=raceCtx;if(!c)return;const centerNorm=.88,center=centerNorm*264-132;
    const greenDeg=Math.max(9,Math.min(34,c.profile.greenWidth*560));
    const yellowDeg=Math.max(greenDeg+13,Math.min(66,c.profile.yellowWidth*560));
    const d=document.getElementById('rpm-dial');if(d){d.style.setProperty('--yellow-start',(center-yellowDeg/2)+'deg');d.style.setProperty('--yellow-end',(center+yellowDeg/2)+'deg');d.style.setProperty('--green-start',(center-greenDeg/2)+'deg');d.style.setProperty('--green-end',(center+greenDeg/2)+'deg');}
  };

  const v8UpdateRaceHUD=updateRaceHUD;
  updateRaceHUD=function(){
    v8UpdateRaceHUD();const c=raceCtx;if(!c)return;
    const cap=c.gearCaps?.[c.gear]||GEAR_CAPS[c.gear]||380;
    const help=document.getElementById('shift-help');if(help)help.textContent='ПЕРЕДАЧА '+c.gear+' · ЛИМИТ '+cap+' КМ/Ч · '+(c.gear<6?'SHIFT В ЗЕЛЁНОЙ ЗОНЕ':'МАКСИМАЛЬНАЯ ПЕРЕДАЧА');
    const gap=c.distance-c.aiDistance,marker=document.getElementById('gap-marker-v9'),fill=document.getElementById('gap-fill-v9'),label=document.getElementById('gap-time-label');
    const pct=clamp(gap/36,-1,1),visual=50+pct*46;
    if(marker){marker.style.left='calc('+visual+'% - 5px)';marker.style.transform='translate3d(0,0,0)';}
    if(fill){fill.style.left=(pct>=0?50:visual)+'%';fill.style.width=(Math.abs(pct)*46)+'%';fill.classList.toggle('behind',pct<0);}
    if(label){const relative=Math.max(5,(c.speed+c.aiSpeed)*.5)/3.6,timeGap=Math.abs(gap)/relative;label.textContent=(gap>=0?'+':'−')+timeGap.toFixed(2)+' s · '+Math.abs(gap).toFixed(1)+' m';label.classList.toggle('behind',gap<0);}
    const sign=gap>1.8?1:gap<-1.8?-1:0;
    if(sign&&c.lastVisualLead&&sign!==c.lastVisualLead&&c.elapsed>1.4){c.overtakes=(c.overtakes||0)+1;const g=document.getElementById('race-gap-visual');if(g){g.classList.remove('overtake');void g.offsetWidth;g.classList.add('overtake');}}
    if(sign)c.lastVisualLead=sign;
    const root=document.querySelector('#race-content .race3');if(root){root.style.setProperty('--race-speed',clamp(c.speed/300,0,1).toFixed(3));root.classList.toggle('speed-200',c.speed>=200);root.classList.toggle('speed-280',c.speed>=280);}
  };

  raceFrame=function(now){
    const c=raceCtx;if(!c||c.finished)return;
    let dt=(now-(c.lastTs||now))/1000;c.lastTs=now;dt=clamp(dt,.001,.05);
    if(document.hidden){c.raf=requestAnimationFrame(raceFrame);return;}
    c.frameEma=c.frameEma?c.frameEma*.94+dt*.06:dt;if(c.frameEma>.022&&!c.fxLowQuality){c.fxLowQuality=true;initRaceFx(c);}
    simulateRace(dt);renderRaceFx(c,dt);c.uiTimer+=dt;
    // DOM updates are capped at 20 Hz; physics and canvas stay on the display RAF.
    if(c.uiTimer>=.05){c.uiTimer=0;updateRaceHUD();}
    if(!c.finished)c.raf=requestAnimationFrame(raceFrame);
  };

  const v8FinishRace=finishRace;
  finishRace=function(won,c){
    if(c?.zeroTo100&&(!state.stats.best0100||c.zeroTo100<state.stats.best0100))state.stats.best0100=Number(c.zeroTo100.toFixed(3));
    v8FinishRace(won,c);
    const result=document.querySelector('#race-content .result-box');
    if(result&&c){const line=document.createElement('div');line.className='race-result-telemetry';line.innerHTML='<span>0–100 <b>'+(c.zeroTo100?c.zeroTo100.toFixed(2)+' s':'—')+'</b></span><span>Обгоны <b>'+(c.overtakes||0)+'</b></span><span>MAX <b>'+Math.round(c.topSpeed||0)+' км/ч</b></span>';result.appendChild(line);}
  };

  /* ---------- SERVER-SYNCHRONIZED CASES 9 ---------- */
  function caseContext(){
    const u=getUpg(state.activeCarId),available=['engine','turbo','gearbox','tires'].filter(k=>(Number(u[k])||0)<5);
    return {owned_cars:state.ownedCars.slice(0,100),available_parts:available,active_car_id:state.activeCarId};
  }
  function normalizeServerPrize(raw){
    const p=plainObject(raw)?raw:{};const rarity=['common','rare','epic','legendary','mythic'].includes(p.rarity)?p.rarity:'common',type=['coins','tuning','plate','car'].includes(p.type)?p.type:'coins';
    const out={type,rarity,label:safeText(p.label,'Награда',80)};
    if(type==='coins')out.amount=intNumber(p.amount,1,1,5_000_000);
    if(type==='tuning'){out.part=['engine','turbo','gearbox','tires'].includes(p.part)?p.part:'engine';out.label=({engine:'Двигатель',turbo:'Турбо',gearbox:'КПП',tires:'Шины'}[out.part]||'Тюнинг')+' · +1 STAGE';}
    if(type==='car'){out.carId=intNumber(p.carId,0,1,100000);const car=carsDB.find(c=>c.id===out.carId);if(car)out.label=car.name;}
    if(type==='plate')out.plate={uid:safeText(p.plate?.uid,'plate_'+Date.now(),64),text:safeText(p.plate?.text,'X777XX',18),rarity,series:safeText(p.plate?.series,'CASE',24),value:intNumber(p.plate?.value,1000,0,2_000_000),limited:p.plate?.limited===true,createdAt:Date.now()};
    return out;
  }
  function visualRarity(cs){let r=rand()*100,sum=0;for(const [rar,w] of cs.weights){sum+=w;if(r<=sum)return rar;}return cs.weights[0][0];}
  function visualPrize(cs){
    const rarity=visualRarity(cs),t=rand();if(t<.46)return {type:'coins',rarity,label:fmt(Math.round(cs.price*(.4+rand()*2.1)))+' SYND'};
    if(t<.72)return {type:'tuning',rarity,label:['Двигатель','Турбо','КПП','Шины'][Math.floor(rand()*4)]+' · +1 STAGE'};
    if(t<.94)return {type:'plate',rarity,label:['A111AA','X777XX','M505MM','K009KK'][Math.floor(rand()*4)]};
    return {type:'car',rarity:rarity==='common'?'rare':rarity,label:'RARE VEHICLE'};
  }
  function v9CaseItemHtml(p){return '<div class="case-reel-item rar-'+p.rarity+'"><span>'+RARITY_LABEL_V9[p.rarity]+'</span><b>'+escapeHtml(p.label)+'</b><small>'+({coins:'SYND',tuning:'TUNING',plate:'PLATE',car:'VEHICLE'}[p.type]||'DROP')+'</small></div>';}
  function grantServerCasePrize(prize,cs,rollId){
    if(state.caseAppliedRolls.includes(rollId))return false;
    if(prize.type==='coins'){state.coins+=prize.amount;state.stats.totalEarned+=prize.amount;}
    else if(prize.type==='tuning'){const u=getUpg(state.activeCarId),before=Number(u[prize.part]||0);if(before<5){u[prize.part]=before+1;state.tuningHistory[state.activeCarId]=state.tuningHistory[state.activeCarId]||[];state.tuningHistory[state.activeCarId].push({ts:Date.now(),part:prize.part,level:before+1,price:0,source:'case-v9'});}}
    else if(prize.type==='plate'&&prize.plate){if(!state.plateInventory.some(x=>x.uid===prize.plate.uid))state.plateInventory.push(prize.plate);}
    else if(prize.type==='car'&&carsDB.some(c=>c.id===prize.carId)&&!state.ownedCars.includes(prize.carId)){state.ownedCars.push(prize.carId);getUpg(prize.carId);getFuel(prize.carId);getCondition(prize.carId);}
    state.caseAppliedRolls.push(rollId);state.caseAppliedRolls=state.caseAppliedRolls.slice(-100);
    state.caseHistory.push({ts:Date.now(),caseId:cs.id,label:prize.label,rarity:prize.rarity,type:prize.type});state.caseHistory=state.caseHistory.slice(-60);
    updateHeader();saveState();checkAchievements();return true;
  }
  async function markCaseClaimed(rollId){try{if(sb&&onlineAuthReady)await sb.rpc('autosyndicate_claim_case_roll',{p_roll_id:rollId});}catch(e){console.warn('case claim mark',e);}}
  async function reconcileCaseRolls(){
    if(state.caseOpening||!sb||!onlineAuthReady)return;
    try{
      const {data,error}=await sb.from('case_rolls').select('id,case_id,price,prize,created_at').is('claimed_at',null).order('created_at',{ascending:true}).limit(8);if(error)throw error;
      for(const row of data||[]){
        if(state.caseAppliedRolls.includes(String(row.id))){await markCaseClaimed(row.id);continue;}
        const price=intNumber(row.price,0,0,100000),cs=CASES_V9[row.case_id];if(!cs)continue;
        if(state.coins<price)continue;
        state.coins-=price;state.stats.totalSpent+=price;state.stats.casesOpened++;
        const prize=normalizeServerPrize(row.prize);grantServerCasePrize(prize,cs,String(row.id));await markCaseClaimed(row.id);
        showToast('Восстановлен незавершённый кейс: '+prize.label);
      }
    }catch(e){console.warn('case reconcile',e?.message||e);}
  }

  renderCases=function(){
    const root=document.getElementById('cases-list');if(!root)return;const hist=(state.caseHistory||[]).slice().reverse();
    root.innerHTML=Object.values(CASES_V9).map(cs=>'<div class="case-v8-card"><div class="case-v8-mark">'+svgIcon('case')+'</div><div class="case-v8-body"><div class="case-v8-title"><b>'+cs.name+'</b><span>'+fmt(cs.price)+' SYND</span></div><p>Результат фиксируется сервером до запуска анимации. Указатель и награда используют один roll ID.</p><div class="case-chances">'+cs.weights.map(([r,w])=>'<span class="rar-'+r+'">'+RARITY_LABEL_V9[r]+' '+w+'%</span>').join('')+'</div><small>Нужна онлайн-сессия Supabase v9. Рассинхронизация рулетки исключена.</small><button class="btn btn-gold" '+(state.coins<cs.price||state.caseOpening?'disabled':'')+' onclick="openCase(\''+cs.id+'\')">ОТКРЫТЬ</button></div></div>').join('')+'<div class="case-history"><div class="v8-section-head"><b>ИСТОРИЯ ОТКРЫТИЙ</b><span>'+hist.length+'</span></div>'+(hist.length?hist.slice(0,12).map(x=>'<div class="history-row"><span class="rar-'+x.rarity+'">'+RARITY_LABEL_V9[x.rarity]+'</span><b>'+escapeHtml(x.label)+'</b><small>'+new Date(x.ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</small></div>').join(''):'<div class="empty-note">Кейсы ещё не открывались.</div>')+'</div>';
  };

  openCase=async function(caseId){
    const cs=CASES_V9[caseId];if(!cs||state.caseOpening)return;if(state.coins<cs.price){showToast('Недостаточно SYND');return;}
    if(!await requireOnlineWrite('Кейсы'))return;
    state.caseOpening=true;renderCases();
    try{
      const {data,error}=await sb.rpc('autosyndicate_roll_case',{p_case_id:caseId,p_context:caseContext()});if(error)throw error;
      const payload=Array.isArray(data)?data[0]:data;const rollId=String(payload?.roll_id||payload?.id||''),prize=normalizeServerPrize(payload?.prize||{}),price=intNumber(payload?.price,cs.price,1,100000);
      if(!rollId)throw new Error('server roll id missing');if(state.coins<price)throw new Error('Недостаточно SYND для подтверждения server roll');
      state.coins-=price;state.stats.totalSpent+=price;state.stats.casesOpened++;saveState();updateHeader();
      const strip=[];for(let i=0;i<43;i++)strip.push(i===CASE_TARGET_INDEX?prize:visualPrize(cs));
      ensureCaseModalV9();const modal=document.getElementById('case-open-modal');modal.classList.add('show');modal.innerHTML='<div class="case-open-shell"><div class="case-open-head"><span>'+cs.name+'</span><b>SERVER ROLL · '+escapeHtml(rollId.slice(0,8).toUpperCase())+'</b></div><div class="case-reel-window" id="case-reel-window"><div class="case-pointer-v9"></div><div class="case-center-line"></div><div class="case-reel-track" id="case-reel-track">'+strip.map(v9CaseItemHtml).join('')+'</div></div><div class="case-open-status" id="case-open-status">Сервер зафиксировал награду · прокрутка...</div></div>';
      const track=document.getElementById('case-reel-track'),win=document.getElementById('case-reel-window');
      const finish=async()=>{if(state.caseOpening!==true)return;grantServerCasePrize(prize,cs,rollId);await markCaseClaimed(rollId);const st=document.getElementById('case-open-status');if(st)st.innerHTML='<span class="rar-'+prize.rarity+'">'+RARITY_LABEL_V9[prize.rarity]+'</span><b>'+escapeHtml(prize.label)+'</b><button class="btn btn-select" onclick="closeCaseModal()">ЗАБРАТЬ</button>';state.caseOpening=false;saveState();renderCases();};
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        const item=track?.children?.[CASE_TARGET_INDEX];if(!track||!win||!item){finish();return;}
        const target=win.clientWidth/2-(item.offsetLeft+item.offsetWidth/2);track.style.transform='translate3d('+target+'px,0,0)';
        let done=false;const complete=()=>{if(done)return;done=true;finish();};track.addEventListener('transitionend',complete,{once:true});setTimeout(complete,3600);
      }));
    }catch(e){state.caseOpening=false;console.warn('case roll failed',e);showToast('Кейс не открыт: '+safeText(e?.message||'ошибка сервера','ошибка сервера',90));renderCases();}
  };

  /* ---------- SVG SLOT MACHINE 9 ---------- */
  const SLOT_V9=[
    {id:'bolt',weight:30,mult:3,label:'BOLT'},
    {id:'diamond',weight:24,mult:4,label:'DIAMOND'},
    {id:'star',weight:18,mult:6,label:'STAR'},
    {id:'crown',weight:13,mult:10,label:'CROWN'},
    {id:'bar',weight:10,mult:20,label:'BAR'},
    {id:'seven',weight:5,mult:50,label:'777'}
  ];
  function slotPick(){const total=SLOT_V9.reduce((a,x)=>a+x.weight,0);let r=rand()*total;for(const s of SLOT_V9){if(r<s.weight)return s;r-=s.weight;}return SLOT_V9[0];}
  function slotSvg(id){
    const paths={
      bolt:'<path d="M13 2 5 13h6l-1 9 9-13h-6z"/>',
      diamond:'<path d="M4 8 8 3h8l4 5-8 13L4 8Z"/><path d="M4 8h16M8 3l4 5 4-5M12 8v13"/>',
      star:'<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3Z"/>',
      crown:'<path d="m4 7 4 4 4-7 4 7 4-4-2 11H6L4 7Z"/><path d="M6 18h12"/>',
      bar:'<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 12h10"/>',
      seven:'<path d="M5 5h14l-8 15"/><path d="M6 9h10"/>'
    };
    const label=SLOT_V9.find(s=>s.id===id)?.label||id.toUpperCase();return '<div class="slot-symbol-v9 '+id+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+paths[id]+'</svg><span>'+label+'</span></div>';
  }
  function initSlotsV9(){
    ['reel0','reel1','reel2'].forEach((id,i)=>{const r=document.getElementById(id);if(r&&!r.dataset.v9){r.dataset.v9='1';r.classList.add('reel-v9');r.innerHTML='<div class="slot-strip-v9">'+slotSvg(['bar','seven','diamond'][i])+'</div>';}});
  }
  slotsSpin=function(){
    if(slotsSpinning)return;initSlotsV9();const input=document.getElementById('slots-bet-input'),bet=clampBet(input,10);if(bet>state.coins||bet<10){showToast('Некорректная ставка');return;}
    state.coins-=bet;state.stats.casinoWagered+=bet;updateHeader();saveState();slotsSpinning=true;const final=[slotPick(),slotPick(),slotPick()];const reels=[0,1,2].map(i=>document.getElementById('reel'+i));document.getElementById('slots-message').textContent='Барабаны вращаются...';
    reels.forEach((reel,i)=>{const seq=[];for(let j=0;j<14+i*2;j++)seq.push(slotPick());seq.push(final[i]);const strip=document.createElement('div');strip.className='slot-strip-v9';strip.innerHTML=seq.map(s=>slotSvg(s.id)).join('');reel.innerHTML='';reel.appendChild(strip);strip.style.transitionDuration=(1.05+i*.16)+'s';requestAnimationFrame(()=>requestAnimationFrame(()=>{strip.style.transform='translate3d(0,-'+((seq.length-1)*86)+'px,0)';}));});
    const settle=()=>{let payout=0,msg='Комбинация не сыграла';if(final[0].id===final[1].id&&final[1].id===final[2].id){payout=bet*final[0].mult;msg='ДЖЕКПОТ · '+final[0].label+' ×'+final[0].mult;}else if(final[0].id===final[1].id||final[1].id===final[2].id||final[0].id===final[2].id){payout=Math.round(bet*1.5);msg='ПАРА · ×1.5';}if(payout>0){state.coins+=payout;state.stats.casinoWon+=Math.max(0,payout-bet);flashResult(document.querySelector('#screen-slots'),true);}else flashResult(document.querySelector('#screen-slots'),false);const m=document.getElementById('slots-message');m.textContent=msg+(payout?' · +'+fmt(payout)+' SYND':'');m.style.color=payout>0?'var(--green)':'var(--text-muted)';slotsSpinning=false;updateHeader();saveState();checkAchievements();};
    const last=reels[2]?.querySelector('.slot-strip-v9');if(last){let done=false;const f=()=>{if(done)return;done=true;settle();};last.addEventListener('transitionend',f,{once:true});setTimeout(f,1900);}else settle();
  };

  /* ---------- PROFILES / FRIENDS / CLANS ---------- */
  const v8PlayerProfilePayload=playerProfilePayload;
  playerProfilePayload=function(){
    const p=v8PlayerProfilePayload(),car=activeCar();return {...p,telegram_username:state.playerUsername||null,best_0_100:state.stats.best0100||null,current_car_name:car?.name||null,rating:playerRating()};
  };
  loadPlayerLeaderboard=async function(){
    if(!sb)return[];try{const {data,error}=await sb.from('player_profiles').select('id,name,photo_url,telegram_username,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,current_car_name,best_0_100,rating,last_seen').order('rating',{ascending:false}).order('wins',{ascending:false}).limit(200);if(error)throw error;return data||[];}catch(e){console.warn('player leaderboard',e);return[];}
  };
  openPublicProfileByName=async function(name){
    if(!sb){showToast('Профиль недоступен без подключения');return;}try{const clean=safeText(name,'',48);if(!clean)return;const {data,error}=await sb.from('player_profiles').select('id,name,photo_url,telegram_username,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,current_car_name,best_0_100,rating,last_seen').eq('name',clean).order('last_seen',{ascending:false}).limit(1).maybeSingle();if(error)throw error;if(data)openPublicProfileData(data);else showToast('Профиль игрока не найден');}catch(e){console.warn(e);showToast('Не удалось загрузить профиль');}
  };
  openPublicProfile=function(name,val,wins,races,cars,profile){
    const root=document.getElementById('public-profile-root');if(!root)return;const p=profile||{},wr=races?Math.round(wins/races*100):0,list=Array.isArray(cars)?cars:[].concat(cars||[]).filter(Boolean),ownedHtml=list.length?list.map(x=>'<span class="player-lb-car">'+escapeHtml(x)+'</span>').join(''):'<span class="muted-v9">Нет данных</span>',balance=Number(p.balance??val)||0,level=Number(p.level)||1,best=Number(p.best_0_100)||0,rating=Number(p.rating)||0,current=safeText(p.current_car_name,'',60)||carsDB.find(c=>String(c.id)===String(p.active_car_id))?.name||'Не указана',username=safeText(p.telegram_username,'',32),isSelf=p.id===state.playerId;
    root.innerHTML='<div class="modal-overlay" onclick="if(event.target===this)closePublicProfile()"><div class="public-profile public-profile-v9"><div class="pp-head"><div class="public-avatar">'+(p.photo_url?'<img src="'+escapeAttrLocal(p.photo_url)+'" alt="">':escapeHtml((name||'Г').charAt(0).toUpperCase()))+'</div><div><div class="pp-name-v9">'+escapeHtml(name)+'</div><div class="pp-meta-v9">RATING '+rating+(username?' · @'+escapeHtml(username):'')+'</div></div></div><div class="pp-grid pp-grid-v9"><div class="pp-stat"><span>Победы</span><b>'+wins+'</b></div><div class="pp-stat"><span>Заезды</span><b>'+races+'</b></div><div class="pp-stat"><span>Win rate</span><b>'+wr+'%</b></div><div class="pp-stat"><span>Лучший 0–100</span><b>'+(best?best.toFixed(2)+' s':'—')+'</b></div><div class="pp-stat"><span>Текущая машина</span><b>'+escapeHtml(current)+'</b></div><div class="pp-stat"><span>Уровень</span><b>'+level+'</b></div></div><div class="pp-stat pp-garage-v9"><span>Гараж</span><div class="player-lb-cars">'+ownedHtml+'</div></div>'+(!isSelf&&p.id?'<button class="btn btn-select" onclick="sendFriendRequestTo('+jsArg(p.id)+')">ДОБАВИТЬ В ДРУЗЬЯ</button>':'')+'<button class="btn btn-ghost" onclick="closePublicProfile()">ЗАКРЫТЬ</button></div></div>';
  };
  openPublicProfileData=function(p){const owned=Array.isArray(p.owned_cars)?p.owned_cars:[],cars=owned.map(id=>carsDB.find(c=>String(c.id)===String(id))).filter(Boolean);openPublicProfile(p.name,p.total_earned||0,p.wins||0,p.races||0,cars.map(c=>c.name),p);};

  function ensureV9Screens(){
    const main=document.getElementById('main-scroll');if(!main)return;
    if(!document.getElementById('screen-friends')){const s=document.createElement('div');s.id='screen-friends';s.className='screen';s.innerHTML='<div class="back-link" onclick="switchTab(\'profile\')">← Профиль</div><div class="section-title"><span>Друзья</span></div><div class="social-search-v9"><input id="friend-query-v9" maxlength="90" placeholder="ID игрока или @telegram_login"><button class="btn btn-select" onclick="sendFriendRequest()">ДОБАВИТЬ</button></div><div id="friends-content-v9" class="list-container"></div>';main.appendChild(s);}
    if(!document.getElementById('screen-clans')){const s=document.createElement('div');s.id='screen-clans';s.className='screen';s.innerHTML='<div class="back-link" onclick="switchTab(\'profile\')">← Профиль</div><div class="section-title"><span>Кланы</span></div><div id="clan-content-v9" class="list-container"></div><div class="section-title clan-ranking-head-v9"><span>Рейтинг кланов</span></div><div class="clan-rank-tabs-v9"><button class="chip-btn active" id="clan-rank-global-v9" onclick="setClanRankMode(\'global\')">ГЛОБАЛЬНЫЙ</button><button class="chip-btn" id="clan-rank-division-v9" onclick="setClanRankMode(\'division\')">ДИВИЗИОН</button></div><div id="clan-leaderboard-v9" class="list-container"></div>';main.appendChild(s);}
  }
  let clanRankMode='global',currentClanDivision='Мантика';
  async function rpc(name,args){if(!await requireOnlineWrite('Социальные функции'))throw new Error('auth unavailable');const {data,error}=await sb.rpc(name,args||{});if(error)throw error;return data;}

  window.sendFriendRequestTo=async function(playerId){try{await rpc('autosyndicate_send_friend_request',{p_query:String(playerId)});showToast('Запрос в друзья отправлен');closePublicProfile();await loadFriendsV9();}catch(e){showToast(safeText(e?.message||'Не удалось отправить запрос','Ошибка',100));}};
  window.sendFriendRequest=async function(){const q=document.getElementById('friend-query-v9')?.value||'';if(!q.trim()){showToast('Введи ID или Telegram login');return;}await window.sendFriendRequestTo(q.trim());};
  window.acceptFriendRequest=async function(id){try{await rpc('autosyndicate_accept_friend_request',{p_friendship_id:Number(id)});showToast('Игрок добавлен в друзья');await loadFriendsV9();}catch(e){showToast(safeText(e?.message||'Ошибка','Ошибка',100));}};
  window.removeFriend=async function(id){try{await rpc('autosyndicate_remove_friendship',{p_friendship_id:Number(id)});await loadFriendsV9();}catch(e){showToast(safeText(e?.message||'Ошибка','Ошибка',100));}};
  async function loadFriendsV9(){
    const root=document.getElementById('friends-content-v9');if(!root)return;root.innerHTML='<div class="empty-note">Загрузка...</div>';if(!await requireOnlineWrite('Друзья'))return;
    try{const {data,error}=await sb.from('friendships').select('*').or('requester_id.eq.'+state.playerId+',recipient_id.eq.'+state.playerId).order('created_at',{ascending:false});if(error)throw error;const rows=data||[],incoming=rows.filter(x=>x.status==='pending'&&x.recipient_id===state.playerId),accepted=rows.filter(x=>x.status==='accepted'),outgoing=rows.filter(x=>x.status==='pending'&&x.requester_id===state.playerId);root.innerHTML='<div class="v9-section-head"><b>ДРУЗЬЯ</b><span>'+accepted.length+'</span></div>'+friendRows(accepted,'accepted')+'<div class="v9-section-head"><b>ВХОДЯЩИЕ</b><span>'+incoming.length+'</span></div>'+friendRows(incoming,'incoming')+'<div class="v9-section-head"><b>ИСХОДЯЩИЕ</b><span>'+outgoing.length+'</span></div>'+friendRows(outgoing,'outgoing');}catch(e){root.innerHTML='<div class="empty-note">Не удалось загрузить друзей: '+escapeHtml(e.message)+'</div>';}
  }
  function friendRows(rows,mode){if(!rows.length)return'<div class="empty-note compact-v9">Нет записей</div>';return rows.map(r=>{const other=r.requester_id===state.playerId?{id:r.recipient_id,name:r.recipient_name}:{id:r.requester_id,name:r.requester_name};return '<div class="social-row-v9"><div><b>'+escapeHtml(other.name||other.id)+'</b><span>'+escapeHtml(other.id)+'</span></div><div class="social-actions-v9">'+(mode==='incoming'?'<button class="btn btn-select" onclick="acceptFriendRequest('+r.id+')">ПРИНЯТЬ</button>':'')+(mode!=='outgoing'?'<button class="btn btn-ghost" onclick="removeFriend('+r.id+')">'+(mode==='accepted'?'УДАЛИТЬ':'ОТКЛОНИТЬ')+'</button>':'<span class="pending-v9">ОЖИДАНИЕ</span>')+'</div></div>';}).join('');}

  window.createClanV9=async function(){const n=document.getElementById('clan-name-v9')?.value||'';try{await rpc('autosyndicate_create_clan',{p_name:n});showToast('Клан создан');await loadClanV9();}catch(e){showToast(safeText(e?.message||'Не удалось создать клан','Ошибка',110));}};
  window.inviteClanV9=async function(){const q=document.getElementById('clan-invite-v9')?.value||'';try{await rpc('autosyndicate_invite_clan_member',{p_query:q});showToast('Приглашение отправлено');await loadClanV9();}catch(e){showToast(safeText(e?.message||'Не удалось пригласить','Ошибка',110));}};
  window.acceptClanInviteV9=async function(id){try{await rpc('autosyndicate_accept_clan_invite',{p_invite_id:Number(id)});showToast('Ты вступил в клан');await loadClanV9();}catch(e){showToast(safeText(e?.message||'Ошибка','Ошибка',110));}};
  window.leaveClanV9=async function(){if(!confirm('Покинуть клан?'))return;try{await rpc('autosyndicate_leave_clan',{});showToast('Ты покинул клан');await loadClanV9();}catch(e){showToast(safeText(e?.message||'Ошибка','Ошибка',110));}};
  window.kickClanMemberV9=async function(uid){if(!confirm('Исключить игрока из клана?'))return;try{await rpc('autosyndicate_kick_clan_member',{p_member_uid:uid});await loadClanV9();}catch(e){showToast(safeText(e?.message||'Ошибка','Ошибка',110));}};
  window.setClanRankMode=function(mode){clanRankMode=mode;document.getElementById('clan-rank-global-v9')?.classList.toggle('active',mode==='global');document.getElementById('clan-rank-division-v9')?.classList.toggle('active',mode==='division');loadClanLeaderboardV9();};

  async function loadClanV9(){
    const root=document.getElementById('clan-content-v9');if(!root)return;root.innerHTML='<div class="empty-note">Загрузка...</div>';if(!await requireOnlineWrite('Кланы'))return;
    try{
      const {data:membership,error:me}=await sb.from('clan_members').select('clan_id,role,clans(id,name,owner_uid,created_at)').eq('player_id',state.playerId).maybeSingle();if(me)throw me;
      const {data:invites,error:ie}=await sb.from('clan_invites').select('id,clan_id,inviter_name,created_at,clans(name)').eq('invitee_id',state.playerId).eq('status','pending').order('created_at',{ascending:false});if(ie)throw ie;
      if(!membership){root.innerHTML='<div class="clan-create-v9"><b>СОЗДАТЬ КЛАН</b><span>Название уникальное. После создания ты становишься лидером.</span><input id="clan-name-v9" maxlength="24" placeholder="Название клана"><button class="btn btn-select" onclick="createClanV9()">СОЗДАТЬ</button></div>'+renderClanInvites(invites||[]);currentClanDivision='Мантика';await loadClanLeaderboardV9();return;}
      const clan=membership.clans||{};const {data:members,error:mm}=await sb.from('clan_members').select('member_uid,player_id,player_name,role,joined_at,player_profiles(rating,wins,current_car_name)').eq('clan_id',membership.clan_id).order('joined_at',{ascending:true});if(mm)throw mm;
      const lb=await getClanLeaderboardRow(membership.clan_id);currentClanDivision=lb?.division||'Мантика';const isOwner=membership.role==='owner';
      root.innerHTML='<div class="clan-hero-v9"><div><span>КЛАН</span><b>'+escapeHtml(clan.name||'Клан')+'</b><small>'+escapeHtml(currentClanDivision)+' · '+fmt(lb?.score||0)+' pts · #'+(lb?.global_rank||'—')+'</small></div><button class="btn btn-ghost" onclick="leaveClanV9()">ВЫЙТИ</button></div>'+(isOwner?'<div class="social-search-v9"><input id="clan-invite-v9" maxlength="90" placeholder="ID или @login друга"><button class="btn btn-select" onclick="inviteClanV9()">ПРИГЛАСИТЬ</button></div>':'')+'<div class="v9-section-head"><b>СОСТАВ</b><span>'+(members||[]).length+'</span></div>'+(members||[]).map(m=>'<div class="clan-member-v9"><div><b>'+escapeHtml(m.player_name)+'</b><span>'+escapeHtml(m.role.toUpperCase())+' · RATING '+(m.player_profiles?.rating||0)+' · '+escapeHtml(m.player_profiles?.current_car_name||'машина не указана')+'</span></div>'+(isOwner&&m.role!=='owner'?'<button class="btn btn-ghost" onclick="kickClanMemberV9('+jsArg(m.member_uid)+')">ИСКЛЮЧИТЬ</button>':'')+'</div>').join('')+renderClanInvites(invites||[]);await loadClanLeaderboardV9();
    }catch(e){root.innerHTML='<div class="empty-note">Не удалось загрузить клан: '+escapeHtml(e.message)+'</div>';}
  }
  function renderClanInvites(invites){if(!invites.length)return'';return '<div class="v9-section-head"><b>ПРИГЛАШЕНИЯ</b><span>'+invites.length+'</span></div>'+invites.map(i=>'<div class="social-row-v9"><div><b>'+escapeHtml(i.clans?.name||'Клан')+'</b><span>Пригласил: '+escapeHtml(i.inviter_name||'Игрок')+'</span></div><button class="btn btn-select" onclick="acceptClanInviteV9('+i.id+')">ВСТУПИТЬ</button></div>').join('');}
  async function getClanLeaderboardRow(clanId){try{const {data,error}=await sb.from('clan_leaderboard').select('*').eq('id',clanId).maybeSingle();if(error)throw error;return data;}catch(_){return null;}}
  async function loadClanLeaderboardV9(){
    const root=document.getElementById('clan-leaderboard-v9');if(!root||!sb)return;try{let q=sb.from('clan_leaderboard').select('*').order('score',{ascending:false}).limit(100);if(clanRankMode==='division')q=q.eq('division',currentClanDivision);const {data,error}=await q;if(error)throw error;const rows=data||[];root.innerHTML=rows.length?'<div class="clan-table-v9"><div class="clan-table-row-v9 head"><span>#</span><b>КЛАН</b><span>ЛИГА</span><span>СОСТАВ</span><span>PTS</span></div>'+rows.map((r,i)=>'<div class="clan-table-row-v9"><span>'+(clanRankMode==='global'?(r.global_rank||i+1):(r.division_rank||i+1))+'</span><b>'+escapeHtml(r.name)+'</b><span>'+escapeHtml(r.division)+'</span><span>'+r.members+'</span><strong>'+fmt(r.score)+'</strong></div>').join('')+'</div>':'<div class="empty-note">В этом рейтинге пока нет кланов.</div>';}catch(e){root.innerHTML='<div class="empty-note">Рейтинг недоступен: '+escapeHtml(e.message)+'</div>';}
  }

  const v8RenderProfile=renderProfile;
  renderProfile=function(){
    v8RenderProfile();ensureV9Screens();const grid=document.querySelector('#screen-profile .hub-grid');if(grid&&!document.getElementById('hub-friends-v9')){const a=document.createElement('div');a.className='hub-card';a.id='hub-friends-v9';a.onclick=()=>switchTab('friends');a.innerHTML='<div class="ic">'+svgIcon('users')+'</div><div class="lbl">Друзья</div><div class="sub">ID и Telegram login</div>';grid.appendChild(a);const b=document.createElement('div');b.className='hub-card';b.id='hub-clans-v9';b.onclick=()=>switchTab('clans');b.innerHTML='<div class="ic">'+svgIcon('shield')+'</div><div class="lbl">Кланы</div><div class="sub">Состав и рейтинг</div>';grid.appendChild(b);}
    const hero=document.querySelector('#screen-profile .profile-hero');if(hero&&!document.getElementById('profile-race-stats-v9')){const car=activeCar(),box=document.createElement('div');box.id='profile-race-stats-v9';box.className='profile-race-stats-v9';box.innerHTML='<span>RATING <b>'+playerRating()+'</b></span><span>0–100 <b>'+(state.stats.best0100?state.stats.best0100.toFixed(2)+' s':'—')+'</b></span><span>МАШИНА <b>'+escapeHtml(car?.name||'—')+'</b></span>';hero.appendChild(box);}
  };

  const v8SwitchTab=switchTab;
  switchTab=function(tabId){ensureV9Screens();v8SwitchTab(tabId);if(tabId==='slots')initSlotsV9();if(tabId==='friends')loadFriendsV9();if(tabId==='clans')loadClanV9();if(tabId==='cases'){reconcileCaseRolls();}};

  // Run reconciliation after online bootstrap has had time to authenticate.
  const v8PollBackgroundClaims=pollBackgroundClaims;
  pollBackgroundClaims=function(){v8PollBackgroundClaims();if(!document.getElementById('screen-race')?.classList.contains('active'))reconcileCaseRolls();};

  window.addEventListener('resize',()=>{if(raceCtx?.fxCanvas)initRaceFx(raceCtx);},{passive:true});
})();
