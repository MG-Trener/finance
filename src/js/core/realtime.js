// Live synchronization between family devices. Primary path: Supabase Realtime.
// Transactions, goals, recurring payments and categories update across both family devices.
(function(){
  const FULL_REFRESH_INTERVAL=60000;
  let channel=null;
  let subscribedFamilyId=null;
  let pendingRender=false;
  let pendingFullRefresh=false;
  let refreshInFlight=false;
  let fullRefreshInFlight=false;
  let lastForegroundRefresh=0;
  let lastFullRefresh=0;

  const ENTITY_CHANNELS=[
    {table:'recurring_payments',stateKey:'recurring'},
    {table:'financial_goals',stateKey:'goals'},
    {table:'goal_contributions',stateKey:'goalContributions'},
    {table:'categories',stateKey:'categories'},
    {table:'subcategories',stateKey:'subcategories',noFamilyFilter:true}
  ];

  function canRerenderSafely(){
    if(document.querySelector('.modal'))return false;
    const active=document.activeElement;
    if(active&&active.matches?.('input,textarea,select'))return false;
    return true;
  }

  function requestRender(){
    if(typeof renderApp!=='function'||!state.family)return;
    if(canRerenderSafely()){pendingRender=false;renderApp()}else pendingRender=true;
  }

  function flushPendingRender(){
    if(pendingRender&&canRerenderSafely()){
      pendingRender=false;renderApp();
    }
    if(pendingFullRefresh&&canRerenderSafely()){
      pendingFullRefresh=false;refreshFamilyData(true);
    }
  }

  function applyRealtimeTransaction(payload){
    if(!state.family||state.user?._offlineLocal)return;
    if(payload.eventType==='DELETE'){
      const id=payload.old?.id;if(!id)return;
      const local=byId(state.transactions,id)||byId(state.trashTransactions,id);
      if(local?._offline)return;
      state.transactions=state.transactions.filter(x=>x.id!==id);
      state.trashTransactions=state.trashTransactions.filter(x=>x.id!==id);
      window.FinanceOffline?.persistSnapshotSoon?.();return requestRender();
    }
    const row=payload.new;
    if(!row?.id||row.family_id!==state.family.id)return;
    const local=byId(state.transactions,row.id)||byId(state.trashTransactions,row.id);
    if(local?._offline)return;
    syncTransactionState(row);requestRender();
  }

  function entityBelongs(config,row){
    if(!row)return false;
    if(config.table==='subcategories')return state.categories.some(c=>c.id===row.category_id);
    if(config.table==='categories')return row.family_id===state.family.id||row.family_id==null;
    return row.family_id===state.family.id;
  }

  function sortEntityState(config){
    const list=state[config.stateKey];if(!Array.isArray(list))return;
    if(config.table==='goal_contributions')list.sort((a,b)=>new Date(b.contributed_at)-new Date(a.contributed_at));
    if(config.table==='financial_goals')list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(config.table==='categories'||config.table==='subcategories')list.sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
    if(config.table==='recurring_payments')list.sort((a,b)=>Number(a.day_of_month||0)-Number(b.day_of_month||0));
  }

  function applyRealtimeEntity(config,payload){
    if(!state.family||state.user?._offlineLocal)return;
    const list=state[config.stateKey];if(!Array.isArray(list))return;
    const id=(payload.eventType==='DELETE'?payload.old:payload.new)?.id;if(!id)return;
    const existing=byId(list,id);
    if(existing?._offline)return;

    if(payload.eventType==='DELETE'){
      state[config.stateKey]=list.filter(x=>x.id!==id);
      if(config.table==='categories')state.subcategories=state.subcategories.filter(x=>x.category_id!==id);
      window.FinanceOffline?.persistSnapshotSoon?.();return requestRender();
    }

    const row=payload.new;if(!entityBelongs(config,row))return;
    upsertById(list,row);sortEntityState(config);
    window.FinanceOffline?.persistSnapshotSoon?.();requestRender();
  }

  function stopChannel(){
    if(channel){try{sb.removeChannel(channel)}catch(_){}}
    channel=null;subscribedFamilyId=null;
  }

  function subscribeFamily(familyId){
    if(!familyId||state.user?._offlineLocal||subscribedFamilyId===familyId&&channel)return;
    stopChannel();subscribedFamilyId=familyId;
    let next=sb.channel(`finance-family-${familyId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:`family_id=eq.${familyId}`},applyRealtimeTransaction);

    for(const config of ENTITY_CHANNELS){
      const options={event:'*',schema:'public',table:config.table};
      if(!config.noFamilyFilter)options.filter=`family_id=eq.${familyId}`;
      next=next.on('postgres_changes',options,payload=>applyRealtimeEntity(config,payload));
    }

    channel=next.subscribe(status=>{
      if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        lastForegroundRefresh=0;
        lastFullRefresh=0;
      }
    });
  }

  function waitForFamily(attempt=0){
    if(!state.user||state.user._offlineLocal)return;
    if(state.family?.id)return subscribeFamily(state.family.id);
    if(attempt<40)setTimeout(()=>waitForFamily(attempt+1),250);
  }

  async function refreshRecentTransactions(force=false){
    const familyId=state.family?.id;
    if(!familyId||state.user?._offlineLocal||refreshInFlight||!navigator.onLine)return;
    const now=Date.now();if(!force&&now-lastForegroundRefresh<20000)return;
    refreshInFlight=true;
    try{
      const [active,trash]=await Promise.all([
        sb.from('transactions').select('*').eq('family_id',familyId).is('deleted_at',null).order('occurred_at',{ascending:false}).limit(100),
        sb.from('transactions').select('*').eq('family_id',familyId).not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(50)
      ]);
      if(active.error)throw active.error;if(trash.error)throw trash.error;
      for(const row of active.data||[]){const local=byId(state.transactions,row.id)||byId(state.trashTransactions,row.id);if(!local?._offline)syncTransactionState(row)}
      for(const row of trash.data||[]){const local=byId(state.transactions,row.id)||byId(state.trashTransactions,row.id);if(!local?._offline)syncTransactionState(row)}
      lastForegroundRefresh=now;requestRender();
    }catch(error){console.warn('Фоновая синхронизация операций недоступна',error)}finally{refreshInFlight=false}
  }

  async function refreshFamilyData(force=false){
    if(!navigator.onLine||document.hidden||!state.family?.id||state.user?._offlineLocal||fullRefreshInFlight)return false;
    const now=Date.now();
    if(!force&&now-lastFullRefresh<FULL_REFRESH_INTERVAL)return false;
    if(!canRerenderSafely()){
      pendingFullRefresh=true;
      return false;
    }
    fullRefreshInFlight=true;
    pendingFullRefresh=false;
    try{
      // Upload local mutations before reading the authoritative snapshot. This
      // makes recovery after an offline period deterministic and prevents a
      // stale server read from temporarily hiding the user's offline edits.
      await window.FinanceOffline?.flushQueue?.();
      await loadData();
      lastFullRefresh=Date.now();
      lastForegroundRefresh=lastFullRefresh;
      waitForFamily();
      return true;
    }catch(error){
      console.warn('Полная фоновая синхронизация недоступна',error);
      return false;
    }finally{fullRefreshInFlight=false}
  }

  function reconnectAndRefresh(){
    if(!navigator.onLine)return;
    if(state.user?._offlineLocal){
      window.FinanceOfflineSession?.scheduleReconnectBurst?.();
      return;
    }
    stopChannel();waitForFamily();
    window.FinanceOffline?.flushQueue?.();
    refreshFamilyData(true);
  }

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'||!session?.user){stopChannel();return}
    setTimeout(()=>waitForFamily(),0);
  });

  document.addEventListener('focusout',()=>setTimeout(flushPendingRender,80),true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)return;
    waitForFamily();
    if(state.user?._offlineLocal)window.FinanceOfflineSession?.scheduleReconnectBurst?.();
    else refreshFamilyData();
  });
  window.addEventListener('pageshow',()=>{waitForFamily();if(!state.user?._offlineLocal)refreshFamilyData()});
  window.addEventListener('focus',()=>{if(state.user?._offlineLocal)window.FinanceOfflineSession?.scheduleReconnectBurst?.();else refreshRecentTransactions()});
  window.addEventListener('online',reconnectAndRefresh);
  window.addEventListener('offline',()=>{lastForegroundRefresh=0;lastFullRefresh=0});

  // Realtime remains the fast path. This one-minute check is only a safety net
  // for missed websocket events, Android network transitions and long-running
  // sessions. It runs only while the app is visible and online.
  setInterval(()=>{
    if(document.hidden||!navigator.onLine)return;
    if(state.user?._offlineLocal)window.FinanceOfflineSession?.reconnectIfPossible?.();
    else refreshFamilyData();
  },FULL_REFRESH_INTERVAL);

  window.FinanceRealtime={
    refresh:()=>refreshFamilyData(true),
    refreshRecent:()=>refreshRecentTransactions(true),
    reconnect:()=>{stopChannel();waitForFamily()},
    get lastFullRefresh(){return lastFullRefresh}
  };
})();
