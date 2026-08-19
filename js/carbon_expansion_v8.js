/* ==================== CARBON DISTRICT 8.0 ====================
   Race dynamics, rival profiles, vehicle-preserving market, plates,
   cases, referral UX, save recovery and UI polish.
*/
(function(){
  const V8_VERSION=8;
  const BACKUP_KEYS=['autosyndicate_save_v8_b1','autosyndicate_save_v8_b2','autosyndicate_save_v8_b3'];
  const RARITY_ORDER={common:0,rare:1,epic:2,legendary:3,mythic:4};
  const RARITY_LABEL={common:'COMMON',rare:'RARE',epic:'EPIC',legendary:'LEGENDARY',mythic:'MYTHIC'};
  const PART_LABEL={engine:'Двигатель',turbo:'Турбо',gearbox:'КПП',tires:'Шины'};

  function svgIcon(name,cls='as-icon'){
    const p={
      map:'<path d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z"/><path d="M9 4v13.5M15 6.5V20"/>',
      list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
      brief:'<rect x="5" y="7" width="14" height="12" rx="2"/><path d="M9 7V5h6v2M5 12h14"/>',
      trophy:'<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v4M8 20h8M9 16h6"/>',
      case:'<path d="M4 9h16v11H4z"/><path d="M3 5h18v4H3zM12 5v15M8 5c0-2 4-2 4 0M16 5c0-2-4-2-4 0"/>',
      chart:'<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
      calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/>',
      tag:'<path d="M20 13 13 20 4 11V4h7l9 9Z"/><circle cx="8" cy="8" r="1"/>',
      chat:'<path d="M4 5h16v11H9l-5 4V5Z"/>',
      bank:'<path d="m3 9 9-5 9 5M5 10v7M9 10v7M15 10v7M19 10v7M3 20h18"/>',
      gear:'<circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3L6.8 4l-1.7.7-1.9-.9L1.1 5.9 2 7.8l-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7 2-.7Z" transform="translate(2.5 0) scale(.8)"/>',
      save:'<path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
      plate:'<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 10h10M7 14h6"/>',
      users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.6-4 2.5-6 6-6s5.4 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.3.4 3.5 2.2 4 5"/>',
      fuel:'<path d="M5 4h8v16H5zM7 8h4M13 7h3l2 3v7a2 2 0 0 0 4 0v-6l-2-2"/>',
      wrench:'<path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-4-4 3-3Z"/>',
      arrow:'<path d="M12 20V5M6 11l6-6 6 6"/>',
      bolt:'<path d="m13 2-8 12h6l-1 8 9-13h-6l0-7Z"/>',
      shield:'<path d="M12 3 20 6v6c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6l8-3Z"/>',
      copy:'<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5H5v11h3"/>',
      car:'<path d="m5 13 2-5h10l2 5"/><path d="M3 13h18v5H3zM6 18v2M18 18v2M6 15h.01M18 15h.01"/>'
    };
    return '<svg class="'+cls+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[name]||p.car)+'</svg>';
  }
  window.svgIcon=svgIcon;

  function sanitizeUiText(v){
    return String(v??'').replace(/[\u{1F000}-\u{1FAFF}]/gu,'').replace(/[\u2600-\u263F\u2700-\u27BF]/g,'').replace(/\s{2,}/g,' ').trim();
  }

  /* ---------- SAVE RECOVERY / NEW STATE ---------- */
  const baseDefaultState=defaultState;
  const baseNormalizeState=normalizeState;
  const baseSaveState=saveState;
  defaultState=function(){
    const s=baseDefaultState();
    return Object.assign(s,{
      saveVersion:V8_VERSION,
      plateInventory:[],installedPlates:{},plateRolls:0,
      casePity:{bronze:0,silver:0,gold:0,goldCar:0},caseHistory:[],caseOpening:false,
      tuningHistory:{},vehicleInstances:{},marketEscrow:{},
      rivalRecords:{},referral:{code:'',bound:false,startBonusClaimed:false,firstRaceBonusClaimed:false,totalClaimed:0,invites:0,earned:0},
      dataRevision:0,lastIntegritySave:0
    });
  };
  function normalizePlate(p){
    if(!p||typeof p!=='object')return null;
    const text=safeText(p.text,'',18).toUpperCase(); if(!text)return null;
    const rarity=['common','rare','epic','legendary','mythic'].includes(p.rarity)?p.rarity:'common';
    return {uid:safeText(p.uid,'plate_'+Math.random().toString(36).slice(2),48),text,rarity,series:safeText(p.series,'STANDARD',24),value:intNumber(p.value,100,0,2_000_000),limited:p.limited===true,createdAt:intNumber(p.createdAt,Date.now(),0,Date.now()+86400000)};
  }
  normalizeState=function(raw){
    const out=baseNormalizeState(raw),s=plainObject(raw)?raw:{};
    out.saveVersion=V8_VERSION;
    out.plateInventory=Array.isArray(s.plateInventory)?s.plateInventory.slice(0,300).map(normalizePlate).filter(Boolean):[];
    out.installedPlates={};
    if(plainObject(s.installedPlates))Object.keys(s.installedPlates).slice(0,100).forEach(k=>{const v=safeText(s.installedPlates[k],'',48);if(/^\d{1,6}$/.test(k)&&v)out.installedPlates[k]=v;});
    out.plateRolls=intNumber(s.plateRolls,0,0,1e7);
    out.casePity={bronze:0,silver:0,gold:0,goldCar:0,...(plainObject(s.casePity)?s.casePity:{})};
    Object.keys(out.casePity).forEach(k=>out.casePity[k]=intNumber(out.casePity[k],0,0,100000));
    out.caseHistory=Array.isArray(s.caseHistory)?s.caseHistory.slice(-60).filter(plainObject).map(x=>({ts:intNumber(x.ts,Date.now(),0,Date.now()+86400000),caseId:safeText(x.caseId,'unknown',20),label:safeText(x.label,'Награда',80),rarity:['common','rare','epic','legendary','mythic'].includes(x.rarity)?x.rarity:'common',type:safeText(x.type,'unknown',20)})):[];
    out.tuningHistory={};
    if(plainObject(s.tuningHistory))Object.keys(s.tuningHistory).slice(0,100).forEach(k=>{if(!/^\d{1,6}$/.test(k)||!Array.isArray(s.tuningHistory[k]))return;out.tuningHistory[k]=s.tuningHistory[k].slice(-40).filter(plainObject).map(x=>({ts:intNumber(x.ts,Date.now(),0,Date.now()+86400000),part:safeText(x.part,'part',16),level:intNumber(x.level,0,0,5),price:intNumber(x.price,0,0,5_000_000),source:safeText(x.source,'shop',20)}));});
    out.marketEscrow=plainObject(s.marketEscrow)?s.marketEscrow:{};
    out.rivalRecords={};
    if(plainObject(s.rivalRecords))Object.keys(s.rivalRecords).slice(0,100).forEach(k=>{const x=s.rivalRecords[k];if(plainObject(x))out.rivalRecords[safeText(k,'',40)]={wins:intNumber(x.wins,0,0,1e6),losses:intNumber(x.losses,0,0,1e6),lastResult:safeText(x.lastResult,'',12)};});
    const rr=plainObject(s.referral)?s.referral:{};
    out.referral={code:safeText(rr.code,'',20),bound:rr.bound===true,startBonusClaimed:rr.startBonusClaimed===true,firstRaceBonusClaimed:rr.firstRaceBonusClaimed===true,totalClaimed:intNumber(rr.totalClaimed,0,0,1e12),invites:intNumber(rr.invites,0,0,1e9),earned:intNumber(rr.earned,0,0,1e12)};
    out.caseOpening=false;out.dataRevision=intNumber(s.dataRevision,0,0,1e9);out.lastIntegritySave=intNumber(s.lastIntegritySave,0,0,Date.now()+86400000);
    return out;
  };
  saveState=function(){
    try{
      state.saveVersion=V8_VERSION;state.dataRevision=(Number(state.dataRevision)||0)+1;state.lastIntegritySave=Date.now();
      const current=localStorage.getItem(SAVE_KEY);
      if(current && current.length<=MAX_SAVE_BYTES){
        const prev1=localStorage.getItem(BACKUP_KEYS[0]),prev2=localStorage.getItem(BACKUP_KEYS[1]);
        if(prev2)localStorage.setItem(BACKUP_KEYS[2],prev2);
        if(prev1)localStorage.setItem(BACKUP_KEYS[1],prev1);
        localStorage.setItem(BACKUP_KEYS[0],current);
      }
    }catch(_){ }
    baseSaveState();
  };
  loadState=function(){
    const candidates=[SAVE_KEY,...BACKUP_KEYS,...LEGACY_SAVE_KEYS];
    for(const key of candidates){
      try{
        const raw=localStorage.getItem(key);if(!raw||raw.length>MAX_SAVE_BYTES)continue;
        const parsed=JSON.parse(raw);state=normalizeState(parsed);localStorage.setItem(SAVE_KEY,JSON.stringify(state));return;
      }catch(_){ }
    }
    state=defaultState();
  };

  /* ---------- VEHICLE / TUNING HELPERS ---------- */
  function tuningInstalledValue(carId){
    const car=carsDB.find(c=>c.id===Number(carId));if(!car)return 0;
    const u=getUpg(car.id);let total=0;
    TUNE_TYPES.forEach(t=>{for(let i=0;i<Math.min(5,Number(u[t.key])||0);i++)total+=tuneStagePrice(car,i);});
    return total;
  }
  function buildRating(carId){
    const u=getUpg(Number(carId));const sum=TUNE_TYPES.reduce((a,t)=>a+(Number(u[t.key])||0),0);
    return Math.round(Math.min(100,(sum/20)*88+(Number(u.gearbox)||0)*1.6+(Number(u.tires)||0)*.8));
  }
  function activePlate(carId){
    const uid=state.installedPlates?.[String(carId)];return state.plateInventory?.find(p=>p.uid===uid)||null;
  }
  function vehicleSnapshot(carId){
    const id=Number(carId),car=carsDB.find(c=>c.id===id);if(!car)return null;
    return {version:2,carId:id,upgrades:{...getUpg(id)},fuel:getFuel(id),condition:getCondition(id),plate:activePlate(id),tuningHistory:(state.tuningHistory?.[id]||[]).slice(-30),effectivePower:getEffectivePower(car),tuningValue:tuningInstalledValue(id),buildRating:buildRating(id)};
  }
  function applyVehicleSnapshot(snap){
    if(!snap||!carsDB.some(c=>c.id===Number(snap.carId)))return false;
    const id=Number(snap.carId);if(!state.ownedCars.includes(id))state.ownedCars.push(id);
    state.upgrades[id]={engine:0,turbo:0,gearbox:0,tires:0,...(plainObject(snap.upgrades)?snap.upgrades:{})};
    TUNE_TYPES.forEach(t=>state.upgrades[id][t.key]=intNumber(state.upgrades[id][t.key],0,0,5));
    state.fuel[id]=finiteNumber(snap.fuel,100,0,100);state.condition[id]=finiteNumber(snap.condition,100,0,100);
    state.tuningHistory[id]=Array.isArray(snap.tuningHistory)?snap.tuningHistory.slice(-30):[];
    let p=normalizePlate(snap.plate);
    if(p){
      if(state.plateInventory.some(x=>x.uid===p.uid)){p={...p,uid:p.uid+'_m'+Date.now().toString(36)};}
      Object.keys(state.installedPlates||{}).forEach(k=>{if(state.installedPlates[k]===p.uid)delete state.installedPlates[k];});
      state.plateInventory.push(p);state.installedPlates[String(id)]=p.uid;
    }
    return true;
  }
  window.vehicleSnapshot=vehicleSnapshot;window.applyVehicleSnapshot=applyVehicleSnapshot;

  function escrowCarIds(){return new Set(Object.values(state.marketEscrow||{}).map(v=>Number(v&&v.carId)).filter(Number.isFinite));}
  const baseBuyCar=buyCar;
  buyCar=function(carId){
    if(escrowCarIds().has(Number(carId))){showToast('Эта модель сейчас находится в рыночном лоте');return;}
    const before=state.ownedCars.includes(carId);baseBuyCar(carId);
    if(!before&&state.ownedCars.includes(carId)){state.tuningHistory[carId]=state.tuningHistory[carId]||[];saveState();}
  };
  const baseUpgradeTune=upgradeTune;
  upgradeTune=function(carId,key){
    const before=Number(getUpg(carId)[key]||0),car=carsDB.find(c=>c.id===carId);const price=car&&before<5?tuneStagePrice(car,before):0;
    baseUpgradeTune(carId,key);
    const after=Number(getUpg(carId)[key]||0);
    if(after>before){state.tuningHistory[carId]=state.tuningHistory[carId]||[];state.tuningHistory[carId].push({ts:Date.now(),part:key,level:after,price,source:'shop'});state.tuningHistory[carId]=state.tuningHistory[carId].slice(-40);saveState();openTune(carId);}
  };

  openTune=function(carId){
    state.tuneTargetId=carId;const car=carsDB.find(c=>c.id===carId);if(!car)return;
    const upg=getUpg(carId),currentPower=getEffectivePower(car),rating=buildRating(carId),value=tuningInstalledValue(carId),profile=raceTuneProfile(car);
    const title=document.getElementById('tune-car-title');if(title)title.innerText='Тюнинг · '+car.name;
    const c=document.getElementById('tune-list');if(!c)return;
    const bars=[['Мощность',Math.min(100,currentPower/1500*100),currentPower+' л.с.'],['Разгон',Math.min(100,profile.accel/2.1*100),profile.accel.toFixed(2)+'x'],['Окно SHIFT',Math.min(100,profile.yellowWidth/.12*100),Math.round(profile.yellowWidth*200)+'%'],['Сцепление',Math.min(100,profile.launchGrip*100),Math.round(profile.launchGrip*100)+'%']];
    let html='<div class="tune-overview"><div class="tune-overview-top"><div><span>BUILD SCORE</span><b>'+rating+'/100</b></div><div><span>ВЛОЖЕНО</span><b>'+fmt(value)+' SYND</b></div></div><div class="tune-chart">'+bars.map(x=>'<div class="tune-chart-row"><span>'+x[0]+'</span><div><i style="width:'+x[1]+'%"></i></div><b>'+x[2]+'</b></div>').join('')+'</div></div>';
    TUNE_TYPES.forEach(t=>{
      const lvl=Number(upg[t.key])||0,maxed=lvl>=5,price=maxed?0:tuneStagePrice(car,lvl),can=state.coins>=price;
      const test={...upg};if(!maxed)test[t.key]=lvl+1;
      let before=currentPower,after=before;
      if(!maxed){let mult=1;TUNE_TYPES.forEach(q=>{const l=Number(test[q.key])||0;for(let i=0;i<l;i++)mult+=q.hpPerStage[i];});const cond=getCondition(carId);if(cond<40)mult*=.85;else if(cond<70)mult*=.93;after=Math.round(car.power*mult);}
      const dots=Array.from({length:5},(_,i)=>'<i class="tune-dot '+(i<lvl?'on':'')+'"></i>').join('');
      const note=t.key==='gearbox'?'Расширяет жёлтое/зелёное окно, ускоряет набор оборотов и снижает штраф ошибки.':t.desc;
      html+='<div class="tune-v8-card"><div class="tune-v8-head"><div class="tune-part-icon">'+svgIcon(t.key==='gearbox'?'gear':t.key==='tires'?'car':t.key==='engine'?'wrench':'bolt')+'</div><div><b>'+t.name+'</b><span>'+note+'</span></div><strong>STAGE '+lvl+'/5</strong></div><div class="tune-dots">'+dots+'</div><div class="tune-compare"><span>Сейчас <b>'+before+' л.с.</b></span><span>После <b>'+(maxed?'MAX':after+' л.с.')+'</b></span></div><button class="tune-btn '+(maxed?'maxed':'')+'" '+(maxed||!can?'disabled':'')+' onclick="upgradeTune('+carId+',\''+t.key+'\')">'+(maxed?'МАКСИМУМ':fmt(price)+' SYND · УСТАНОВИТЬ')+'</button></div>';
    });
    const hist=(state.tuningHistory?.[carId]||[]).slice().reverse();
    html+='<div class="tune-history"><div class="v8-section-head"><b>ИСТОРИЯ СБОРКИ</b><span>'+hist.length+' операций</span></div>'+(hist.length?hist.slice(0,8).map(x=>'<div class="history-row"><span>'+PART_LABEL[x.part]+' · STAGE '+x.level+'</span><b>'+fmt(x.price)+' SYND</b></div>').join(''):'<div class="empty-note">Установок пока нет</div>')+'</div>';
    c.innerHTML=html;
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-tune').classList.add('active');document.getElementById('main-scroll').scrollTop=0;
  };

  /* ---------- PLATES ---------- */
  const PLATE_POOLS={
    common:['A124BC','M381KT','K052PA','B917EP','C404AX','T218OP'],
    rare:['X777XX','A001AA','M777MM','P555PP','O009OO','K888KK'],
    epic:['777 CARBON','RACE 01','NIGHT 7','BOSS 66','SYN 777'],
    legendary:['X777XX 77','A001AA 77','M777MM 77','KING 001'],
    mythic:['SYND 001','CARBON 1','BLACK 777']
  };
  function secureRandom(){if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]/4294967296;}return Math.random();}
  function pick(arr){return arr[Math.floor(secureRandom()*arr.length)];}
  function rollRarity(weights){let r=secureRandom()*100,acc=0;for(const [rar,w] of weights){acc+=w;if(r<acc)return rar;}return weights[weights.length-1][0];}
  function makePlate(rarity){
    const text=pick(PLATE_POOLS[rarity]||PLATE_POOLS.common),limited=rarity==='mythic'||(rarity==='legendary'&&secureRandom()<.25);
    return {uid:'plate_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),text,rarity,series:limited?'LIMITED '+new Date().getFullYear():(rarity==='common'?'STANDARD':'BLACK SERIES'),value:{common:120,rare:800,epic:3500,legendary:12000,mythic:30000}[rarity],limited,createdAt:Date.now()};
  }
  function renderPlateScreen(carId){
    ensureV8Screens();const id=Number(carId||state.activeCarId),car=carsDB.find(c=>c.id===id);if(!car)return;
    const root=document.getElementById('plate-content'),installed=activePlate(id),inv=state.plateInventory||[];
    root.innerHTML='<div class="plate-hero"><div><span>АВТОМОБИЛЬ</span><b>'+escapeHtml(car.name)+'</b></div><div class="plate-preview '+(installed?'rar-'+installed.rarity:'')+'">'+(installed?escapeHtml(installed.text):'БЕЗ НОМЕРА')+'</div>'+(installed?'<small>'+RARITY_LABEL[installed.rarity]+' · '+escapeHtml(installed.series)+'</small>':'<small>Установи номер из коллекции</small>')+'</div><div class="plate-roll-card"><div><b>ПРОКРУТКА НОМЕРОВ</b><span>Обычные, редкие, блатные и лимитированные серии.</span></div><button class="btn btn-gold" '+(state.coins<650?'disabled':'')+' onclick="spinPlate('+id+')">650 SYND · КРУТИТЬ</button></div><div class="v8-section-head"><b>КОЛЛЕКЦИЯ</b><span>'+inv.length+' шт.</span></div><div class="plate-grid">'+(inv.length?inv.slice().sort((a,b)=>RARITY_ORDER[b.rarity]-RARITY_ORDER[a.rarity]).map(p=>'<div class="plate-card rar-'+p.rarity+' '+(installed?.uid===p.uid?'installed':'')+'"><div class="plate-card-number">'+escapeHtml(p.text)+'</div><div class="plate-card-meta"><span>'+RARITY_LABEL[p.rarity]+'</span><span>'+escapeHtml(p.series)+'</span></div><button class="btn btn-ghost" onclick="installPlate('+id+',\''+p.uid+'\')">'+(installed?.uid===p.uid?'УСТАНОВЛЕН':'УСТАНОВИТЬ')+'</button></div>').join(''):'<div class="empty-note">Коллекция пуста. Прокрути первый номер.</div>')+'</div>';
  }
  window.openPlateGarage=function(carId){const id=Number(carId||state.activeCarId);state.tuneTargetId=id;ensureV8Screens();switchTab('plates');renderPlateScreen(id);};
  window.installPlate=function(carId,uid){if(!(state.plateInventory||[]).some(p=>p.uid===uid))return;Object.keys(state.installedPlates||{}).forEach(k=>{if(state.installedPlates[k]===uid)delete state.installedPlates[k];});state.installedPlates[String(carId)]=uid;saveState();renderPlateScreen(carId);showToast('Номер установлен');};
  window.spinPlate=function(carId){
    if(state.coins<650){showToast('Недостаточно SYND');return;}state.coins-=650;state.stats.totalSpent+=650;state.plateRolls=(state.plateRolls||0)+1;
    let rarity=rollRarity([['common',64],['rare',25],['epic',8.5],['legendary',2.2],['mythic',.3]]);
    if(state.plateRolls%25===0&&RARITY_ORDER[rarity]<2)rarity='epic';
    const p=makePlate(rarity);state.plateInventory.push(p);updateHeader();saveState();renderPlateScreen(carId);showToast(p.text+' · '+RARITY_LABEL[p.rarity]);
  };

  const baseOpenDetail=openDetail;
  openDetail=function(carId){
    baseOpenDetail(carId);if(!state.ownedCars.includes(carId))return;const root=document.getElementById('detail-content');if(!root)return;
    const p=activePlate(carId),car=carsDB.find(c=>c.id===carId);const box=document.createElement('div');box.className='vehicle-identity-card';box.innerHTML='<div><span>ГОСНОМЕР</span><b>'+(p?escapeHtml(p.text):'НЕ УСТАНОВЛЕН')+'</b><small>'+(p?RARITY_LABEL[p.rarity]+' · '+escapeHtml(p.series):'Открой коллекцию номеров')+'</small></div><button class="btn btn-ghost" onclick="openPlateGarage('+carId+')">'+svgIcon('plate')+' НОМЕРА</button></div><div class="vehicle-value-row"><span>Стоимость тюнинга</span><b>'+fmt(tuningInstalledValue(carId))+' SYND</b><span>Build score</span><b>'+buildRating(carId)+'/100</b></div>';
    root.appendChild(box);
    const tuneBtn=root.querySelector('button[onclick^="openTune"]');if(tuneBtn)tuneBtn.innerHTML=svgIcon('wrench')+' ТЮНИНГ';
  };

  /* ---------- RIVALS ---------- */
  const EXTRA_RIVALS=[
    {id:10,name:'Marlow',power:390,reward:450,unlockLevel:1,car:'Honda Civic EK9',rating:71,style:'Поздний тормоз',favoriteTracks:['Промзона','Тоннель'],wins:34,losses:19,avatar:'MR',taunt:'Твоя машина выглядит быстро. Жаль, что водитель нет.',preLines:['Не держи меня на старте.','Я вижу, где ты теряешь время.'],winLine:'Слишком много шума, слишком мало скорости.',loseLine:'Ладно. Этот старт был твоим.'},
    {id:11,name:'Kira',power:520,reward:760,unlockLevel:2,car:'Mazda RX-7 FD',rating:76,style:'Техничный',favoriteTracks:['Старая эстакада','Портовый обход'],wins:58,losses:21,avatar:'KR',taunt:'Переключайся аккуратно. Я на ошибках не прощаю.',preLines:['Смотри на тахометр, не на меня.','Один плохой SHIFT и я исчезну.'],winLine:'Ты подарил мне слишком много метров.',loseLine:'Чисто. Признаю.'},
    {id:12,name:'Rook',power:680,reward:1250,unlockLevel:4,car:'BMW M3 E46',rating:82,style:'Агрессивный',favoriteTracks:['Ночной проспект','Промзона'],wins:91,losses:37,avatar:'RK',taunt:'Я не обгоняю. Я забираю полосу.',preLines:['Не моргай на старте.','Сегодня тесно будет именно тебе.'],winLine:'Давление выдерживают не все.',loseLine:'В этот раз ты выдержал.'},
    {id:13,name:'Vanta',power:810,reward:2250,unlockLevel:6,car:'Nissan Skyline R34',rating:87,style:'Контратака',favoriteTracks:['Тоннель','Портовый обход'],wins:126,losses:42,avatar:'VT',taunt:'Выходишь вперёд — я становлюсь быстрее.',preLines:['Дай мне повод догонять.','Первый обгон ничего не значит.'],winLine:'Я предупреждал: впереди меня ехать тяжело.',loseLine:'Редко кто удерживает позицию до конца.'},
    {id:14,name:'Sable',power:990,reward:4100,unlockLevel:8,car:'Porsche 911 Turbo S',rating:92,style:'Холодный темп',favoriteTracks:['Старая эстакада','Ночной проспект'],wins:202,losses:39,avatar:'SB',taunt:'У тебя пять передач, чтобы доказать, что ты здесь не случайно.',preLines:['Проверим твою КПП.','Я не спешу. Мне хватает темпа.'],winLine:'Ровный темп всегда побеждает панику.',loseLine:'Твой темп был лучше. Запомню.'},
    {id:15,name:'Knox',power:1180,reward:7200,unlockLevel:11,car:'McLaren 720S',rating:96,style:'Максимальное давление',favoriteTracks:['Промзона','Тоннель'],wins:331,losses:54,avatar:'KX',taunt:'Когда увидишь меня сбоку, уже будет поздно.',preLines:['Не оставляй мне полметра.','Вторая половина трассы моя.'],winLine:'Ты оставил дверь открытой.',loseLine:'Закрыл всё. Нечего сказать.',boss:true},
    {id:16,name:'Cipher',power:1430,reward:12500,unlockLevel:15,car:'Bugatti Chiron',rating:99,style:'Безошибочный',favoriteTracks:['Ночной проспект','Портовый обход'],wins:497,losses:31,avatar:'CP',taunt:'Я считаю твои ошибки до старта.',preLines:['Шанс у тебя есть. Маленький.','Сделай идеальный старт. Он тебе понадобится.'],winLine:'Ошибка номер один была выйти против меня.',loseLine:'Без ошибок. Именно так и надо.',boss:true}
  ];
  EXTRA_RIVALS.forEach(r=>{if(!opponentsDB.some(o=>String(o.id)===String(r.id)))opponentsDB.push(r);});
  const baseProfiles=[
    {avatar:'ST',style:'Нервный старт',favoriteTracks:['Промзона'],wins:18,losses:32,car:'ВАЗ 2101',rating:58,preLines:['Только не заглохни.'],winLine:'Ну что, музыка всё-таки помогла.',loseLine:'Ладно, мотор у тебя бодрый.'},
    {avatar:'TL',style:'Ранний SHIFT',favoriteTracks:['Тоннель'],wins:29,losses:25,car:'Volkswagen Golf',rating:63,preLines:['Чип сегодня злой.'],winLine:'Я же говорил про чип.',loseLine:'Надо было прошивку другую ставить.'},
    {avatar:'AV',style:'Рывками',favoriteTracks:['Ночной проспект'],wins:44,losses:30,car:'Audi S4',rating:69,preLines:['Только быстро, пока никто не звонит.'],winLine:'Вот это будет сложно объяснить дома.',loseLine:'Никому не рассказывай.'},
    {avatar:'FX',style:'Агрессивный',favoriteTracks:['Портовый обход'],wins:83,losses:28,car:'Nissan 350Z',rating:79,preLines:['Дуэль начинается после зелёного.'],winLine:'Это и есть разница между гонкой и прогулкой.',loseLine:'Сегодня это была гонка.'},
    {avatar:'VD',style:'Стабильный',favoriteTracks:['Старая эстакада'],wins:135,losses:51,car:'BMW M4',rating:85,preLines:['Не отставай после третьей.'],winLine:'Стабильность скучная, пока не выигрывает.',loseLine:'Ты был стабильнее.'},
    {avatar:'TN',style:'Тихий',favoriteTracks:['Тоннель'],wins:188,losses:46,car:'Toyota Supra MK4',rating:90,preLines:['...'],winLine:'...',loseLine:'Хорошо.'},
    {avatar:'DR',style:'Босс',favoriteTracks:['Ночной проспект'],wins:302,losses:44,car:'Lamborghini Huracan',rating:96,preLines:['Не разочаруй меня.'],winLine:'Ещё рано называться легендой.',loseLine:'Теперь можешь.',boss:true},
    {avatar:'PN',style:'Финишер',favoriteTracks:['Портовый обход'],wins:409,losses:37,car:'Ferrari SF90',rating:98,preLines:['Финиш решает всё.'],winLine:'Первым считают только одного.',loseLine:'Сегодня им был ты.',boss:true},
    {avatar:'SY',style:'Абсолютное давление',favoriteTracks:['Промзона'],wins:701,losses:22,car:'Bugatti Chiron',rating:100,preLines:['Покажи, зачем ты сюда пришёл.'],winLine:'Синдикат не отдаёт корону просто так.',loseLine:'Корона твоя. Пока.',boss:true}
  ];
  opponentsDB.forEach((o,i)=>Object.assign(o,baseProfiles[i]||{},o));
  function rivalMeta(opp){
    const rec=state.rivalRecords?.[String(opp.id)]||{wins:0,losses:0};return {avatar:opp.avatar||String(opp.name).slice(0,2).toUpperCase(),style:opp.style||'Сбалансированный',favoriteTracks:opp.favoriteTracks||['Промзона'],wins:opp.wins||0,losses:opp.losses||0,car:opp.car||'Street build',rating:opp.rating||Math.min(99,Math.round(50+(opp.power||200)/18)),record:rec};
  }
  renderOpponents=function(){
    updateHeader();const c=document.getElementById('opponent-list');if(!c)return;c.innerHTML='';const car=carsDB.find(x=>x.id===state.activeCarId);if(!car){c.innerHTML='<div class="empty-note">Сначала выберите активную машину.</div>';return;}
    if(state.licenseSuspended){c.innerHTML='<div class="empty-note">Права изъяты. Восстановите допуск к заездам в профиле.</div>';return;}
    const list=state.duelSub==='tour'?tournamentsDB:opponentsDB,myPower=getEffectivePower(car),history=state.raceHistory||[];let pool=list.filter(o=>state.level>=o.unlockLevel);
    if(state.duelSub==='tour'){
      const now=Date.now(),day=new Date().toISOString().slice(0,10);pool=pool.filter(o=>{const r=state.tournamentRuns[String(o.id)]||{};const count=r.day===day?(Number(r.count)||0):0,next=r.day===day?(Number(r.next)||0):0;return count<3&&next<=now;});
    } else {const fresh=pool.filter(o=>!history.slice(-4).includes(String(o.id)));if(fresh.length>=5)pool=fresh;}
    pool=pool.slice().sort(()=>secureRandom()-.5).slice(0,Math.min(state.duelSub==='tour'?3:7,pool.length));
    if(!pool.length){c.innerHTML='<div class="empty-note">Доступных соперников сейчас нет.</div>';return;}
    c.innerHTML='<div class="race-event-badge"><span>СЕТКА СОПЕРНИКОВ</span><b>'+pool.length+' ДОСТУПНО</b></div>'+pool.map((opp,idx)=>{
      const m=rivalMeta(opp),winChance=Math.max(5,Math.min(95,Math.round(50+(myPower-opp.power)/Math.max(opp.power,1)*86))),fee=entryFeeFor(opp),recent=history.includes(String(opp.id));
      const r=state.tournamentRuns[String(opp.id)]||{},day=new Date().toISOString().slice(0,10),count=state.duelSub==='tour'&&r.day===day?(Number(r.count)||0):0,mult=state.duelSub==='tour'?([1,.72,.48][Math.min(2,count)]||.48):1,reward=Math.round(opp.reward*mult);
      return '<div class="rival-card '+(opp.boss?'boss':'')+'" style="animation-delay:'+idx*45+'ms"><div class="rival-top"><div class="rival-avatar">'+escapeHtml(m.avatar)+'</div><div class="rival-id"><b>'+escapeHtml(opp.name)+'</b><span>'+escapeHtml(m.car)+' · RATING '+m.rating+'</span></div><div class="rival-power">'+opp.power+'<small>л.с.</small></div></div><div class="rival-quote">“'+escapeHtml(opp.taunt||pick(opp.preLines||['Встретимся на финише.']))+'”</div><div class="rival-profile-grid"><span>Стиль<b>'+escapeHtml(m.style)+'</b></span><span>Любит<b>'+escapeHtml(m.favoriteTracks[0])+'</b></span><span>История<b>'+m.wins+'–'+m.losses+'</b></span><span>С вами<b>'+m.record.wins+'–'+m.record.losses+'</b></span></div><div class="odds-bar-bg"><div class="odds-win" style="width:'+winChance+'%"></div><div class="odds-lose" style="width:'+(100-winChance)+'%"></div></div><div class="opp-foot"><span>Шанс <b>'+winChance+'%</b></span><span>Вход <b>'+fmt(fee)+'</b></span><span>Приз <b>'+fmt(reward)+'</b></span></div><button class="btn btn-select" onclick="prepareRace(\''+String(opp.id).replace(/'/g,"\\'")+'\',\''+(state.duelSub==='tour'?'tour':'normal')+'\')">НА ЛИНИЮ</button>'+(recent?'<small class="recent-rival">Недавняя встреча</small>':'')+'</div>';
    }).join('');
  };

  /* ---------- RACE DYNAMICS ---------- */
  raceTuneProfile=function(car){
    const u=getUpg(car.id),engine=Number(u.engine||0),trans=Number(u.gearbox||0),turbo=Number(u.turbo||0),grip=Number(u.tires||0),sum=engine+trans+turbo+grip;
    return {sum,engine,trans,turbo,grip,rpmRate:1.18+engine*.09+turbo*.10+trans*.045+sum*.018,greenWidth:.022+trans*.006,yellowWidth:.050+trans*.009,launchGrip:Math.min(.995,.72+grip*.045+trans*.018),accel:1.05+engine*.065+turbo*.085+trans*.024,shiftRecovery:Math.min(.78,.54+trans*.042),errorRecovery:Math.min(.82,.62+trans*.032)};
  };
  const basePrepareRace=prepareRace;
  prepareRace=function(target,mode){
    basePrepareRace(target,mode);if(!raceCtx)return;const car=carsDB.find(x=>x.id===state.activeCarId),raw=getEffectivePower(car),stock=car.power,u=getUpg(car.id),upgradeRatio=Math.max(0,(raw-stock)/Math.max(stock,1));
    raceCtx.maxSpeed=Math.round(Math.max(205,Math.min(445,205+raw*.145+upgradeRatio*42)));
    raceCtx.aiMaxSpeed=Math.round(Math.max(200,Math.min(438,202+(Number(raceCtx.opp.power)||raw)*.142)));
    raceCtx.trackLength=1450+Math.floor(secureRandom()*260);raceCtx.shiftBoost=1;raceCtx.shiftBoostTimer=0;raceCtx.pressure=0;raceCtx.eventCooldown=2.5;raceCtx.draftTimer=0;raceCtx.aiSurgeTimer=0;raceCtx.nearMisses=0;raceCtx.overtakes=0;raceCtx.rival=rivalMeta(raceCtx.opp);raceCtx.gearboxLevel=Number(u.gearbox)||0;
    renderRaceBrief();
  };
  renderRaceBrief=function(){
    const c=raceCtx,car=carsDB.find(x=>x.id===state.activeCarId),o=c.opp,m=c.rival||rivalMeta(o),line=pick(o.preLines||[o.taunt||'Встретимся на финише.']);
    document.getElementById('race-content').innerHTML='<div class="race3"><div class="race-event-badge"><span>'+escapeHtml(c.route)+'</span><b>'+c.trackLength+' М · STREET DUEL</b></div><div class="race3-top"><div class="race3-driver"><b>ВЫ</b><span>'+escapeHtml(car.name)+' · '+getEffectivePower(car)+' л.с.</span></div><div class="race3-vs">VS</div><div class="race3-driver" style="text-align:right"><b>'+escapeHtml(o.name)+'</b><span>'+escapeHtml(m.car)+' · '+o.power+' л.с.</span></div></div><div class="rival-intro"><div class="rival-avatar large">'+escapeHtml(m.avatar)+'</div><div><span>'+escapeHtml(m.style)+' · RATING '+m.rating+'</span><b>“'+escapeHtml(line)+'”</b><small>Любимые трассы: '+escapeHtml(m.favoriteTracks.join(' · '))+' · Карьера '+m.wins+'–'+m.losses+'</small></div></div><div class="pre-race-box"><div class="pre-race-line"><span>Вход</span><b>'+fmt(c.fee)+' SYND</b></div><div class="pre-race-line"><span>Топливо</span><b>'+c.fuelCost+'%</b></div><div class="pre-race-line"><span>Победа</span><b>'+fmt(o.reward)+' SYND</b></div><div class="pre-race-line"><span>КПП</span><b>STAGE '+c.gearboxLevel+'/5</b></div></div><button class="big-btn" onclick="beginLaunch()">ВЫЕХАТЬ НА ЛИНИЮ</button><button class="btn btn-ghost" style="margin-top:8px" onclick="switchTab(\'duel-select\')">ОТМЕНА</button></div>';
  };
  beginLaunch=function(){
    const car=carsDB.find(x=>x.id===state.activeCarId),c=raceCtx;if(!c)return;state.coins-=c.fee;state.stats.totalSpent+=c.fee;state.fuel[car.id]=Math.max(0,getFuel(car.id)-c.fuelCost);updateHeader();saveState();
    document.getElementById('race-content').innerHTML='<div class="race3"><div class="race-event-badge"><span>LAUNCH CONTROL</span><b>ПОЙМАЙ ЗОНУ</b></div><div class="launch-panel"><div class="launch-title">ЧУВСТВИТЕЛЬНЫЙ СТАРТ</div><div class="launch-copy">Зелёная зона даёт максимальное сцепление и стартовый импульс. Жёлтая сохраняет хороший темп.</div><div class="launch-meter"><div class="launch-zone yellow"></div><div class="launch-zone green"></div><div class="launch-marker" id="launch-marker"></div></div><div class="launch-rpm" id="launch-rpm">1 100 RPM</div><div class="launch-buttons"><button class="launch-btn safe" onclick="chooseLaunch(\'safe\')">КОНТРОЛЬ<small>стабильный зацеп</small></button><button class="launch-btn hard" onclick="chooseLaunch(\'spin\')">АТАКА<small>максимальный импульс</small></button></div></div></div>';
    c.launchPos=10;c.launchDir=1;c.launchLast=performance.now();
    const tick=(now)=>{if(!raceCtx||raceCtx!==c||c.finished||c.launchMode)return;const dt=Math.min(.04,(now-c.launchLast)/1000);c.launchLast=now;c.launchPos+=c.launchDir*(49+c.profile.rpmRate*9)*dt;if(c.launchPos>=92){c.launchPos=92;c.launchDir=-1;}if(c.launchPos<=6){c.launchPos=6;c.launchDir=1;}const m=document.getElementById('launch-marker'),r=document.getElementById('launch-rpm');if(m)m.style.left=c.launchPos+'%';if(r)r.textContent=Math.round(900+c.launchPos/100*7800).toLocaleString('ru-RU')+' RPM';c.launchRaf=requestAnimationFrame(tick);};
    c.launchRaf=requestAnimationFrame(tick);
  };
  const baseChooseLaunch=chooseLaunch;
  chooseLaunch=function(mode){const c=raceCtx;if(c?.launchRaf)cancelAnimationFrame(c.launchRaf);baseChooseLaunch(mode);if(!c)return;const q=Math.max(0,1-Math.abs((c.launchPos/100)-.67)/.30);c.launchQuality=q;c.speed*=1.10+q*.35;c.distance+=q*2.2;c.rpm=Math.min(c.redline*.82,c.rpm*(1.05+q*.12));if(q>.9){c.shiftBoost=1.12;c.shiftBoostTimer=.75;showAction('ИДЕАЛЬНЫЙ СТАРТ · ТЯГА +12%');}else if(q>.72){c.shiftBoost=1.06;c.shiftBoostTimer=.45;showAction('ХОРОШИЙ СТАРТ · ТЯГА +6%');}};
  manualShift=function(){
    const c=raceCtx;if(!c||c.finished||c.startLocked)return;if(c.gear>=6){showShiftText('6-Я ПЕРЕДАЧА · ДЕРЖИ ТЯГУ',false);return;}
    const p=c.rpm/c.redline,g=c.profile.greenWidth,y=c.profile.yellowWidth,center=.78,perfect=Math.abs(p-center)<=g,good=Math.abs(p-center)<=y;c.shiftCount++;c.gear=Math.min(6,c.gear+1);
    if(perfect){c.perfectShifts++;c.goodShifts++;c.shiftBoost=1.18+Math.min(.05,c.profile.trans*.01);c.shiftBoostTimer=.62;c.rpm=Math.max(3400,c.rpm*c.profile.shiftRecovery);c.speed+=Math.max(3,c.speed*.018);recordContractEvent('perfectShift',1);haptic('success');showAction('PERFECT SHIFT · BOOST ТЯГИ');showShiftText('ИДЕАЛЬНЫЙ SHIFT · МИНИМУМ ПОТЕРИ RPM',true);}
    else if(good){c.goodShifts++;c.shiftBoost=1.08;c.shiftBoostTimer=.38;c.rpm=Math.max(3000,c.rpm*c.profile.shiftRecovery*.95);c.speed+=2;haptic('medium');showAction('GOOD SHIFT · УСКОРЕНИЕ');showShiftText('ХОРОШИЙ SHIFT · ТЯГА +8%',false);}
    else{c.errors++;const late=p>.96,rec=c.profile.errorRecovery;c.shiftBoost=Math.max(.86,.78+c.profile.trans*.018);c.shiftBoostTimer=.48;c.rpm=Math.max(late?2800:2200,c.rpm*(late?rec*.78:rec*.88));c.speed*=Math.max(.91,.86+c.profile.trans*.012);haptic('warning');showAction((late?'ПОЗДНИЙ':'РАННИЙ')+' SHIFT · ПОТЕРЯ ТЯГИ');showShiftText((late?'ПОЗДНО':'РАНО')+' · КПП СТАБИЛИЗИРУЕТ ТЯГУ',false);}
    updateRaceHUD();
  };
  simulateRace=function(dt){
    const c=raceCtx;if(c.startLocked)return;c.elapsed+=dt;if(c.nitroTimer>0){c.nitroTimer=Math.max(0,c.nitroTimer-dt);c.nitroActive=c.nitroTimer>0;}if(c.shiftBoostTimer>0){c.shiftBoostTimer=Math.max(0,c.shiftBoostTimer-dt);}else c.shiftBoost+=(1-c.shiftBoost)*Math.min(1,dt*5);if(c.actionTimer>0){c.actionTimer-=dt;if(c.actionTimer<=0)document.getElementById('race-action')?.classList.remove('show');}
    const p=c.profile,gear=c.gear,ratios=[0,.63,.76,.86,.93,.98,1],ratio=ratios[gear],rpmNorm=c.rpm/c.redline;
    if(c.gas&&!c.brake){const gain=1680*p.rpmRate*(.72+ratio*.38)*dt;if(gear<6)c.rpm=Math.min(c.redline*1.012,c.rpm+gain);else c.rpm=Math.min(c.redline*.995,c.rpm+gain*.24);const band=Math.max(.18,Math.min(1,rpmNorm)),launch=(c.launchMode==='spin'&&c.distance<16)?c.launchGrip:.995,nitro=c.nitroActive?1.36:1,boost=c.shiftBoost||1;const base=(c.maxSpeed*1.02)*p.accel*ratio*(.54+band*.88)*launch*nitro*boost;const resistance=.017*c.speed*c.speed/Math.max(c.maxSpeed,1);c.speed+=Math.max(0,base-resistance)*dt;}else{c.rpm=Math.max(1100,c.rpm-1200*dt);c.speed=Math.max(0,c.speed-7*dt);}if(c.brake){c.rpm=Math.max(1100,c.rpm-3400*dt);c.speed=Math.max(0,c.speed-82*dt);}const cap=c.nitroActive?Math.min(470,c.maxSpeed*1.065):c.maxSpeed;c.speed=Math.max(0,Math.min(cap,c.speed));c.topSpeed=Math.max(c.topSpeed||0,c.speed);c.distance=Math.min(c.trackLength,c.distance+(c.speed/3.6)*dt);
    const myPower=getEffectivePower(carsDB.find(x=>x.id===state.activeCarId)),ratioPower=Math.max(.70,Math.min(1.32,c.opp.power/Math.max(myPower,1))),gap=c.distance-c.aiDistance,style=c.rival?.style||'';let aggression=.99+(ratioPower-1)*.17;if(/Агрессив|давлен|Контрат|Босс/i.test(style))aggression+=.035;if(gap>8)aggression+=Math.min(.055,gap/300);if(gap<-18)aggression-=.018;if(c.aiSurgeTimer>0){c.aiSurgeTimer-=dt;aggression+=.055;}const variation=1+Math.sin(c.elapsed*.77)*.022+Math.sin(c.elapsed*1.83)*.011,target=Math.min(c.aiMaxSpeed*.997,c.aiMaxSpeed*aggression*c.aiSkill*variation);c.aiSpeed+=((target-c.aiSpeed)*1.55*dt);if(c.elapsed<c.aiStartDelay)c.aiSpeed*=Math.max(0,1-dt*6);c.aiSpeed=Math.max(0,Math.min(c.aiMaxSpeed*1.01,c.aiSpeed));c.aiDistance=Math.min(c.trackLength,c.aiDistance+(c.aiSpeed/3.6)*dt);
    c.eventCooldown-=dt;if(c.eventCooldown<=0&&c.elapsed>3){c.eventCooldown=3.2+secureRandom()*4.2;const liveGap=c.distance-c.aiDistance;if(Math.abs(liveGap)<12&&secureRandom()<.68){c.pressure=Math.min(1,c.pressure+.35);c.aiSurgeTimer=.8+secureRandom()*.8;showAction(liveGap>=0?'СОПЕРНИК ДАВИТ СЗАДИ · НЕ ОШИБИСЬ':'ВИСИШЬ НА БАМПЕРЕ · МОМЕНТ ДЛЯ ОБГОНА');}else if(c.speed>c.maxSpeed*.72&&secureRandom()<.4){c.nearMisses++;showAction('ТРАФИК ВПЕРЕДИ · ДЕРЖИ ТЕМП');}}
    if(c.aiDistance>=c.trackLength&&!c.aiFinishedAt){c.aiFinishedAt=c.elapsed;showAction('СОПЕРНИК ФИНИШИРОВАЛ · ДОЖИМАЙ');}if(c.distance>=c.trackLength){c.playerFinishedAt=c.elapsed;finishRace(!c.aiFinishedAt||c.playerFinishedAt<=c.aiFinishedAt,c);}
  };
  updateRaceZones=function(){
    const c=raceCtx;if(!c)return;const centerNorm=.78,center=centerNorm*264-132;
    const greenDeg=Math.max(8,Math.min(30,c.profile.greenWidth*528));
    const yellowDeg=Math.max(greenDeg+9,Math.min(58,c.profile.yellowWidth*528));
    const d=document.getElementById('rpm-dial');if(d){d.style.setProperty('--yellow-start',(center-yellowDeg/2)+'deg');d.style.setProperty('--yellow-end',(center+yellowDeg/2)+'deg');d.style.setProperty('--green-start',(center-greenDeg/2)+'deg');d.style.setProperty('--green-end',(center+greenDeg/2)+'deg');}
    const sd=document.getElementById('speed-dial');if(sd){sd.style.setProperty('--yellow-start','999deg');sd.style.setProperty('--yellow-end','1000deg');sd.style.setProperty('--green-start','1001deg');sd.style.setProperty('--green-end','1002deg');}
  };
  const baseUpdateRaceHUD=updateRaceHUD;
  updateRaceHUD=function(){baseUpdateRaceHUD();const c=raceCtx;if(!c)return;const fx=document.getElementById('speed-effects');if(fx){const intensity=Math.max(0,Math.min(1,(c.speed-c.maxSpeed*.35)/(c.maxSpeed*.55)));fx.style.setProperty('--speed-intensity',intensity.toFixed(2));fx.classList.toggle('warp',intensity>.62||c.nitroActive);}const root=document.querySelector('.race3');if(root){root.style.setProperty('--race-speed',Math.max(0,Math.min(1,c.speed/c.maxSpeed)).toFixed(2));root.classList.toggle('under-pressure',Math.abs(c.distance-c.aiDistance)<10&&c.elapsed>2);}};
  const baseFinishRace=finishRace;
  finishRace=function(won,c){
    const o=c?.opp,m=c?.rival||rivalMeta(o||{});baseFinishRace(won,c);if(!c||!o)return;state.rivalRecords=state.rivalRecords||{};const rec=state.rivalRecords[String(o.id)]||{wins:0,losses:0};if(won)rec.wins++;else rec.losses++;rec.lastResult=won?'win':'loss';state.rivalRecords[String(o.id)]=rec;saveState();const line=won?(o.loseLine||'Чистый заезд. Увидимся ещё.'):(o.winLine||'В следующий раз не оставляй мне место.');const race=document.querySelector('#race-content .race3');if(race){const d=document.createElement('div');d.className='rival-reaction';d.innerHTML='<div class="rival-avatar">'+escapeHtml(m.avatar)+'</div><div><span>'+escapeHtml(o.name)+'</span><b>“'+escapeHtml(line)+'”</b></div>';race.appendChild(d);}if(typeof syncPlayerProfile==='function')setTimeout(async()=>{await syncPlayerProfile(true);claimFirstRaceReferralBonus();},120);};

  /* ---------- CASES ---------- */
  const CASES_V8=[
    {id:'bronze',name:'Street Case',price:350,desc:'Базовый кейс. Деньги, детали и номера.',guarantee:'RARE каждые 10',weights:[['common',72],['rare',23],['epic',4.7],['legendary',.3]]},
    {id:'silver',name:'Carbon Case',price:1400,desc:'Больше тюнинга, редких номеров и высокий возврат.',guarantee:'RARE каждые 6 · EPIC каждые 20',weights:[['common',50],['rare',37],['epic',11.8],['legendary',1.2]]},
    {id:'gold',name:'Syndicate Case',price:4500,desc:'Лучший пул. Маленький шанс редкой машины.',guarantee:'EPIC каждые 12 · машина максимум за 50',weights:[['common',35],['rare',42],['epic',20],['legendary',2.7],['mythic',.3]]}
  ];
  function chooseCaseRarity(cs){
    const p=state.casePity; p[cs.id]=(p[cs.id]||0)+1;if(cs.id==='gold')p.goldCar=(p.goldCar||0)+1;
    let r=rollRarity(cs.weights);if(cs.id==='bronze'&&p.bronze>=10&&RARITY_ORDER[r]<1){r='rare';p.bronze=0;}if(cs.id==='silver'){if(p.silver%20===0&&RARITY_ORDER[r]<2)r='epic';else if(p.silver%6===0&&RARITY_ORDER[r]<1)r='rare';}if(cs.id==='gold'&&p.gold%12===0&&RARITY_ORDER[r]<2)r='epic';return r;
  }
  function makeCasePrize(cs,forcedRarity){
    const rarity=forcedRarity||chooseCaseRarity(cs);let typeRoll=secureRandom();
    if(cs.id==='gold'&&state.casePity.goldCar>=50){typeRoll=.99999;state.casePity.goldCar=0;}
    if(cs.id==='gold'&&((rarity==='legendary'&&typeRoll>.88)||(rarity==='mythic'&&typeRoll>.70)||typeRoll>.9965)){
      const reserved=escrowCarIds();const possible=carsDB.filter(c=>c.id>=18&&!state.ownedCars.includes(c.id)&&!reserved.has(c.id));if(possible.length){const car=pick(possible);return {type:'car',rarity:rarity==='mythic'?'mythic':'legendary',label:car.name,carId:car.id};}
    }
    if(typeRoll<.46){const mult={common:[.45,1.05],rare:[.9,1.7],epic:[1.5,2.8],legendary:[2.5,4.5],mythic:[4,7]}[rarity],amount=Math.round(cs.price*(mult[0]+secureRandom()*(mult[1]-mult[0])));return {type:'coins',rarity,label:fmt(amount)+' SYND',amount};}
    if(typeRoll<.75){const choices=TUNE_TYPES.filter(t=>(getUpg(state.activeCarId)[t.key]||0)<5);if(choices.length){const part=pick(choices);return {type:'tuning',rarity,label:PART_LABEL[part.key]+' · +1 STAGE',part:part.key};}}
    const plate=makePlate(rarity);return {type:'plate',rarity,label:plate.text,plate};
  }
  function grantCasePrize(prize,cs){
    if(prize.type==='coins'){state.coins+=prize.amount;state.stats.totalEarned+=prize.amount;}
    else if(prize.type==='tuning'){const carId=state.activeCarId,u=getUpg(carId),before=u[prize.part]||0;if(before<5){u[prize.part]=before+1;state.tuningHistory[carId]=state.tuningHistory[carId]||[];state.tuningHistory[carId].push({ts:Date.now(),part:prize.part,level:before+1,price:0,source:'case'});}}
    else if(prize.type==='plate'){state.plateInventory.push(prize.plate);}
    else if(prize.type==='car'){if(!state.ownedCars.includes(prize.carId)){state.ownedCars.push(prize.carId);getUpg(prize.carId);getFuel(prize.carId);getCondition(prize.carId);state.casePity.goldCar=0;}}
    state.caseHistory.push({ts:Date.now(),caseId:cs.id,label:prize.label,rarity:prize.rarity,type:prize.type});state.caseHistory=state.caseHistory.slice(-60);updateHeader();saveState();checkAchievements();
  }
  function caseItemHtml(p){return '<div class="case-reel-item rar-'+p.rarity+'"><span>'+RARITY_LABEL[p.rarity]+'</span><b>'+escapeHtml(p.label)+'</b><small>'+({coins:'SYND',tuning:'TUNING',plate:'PLATE',car:'VEHICLE'}[p.type]||'DROP')+'</small></div>';}
  renderCases=function(){
    const root=document.getElementById('cases-list');if(!root)return;const hist=(state.caseHistory||[]).slice().reverse();root.innerHTML=CASES_V8.map(cs=>'<div class="case-v8-card"><div class="case-v8-mark">'+svgIcon('case')+'</div><div class="case-v8-body"><div class="case-v8-title"><b>'+cs.name+'</b><span>'+fmt(cs.price)+' SYND</span></div><p>'+cs.desc+'</p><div class="case-chances">'+cs.weights.map(([r,w])=>'<span class="rar-'+r+'">'+RARITY_LABEL[r]+' '+w+'%</span>').join('')+'</div><small>Гарантия: '+cs.guarantee+(cs.id==='gold'?' · автомобиль ~0.7% до pity':'')+'</small><button class="btn btn-gold" '+(state.coins<cs.price||state.caseOpening?'disabled':'')+' onclick="openCase(\''+cs.id+'\')">ОТКРЫТЬ</button></div></div>').join('')+'<div class="case-history"><div class="v8-section-head"><b>ИСТОРИЯ ОТКРЫТИЙ</b><span>'+hist.length+'</span></div>'+(hist.length?hist.slice(0,12).map(x=>'<div class="history-row"><span class="rar-'+x.rarity+'">'+RARITY_LABEL[x.rarity]+'</span><b>'+escapeHtml(x.label)+'</b><small>'+new Date(x.ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})+'</small></div>').join(''):'<div class="empty-note">Кейсы ещё не открывались.</div>')+'</div>';
  };
  openCase=function(caseId){
    const cs=CASES_V8.find(x=>x.id===caseId);if(!cs||state.caseOpening)return;if(state.coins<cs.price){showToast('Недостаточно SYND');return;}
    state.caseOpening=true;state.coins-=cs.price;state.stats.totalSpent+=cs.price;state.stats.casesOpened++;
    const final=makeCasePrize(cs),strip=[];for(let i=0;i<42;i++)strip.push(i===35?final:makeCasePrize(cs,rollRarity(cs.weights)));
    // Commit payment + reward before the cosmetic animation. A reload/crash can no longer charge the case without preserving its drop.
    grantCasePrize(final,cs);
    ensureCaseModal();const modal=document.getElementById('case-open-modal');modal.classList.add('show');modal.innerHTML='<div class="case-open-shell"><div class="case-open-head"><span>'+cs.name+'</span><b>DROP ROLL</b></div><div class="case-reel-window"><div class="case-center-line"></div><div class="case-reel-track" id="case-reel-track">'+strip.map(caseItemHtml).join('')+'</div></div><div class="case-open-status" id="case-open-status">Прокрутка...</div></div>';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const track=document.getElementById('case-reel-track');if(track)track.style.transform='translateX(calc(50% - '+(35*146+73)+'px))';}));
    setTimeout(()=>{const st=document.getElementById('case-open-status');if(st)st.innerHTML='<span class="rar-'+final.rarity+'">'+RARITY_LABEL[final.rarity]+'</span><b>'+escapeHtml(final.label)+'</b><button class="btn btn-select" onclick="closeCaseModal()">ЗАБРАТЬ</button>';state.caseOpening=false;saveState();renderCases();},3050);
  };
  function ensureCaseModal(){if(document.getElementById('case-open-modal'))return;const d=document.createElement('div');d.id='case-open-modal';d.className='case-open-modal';document.body.appendChild(d);}
  window.closeCaseModal=function(){document.getElementById('case-open-modal')?.classList.remove('show');};

  /* ---------- MARKET: FULL VEHICLE ---------- */
  function marketVehicleFromRow(r){
    let v=r.vehicle_data;if(typeof v==='string'){try{v=JSON.parse(v);}catch(_){v=null;}}
    const carId=parseInt((v&&v.carId)||r.car_id,10),car=carsDB.find(c=>c.id===carId),raw=plainObject(v)?v:{};
    const upgrades={engine:0,turbo:0,gearbox:0,tires:0,...(plainObject(raw.upgrades)?raw.upgrades:{})};
    TUNE_TYPES.forEach(t=>upgrades[t.key]=intNumber(upgrades[t.key],0,0,5));
    const condition=finiteNumber(raw.condition,100,0,100),fuel=finiteNumber(raw.fuel,100,0,100);
    let mult=1,tuningValue=0,totalStages=0;
    if(car)TUNE_TYPES.forEach(t=>{const lvl=upgrades[t.key];totalStages+=lvl;for(let i=0;i<lvl;i++){mult+=t.hpPerStage[i];tuningValue+=tuneStagePrice(car,i);}});
    if(condition<40)mult*=.85;else if(condition<70)mult*=.93;
    return {version:2,carId,upgrades,fuel,condition,plate:normalizePlate(raw.plate),tuningHistory:Array.isArray(raw.tuningHistory)?raw.tuningHistory.slice(-30):[],effectivePower:car?Math.round(car.power*mult):0,tuningValue,buildRating:Math.round(totalStages/20*100)};
  }
  renderMarketList=function(rows){
    const c=document.getElementById('market-list');if(!c)return;c.innerHTML='';if(!rows.length){c.innerHTML='<div class="empty-note">Активных лотов нет.</div>';return;}rows.forEach(r=>{const v=marketVehicleFromRow(r),car=carsDB.find(x=>x.id===Number(v.carId||r.car_id));if(!car)return;const u=v.upgrades||{},mine=r.seller_id===state.playerId,plate=v.plate;c.innerHTML+='<div class="listing-card market-v8"><div class="listing-head"><span class="listing-name">'+escapeHtml(car.name)+'</span>'+(mine?'<span class="mine-tag">ВАШ ЛОТ</span>':'')+'</div><div class="listing-meta">'+escapeHtml(r.seller_name||'Игрок')+' · '+(v.effectivePower||car.power)+' л.с. · Build '+(v.buildRating||0)+'/100</div><div class="market-tune-grid"><span>Двигатель<b>'+Number(u.engine||0)+'/5</b></span><span>Турбо<b>'+Number(u.turbo||0)+'/5</b></span><span>КПП<b>'+Number(u.gearbox||0)+'/5</b></span><span>Шины<b>'+Number(u.tires||0)+'/5</b></span></div><div class="market-installed"><span>Тюнинг <b>'+fmt(v.tuningValue||0)+' SYND</b></span><span>Номер <b>'+(plate?escapeHtml(plate.text)+' · '+RARITY_LABEL[plate.rarity]:'нет')+'</b></span></div><div class="listing-head"><span class="listing-price">'+fmt(r.price)+' SYND</span>'+(mine?'<button class="sell-btn" onclick="cancelListing('+r.id+')">Снять</button>':'<button class="btn btn-buy" onclick="buyListing('+r.id+')">КУПИТЬ</button>')+'</div></div>';});
  };
  stateSellPrice=function(car){return Math.max(50,Math.round((car.price+tuningInstalledValue(car.id)*.52+(activePlate(car.id)?.value||0)*.35)*(0.52+getCondition(car.id)/100*.18)));};
  promptListCar=function(carId){const car=carsDB.find(c=>c.id===carId),snap=vehicleSnapshot(carId),suggested=Math.round((car.price+(snap?.tuningValue||0)*.72+(snap?.plate?.value||0)*.45)*.82)||100;const input=window.prompt('Цена за '+car.name+' вместе с тюнингом и установленным номером. Ориентир: '+fmt(suggested),suggested);if(input===null)return;const price=parseInt(input,10);if(!price||price<=0||price>MAX_MARKET_PRICE){showToast('Цена должна быть от 1 до '+fmt(MAX_MARKET_PRICE)+' SYND');return;}listCarForSale(carId,price);};
  listCarForSale=async function(carId,price){
    if(!sb){showToast('Рынок недоступен');return;}if(!await requireOnlineWrite('Рынок'))return;if(!state.ownedCars.includes(carId)||state.ownedCars.length<=1)return;price=Math.trunc(Number(price));if(!Number.isFinite(price)||price<1||price>MAX_MARKET_PRICE)return;const car=carsDB.find(c=>c.id===carId),snapshot=vehicleSnapshot(carId);
    try{const {data,error}=await sb.from('market_cars').insert({seller_id:state.playerId,seller_name:state.playerName,car_id:String(carId),price,vehicle_data:snapshot}).select('id').single();if(error)throw error;state.marketEscrow[String(data.id)]=snapshot;state.ownedCars=state.ownedCars.filter(id=>id!==carId);if(snapshot?.plate){state.plateInventory=state.plateInventory.filter(p=>p.uid!==snapshot.plate.uid);Object.keys(state.installedPlates||{}).forEach(k=>{if(state.installedPlates[k]===snapshot.plate.uid)delete state.installedPlates[k];});}delete state.upgrades[carId];delete state.fuel[carId];delete state.condition[carId];delete state.tuningHistory[carId];if(state.activeCarId===carId)state.activeCarId=state.ownedCars[0];showToast(car.name+' выставлена вместе с тюнингом');updateHeader();saveState();refreshMarket();renderSellPicker();}catch(e){console.warn(e);showToast('Не удалось выставить лот');}
  };
  cancelListing=async function(id){
    if(!sb||!await requireOnlineWrite('Рынок'))return;try{const {data,error}=await sb.from('market_cars').select('*').eq('id',id).single();if(error||!data)throw error||new Error('not found');if(data.seller_id!==state.playerId||data.status!=='active'){showToast('Лот недоступен');return;}const {error:u}=await sb.from('market_cars').update({status:'cancelled'}).eq('id',id).eq('status','active');if(u)throw u;const snap=marketVehicleFromRow(data)||state.marketEscrow[String(id)];applyVehicleSnapshot(snap);delete state.marketEscrow[String(id)];showToast('Машина и её сборка возвращены в гараж');saveState();refreshMarket();}catch(e){console.warn(e);showToast('Ошибка снятия лота');}
  };
  buyListing=async function(id){
    if(!sb||!await requireOnlineWrite('Рынок'))return;try{const {data,error}=await sb.from('market_cars').select('*').eq('id',id).eq('status','active').single();if(error||!data){showToast('Лот уже недоступен');refreshMarket();return;}if(data.seller_id===state.playerId)return;const snap=marketVehicleFromRow(data),carId=Number(snap.carId||data.car_id);if(state.ownedCars.includes(carId)||escrowCarIds().has(carId)){showToast('Такая модель уже есть в гараже или находится в вашем лоте');return;}if(state.coins<data.price){showToast('Недостаточно SYND');return;}const {data:upd,error:u}=await sb.from('market_cars').update({status:'sold',buyer_id:state.playerId,sold_at:new Date().toISOString()}).eq('id',id).eq('status','active').select();if(u)throw u;if(!upd?.length){showToast('Лот уже купили');refreshMarket();return;}state.coins-=data.price;state.stats.totalSpent+=data.price;applyVehicleSnapshot(snap);showToast('Куплено: машина, тюнинг и установленный номер');updateHeader();saveState();refreshMarket();}catch(e){console.warn(e);showToast('Не удалось купить лот');}
  };
  sellToState=function(carId){if(!state.ownedCars.includes(carId)||state.ownedCars.length<=1)return;const car=carsDB.find(c=>c.id===carId),price=stateSellPrice(car);if(!confirm('Продать '+car.name+' государству за '+fmt(price)+' SYND? Установленный тюнинг и номер уйдут вместе с машиной.'))return;state.coins+=price;state.stats.totalEarned+=price;state.ownedCars=state.ownedCars.filter(id=>id!==carId);if(state.activeCarId===carId)state.activeCarId=state.ownedCars[0];const uid=state.installedPlates[String(carId)];if(uid)state.plateInventory=state.plateInventory.filter(p=>p.uid!==uid);delete state.installedPlates[String(carId)];delete state.upgrades[carId];delete state.fuel[carId];delete state.condition[carId];delete state.tuningHistory[carId];showToast('Машина продана вместе со сборкой');updateHeader();saveState();renderSellPicker();};

  async function reconcileMarketEscrow(){
    if(!sb||!onlineAuthReady||!state.playerId)return;
    try{
      const {data,error}=await sb.from('market_cars').select('*').eq('seller_id',state.playerId).eq('status','active');if(error)throw error;
      let changed=false;
      for(const row of (data||[])){
        const key=String(row.id),snap=marketVehicleFromRow(row),carId=Number(snap.carId||row.car_id);
        if(!state.marketEscrow[key]){state.marketEscrow[key]=snap;changed=true;}
        if(state.ownedCars.includes(carId)){
          state.ownedCars=state.ownedCars.filter(id=>id!==carId);
          if(snap?.plate){state.plateInventory=state.plateInventory.filter(p=>p.uid!==snap.plate.uid);delete state.installedPlates[String(carId)];}
          delete state.upgrades[carId];delete state.fuel[carId];delete state.condition[carId];delete state.tuningHistory[carId];
          if(state.activeCarId===carId&&state.ownedCars.length)state.activeCarId=state.ownedCars[0];changed=true;
        }
      }
      if(changed){saveState();updateHeader();}
    }catch(e){console.warn('market reconcile',e);}
  }
  window.reconcileMarketEscrow=reconcileMarketEscrow;

  const baseClaimSoldProceeds=claimSoldProceeds;
  claimSoldProceeds=async function(){
    await baseClaimSoldProceeds();let changed=false;
    Object.keys(state.marketEscrow||{}).forEach(id=>{if((state.claimedSaleIds||[]).includes(Number(id))){delete state.marketEscrow[id];changed=true;}});
    if(changed)saveState();
  };

  /* ---------- REFERRALS ---------- */
  async function initReferralSystem(){
    if(!sb||!onlineAuthReady)return;try{const ref=new URLSearchParams(location.search).get('ref');if(ref&&!state.referral.bound){const {data,error}=await sb.rpc('autosyndicate_bind_referrer',{p_referral_code:safeText(ref,'',20).toUpperCase()});if(!error&&data){const row=Array.isArray(data)?data[0]:data,bonus=Number(row?.invitee_bonus)||0;if(bonus>0&&!state.referral.startBonusClaimed){state.coins+=bonus;state.stats.totalEarned+=bonus;state.referral.startBonusClaimed=true;showToast('Реферальный стартовый бонус: +'+fmt(bonus)+' SYND');}state.referral.bound=!!row?.bound;saveState();}}
      await refreshReferralDashboard();await claimReferralRewards();
    }catch(e){console.warn('referral init',e);}
  }
  async function refreshReferralDashboard(){
    if(!sb||!onlineAuthReady)return;try{const {data,error}=await sb.rpc('autosyndicate_referral_dashboard');if(error||!data)return;const r=Array.isArray(data)?data[0]:data;if(!r)return;state.referral.code=safeText(r.referral_code,'',20);state.referral.bound=!!r.has_referrer;state.referral.invites=Number(r.invites)||0;state.referral.earned=Number(r.total_earned)||0;saveState();if(document.getElementById('screen-referrals')?.classList.contains('active'))renderReferrals();}catch(e){console.warn(e);}
  }
  async function claimReferralRewards(){
    if(!sb||!onlineAuthReady)return 0;try{const {data,error}=await sb.rpc('autosyndicate_claim_referral_rewards');if(error)return 0;const amount=Number(Array.isArray(data)?data[0]?.amount:data?.amount)||Number(data)||0;if(amount>0){state.coins+=amount;state.stats.totalEarned+=amount;state.referral.totalClaimed=(state.referral.totalClaimed||0)+amount;showToast('Доход от рефералов: +'+fmt(amount)+' SYND');updateHeader();saveState();return amount;}}catch(e){console.warn(e);}return 0;
  }
  async function claimFirstRaceReferralBonus(){
    if(!sb||!onlineAuthReady||state.referral.firstRaceBonusClaimed||state.stats.races<1)return;try{const {data,error}=await sb.rpc('autosyndicate_claim_first_race_bonus');if(error)return;const amount=Number(Array.isArray(data)?data[0]?.bonus:data?.bonus)||Number(data)||0;if(amount>0){state.coins+=amount;state.stats.totalEarned+=amount;state.referral.firstRaceBonusClaimed=true;showToast('Подарок за первую гонку: +'+fmt(amount)+' SYND');updateHeader();saveState();}}catch(e){console.warn(e);}
  }
  window.refreshReferralDashboard=refreshReferralDashboard;window.claimReferralRewards=claimReferralRewards;window.claimFirstRaceReferralBonus=claimFirstRaceReferralBonus;
  window.copyReferralLink=async function(){const code=state.referral.code;if(!code)return;const link=location.origin+location.pathname+'?ref='+encodeURIComponent(code);try{await navigator.clipboard.writeText(link);showToast('Реферальная ссылка скопирована');}catch(_){window.prompt('Скопируйте ссылку',link);}};
  window.renderReferrals=function(){ensureV8Screens();const root=document.getElementById('referral-content');if(!root)return;const code=state.referral.code||'СИНХРОНИЗАЦИЯ',link=state.referral.code?(location.origin+location.pathname+'?ref='+state.referral.code):'—';root.innerHTML='<div class="referral-hero"><div class="referral-code"><span>ВАШ КОД</span><b>'+escapeHtml(code)+'</b><button onclick="copyReferralLink()">'+svgIcon('copy')+' КОПИРОВАТЬ ССЫЛКУ</button></div><div class="referral-stats"><div><span>Приглашено</span><b>'+fmt(state.referral.invites||0)+'</b></div><div><span>Начислено</span><b>'+fmt(state.referral.earned||0)+' SYND</b></div><div><span>Получено</span><b>'+fmt(state.referral.totalClaimed||0)+' SYND</b></div></div></div><div class="referral-rules"><div class="v8-section-head"><b>КАК РАБОТАЕТ</b><span>5% от заработка</span></div><div class="rule-row"><b>Приглашённый</b><span>Стартовый бонус и отдельный подарок после первой завершённой гонки.</span></div><div class="rule-row"><b>Пригласивший</b><span>Получает 5% от роста подтверждённого серверного total_earned реферала.</span></div><div class="rule-row"><b>Защита</b><span>Самореферал запрещён. Реферер привязывается один раз и не меняется. Начисления хранятся в БД и выдаются идемпотентно.</span></div></div><div class="referral-link-preview">'+escapeHtml(link)+'</div><button class="btn btn-select" onclick="claimReferralRewards();refreshReferralDashboard()">ПРОВЕРИТЬ НАЧИСЛЕНИЯ</button>';
  };
  const basePoll=pollBackgroundClaims;pollBackgroundClaims=function(){basePoll();claimReferralRewards();};
  const baseBootstrap=bootstrapOnline;bootstrapOnline=async function(){await baseBootstrap();await reconcileMarketEscrow();await syncPlayerProfile(true);await initReferralSystem();};

  /* ---------- UI SCREENS / ICONS ---------- */
  function ensureCaseModalRoot(){ensureCaseModal();}
  function ensureV8Screens(){
    const main=document.getElementById('main-scroll');if(!main)return;
    if(!document.getElementById('screen-plates')){const s=document.createElement('div');s.id='screen-plates';s.className='screen';s.innerHTML='<div class="back-link" onclick="openDetail(state.tuneTargetId||state.activeCarId)">← К машине</div><div class="section-title"><span>Номера</span></div><div id="plate-content" class="list-container"></div>';main.appendChild(s);}
    if(!document.getElementById('screen-referrals')){const s=document.createElement('div');s.id='screen-referrals';s.className='screen';s.innerHTML='<div class="back-link" onclick="switchTab(\'profile\')">← Профиль</div><div class="section-title"><span>Реферальная система</span></div><div id="referral-content" class="list-container"></div>';main.appendChild(s);}
    ensureCaseModalRoot();
  }
  const baseSwitchTab=switchTab;
  switchTab=function(tabId){if(tabId==='plates'||tabId==='referrals')ensureV8Screens();baseSwitchTab(tabId);if(tabId==='plates')renderPlateScreen(state.tuneTargetId||state.activeCarId);if(tabId==='referrals'){renderReferrals();refreshReferralDashboard();claimReferralRewards();}if(raceCtx?.launchRaf&&tabId!=='race'&&raceCtx.finished)cancelAnimationFrame(raceCtx.launchRaf);};
  const baseRenderProfile=renderProfile;
  renderProfile=function(){baseRenderProfile();ensureV8Screens();const grid=document.querySelector('#screen-profile .hub-grid');if(grid&&!document.getElementById('hub-referral-v8')){const card=document.createElement('div');card.className='hub-card';card.id='hub-referral-v8';card.onclick=()=>switchTab('referrals');card.innerHTML='<div class="ic">'+svgIcon('users')+'</div><div class="lbl">Рефералы</div><div class="sub">5% от заработка</div>';grid.appendChild(card);}replaceHubIcons();};
  function replaceHubIcons(){
    const map=[['districts','map'],['contracts','list'],['jobs','brief'],['achievements','trophy'],['cases','case'],['leaderboard','chart'],['market','tag'],['chat','chat'],['bank','bank'],['settings','gear']];
    map.forEach(([tab,ic])=>{const el=document.querySelector('.hub-card[onclick*="\''+tab+'\'"] .ic');if(el)el.innerHTML=svgIcon(ic);});const daily=document.querySelector('.hub-card[onclick*="openDailyModal"] .ic');if(daily)daily.innerHTML=svgIcon('calendar');
  }
  const baseRenderGarage=renderGarage;renderGarage=function(){baseRenderGarage();document.querySelectorAll('#garage-list .car-card').forEach(card=>{const click=card.querySelector('.car-thumb')?.getAttribute('onclick')||'';const m=click.match(/openDetail\((\d+)\)/);const id=m?Number(m[1]):0;if(!id)return;const p=activePlate(id),info=card.querySelector('.car-title');if(info&&p)info.insertAdjacentHTML('afterend','<div class="garage-plate rar-'+p.rarity+'">'+escapeHtml(p.text)+'</div>');});};

  const baseShowToast=showToast;showToast=function(msg){baseShowToast(sanitizeUiText(msg));};
  const baseManualSave=manualSave;manualSave=function(){saveState();showToast('Прогресс сохранён');};
  const baseExport=exportSave;exportSave=function(){baseExport();};

  /* Fix duplicate achievement definition. */
  for(let i=achievementsDB.length-1;i>=0;i--){if(achievementsDB.findIndex(a=>a.id===achievementsDB[i].id)!==i)achievementsDB.splice(i,1);}
  renderAchievements=function(){const c=document.getElementById('ach-list');if(!c)return;c.innerHTML=achievementsDB.map(a=>{const done=!!state.achievements[a.id];return '<div class="ach-card '+(done?'done':'')+'"><div class="ach-ic">'+svgIcon(done?'shield':'trophy')+'</div><div class="ach-body"><b>'+a.name+'</b><span>'+a.desc+'</span></div><div class="ach-reward">'+(done?'ГОТОВО':'+'+fmt(a.reward)+' SYND')+'</div></div>';}).join('');};

  /* Slot symbols without emoji. */
  try{SLOT_SYMBOLS.splice(0,SLOT_SYMBOLS.length,'CHRY','LEMN','BELL','STAR','DIA','7');Object.keys(SLOT_PAYOUTS).forEach(k=>delete SLOT_PAYOUTS[k]);Object.assign(SLOT_PAYOUTS,{CHRY:3,LEMN:4,BELL:6,STAR:10,DIA:20,'7':50});}catch(_){ }

  document.addEventListener('DOMContentLoaded',()=>{ensureV8Screens();replaceHubIcons();renderProfile();});
})();
