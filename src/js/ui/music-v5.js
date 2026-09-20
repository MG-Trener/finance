// Safe Android splash-audio controller.
// This file has a unique path so an old WebView/cache cannot revive the retired
// background-audio implementation. Background music stays disabled here on purpose.
(function(){
  const STORAGE_KEY='finance.appMusic';
  const isNative=Boolean(window.__FINANCE_NATIVE__||document.body?.classList.contains('native-app'));
  const stored=localStorage.getItem(STORAGE_KEY);
  let enabled=stored===null?isNative:stored!=='0';
  let splashFinished=!document.getElementById('startupCrestSplash');
  let playPromise=null;
  let injectQueued=false;

  // Make sure a previous controller cannot keep media alive after an app update.
  try{window.FinanceMusic?.stop?.()}catch(_){ }
  document.querySelectorAll('audio').forEach(node=>{try{node.pause()}catch(_){ }});

  // Native APK never needs a PWA service worker/cache. Removing old registrations
  // prevents a previous APK from serving stale audio/controller files after update.
  if(isNative){
    try{
      if('serviceWorker' in navigator){
        navigator.serviceWorker.getRegistrations().then(items=>items.forEach(item=>item.unregister())).catch(()=>{});
      }
      if('caches' in window){
        caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('family-finance-')).map(key=>caches.delete(key)))).catch(()=>{});
      }
    }catch(_){ }
  }

  // This is the Pirates of the Caribbean clip that was used on the splash before.
  // Keep it as a normal local file; no Base64/Blob decoding and no loop.
  const splashAudio=new Audio('assets/sounds/splash-epic.webm?v=pirates-splash-v5');
  splashAudio.preload='auto';
  splashAudio.loop=false;
  splashAudio.volume=.76;

  function safePlaySplash(){
    if(!isNative||!enabled||splashFinished||document.hidden)return Promise.resolve(false);
    if(playPromise)return playPromise;
    try{
      const result=splashAudio.play();
      const promise=result&&typeof result.then==='function'
        ?result.then(()=>true).catch(()=>false)
        :Promise.resolve(true);
      playPromise=promise.finally(()=>{playPromise=null});
      return playPromise;
    }catch(_){return Promise.resolve(false)}
  }

  function stopSplash(reset=false){
    try{splashAudio.pause()}catch(_){ }
    if(reset){try{splashAudio.currentTime=0}catch(_){ }}
  }

  function finishSplash(){
    if(splashFinished)return;
    splashFinished=true;
    stopSplash(true);
  }

  function buttonLabel(){return enabled?'🎵 Включена':'🔇 Выключена'}
  function refreshButtons(){
    document.querySelectorAll('#musicToggle').forEach(button=>{
      button.textContent=buttonLabel();
      button.title=enabled?'Выключить музыку заставки':'Включить музыку заставки';
      button.setAttribute('aria-pressed',enabled?'true':'false');
    });
  }

  function setEnabled(next){
    enabled=Boolean(next);
    localStorage.setItem(STORAGE_KEY,enabled?'1':'0');
    if(enabled&&!splashFinished)safePlaySplash();
    else stopSplash(true);
    refreshButtons();
  }

  function injectSettingsCard(){
    injectQueued=false;
    if(document.getElementById('musicToggle'))return refreshButtons();
    const soundButton=document.getElementById('soundToggle');
    const soundCard=soundButton?.closest('.settings-card');
    if(!soundCard)return;
    soundCard.insertAdjacentHTML('afterend',`<div class="card settings-card"><div class="settings-card-icon">♬</div><div class="settings-card-body"><h3>Музыка заставки</h3><p>Музыка «Пираты Карибского моря» играет только во время заставки. Фоновая музыка временно отключена для стабильности.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="musicToggle" aria-pressed="${enabled?'true':'false'}">${buttonLabel()}</button></div>`);
  }

  function queueSettingsInjection(){
    if(injectQueued)return;
    injectQueued=true;
    queueMicrotask(injectSettingsCard);
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#musicToggle');
    if(!button)return;
    event.preventDefault();
    setEnabled(!enabled);
    if(typeof window.uiSound==='function')window.uiSound('switch');
  },true);

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)stopSplash(false);
    else if(enabled&&!splashFinished)safePlaySplash();
  });
  window.addEventListener('pagehide',()=>stopSplash(false));
  window.addEventListener('pageshow',()=>{
    if(enabled&&!document.hidden&&!splashFinished)safePlaySplash();
  });

  function unlock(){
    if(enabled&&!document.hidden&&!splashFinished&&splashAudio.paused)safePlaySplash();
  }
  document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
  document.addEventListener('touchstart',unlock,{capture:true,passive:true});

  const splash=document.getElementById('startupCrestSplash');
  if(splash){
    const observer=new MutationObserver(()=>{
      if(!document.body.contains(splash)||splash.classList.contains('is-hiding')){
        observer.disconnect();
        finishSplash();
      }
    });
    observer.observe(document.body,{childList:true,subtree:true});
    observer.observe(splash,{attributes:true,attributeFilter:['class']});
    setTimeout(finishSplash,6500);
    safePlaySplash();
  }else splashFinished=true;

  const settingsObserver=new MutationObserver(queueSettingsInjection);
  settingsObserver.observe(document.body,{childList:true,subtree:true});
  queueSettingsInjection();

  window.FinanceMusic={
    version:'safe-splash-v5',
    isEnabled:()=>enabled,
    setEnabled,
    playBackground:()=>false,
    stop:()=>stopSplash(false)
  };
})();
