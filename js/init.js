/* ==================== INIT ==================== */
loadState();
initTelegram();
applyUiSettings();
rltInit();
diceUpdate();
updateHeader();
updateAvatarUI();
renderGarage();
window.addEventListener('load', initSupabase);
setTimeout(initSupabase, 1500);
setTimeout(()=>{ if(checkDailyEligible()) openDailyModal(true); }, 900);
