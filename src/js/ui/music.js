// Splash and background music for the Android application.
(function(){
  const STORAGE_KEY='finance.appMusic';
  const isNative=Boolean(window.__FINANCE_NATIVE__||document.body?.classList.contains('native-app'));
  const stored=localStorage.getItem(STORAGE_KEY);
  let enabled=stored===null?isNative:stored!=='0';
  let splashFinished=!document.getElementById('startupCrestSplash');
  let resumeAfterHidden=false;
  let injectQueued=false;
  let backgroundLoad=null;
  let backgroundObjectUrl='';

  // The supplied ethereal track is used during the splash screen.
  const splashAudio=new Audio('assets/sounds/background-ambient.webm?v=3');
  splashAudio.preload='auto';
  splashAudio.volume=.76;

  // The supplied Pirates track is stored as small text chunks and rebuilt locally.
  const backgroundAudio=new Audio();
  backgroundAudio.preload='auto';
  backgroundAudio.loop=true;
  backgroundAudio.volume=.18;

  function loadBackground(){
    if(backgroundAudio.src)return Promise.resolve(backgroundAudio);
    if(backgroundLoad)return backgroundLoad;
    backgroundLoad=Promise.all(['00','01','02','03'].map(part=>
      fetch(`assets/sounds/background-pirates/${part}.b64?v=1`,{cache:'force-cache'}).then(response=>{
        if(!response.ok)throw new Error(`background-pirates/${part}: ${response.status}`);
        return response.text();
      })
    )).then(parts=>{
      const binary=atob(parts.join('').replace(/\s+/g,''));
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      backgroundObjectUrl=URL.createObjectURL(new Blob([bytes],{type:'audio/webm'}));
      backgroundAudio.src=backgroundObjectUrl;
      backgroundAudio.load();
      return backgroundAudio;
    }).catch(error=>{
      console.warn('Не удалось загрузить фоновую музыку приложения.',error);
      return null;
    });
    return backgroundLoad;
  }

  function safePlay(audio,loader){
    if(!enabled||document.hidden)return Promise.resolve(false);
    const ready=loader?loader():Promise.resolve(audio);
    return ready.then(loaded=>{
      if(!loaded||!enabled||document.hidden)return false;
      try{
        const result=audio.play();
        return result&&typeof result.then==='function'
          ?result.then(()=>true).catch(()=>false)
          :true;
      }catch(_){return false}
    });
  }

  function playSplash(){
    if(!isNative||!enabled||splashFinished||document.hidden)return;
    backgroundAudio.pause();
    safePlay(splashAudio);
  }

  function playBackground(){
    if(!isNative||!enabled||!splashFinished||document.hidden)return;
    splashAudio.pause();
    safePlay(backgroundAudio,loadBackground);
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
    soundCard.insertAdjacentHTML('afterend',`<div class="card settings-card"><div class="settings-card-icon">♬</div><div class="settings-card-body"><h3>Музыка приложения</h3><p>Музыка на заставке и фоновая мелодия во время работы.</p></div><button type="button" class="btn btn-soft btn-small settings-control" id="musicToggle" aria-pressed="${enabled?'true':'false'}">${buttonLabel()}</button></div>`);
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
  window.addEventListener('beforeunload',()=>{
    if(backgroundObjectUrl)URL.revokeObjectURL(backgroundObjectUrl);
  });

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
    loadBackground();
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
