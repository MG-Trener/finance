// Splash and background music for the Android application.
(function(){
  const STORAGE_KEY='finance.appMusic';
  const isNative=Boolean(window.__FINANCE_NATIVE__||document.body?.classList.contains('native-app'));
  const stored=localStorage.getItem(STORAGE_KEY);
  let enabled=stored===null?isNative:stored!=='0';
  let splashFinished=!document.getElementById('startupCrestSplash');
  let resumeAfterHidden=false;
  let injectQueued=false;

  const splashAudio=new Audio('assets/sounds/splash-epic.webm?v=1');
  splashAudio.preload='auto';
  splashAudio.volume=.76;

  const backgroundAudio=new Audio('assets/sounds/background-ambient.webm?v=1');
  backgroundAudio.preload='auto';
  backgroundAudio.loop=true;
  backgroundAudio.volume=.18;

  function safePlay(audio){
    if(!enabled||document.hidden)return Promise.resolve(false);
    try{
      const result=audio.play();
      return result&&typeof result.then==='function'
        ?result.then(()=>true).catch(()=>false)
        :Promise.resolve(true);
    }catch(_){return Promise.resolve(false)}
  }

  function playSplash(){
    if(!isNative||!enabled||splashFinished||document.hidden)return;
    backgroundAudio.pause();
    safePlay(splashAudio);
  }

  function playBackground(){
    if(!isNative||!enabled||!splashFinished||document.hidden)return;
    splashAudio.pause();
    safePlay(backgroundAudio);
  }

  function stopAll(reset=false){
    splashAudio.pause();
    backgroundAudio.pause();
    if(reset){
      try{splashAudio.currentTime=0}catch(_){}
      try{backgroundAudio.currentTime=0}catch(_){}
    }
  }

  function finishSplash(){
    if(splashFinished)return;
    splashFinished=true;
    splashAudio.pause();
    try{splashAudio.currentTime=0}catch(_){}
    if(enabled)playBackground();
  }

  function buttonLabel(){return enabled?'🎵 Включена':'🔇 Выключена'}
  function refreshButtons(){
    document.querySelectorAll('#musicToggle').forEach(button=>{
      button.textContent=buttonLabel();
      button.title=enabled?'Выключить музыку приложения':'Включить музыку приложения';
      button.setAttribute('aria-pressed',enabled?'true':'false');
    });
  }

  function setEnabled(next){
    enabled=Boolean(next);
    localStorage.setItem(STORAGE_KEY,enabled?'1':'0');
    if(enabled){
      if(splashFinished)playBackground();
      else playSplash();
    }else stopAll(true);
    refreshButtons();
  }

  function injectSettingsCard(){
    injectQueued=false;
    if(document.getElementById('musicToggle'))return refreshButtons();
    const soundButton=document.getElementById('soundToggle');
    const soundCard=soundButton?.closest('.settings-card');
    if(!soundCard)return;
    soundCard.insertAdjacentHTML('afterend',`<div class="card settings-card"><div class="settings-card-icon">♬</div><div class="settings-card-body"><h3>Музыка приложения</h3><p>Эпическая музыка на заставке и спокойная фоновая музыка во время работы.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="musicToggle" aria-pressed="${enabled?'true':'false'}">${buttonLabel()}</button></div>`);
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
    if(document.hidden){
      resumeAfterHidden=enabled&&(!backgroundAudio.paused||!splashAudio.paused);
      stopAll(false);
      return;
    }
    if(resumeAfterHidden&&enabled){
      resumeAfterHidden=false;
      if(splashFinished)playBackground();
      else playSplash();
    }
  });

  window.addEventListener('pagehide',()=>stopAll(false));
  window.addEventListener('pageshow',()=>{
    if(enabled&&!document.hidden){
      if(splashFinished)playBackground();
      else playSplash();
    }
  });

  // A user gesture is a fallback for browsers/WebViews that block autoplay.
  function unlock(){
    if(!enabled||document.hidden)return;
    if(splashFinished&&backgroundAudio.paused)playBackground();
    else if(!splashFinished&&splashAudio.paused)playSplash();
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
    playSplash();
  }else{
    splashFinished=true;
    if(enabled)playBackground();
  }

  const settingsObserver=new MutationObserver(queueSettingsInjection);
  settingsObserver.observe(document.body,{childList:true,subtree:true});
  queueSettingsInjection();

  window.FinanceMusic={
    isEnabled:()=>enabled,
    setEnabled,
    playBackground,
    stop:()=>stopAll(false)
  };
})();
