// Lightweight UI sounds via Web Audio API. No external audio files required.
(function(){
  let ctx=null;
  let enabled=localStorage.getItem('finance.uiSounds')!=='0';

  function audio(){
    if(!ctx){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C)return null;
      ctx=new C();
    }
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    return ctx;
  }

  function tone(freq,duration=.06,type='triangle',gain=.022,delay=0,endFreq=null){
    const c=audio();if(!c||!enabled)return;
    const t=c.currentTime+delay;
    const osc=c.createOscillator();
    const g=c.createGain();
    osc.type=type;osc.frequency.setValueAtTime(freq,t);
    if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),t+duration);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(gain,t+.008);
    g.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(g);g.connect(c.destination);osc.start(t);osc.stop(t+duration+.02);
  }

  window.uiSound=function(kind='click'){
    if(!enabled)return;
    if(kind==='switch'){
      tone(240,.055,'triangle',.018,0,330);
      tone(460,.035,'sine',.010,.035,520);
      return;
    }
    if(kind==='nav'){
      tone(170,.07,'triangle',.018,0,230);
      tone(300,.055,'sine',.012,.045,360);
      return;
    }
    if(kind==='success'){
      tone(780,.09,'sine',.025,0,1050);
      tone(1320,.12,'sine',.018,.055,1600);
      return;
    }
    if(kind==='delete'){
      tone(135,.10,'square',.014,0,90);
      return;
    }
    if(kind==='warning'){
      tone(440,.08,'triangle',.018);
      tone(440,.08,'triangle',.018,.12);
      return;
    }
    tone(185,.045,'triangle',.014,0,150);
  };

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
      if(enabled)window.uiSound('switch');
      toggle.textContent=icon();toggle.title=label();toggle.setAttribute('aria-label',label());
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
})();
