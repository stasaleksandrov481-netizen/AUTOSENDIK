/* ==================== SUPABASE (МУЛЬТИПЛЕЕР: РЫНОК + ЧАТ) ==================== */
const SUPABASE_URL = 'https://jkmspwpfbebynwubykdf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_byHJILmOo07-I7aEJF3uMA_jIJqMFAb';
let sb = null;
let marketChannel = null;
let chatChannel = null;
const MAX_MARKET_PRICE=2_000_000;
const MAX_PVP_STAKE=25_000;
const CHAT_RATE_MS=2500;
const CHAT_MAX_PER_MIN=8;
let chatSendTimes=[];
let onlineBootstrapped=false;
let onlineAuthReady=false;
let onlineIntervalsStarted=false;

function initSupabase(){
  if(sb){ if(!onlineBootstrapped)bootstrapOnline(); return sb; }
  try{
    if(window.supabase&&window.supabase.createClient){
      sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      bootstrapOnline();
    }
  }catch(e){console.warn('supabase init failed',e);}
  return sb;
}
async function ensureOnlineAuth(){
  if(!sb)return false;
  try{
    const {data}=await sb.auth.getSession();
    if(data?.session){
      const currentId=data.session.user?.user_metadata?.player_id;
      if(currentId!==state.playerId){const {error:uerr}=await sb.auth.updateUser({data:{player_id:state.playerId}});if(uerr)throw uerr;}
      onlineAuthReady=true;return true;
    }
    const {data:anon,error}=await sb.auth.signInAnonymously({options:{data:{player_id:state.playerId}}});
    if(error)throw error;
    onlineAuthReady=!!anon?.session;
    return onlineAuthReady;
  }catch(e){
    onlineAuthReady=false;
    console.warn('Supabase anonymous auth is not enabled. Online writes may be unavailable in hardened mode.',e?.message||e);
    return false;
  }
}
async function bootstrapOnline(){
  if(onlineBootstrapped||!sb)return;
  onlineBootstrapped=true;
  await ensureOnlineAuth();
  subscribeMarket();syncPlayerProfile();loadPlayerLeaderboard();pollBackgroundClaims();
  if(!onlineIntervalsStarted){onlineIntervalsStarted=true;setInterval(pollBackgroundClaims,90000);setInterval(syncPlayerProfile,30000);}
}
async function requireOnlineWrite(feature='Онлайн-функция'){
  if(!sb) initSupabase();
  if(!onlineAuthReady){
    const ok=await ensureOnlineAuth();
    if(!ok){ showToast(' '+feature+': включи Anonymous Sign-Ins в Supabase Auth'); return false; }
  }
  const synced=await syncPlayerProfile(true);
  if(!synced){ showToast(' '+feature+': профиль не синхронизирован'); return false; }
  return true;
}

function pollBackgroundClaims(){
  if(document.getElementById('screen-race')?.classList.contains('active')) return;
  if(!sb) return;
  claimSoldProceeds();
  claimBankTransfers();
  claimPvpResults();
}


/* ---------- РЕАЛЬНЫЕ ПРОФИЛИ ИГРОКОВ ---------- */
function playerProfilePayload(){
  return {
    id: state.playerId,
    name: safeText(state.playerName,'Гонщик',48),
    photo_url: state.playerPhoto || null,
    level: Number(state.level)||1,
    balance: Number(state.coins)||0,
    xp: Number(state.xp)||0,
    races: Number(state.stats?.races)||0,
    wins: Number(state.stats?.wins)||0,
    losses: Number(state.stats?.losses)||0,
    total_earned: Number(state.stats?.totalEarned)||0,
    owned_cars: Array.isArray(state.ownedCars)?state.ownedCars.slice(0,100):[],
    active_car_id: Number(state.activeCarId)||1,
    last_seen: new Date().toISOString()
  };
}
async function syncPlayerProfile(force=false){
  if(!force && document.getElementById('screen-race')?.classList.contains('active')) return false;
  if(!sb || !onlineAuthReady || !state.playerId || !/^(tg_[0-9]{1,24}|guest_[A-Za-z0-9-]{8,80})$/.test(state.playerId)) return false;
  try{
    const {error}=await sb.from('player_profiles').upsert(playerProfilePayload(),{onConflict:'id'});
    if(error){ console.warn('player profile sync:',error.message); return false; }
    return true;
  }catch(e){ console.warn('player profile sync failed',e); return false; }
}
async function loadPlayerLeaderboard(){
  if(!sb) return [];
  try{
    const {data,error}=await sb.from('player_profiles').select('id,name,photo_url,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,last_seen').order('level',{ascending:false}).order('total_earned',{ascending:false}).limit(200);
    if(error) throw error;
    return data||[];
  }catch(e){ console.warn('player leaderboard:',e.message); return []; }
}
async function openPublicProfileByName(name){
  if(!sb){ showToast('Профиль недоступен без подключения'); return; }
  try{
    const clean=safeText(name,'',48); if(!clean) return;
    const {data,error}=await sb.from('player_profiles').select('id,name,photo_url,level,balance,xp,races,wins,losses,total_earned,owned_cars,active_car_id,last_seen').eq('name',clean).order('last_seen',{ascending:false}).limit(1).maybeSingle();
    if(error) throw error;
    if(data) openPublicProfileData(data);
    else showToast('Профиль игрока не найден');
  }catch(e){ console.warn(e); showToast('Не удалось загрузить профиль'); }
}
/* ---------- РЫНОК ---------- */
let marketSub = 'browse';
function switchMarketSub(sub){
  marketSub = sub;
  document.getElementById('msub-browse').classList.toggle('active', sub==='browse');
  document.getElementById('msub-sell').classList.toggle('active', sub==='sell');
  document.getElementById('market-browse-wrap').style.display = sub==='browse' ? '' : 'none';
  document.getElementById('market-sell-wrap').style.display = sub==='sell' ? '' : 'none';
  if(sub==='sell') renderSellPicker();
}
function openMarket(){
  initSupabase();
  switchMarketSub(marketSub);
  refreshMarket();
}
function subscribeMarket(){
  if(!sb || marketChannel) return;
  marketChannel = sb.channel('market_cars_rt')
    .on('postgres_changes', {event:'*', schema:'public', table:'market_cars'}, ()=>{
      const scr=document.getElementById('screen-market');
      if(scr && scr.classList.contains('active')) refreshMarket();
    })
    .subscribe();
}
async function refreshMarket(){
  const statusEl = document.getElementById('market-status');
  if(!sb){ if(statusEl) statusEl.innerText=' Рынок недоступен (нет подключения к серверу)'; return; }
  if(statusEl) statusEl.innerText='Загрузка лотов…';
  try{
    const {data, error} = await sb.from('market_cars').select('*').eq('status','active').order('id',{ascending:false}).limit(60);
    if(error) throw error;
    renderMarketList(data||[]);
    if(statusEl) statusEl.innerText = (data&&data.length) ? 'Активных лотов: '+data.length : 'Рынок пуст';
  }catch(e){ console.warn(e); if(statusEl) statusEl.innerText=' Не удалось загрузить рынок'; }
  claimSoldProceeds();
  renderMyListings();
}
function renderMarketList(rows){
  const c=document.getElementById('market-list'); if(!c) return;
  c.innerHTML='';
  if(!rows.length){ c.innerHTML='<div class="empty-note">Пока никто ничего не продаёт. Загляни позже!</div>'; return; }
  rows.forEach(r=>{
    const car=carsDB.find(x=>x.id===parseInt(r.car_id,10));
    if(!car) return;
    const isMine = r.seller_id===state.playerId;
    c.innerHTML += '<div class="listing-card">'+
      '<div class="listing-head"><span class="listing-name">'+escapeHtml(car.name)+'</span>'+(isMine?'<span class="mine-tag">Ваш лот</span>':'')+'</div>'+
      '<div class="listing-meta">Продавец: '+escapeHtml(r.seller_name||'Игрок')+' · '+car.tier+' · '+car.power+' л.с.</div>'+
      '<div class="listing-head"><span class="listing-price">'+fmt(r.price)+' </span>'+
      (isMine
        ? '<button class="sell-btn" onclick="cancelListing('+r.id+')">Снять с продажи</button>'
        : '<button class="btn btn-buy" style="width:auto;padding:8px 14px;" onclick="buyListing('+r.id+')">КУПИТЬ</button>')+
      '</div></div>';
  });
}
function renderSellPicker(){
  const box=document.getElementById('sell-picker'); if(!box) return;
  const mine = carsDB.filter(c=>state.ownedCars.includes(c.id));
  if(mine.length<=1){ box.innerHTML='<div class="empty-note">Нужна хотя бы одна запасная машина в гараже, чтобы её продать.</div>'; return; }
  let html='<div class="gauge-label" style="text-align:left;margin-bottom:6px;">Выбери машину на продажу</div>';
  mine.forEach(car=>{
    const statePrice = stateSellPrice(car);
    html += '<div class="sell-row"><div><div class="sell-row-name">'+car.name+'</div><div class="sell-row-sub">'+car.tier+'</div></div>'+
      '<div class="btn-row" style="width:auto;gap:6px;">'+
      '<button class="sell-btn market" onclick="promptListCar('+car.id+')">На рынок</button>'+
      '<button class="sell-btn state" onclick="sellToState('+car.id+')">Гос-во '+fmt(statePrice)+'</button>'+
      '</div></div>';
  });
  box.innerHTML = html;
}
function stateSellPrice(car){
  return Math.max(50, Math.round(car.price*0.35 * (0.6+getCondition(car.id)/100*0.4)));
}
function promptListCar(carId){
  const car=carsDB.find(c=>c.id===carId);
  const suggested = Math.round(car.price*0.85)||100;
  const input = window.prompt('Цена продажи для "'+car.name+'" (в игровой валюте). Ориентир: '+fmt(suggested), suggested);
  if(input===null) return;
  const price = parseInt(input,10);
  if(!price || price<=0 || price>MAX_MARKET_PRICE){ showToast('Цена должна быть от 1 до '+fmt(MAX_MARKET_PRICE)+' SYND'); return; }
  listCarForSale(carId, price);
}
async function listCarForSale(carId, price){
  if(!sb){ showToast('Рынок недоступен'); return; }
  if(!await requireOnlineWrite('Рынок')) return;
  if(!state.ownedCars.includes(carId)) return;
  price=Math.trunc(Number(price));if(!Number.isFinite(price)||price<=0||price>MAX_MARKET_PRICE){showToast('Некорректная цена лота');return;}
  if(state.ownedCars.length<=1){ showToast('Нельзя продать последнюю машину'); return; }
  const car=carsDB.find(c=>c.id===carId);
  try{
    const {error} = await sb.from('market_cars').insert({
      seller_id: state.playerId, seller_name: state.playerName, car_id: String(carId), price: price
    });
    if(error) throw error;
    state.ownedCars = state.ownedCars.filter(id=>id!==carId);
    if(state.activeCarId===carId) state.activeCarId = state.ownedCars[0];
    showToast(' "'+car.name+'" выставлена на рынок за '+fmt(price)+' ');
    updateHeader(); saveState(); refreshMarket(); renderSellPicker();
  }catch(e){ console.warn(e); showToast(' Не удалось выставить лот (проверь настройки Supabase)'); }
}
async function cancelListing(id){
  if(!sb) return;
  if(!await requireOnlineWrite('Рынок')) return;
  try{
    const {data,error} = await sb.from('market_cars').select('*').eq('id',id).single();
    if(error||!data) throw error||new Error('not found');
    if(data.seller_id!==state.playerId || data.status!=='active'){ showToast('Лот недоступен'); refreshMarket(); return; }
    const {error:updErr} = await sb.from('market_cars').update({status:'cancelled'}).eq('id',id).eq('status','active');
    if(updErr) throw updErr;
    const carId = parseInt(data.car_id,10);
    if(!state.ownedCars.includes(carId)) state.ownedCars.push(carId);
    showToast('Лот снят, машина вернулась в гараж');
    saveState(); refreshMarket();
  }catch(e){ console.warn(e); showToast(' Ошибка при снятии лота'); }
}
async function buyListing(id){
  if(!sb) return;
  if(!await requireOnlineWrite('Рынок')) return;
  try{
    const {data,error} = await sb.from('market_cars').select('*').eq('id',id).eq('status','active').single();
    if(error||!data){ showToast('Лот уже продан или недоступен'); refreshMarket(); return; }
    if(data.seller_id===state.playerId){ showToast('Нельзя купить свой же лот'); return; }
    const carId = parseInt(data.car_id,10);
    if(state.ownedCars.includes(carId)){ showToast('У вас уже есть такая машина'); return; }
    if(state.coins<data.price){ showToast('Недостаточно денег'); return; }
    const {data:upd, error:updErr} = await sb.from('market_cars')
      .update({status:'sold', buyer_id: state.playerId, sold_at: new Date().toISOString()})
      .eq('id',id).eq('status','active').select();
    if(updErr) throw updErr;
    if(!upd || !upd.length){ showToast('Лот уже купил другой игрок'); refreshMarket(); return; }
    state.coins -= data.price; state.stats.totalSpent += data.price;
    state.ownedCars.push(carId);
    getFuel(carId); getCondition(carId); getUpg(carId);
    const car=carsDB.find(c=>c.id===carId);
    showToast(' Куплено у игрока: '+(car?car.name:'машина'));
    updateHeader(); saveState(); refreshMarket();
  }catch(e){ console.warn(e); showToast(' Не удалось купить лот'); }
}
function sellToState(carId){
  if(!state.ownedCars.includes(carId)) return;
  if(state.ownedCars.length<=1){ showToast('Нельзя продать последнюю машину'); return; }
  const car=carsDB.find(c=>c.id===carId);
  const price = stateSellPrice(car);
  if(!confirm('Продать "'+car.name+'" государству за '+fmt(price)+' ? Это заметно ниже рыночной цены — зато мгновенно.')) return;
  state.coins += price; state.stats.totalEarned += price;
  state.ownedCars = state.ownedCars.filter(id=>id!==carId);
  if(state.activeCarId===carId) state.activeCarId = state.ownedCars[0];
  delete state.upgrades[carId]; delete state.fuel[carId]; delete state.condition[carId];
  showToast(' Продано государству за '+fmt(price)+' ');
  updateHeader(); saveState(); renderSellPicker();
}
async function claimSoldProceeds(){
  if(!sb || !onlineAuthReady) return;
  try{
    const {data,error} = await sb.from('market_cars').select('id,price').eq('seller_id', state.playerId).eq('status','sold');
    if(error || !data || !data.length) return;
    if(!Array.isArray(state.claimedSaleIds)) state.claimedSaleIds=[];
    let credited=0, total=0;
    for(const row of data){
      if(state.claimedSaleIds.includes(row.id)) continue;
      const {data:settled,error:settleError}=await sb.from('market_cars').update({status:'settled'}).eq('id',row.id).eq('status','sold').select('id,price');
      if(settleError || !settled || !settled.length) continue;
      state.coins += Number(row.price)||0; state.stats.totalEarned += Number(row.price)||0;
      state.claimedSaleIds.push(row.id);
      credited++; total+=Number(row.price)||0;
    }
    if(credited){ showToast(' Продано на рынке: +'+fmt(total)+'  ('+credited+' лот.)'); updateHeader(); saveState(); }
  }catch(e){ console.warn(e); }
}
async function renderMyListings(){
  const c=document.getElementById('market-mine-list'); if(!c || !sb) return;
  try{
    const {data} = await sb.from('market_cars').select('*').eq('seller_id', state.playerId).order('id',{ascending:false}).limit(30);
    c.innerHTML='';
    if(!data || !data.length){ c.innerHTML='<div class="empty-note">Вы пока ничего не продавали на рынке</div>'; return; }
    const labels = {active:'На продаже', sold:'Продано ', settled:'Продано ', cancelled:'Снято с продажи'};
    data.forEach(r=>{
      const car=carsDB.find(x=>x.id===parseInt(r.car_id,10));
      c.innerHTML += '<div class="listing-card"><div class="listing-head"><span class="listing-name">'+(car?car.name:'Машина #'+r.car_id)+'</span><span class="listing-meta">'+(labels[r.status]||r.status)+'</span></div>'+
        '<div class="listing-head"><span class="listing-price">'+fmt(r.price)+' </span>'+
        (r.status==='active' ? '<button class="sell-btn" onclick="cancelListing('+r.id+')">Снять</button>' : '')+
        '</div></div>';
    });
  }catch(e){ console.warn(e); }
}

/* ---------- ЧАТ ---------- */
function openChat(){
  initSupabase();
  loadChatHistory();
  subscribeChat();
  setTimeout(()=>{ const i=document.getElementById('chat-input'); if(i) i.focus(); }, 200);
}
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function appendChatMessage(m){
  const c=document.getElementById('chat-messages'); if(!c) return;
  const isMe = m.user_name===state.playerName;
  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '';
  const div=document.createElement('div');
  div.className='chat-msg'+(isMe?' me':'');
  const nm=escapeHtml(m.user_name||'Игрок');
  div.innerHTML='<div class="chat-msg-name chat-profile-link" onclick="openPublicProfileByName('+JSON.stringify(m.user_name||'Игрок').replace(/"/g,'&quot;')+')">'+nm+' <span style="font-size:8px;color:var(--accent);">ПРОФИЛЬ</span></div><div class="chat-msg-text">'+escapeHtml(m.message)+'</div><div class="chat-msg-time">'+time+'</div>';
  c.appendChild(div);
}
async function loadChatHistory(){
  const statusEl=document.getElementById('chat-status');
  if(!sb){ if(statusEl){ statusEl.innerText=' Чат недоступен (нет подключения к серверу)'; statusEl.classList.remove('on'); } return; }
  if(statusEl) statusEl.innerText='Загрузка сообщений…';
  try{
    const {data,error} = await sb.from('chat_messages').select('*').order('id',{ascending:false}).limit(50);
    if(error) throw error;
    const msgs=(data||[]).slice().reverse();
    const c=document.getElementById('chat-messages'); c.innerHTML='';
    msgs.forEach(appendChatMessage);
    c.scrollTop=c.scrollHeight;
    if(statusEl){ statusEl.innerText='Онлайн'; statusEl.classList.add('on'); }
  }catch(e){ console.warn(e); if(statusEl){ statusEl.innerText=' Ошибка загрузки чата'; statusEl.classList.remove('on'); } }
}
function subscribeChat(){
  if(!sb || chatChannel) return;
  chatChannel = sb.channel('chat_messages_rt')
    .on('postgres_changes', {event:'INSERT', schema:'public', table:'chat_messages'}, payload=>{
      appendChatMessage(payload.new);
      const c=document.getElementById('chat-messages'); if(c) c.scrollTop=c.scrollHeight;
    })
    .subscribe();
}
async function sendChatMessage(){
  if(!sb){showToast('Чат недоступен');return;}
  if(!await requireOnlineWrite('Чат')) return;
  const input=document.getElementById('chat-input'),text=(input.value||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,300);if(!text)return;
  const now=Date.now();chatSendTimes=chatSendTimes.filter(ts=>now-ts<60000);
  if(chatSendTimes.length>=CHAT_MAX_PER_MIN || (chatSendTimes.length&&now-chatSendTimes[chatSendTimes.length-1]<CHAT_RATE_MS)){showToast('Не спамь: подожди пару секунд');haptic('warning');return;}
  try{
    const {error}=await sb.from('chat_messages').insert({user_name:safeText(state.playerName,'Гонщик',48),message:text});if(error)throw error;
    chatSendTimes.push(now);input.value='';haptic('light');
  }catch(e){console.warn(e);showToast(' Сообщение не отправлено');}
}

/* ==================== БАНК (ПЕРЕВОДЫ МЕЖДУ ИГРОКАМИ) ==================== */
function openBank(){
  initSupabase();
  document.getElementById('bank-my-id').innerText = state.playerId || '—';
  document.getElementById('bank-balance').innerText = fmt(state.coins);
  claimBankTransfers();
  renderBankLog();
}
function bankSentToday(){
  const dayAgo = Date.now()-24*60*60*1000;
  state.bankSentLog = (state.bankSentLog||[]).filter(l=>l.ts>dayAgo);
  return state.bankSentLog.reduce((s,l)=>s+l.amount,0);
}
function bankCooldownLeft(receiverId){
  const last = (state.bankSentLog||[]).filter(l=>l.to===receiverId).sort((a,b)=>b.ts-a.ts)[0];
  if(!last) return 0;
  const left = BANK_COOLDOWN_MS-(Date.now()-last.ts);
  return left>0 ? left : 0;
}
async function sendBankTransfer(){
  if(!sb){ showToast('Банк недоступен (нет подключения)'); return; }
  if(!await requireOnlineWrite('Банк')) return;
  const idInput=document.getElementById('bank-to-id');
  const amountInput=document.getElementById('bank-amount');
  const toId=(idInput.value||'').trim();
  const amount=parseInt(amountInput.value,10);
  const statusEl=document.getElementById('bank-send-status');
  statusEl.style.color='var(--accent)';
  if(!toId){ statusEl.innerText='Укажи ID получателя'; return; }
  if(!/^(tg_[0-9]{1,24}|guest_[A-Za-z0-9-]{8,80})$/.test(toId)){statusEl.innerText='Некорректный ID получателя';return;}
  if(toId===state.playerId){ statusEl.innerText='Нельзя перевести самому себе'; return; }
  if(!amount || amount<=0){ statusEl.innerText='Некорректная сумма'; return; }
  if(amount>BANK_MAX_PER_TRANSFER){ statusEl.innerText='Максимум за один перевод: '+fmt(BANK_MAX_PER_TRANSFER)+' '; return; }
  if(amount>state.coins){ statusEl.innerText='Недостаточно денег'; return; }
  const cooldown=bankCooldownLeft(toId);
  if(cooldown>0){ statusEl.innerText='Этому игроку можно перевести снова через '+Math.ceil(cooldown/60000)+' мин.'; return; }
  const sentToday=bankSentToday();
  if(sentToday+amount>BANK_MAX_PER_DAY){ statusEl.innerText='Дневной лимит переводов: '+fmt(BANK_MAX_PER_DAY)+'  (уже отправлено '+fmt(sentToday)+')'; return; }
  try{
    const {error} = await sb.from('bank_transfers').insert({
      sender_id: state.playerId, sender_name: state.playerName, receiver_id: toId, amount: amount
    });
    if(error) throw error;
    state.coins -= amount;
    state.bankSentLog.push({to:toId, amount, ts:Date.now()});
    showToast(' Отправлено '+fmt(amount)+'  игроку '+toId);
    statusEl.style.color='var(--green)'; statusEl.innerText='Перевод отправлен!';
    amountInput.value=''; idInput.value='';
    updateHeader(); saveState(); renderBankLog();
    document.getElementById('bank-balance').innerText=fmt(state.coins);
  }catch(e){ console.warn(e); statusEl.innerText=' Ошибка перевода'; }
}
async function claimBankTransfers(){
  if(!sb || !onlineAuthReady) return;
  try{
    const {data,error} = await sb.from('bank_transfers').select('id,amount').eq('receiver_id', state.playerId).eq('claimed', false);
    if(error || !data || !data.length) return;
    if(!Array.isArray(state.claimedTransferIds)) state.claimedTransferIds=[];
    let credited=0, total=0;
    for(const row of data){
      if(state.claimedTransferIds.includes(row.id)) continue;
      const {data:claimed,error:claimError}=await sb.from('bank_transfers').update({claimed:true}).eq('id',row.id).eq('claimed',false).select('id,amount');
      if(claimError || !claimed || !claimed.length) continue;
      const amount=Number(row.amount)||0;
      state.coins += amount;
      state.claimedTransferIds.push(row.id);
      credited++; total+=amount;
    }
    if(credited){ showToast(' Пришёл перевод: +'+fmt(total)+'  ('+credited+' шт.)'); updateHeader(); saveState(); }
  }catch(e){ console.warn(e); }
}
async function renderBankLog(){
  const c=document.getElementById('bank-log'); if(!c || !sb) return;
  try{
    const {data} = await sb.from('bank_transfers').select('*')
      .or('sender_id.eq.'+state.playerId+',receiver_id.eq.'+state.playerId)
      .order('id',{ascending:false}).limit(20);
    c.innerHTML='';
    if(!data || !data.length){ c.innerHTML='<div class="empty-note">Переводов пока не было</div>'; return; }
    data.forEach(r=>{
      const outgoing = r.sender_id===state.playerId;
      c.innerHTML += '<div class="listing-card"><div class="listing-head">'+
        '<span class="listing-name">'+(outgoing?'Отправлено → '+escapeHtml(r.receiver_id):'Получено ← '+escapeHtml(r.sender_name||r.sender_id))+'</span>'+
        '<span class="listing-price" style="color:'+(outgoing?'var(--accent)':'var(--green)')+'">'+(outgoing?'-':'+')+fmt(r.amount)+' </span>'+
        '</div></div>';
    });
  }catch(e){ console.warn(e); }
}

/* ==================== PVP-ЗАЕЗДЫ С ИГРОКАМИ (асинхронные вызовы) ==================== */
function openPvp(){
  initSupabase();
  claimPvpResults();
  refreshPvpList();
}
async function refreshPvpList(){
  const c=document.getElementById('pvp-list'); if(!c) return;
  if(!sb){ c.innerHTML='<div class="empty-note"> PvP недоступен (нет подключения)</div>'; return; }
  try{
    const {data,error} = await sb.from('pvp_challenges').select('*').eq('status','open').order('id',{ascending:false}).limit(40);
    if(error) throw error;
    c.innerHTML='';
    if(!data || !data.length){ c.innerHTML='<div class="empty-note">Открытых вызовов нет. Создай свой!</div>'; return; }
    data.forEach(r=>{
      const isMine = r.challenger_id===state.playerId;
      c.innerHTML += '<div class="listing-card"><div class="listing-head"><span class="listing-name">'+escapeHtml(r.challenger_name||'Игрок')+'</span>'+(isMine?'<span class="mine-tag">Твой вызов</span>':'')+'</div>'+
        '<div class="listing-meta">Мощность соперника: '+r.power+' л.с.</div>'+
        '<div class="listing-head"><span class="listing-price">Ставка '+fmt(r.stake)+' </span>'+
        (isMine
          ? '<button class="sell-btn" onclick="cancelPvpChallenge('+r.id+')">Отменить</button>'
          : '<button class="btn btn-buy" style="width:auto;padding:8px 14px;" onclick="acceptPvpChallenge('+r.id+')">ПРИНЯТЬ ВЫЗОВ</button>')+
        '</div></div>';
    });
  }catch(e){ console.warn(e); c.innerHTML='<div class="empty-note"> Не удалось загрузить вызовы</div>'; }
}
async function postPvpChallenge(){
  if(!sb){ showToast('PvP недоступен'); return; }
  if(!await requireOnlineWrite('PvP')) return;
  const car = carsDB.find(c=>c.id===state.activeCarId);
  const stakeInput=document.getElementById('pvp-stake-input');
  const stake=parseInt(stakeInput.value,10);
  if(!stake || stake<=0){ showToast('Укажи ставку'); return; }
  if(stake>MAX_PVP_STAKE){showToast('Максимальная ставка: '+fmt(MAX_PVP_STAKE)+' SYND');return;}
  if(stake>state.coins){ showToast('Недостаточно денег на ставку'); return; }
  try{
    const {error} = await sb.from('pvp_challenges').insert({
      challenger_id: state.playerId, challenger_name: state.playerName,
      power: getEffectivePower(car), stake: stake, status:'open'
    });
    if(error) throw error;
    state.coins -= stake; state.stats.totalSpent += stake;
    showToast(' Вызов создан! Ставка '+fmt(stake)+'  заморожена до результата');
    updateHeader(); saveState(); refreshPvpList();
    stakeInput.value='';
  }catch(e){ console.warn(e); showToast(' Не удалось создать вызов'); }
}
async function cancelPvpChallenge(id){
  if(!sb) return;
  if(!await requireOnlineWrite('PvP')) return;
  try{
    const {data,error} = await sb.from('pvp_challenges').select('*').eq('id',id).single();
    if(error||!data) throw error||new Error('not found');
    if(data.challenger_id!==state.playerId || data.status!=='open'){ showToast('Вызов недоступен'); refreshPvpList(); return; }
    const {error:updErr} = await sb.from('pvp_challenges').update({status:'cancelled'}).eq('id',id).eq('status','open');
    if(updErr) throw updErr;
    state.coins += data.stake;
    showToast('Вызов отменён, ставка возвращена');
    updateHeader(); saveState(); refreshPvpList();
  }catch(e){ console.warn(e); showToast(' Ошибка отмены'); }
}
async function acceptPvpChallenge(id){
  if(!sb) return;
  if(!await requireOnlineWrite('PvP')) return;
  try{
    const {data,error} = await sb.from('pvp_challenges').select('*').eq('id',id).eq('status','open').single();
    if(error||!data){ showToast('Вызов уже принят другим игроком'); refreshPvpList(); return; }
    if(data.challenger_id===state.playerId){ showToast('Нельзя принять свой же вызов'); return; }
    if(state.coins<data.stake){ showToast('Недостаточно денег для ставки'); return; }
    const {data:upd, error:updErr} = await sb.from('pvp_challenges')
      .update({status:'racing', accepter_id: state.playerId, accepter_name: state.playerName})
      .eq('id',id).eq('status','open').select();
    if(updErr) throw updErr;
    if(!upd || !upd.length){ showToast('Вызов уже приняли раньше вас'); refreshPvpList(); return; }
    // ставка принимающего замораживается прямо в заезде (raceCtx.fee = stake)
    prepareRace(upd[0], 'pvp');
  }catch(e){ console.warn(e); showToast(' Не удалось принять вызов'); }
}
async function resolvePvpChallenge(row, accepterWon, reward){
  if(!sb || !row) return;
  if(!await requireOnlineWrite('PvP')) return;
  try{
    await sb.from('pvp_challenges').update({
      status:'resolved', winner_id: accepterWon ? state.playerId : row.challenger_id, resolved_at: new Date().toISOString()
    }).eq('id', row.id);
  }catch(e){ console.warn(e); }
}
async function claimPvpResults(){
  if(!sb || !onlineAuthReady) return;
  try{
    const {data,error} = await sb.from('pvp_challenges').select('*').eq('challenger_id', state.playerId).eq('status','resolved');
    if(error || !data || !data.length) return;
    if(!Array.isArray(state.claimedPvpIds)) state.claimedPvpIds=[];
    let msgCount=0;
    for(const row of data){
      if(state.claimedPvpIds.includes(row.id)) continue;
      const {data:settled,error:settleError}=await sb.from('pvp_challenges').update({status:'settled'}).eq('id',row.id).eq('status','resolved').select('id');
      if(settleError || !settled || !settled.length) continue;
      state.claimedPvpIds.push(row.id);
      if(row.winner_id===state.playerId){
        const winnings = (Number(row.stake)||0)*2;
        state.coins += winnings; state.stats.totalEarned += winnings;
        showToast(' Твой вызов принял '+(row.accepter_name||'игрок')+' — и ты выиграл +'+fmt(winnings)+' !');
      } else {
        showToast(' Твой вызов принял '+(row.accepter_name||'игрок')+' — и обыграл тебя. Ставка потеряна.');
      }
      msgCount++;
    }
    if(msgCount){ updateHeader(); saveState(); }
  }catch(e){ console.warn(e); }
}

