// Final application start after all feature modules are registered.
// Keep the boot screen visible until Supabase resolves the persisted session.
(function(){
  let initialResolved=false;
  let renderedUserId=null;
  let slowStartTimer=null;
  const SLOW_START_DELAY=15000;

  function runAfterAuthCallback(fn){setTimeout(()=>Promise.resolve().then(fn).catch(error=>console.error('Ошибка запуска приложения',error)),0)}
  function browserUsesLocalLock(){return Boolean(window.__FINANCE_NATIVE__||window.matchMedia?.('(display-mode: standalone)').matches)}
  function bootElement(){return document.querySelector('#app>.boot')}
  function scheduleSlowStartPrompt(){
    clearTimeout(slowStartTimer);
    slowStartTimer=setTimeout(showSlowStartPrompt,SLOW_START_DELAY);
  }
  async function exitApplication(){
    try{
      const nativeApp=window.Capacitor?.Plugins?.App;
      if(window.__FINANCE_NATIVE__&&nativeApp?.exitApp){
        await nativeApp.exitApp();
        return;
      }
    }catch(error){
      console.warn('Не удалось закрыть Android-приложение через Capacitor',error);
    }
    try{window.close()}catch(_){ }
  }
  function showSlowStartPrompt(){
    const boot=bootElement();
    if(!boot||boot.querySelector('.boot-wait-panel'))return;
    const panel=document.createElement('div');
    panel.className='boot-wait-panel';
    panel.setAttribute('role','status');
    panel.setAttribute('aria-live','polite');
    panel.innerHTML=`<div class="boot-wait-message">Интернет! Ну ты где? Походу нужно попробовать подключится попозже</div>
      <div class="boot-wait-actions">
        <button type="button" class="boot-wait-button boot-wait-primary" id="bootWaitMore">Подождать</button>
        <button type="button" class="boot-wait-button" id="bootCloseApp">Закрыть приложение</button>
      </div>`;
    boot.appendChild(panel);
    document.getElementById('bootWaitMore').onclick=()=>{
      panel.remove();
      scheduleSlowStartPrompt();
    };
    document.getElementById('bootCloseApp').onclick=exitApplication;
  }
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

  scheduleSlowStartPrompt();

  sb.auth.onAuthStateChange((event,session)=>{
    const user=session?.user||null;
    const wasLocalSession=Boolean(state.user?._offlineLocal);
    const recovery=window.FinancePasswordRecovery;
    // Do not erase a PIN-unlocked local identity merely because Supabase has no
    // network session while Android is offline.
    if(user||!wasLocalSession)state.user=user;

    if(event==='PASSWORD_RECOVERY'){
      initialResolved=true;
      if(user)renderedUserId=user.id;
      runAfterAuthCallback(()=>recovery?.renderReset?.());
      return;
    }

    if(event==='INITIAL_SESSION'){
      if(initialResolved)return;
      initialResolved=true;
      if(user&&recovery?.hasIntent?.()){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>recovery.renderReset());
      }else if(user){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>openUserSession(user));
      }else runAfterAuthCallback(()=>openWithoutServerSession());
      return;
    }

    if(event==='SIGNED_IN'){
      initialResolved=true;
      if(!user)return;
      state.user=user;
      if(recovery?.hasIntent?.()){
        renderedUserId=user.id;
        runAfterAuthCallback(()=>recovery.renderReset());
        return;
      }
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
