// Live synchronization between family devices. Primary path: Supabase Realtime.
// A light foreground refresh is kept as a fallback for mobile browsers that suspend sockets.
(function(){
  let channel=null;
  let subscribedFamilyId=null;
  let pendingRender=false;
  let refreshInFlight=false;
  let lastForegroundRefresh=0;

  function canRerenderSafely(){
    if(document.querySelector('.modal'))return false;
    const active=document.activeElement;
    if(active&&active.matches?.('input,textarea,select'))return false;
    return true;
  }

  function requestRender(){
    if(typeof renderApp!=='function'||!state.family)return;
    if(canRerenderSafely()){
      pendingRender=false;
      renderApp();
    }else pendingRender=true;
  }

  function flushPendingRender(){
    if(!pendingRender||!canRerenderSafely())return;
    pendingRender=false;
    renderApp();
  }

  function applyRealtimeTransaction(payload){
    if(!state.family)return;
    if(payload.eventType==='DELETE'){
      const id=payload.old?.id;
      if(!id)return;
      state.transactions=state.transactions.filter(x=>x.id!==id);
      state.trashTransactions=state.trashTransactions.filter(x=>x.id!==id);
      return requestRender();
    }
    const row=payload.new;
    if(!row?.id||row.family_id!==state.family.id)return;
    syncTransactionState(row);
    requestRender();
  }

  function stopChannel(){
    if(channel){try{sb.removeChannel(channel)}catch(_){}}
    channel=null;
    subscribedFamilyId=null;
  }

  function subscribeFamily(familyId){
    if(!familyId||subscribedFamilyId===familyId&&channel)return;
    stopChannel();
    subscribedFamilyId=familyId;
    channel=sb.channel(`finance-family-${familyId}`)
      .on('postgres_changes',{
        event:'*',schema:'public',table:'transactions',filter:`family_id=eq.${familyId}`
      },applyRealtimeTransaction)
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
          // Foreground refresh below remains available when an embedded browser
          // pauses or blocks a websocket connection.
          lastForegroundRefresh=0;
        }
      });
  }

  function waitForFamily(attempt=0){
    if(!state.user)return;
    if(state.family?.id)return subscribeFamily(state.family.id);
    if(attempt<40)setTimeout(()=>waitForFamily(attempt+1),250);
  }

  async function refreshRecentTransactions(force=false){
    const familyId=state.family?.id;
    if(!familyId||refreshInFlight)return;
    const now=Date.now();
    if(!force&&now-lastForegroundRefresh<20000)return;
    refreshInFlight=true;
    try{
      const [active,trash]=await Promise.all([
        sb.from('transactions').select('*').eq('family_id',familyId).is('deleted_at',null).order('occurred_at',{ascending:false}).limit(100),
        sb.from('transactions').select('*').eq('family_id',familyId).not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(50)
      ]);
      if(active.error)throw active.error;
      if(trash.error)throw trash.error;
      for(const row of active.data||[])syncTransactionState(row);
      for(const row of trash.data||[])syncTransactionState(row);
      lastForegroundRefresh=now;
      requestRender();
    }catch(error){
      console.warn('Фоновая синхронизация операций недоступна',error);
    }finally{
      refreshInFlight=false;
    }
  }

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'||!session?.user){stopChannel();return}
    setTimeout(()=>waitForFamily(),0);
  });

  document.addEventListener('focusout',()=>setTimeout(flushPendingRender,80),true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)return;
    waitForFamily();
    refreshRecentTransactions();
  });
  window.addEventListener('pageshow',()=>{waitForFamily();refreshRecentTransactions()});
  window.addEventListener('focus',()=>refreshRecentTransactions());

  // Useful for manual diagnostics from DevTools without exposing any secret data.
  window.FinanceRealtime={refresh:()=>refreshRecentTransactions(true)};
})();
