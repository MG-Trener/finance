// Final application start after all feature modules are registered.
// Keep the boot screen visible until Supabase resolves the persisted session.
(function(){
  let initialResolved=false;
  let renderedUserId=null;

  function runAfterAuthCallback(fn){setTimeout(()=>Promise.resolve().then(fn).catch(error=>console.error('Ошибка запуска приложения',error)),0)}
  async function openUserSession(user){
    if(!user)return false;
    const unlocked=await window.FinanceLocalLock?.unlockIfNeeded?.(user);
    if(unlocked===false)return false;
    await loadData();return true;
  }

  sb.auth.onAuthStateChange((event,session)=>{
    const user=session?.user||null;
    state.user=user;

    if(event==='INITIAL_SESSION'){
      if(initialResolved)return;
      initialResolved=true;
      if(user){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>openUserSession(user));
      }else runAfterAuthCallback(()=>renderAuth());
      return;
    }

    if(event==='SIGNED_IN'){
      initialResolved=true;
      if(!user)return;
      if(renderedUserId===user.id&&state.family)return;
      renderedUserId=user.id;
      runAfterAuthCallback(()=>openUserSession(user));
      return;
    }

    if(event==='SIGNED_OUT'){
      initialResolved=true;
      renderedUserId=null;
      window.FinanceLocalLock?.reset?.();
      state.user=null;state.family=null;
      runAfterAuthCallback(()=>renderAuth());
      return;
    }

    // TOKEN_REFRESHED and USER_UPDATED should not replace the current screen.
    if(user)renderedUserId=user.id;
  });
})();
