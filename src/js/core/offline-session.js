// PIN-protected local session fallback for the installed app.
// If Supabase cannot restore a session while the device is offline, a previously
// authenticated user may still open the encrypted-by-device app shell with the local PIN.
(function(){
  const KEY='finance.offlineIdentity.v1';
  const RECONNECT_DELAYS=[350,1500,4000,9000,18000,30000];
  let opening=false;
  let reconnecting=false;
  let reconnectTimers=[];

  function nativeLike(){
    return Boolean(window.__FINANCE_NATIVE__||window.matchMedia?.('(display-mode: standalone)').matches);
  }
  function readIdentity(){
    try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){return null}
  }
  function remember(user){
    if(!user?.id)return;
    const value={userId:user.id,email:user.email||'',savedAt:new Date().toISOString()};
    try{localStorage.setItem(KEY,JSON.stringify(value))}catch(_){ }
  }
  function clear(){try{localStorage.removeItem(KEY)}catch(_){}}
  function isLocalSession(){return Boolean(state.user?._offlineLocal)}

  async function tryOpen(){
    if(opening||navigator.onLine||!nativeLike())return false;
    const identity=readIdentity();
    if(!identity?.userId)return false;
    if(!window.FinanceLocalLock?.enabled?.(identity.userId))return false;
    opening=true;
    try{
      const localUser={id:identity.userId,email:identity.email||'',_offlineLocal:true};
      state.user=localUser;
      const unlocked=await window.FinanceLocalLock.unlockIfNeeded(localUser);
      if(!unlocked){state.user=null;return false}
      const restored=await window.FinanceOffline?.restoreSnapshot?.(identity.userId);
      if(!restored){state.user=null;return false}
      return true;
    }catch(error){
      console.warn('Не удалось открыть локальную офлайн-сессию',error);
      state.user=null;return false;
    }finally{opening=false}
  }

  function statusMarkup(){
    if(!isLocalSession())return'';
    return `<button type="button" class="connection-status is-auth-needed" id="offlineAuthStatus" title="Войти для синхронизации">Нужен вход</button>`;
  }

  function openReauth(){
    const identity=readIdentity();closeModal?.();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal offline-reauth-modal"><div class="modal-head"><div><h2>Вход для синхронизации</h2><p class="quick-amount-context">Локальные данные останутся на телефоне</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="offlineReauthNotice"></div><form id="offlineReauthForm"><div class="field"><label>Email</label><input id="offlineReauthEmail" type="email" autocomplete="email" required value="${esc(identity?.email||'')}"></div><div class="field"><label>Пароль</label><input id="offlineReauthPassword" type="password" autocomplete="current-password" required></div><button class="btn btn-primary btn-wide">Войти и синхронизировать</button></form></div></div>`);
    document.getElementById('closeModal').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
    document.getElementById('offlineReauthForm').onsubmit=async e=>{
      e.preventDefault();const button=e.currentTarget.querySelector('button[type="submit"]');button.disabled=true;button.textContent='Входим…';
      const email=document.getElementById('offlineReauthEmail').value.trim(),password=document.getElementById('offlineReauthPassword').value;
      try{
        const {data,error}=await sb.auth.signInWithPassword({email,password});
        if(error)return notice('offlineReauthNotice',error.message);
        if(identity?.userId&&data.user?.id!==identity.userId){await sb.auth.signOut();return notice('offlineReauthNotice','Это другой аккаунт. Войдите тем же пользователем, чья офлайн-копия хранится на телефоне.')}
        state.user=data.user;remember(data.user);closeModal();
        await window.FinanceOffline?.flushQueue?.();
        await loadData();
        window.FinanceRealtime?.reconnect?.();
      }catch(error){notice('offlineReauthNotice',error?.message||String(error))}
      finally{if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Войти и синхронизировать'}}
    };
  }

  function cancelReconnectTimers(){
    reconnectTimers.forEach(clearTimeout);reconnectTimers=[];
  }

  async function reconnectIfPossible(){
    if(reconnecting||!isLocalSession()||!navigator.onLine)return false;
    reconnecting=true;
    const localUserId=state.user?.id;
    try{
      const {data:{session},error}=await sb.auth.getSession();
      if(error)throw error;
      if(!session?.user||session.user.id!==localUserId){
        if(typeof renderApp==='function')renderApp();
        return false;
      }

      state.user=session.user;
      remember(session.user);
      // First send everything that was created/edited while offline. Then load
      // a fresh server snapshot so the screen reflects both devices immediately.
      await window.FinanceOffline?.flushQueue?.();
      await loadData();
      await window.FinanceOffline?.flushQueue?.();
      window.FinanceRealtime?.reconnect?.();
      window.FinanceRealtime?.refresh?.();
      cancelReconnectTimers();
      return true;
    }catch(error){
      console.warn('Автоматическое восстановление онлайн-сессии пока недоступно',error);
      return false;
    }finally{reconnecting=false}
  }

  function scheduleReconnectBurst(){
    cancelReconnectTimers();
    if(!navigator.onLine||!isLocalSession())return;
    RECONNECT_DELAYS.forEach(delay=>{
      const timer=setTimeout(async()=>{
        reconnectTimers=reconnectTimers.filter(x=>x!==timer);
        const restored=await reconnectIfPossible();
        if(restored)cancelReconnectTimers();
      },delay);
      reconnectTimers.push(timer);
    });
  }

  function bindStatus(){const el=document.getElementById('offlineAuthStatus');if(el)el.onclick=openReauth}

  sb.auth.onAuthStateChange((event,session)=>{
    if(session?.user)remember(session.user);
    if(event==='SIGNED_OUT'&&!state.user?._offlineLocal){/* keep identity for future PIN-protected offline opening */}
  });

  window.addEventListener('online',scheduleReconnectBurst);
  window.addEventListener('offline',cancelReconnectTimers);
  window.addEventListener('focus',()=>{if(navigator.onLine&&isLocalSession())scheduleReconnectBurst()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine&&isLocalSession())scheduleReconnectBurst()});
  // Safety net: if Android reports the online event before the network is truly
  // usable, retry while the app remains open instead of requiring a restart.
  setInterval(()=>{if(!document.hidden&&navigator.onLine&&isLocalSession())reconnectIfPossible()},60000);

  window.FinanceOfflineSession={tryOpen,remember,clear,isLocalSession,statusMarkup,bindStatus,openReauth,reconnectIfPossible,scheduleReconnectBurst};
})();
