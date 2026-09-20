// Splash music for the Android application.
// Background playback is intentionally disabled: the previous Base64/WebM
// implementation distorted the audio and could freeze Android WebView.
(function(){
  const STORAGE_KEY='finance.appMusic';
  const isNative=Boolean(window.__FINANCE_NATIVE__||document.body?.classList.contains('native-app'));
  const stored=localStorage.getItem(STORAGE_KEY);
  let enabled=stored===null?isNative:stored!=='0';
  let splashFinished=!document.getElementById('startupCrestSplash');
  let injectQueued=false;
  let splashPlayPromise=null;

  const splashAudio=new Audio('assets/sounds/background-ambient.webm?v=3');
  splashAudio.preload='auto';
  splashAudio.volume=.76;

  function safePlaySplash(){
    if(!isNative||!enabled||splashFinished||document.hidden)return Promise.resolve(false);
    if(splashPlayPromise)return splashPlayPromise;
    try{
      const result=splashAudio.play();
      const promise=result&&typeof result.then==='function'
        ?result.then(()=>true).catch(()=>false)
        :Promise.resolve(true);
      splashPlayPromise=promise.finally(()=>{splashPlayPromise=null});
      return splashPlayPromise;
    }catch(_){return Promise.resolve(false)}
  }

  function stopSplash(reset=false){
    splashAudio.pause();
    if(reset){try{splashAudio.currentTime=0}catch(_){}}
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
    soundCard.insertAdjacentHTML('afterend',`<div class="card settings-card"><div class="settings-card-icon">♬</div><div class="settings-card-body"><h3>Музыка заставки</h3><p>Музыка при запуске приложения. Проблемная фоновая дорожка отключена.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="musicToggle" aria-pressed="${enabled?'true':'false'}">${buttonLabel()}</button></div>`);
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
    isEnabled:()=>enabled,
    setEnabled,
    playBackground:()=>false,
    stop:()=>stopSplash(false)
  };
})();
