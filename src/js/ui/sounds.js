// Звуки интерфейса через Web Audio API без внешних аудиофайлов.
(function(){
  let ctx=null;
  let resumePromise=null;
  let enabled=localStorage.getItem('finance.uiSounds')!=='0';
  let lastHoverElement=null;
  let lastHoverAt=0;

  function getContext(){
    if(ctx)return ctx;
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C)return null;
    ctx=new C();
    return ctx;
  }

  function ensureAudio(){
    const c=getContext();
    if(!c)return Promise.resolve(null);
    if(c.state==='running')return Promise.resolve(c);
    if(resumePromise)return resumePromise;
    resumePromise=c.resume()
      .then(()=>c)
      .catch(()=>null)
      .finally(()=>{resumePromise=null});
    return resumePromise;
  }

  function tone(c,freq,duration=.06,type='triangle',gain=.04,delay=0,endFreq=null){
    if(!c||c.state!=='running'||!enabled)return;
    const t=c.currentTime+delay;
    const osc=c.createOscillator();
    const g=c.createGain();
    osc.type=type;
    osc.frequency.setValueAtTime(freq,t);
    if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),t+duration);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(gain,t+.006);
    g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t+duration+.025);
  }

  function play(kind,c){
    if(!enabled||!c)return;
    if(kind==='hover'){
      tone(c,155,.035,'triangle',.025,0,185);
      return;
    }
    if(kind==='switch'){
      tone(c,240,.06,'triangle',.045,0,340);
      tone(c,470,.045,'sine',.024,.035,540);
      return;
    }
    if(kind==='nav'){
      tone(c,160,.075,'triangle',.052,0,235);
      tone(c,315,.06,'sine',.032,.045,390);
      return;
    }
    if(kind==='success'){
      tone(c,720,.10,'sine',.060,0,1040);
      tone(c,1180,.14,'sine',.045,.055,1650);
      tone(c,1560,.08,'triangle',.024,.12,1900);
      return;
    }
    if(kind==='delete'){
      tone(c,145,.12,'square',.040,0,82);
      tone(c,92,.08,'triangle',.025,.045,60);
      return;
    }
    if(kind==='warning'){
      tone(c,440,.09,'triangle',.045);
      tone(c,440,.09,'triangle',.045,.13);
      return;
    }
    tone(c,205,.05,'triangle',.040,0,145);
  }

  window.uiSound=function(kind='click'){
    if(!enabled)return;
    ensureAudio().then(c=>play(kind,c));
  };

  // Браузеры разрешают Web Audio только после действия пользователя.
  // Разблокируем контекст как можно раньше при первом нажатии/касании.
  document.addEventListener('pointerdown',()=>{
    if(enabled)ensureAudio();
  },true);

  function icon(){return enabled?'🔊':'🔇'}
  function label(){return enabled?'Звуки включены':'Звуки выключены'}

  const originalHeader=header;
  header=function(){
    const html=originalHeader();
    return html.replace('<button class="btn btn-soft" id="logout">',`<button class="btn btn-soft sound-toggle" id="soundToggle" title="${label()}" aria-label="${label()}">${icon()}</button><button class="btn btn-soft" id="logout">`);
  };

  document.addEventListener('click',e=>{
    const toggle=e.target.closest('#soundToggle');
    if(toggle){
      enabled=!enabled;
      localStorage.setItem('finance.uiSounds',enabled?'1':'0');
      if(enabled){
        ensureAudio().then(c=>play('switch',c));
      }
      toggle.textContent=icon();
      toggle.title=label();
      toggle.setAttribute('aria-label',label());
      return;
    }
    if(!enabled)return;
    if(e.target.closest('.nav-item'))return window.uiSound('nav');
    if(e.target.closest('#txForm .segmented [data-type],#txForm [data-group="personChoice"]'))return window.uiSound('switch');
    if(e.target.closest('.deleteTx,.deleteCat,.deleteBudget,.deleteRecurring,.deleteGoal'))return window.uiSound('delete');
    if(e.target.closest('button,.icon-btn,.text-action,.quick-pair'))return window.uiSound('click');
  },true);

  document.addEventListener('change',e=>{
    if(!enabled)return;
    if(e.target.matches('select'))window.uiSound('switch');
  },true);

  // Короткий звук при наведении на пункты боковой панели.
  // После первого пользовательского клика AudioContext уже разблокирован.
  document.addEventListener('pointerover',e=>{
    if(!enabled||!ctx||ctx.state!=='running')return;
    const item=e.target.closest('.sidebar .nav-item');
    if(!item)return;
    if(e.relatedTarget&&item.contains(e.relatedTarget))return;
    const now=performance.now();
    if(item===lastHoverElement&&now-lastHoverAt<180)return;
    lastHoverElement=item;
    lastHoverAt=now;
    play('hover',ctx);
  },true);
})();
