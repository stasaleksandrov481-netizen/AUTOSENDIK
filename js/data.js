/* ==================== CARS DB ==================== */
const carsDB = [
  { id:1, name:"ВАЗ-2106 'Шестёрка'", image:"assets/cars/1.webp", price:0, power:150, tier:"Street Tier 1", cat:"street", flavor:"Легенда дворов. Заводится не с первого раза, зато душа поёт, когда наконец завёлся." },
  { id:2, name:"Volkswagen Golf Mk2", image:"assets/cars/2.webp", price:700, power:190, tier:"Street Tier 1", cat:"street", flavor:"Немецкая надёжность по цене б/у самоката. Идеально для первых заработков." },
  { id:3, name:"Toyota AE86 Trueno", image:"assets/cars/3.webp", price:1400, power:260, tier:"Street Tier 2", cat:"jdm", flavor:"Панда на колёсах. Говорят, кто-то развозил на такой тофу по горным серпантинам." },
  { id:4, name:"Nissan Silvia S15", image:"assets/cars/4.webp", price:2600, power:350, tier:"Tuner Tier 2", cat:"jdm", flavor:"Дрифт-икона. На светофорах косятся, на трассе — уважают." },
  { id:5, name:"Mazda RX-7 FD", image:"assets/cars/5.webp", price:3200, power:390, tier:"Tuner Tier 2", cat:"jdm", flavor:"Роторный движок воет как турбина. Соседи не любят, зато завидуют." },
  { id:6, name:"Toyota Supra MK4", image:"assets/cars/6.webp", price:4400, power:430, tier:"Tuner Tier 3", cat:"jdm", flavor:"2JZ можно крутить бесконечно. Легенда подполья, проверено временем." },
  { id:7, name:"Mitsubishi Lancer Evo IX", image:"assets/cars/7.webp", price:4900, power:450, tier:"Tuner Tier 3", cat:"jdm", flavor:"Полный привод и характер бойца. На мокром асфальте не подведёт." },
  { id:8, name:"Subaru Impreza WRX STI", image:"assets/cars/8.webp", price:5100, power:465, tier:"Tuner Tier 3", cat:"jdm", flavor:"Оппозитный рокот слышно за квартал. Раллийные гены не пропьёшь." },
  { id:9, name:"Nissan Skyline GT-R R34", image:"assets/cars/9.webp", price:6800, power:500, tier:"Tuner Tier 3", cat:"jdm", flavor:"Godzilla. Просто Godzilla. На этом можно закончить описание." },
  { id:10, name:"Ford Mustang GT", image:"assets/cars/10.webp", price:3400, power:440, tier:"Muscle Tier 3", cat:"muscle", flavor:"Американская классика. Жрёт бензин как не в себя, но звук V8 того стоит." },
  { id:11, name:"Dodge Challenger SRT", image:"assets/cars/11.webp", price:5400, power:490, tier:"Muscle Tier 3", cat:"muscle", flavor:"Тяжёлый, злой, прямолинейный. На драге — король." },
  { id:12, name:"Chevrolet Camaro SS", image:"assets/cars/12.webp", price:5700, power:505, tier:"Muscle Tier 3", cat:"muscle", flavor:"Низкий, широкий, агрессивный силуэт. Дизайнеры не сдерживались." },
  { id:13, name:"BMW M4 Competition", image:"assets/cars/13.webp", price:7600, power:520, tier:"Sport Tier 4", cat:"sport", flavor:"Баварский хирургический инструмент. Точность в каждом повороте." },
  { id:14, name:"Mercedes-AMG GT", image:"assets/cars/14.webp", price:8300, power:560, tier:"Sport Tier 4", cat:"sport", flavor:"Длинный капот, короткий характер. AMG не терпит компромиссов." },
  { id:15, name:"Audi RS6 Avant", image:"assets/cars/15.webp", price:8700, power:575, tier:"Sport Tier 4", cat:"sport", flavor:"Универсал, который порвёт половину спорткаров. Quattro не обманывает." },
  { id:16, name:"Porsche 911 Turbo S", image:"assets/cars/16.webp", price:13500, power:660, tier:"Supercar Tier 5", cat:"super", flavor:"Инженерное совершенство Штутгарта. Заезд — формальность, победа — данность." },
  { id:17, name:"Porsche 911 GT3 RS", image:"assets/cars/17.webp", price:15800, power:700, tier:"Supercar Tier 5", cat:"super", flavor:"Трековый снаряд с номерами. Антикрыло не для красоты." },
  { id:18, name:"Audi R8 V10", image:"assets/cars/18.webp", price:17200, power:730, tier:"Supercar Tier 5", cat:"super", flavor:"Атмосферная десятка ревёт так, что закладывает уши прохожим." },
  { id:19, name:"Nissan GT-R R35", image:"assets/cars/19.webp", price:18900, power:750, tier:"Supercar Tier 5", cat:"super", flavor:"Компьютерный мозг и звериная тяга. Из коробки готов рвать полигон." },
  { id:20, name:"McLaren 720S", image:"assets/cars/20.webp", price:24500, power:790, tier:"Supercar Tier 5", cat:"super", flavor:"Глаза-фары смотрят прямо в душу соперника ещё до старта." },
  { id:21, name:"Ferrari 488 Pista", image:"assets/cars/21.webp", price:32000, power:860, tier:"Hypercar Tier 6", cat:"hyper", flavor:"Red is the fastest colour, как говорят в Маранелло." },
  { id:22, name:"Ferrari SF90 Stradale", image:"assets/cars/22.webp", price:38500, power:900, tier:"Hypercar Tier 6", cat:"hyper", flavor:"Гибрид, который стыдно называть гибридом. Разгон рвёт шею." },
  { id:23, name:"Lamborghini Huracan", image:"assets/cars/23.webp", price:42000, power:930, tier:"Hypercar Tier 6", cat:"hyper", flavor:"Итальянский бык на асфальте. Соседи снимают на телефон каждый выезд." },
  { id:24, name:"Lamborghini Aventador", image:"assets/cars/24.webp", price:52000, power:975, tier:"Legendary Boss", cat:"legend", flavor:"Ножничные двери — билет в клуб избранных подполья." },
  { id:25, name:"Bugatti Chiron", image:"assets/cars/25.webp", price:78000, power:1200, tier:"Legendary Boss", cat:"legend", flavor:"Не машина — произведение искусства с мотором W16. Топ пищевой цепи." },
  { id:26, name:"Комета Тьмы (миф)", image:null, price:95000, power:1350, tier:"Mythic ★★★", cat:"myth", flavor:"Говорят, объезжает светофоры сама и появляется только на полнолуние. Никто не видел документов на эту тачку." },
  { id:27, name:"'Дед Толян' — ржавое чудо", image:null, price:9999, power:1050, tier:"Mythic ★★★", cat:"myth", flavor:"Снаружи ведро с гайками, внутри — движок неизвестного происхождения. Механики отказываются его обслуживать из уважения." }
];
const CAT_LABELS = { street:"Уличный", jdm:"JDM тюнер", muscle:"Масл-кар", sport:"Спорт", super:"Суперкар", hyper:"Гиперкар", legend:"Легенда", myth:"Миф подполья" };
const CAT_COLORS = { street:['#94a3b8','#334155'], jdm:['#38bdf8','#0c4a6e'], muscle:['#fb923c','#7c2d12'], sport:['#a78bfa','#4c1d95'], super:['#fb7185','#4c0519'], hyper:['#fbbf24','#78350f'], legend:['#facc15','#713f12'], myth:['#c084fc','#1e1033'] };

/* ==================== CAR ART (SVG, matches by category — no more mismatched photos) ==================== */
function carArtSVG(car){
  if(car.image){
    return '<img class="car-real-image" src="'+String(car.image).replace(/"/g,'&quot;')+'" alt="'+String(car.name).replace(/"/g,'&quot;')+'" loading="lazy">';
  }
  const col = CAT_COLORS[car.cat] || CAT_COLORS.street;
  const c1=col[0], c2=col[1];
  const shape = ['street','jdm','muscle'].includes(car.cat) ? 'classic' : (['sport','super'].includes(car.cat) ? 'coupe' : 'hyper');
  const gid = 'g'+car.id;
  const spoiler = shape==='hyper' ? '<rect x="150" y="53" width="58" height="6" rx="2" fill="'+c1+'"/><rect x="154" y="41" width="6" height="15" fill="'+c1+'"/><rect x="198" y="41" width="6" height="15" fill="'+c1+'"/>' : '';
  let body;
  if(shape==='classic'){
    body = '<path d="M20 110 Q20 90 45 88 L70 60 Q80 50 100 50 L160 50 Q180 50 190 65 L215 88 Q240 90 240 110 L240 118 Q240 124 232 124 L28 124 Q20 124 20 118 Z" fill="url(#'+gid+')"/>';
  } else if(shape==='coupe'){
    body = '<path d="M15 112 Q15 88 42 85 L65 55 Q78 42 105 42 L165 42 Q188 44 200 60 L222 85 Q245 88 245 112 L245 120 Q245 126 237 126 L23 126 Q15 126 15 120 Z" fill="url(#'+gid+')"/>';
  } else {
    body = '<path d="M10 114 Q10 95 35 90 L60 62 Q75 44 110 42 L160 42 Q195 44 208 65 L228 90 Q250 92 250 114 L250 122 Q250 127 242 127 L18 127 Q10 127 10 122 Z" fill="url(#'+gid+')"/>';
  }
  const hueShift = ((car.id*29) % 40) - 20;
  return '<svg viewBox="0 0 260 150" preserveAspectRatio="xMidYMid slice" style="filter:hue-rotate('+hueShift+'deg)">'+
    '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>'+
    '<linearGradient id="bgg'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0e16"/><stop offset="1" stop-color="#050508"/></linearGradient></defs>'+
    '<rect width="260" height="150" fill="url(#bgg'+gid+')"/>'+
    '<ellipse cx="130" cy="129" rx="112" ry="9" fill="'+c1+'" opacity="0.18"/>'+
    body + spoiler +
    '<rect x="35" y="66" width="185" height="2" fill="rgba(255,255,255,.15)"/>'+
    '<circle cx="65" cy="126" r="17" fill="#0a0a0e" stroke="'+c1+'" stroke-width="3"/><circle cx="65" cy="126" r="6" fill="'+c1+'"/>'+
    '<circle cx="195" cy="126" r="17" fill="#0a0a0e" stroke="'+c1+'" stroke-width="3"/><circle cx="195" cy="126" r="6" fill="'+c1+'"/>'+
    '<rect x="205" y="94" width="15" height="6" rx="2" fill="#fff" opacity="0.9"/>'+
    '<rect x="28" y="94" width="10" height="5" rx="2" fill="#ff3b3b" opacity="0.85"/>'+
    '</svg>';
}

/* ==================== TUNING (5 stages + Nitro + Tires) ==================== */
const TUNE_TYPES = [
  { key:"engine", name:"Двигатель", icon:"🔧", desc:"Прошивка ЭБУ и доработка мотора", hpPerStage:[0.08,0.09,0.10,0.11,0.12] },
  { key:"turbo", name:"Турбина", icon:"🌀", desc:"Больше буст — больше тяги", hpPerStage:[0.06,0.07,0.08,0.09,0.10] },
  { key:"gearbox", name:"КПП", icon:"⚙️", desc:"Короткие передачи, быстрее разгон", hpPerStage:[0.05,0.06,0.06,0.07,0.08] },
  { key:"tires", name:"Резина", icon:"🛞", desc:"Слики держат разгон без пробуксовки", hpPerStage:[0.03,0.04,0.05,0.05,0.06] }
];
function getUpg(carId){ if(!state.upgrades[carId]) state.upgrades[carId]={engine:0,turbo:0,gearbox:0,tires:0}; TUNE_TYPES.forEach(t=>{ if(state.upgrades[carId][t.key]===undefined) state.upgrades[carId][t.key]=0; }); return state.upgrades[carId]; }
function getEffectivePower(car){
  const upg=getUpg(car.id); let mult=1;
  TUNE_TYPES.forEach(t=>{ const lvl=upg[t.key]; for(let i=0;i<lvl;i++) mult+=t.hpPerStage[i]; });
  const cond = getCondition(car.id);
  if(cond<40) mult*=0.85; else if(cond<70) mult*=0.93;
  return Math.round(car.power*mult);
}
function tuneStagePrice(car,stageIndex){ const base=Math.max(250,Math.round(car.price*0.10)); return Math.round(base*(stageIndex+1)*1.6); }


/* ==================== OPPONENTS / TOURNAMENTS ==================== */
const opponentsDB = [
  { id:1, name:"Дворовый Стас на 'копейке'", image:null, power:220, reward:220, unlockLevel:1, taunt:"«Погнали, братан, я на этой тачке с музыкой из телефона!»" },
  { id:2, name:"Толян с раёна на Golf'e", image:null, power:340, reward:380, unlockLevel:1, taunt:"«У меня чип стоит, между прочим!»" },
  { id:3, name:"Августина на мамином Audi", image:null, power:480, reward:650, unlockLevel:2, taunt:"«Мама не узнает, погнали!»" },
  { id:4, name:"Ночной Гонщик 'Феникс'", image:null, power:620, reward:1100, unlockLevel:4, taunt:"«Тут тебе не покатушки, тут дуэль.»" },
  { id:5, name:"Барон трассы Вадим", image:null, power:780, reward:2000, unlockLevel:6, taunt:"«Многие пытались. Мало кто финишировал первым.»" },
  { id:6, name:"Скрытная 'Тень'", image:null, power:950, reward:3600, unlockLevel:8, taunt:"«...» (она никогда не разговаривает)" },
  { id:7, name:"Легенда подполья Дариан", image:null, power:1150, reward:6000, unlockLevel:11, taunt:"«Я жду соперника десять лет. Ты следующий проигравший.»", boss:true },
  { id:8, name:"Финалист 'Полночь'", image:null, power:1350, reward:10000, unlockLevel:14, taunt:"«Никто не побеждал меня дважды. Некоторые — ни разу.»", boss:true },
  { id:9, name:"Король подполья «Синдикат»", image:null, power:1550, reward:20000, unlockLevel:18, taunt:"«Ты хоть знаешь, кто здесь всем заправляет?»", boss:true }
];
const tournamentsDB = [
  { id:'t1', name:"Ночной Кубок", power:500, reward:2500, entryFee:300, unlockLevel:3, taunt:"Ночной турнир для смелых новичков." },
  { id:'t2', name:"Кубок Синдиката", power:900, reward:9000, entryFee:1200, unlockLevel:7, taunt:"Только сильнейшие доходят до финала." },
  { id:'t3', name:"Гран-При Подполья", power:1400, reward:30000, entryFee:4000, unlockLevel:13, taunt:"Легенды подполья рождаются здесь." }
];
function entryFeeFor(opp){ return opp.entryFee!==undefined ? opp.entryFee : Math.round(opp.reward*0.12)+20; }
function fuelCostFor(opp){ return opp.boss ? 26 : (opp.entryFee!==undefined ? 22 : 14); }

/* ==================== JOBS ==================== */
const jobsDB = [
  { id:"wash", name:"Мойка тачек в гараже", desc:"Быстро, скучно, но надёжно", reward:90, xp:6, cooldown:25 },
  { id:"delivery", name:"Доставка запчастей", desc:"Погонять по району без риска", reward:180, xp:12, cooldown:60 },
  { id:"taxi", name:"Ночной таксист", desc:"Долгая смена, зато солидно платят", reward:340, xp:20, cooldown:150 }
];

/* ==================== ДПС (ПОЛИЦИЯ) ==================== */
const POLICE_LINES = [
  "«Документы, инструмент, вот это всё.»",
  "«Куда спешим, гонщик?»",
  "«Радар показал интересную циферку.»",
  "«Ты не в кино, притормози.»",
  "«Опять ты? Третий раз за неделю вижу эту тачку.»"
];
const POLICE_BASE_FINE = 180;
const LICENSE_BASE_PRICE = 900;
function licensePrice(){ return LICENSE_BASE_PRICE + state.licenseSuspendCount*350; }

/* ==================== БАНК ==================== */
const BANK_MAX_PER_TRANSFER = 800;
const BANK_MAX_PER_DAY = 2000;
const BANK_COOLDOWN_MS = 10*60*1000; // 10 минут между переводами одному игроку

