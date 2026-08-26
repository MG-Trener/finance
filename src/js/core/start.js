// Final application start after all feature modules are registered.
// Keep the boot screen visible until Supabase resolves the persisted session.
(function(){
  let initialResolved=false;
  let renderedUserId=null;

  function runAfterAuthCallback(fn){setTimeout(()=>Promise.resolve().then(fn).catch(error=>console.error('Ошибка запуска приложения',error)),0)}
  function browserUsesLocalLock(){return Boolean(window.__FINANCE_NATIVE__||window.matchMedia?.('(display-mode: standalone)').matches)}
  async function openUserSession(user){
    if(!user)return false;
    const unlocked=browserUsesLocalLock()?await window.FinanceLocalLock?.unlockIfNeeded?.(user):true;
    if(unlocked===false)return false;
    await loadData();return true;
  }
  async function openWithoutServerSession(){
    if(!navigator.onLine){
      const restored=await window.FinanceOfflineSession?.tryOpen?.();
      if(restored){renderedUserId=state.user?.id||null;return true}
    }
    renderAuth();return false;
  }

  sb.auth.onAuthStateChange((event,session)=>{
    const user=session?.user||null;
    const wasLocalSession=Boolean(state.user?._offlineLocal);
    // Do not erase a PIN-unlocked local identity merely because Supabase has no
    // network session while Android is offline.
    if(user||!wasLocalSession)state.user=user;

    if(event==='INITIAL_SESSION'){
      if(initialResolved)return;
      initialResolved=true;
      if(user){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>openUserSession(user));
      }else runAfterAuthCallback(()=>openWithoutServerSession());
      return;
    }

    if(event==='SIGNED_IN'){
      initialResolved=true;
      if(!user)return;
      state.user=user;
      if(renderedUserId===user.id&&state.family&&!wasLocalSession)return;
      renderedUserId=user.id;
      runAfterAuthCallback(()=>openUserSession(user));
      return;
    }

    if(event==='SIGNED_OUT'){
      initialResolved=true;
      renderedUserId=null;
      window.FinanceLocalLock?.reset?.();
      state.user=null;state.family=null;
      runAfterAuthCallback(()=>navigator.onLine?renderAuth():openWithoutServerSession());
      return;
    }

    // TOKEN_REFRESHED and USER_UPDATED should not replace the current screen.
    if(user)renderedUserId=user.id;
  });
})();
