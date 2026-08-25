// Звуки интерфейса через Web Audio API без переопределения UI-рендеров.
(function(){
  let ctx=null,master=null,compressor=null,resumePromise=null;
  let enabled=localStorage.getItem('finance.uiSounds')!=='0';
  let lastHoverElement=null,lastHoverAt=0,unlocked=false;

  function getContext(){
    if(ctx)return ctx;const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
    ctx=new C({latencyHint:'interactive'});compressor=ctx.createDynamicsCompressor();compressor.threshold.setValueAtTime(-16,ctx.currentTime);compressor.knee.setValueAtTime(14,ctx.currentTime);compressor.ratio.setValueAtTime(4,ctx.currentTime);compressor.attack.setValueAtTime(.002,ctx.currentTime);compressor.release.setValueAtTime(.16,ctx.currentTime);master=ctx.createGain();master.gain.setValueAtTime(.92,ctx.currentTime);compressor.connect(master);master.connect(ctx.destination);return ctx;
  }
  function primeAudio(c){if(!c||unlocked)return;try{const buffer=c.createBuffer(1,1,22050),source=c.createBufferSource();source.buffer=buffer;source.connect(compressor||c.destination);source.start(0);unlocked=true}catch(_){}}
  function ensureAudio(){const c=getContext();if(!c)return Promise.resolve(null);primeAudio(c);if(c.state==='running')return Promise.resolve(c);if(resumePromise)return resumePromise;resumePromise=c.resume().then(()=>{primeAudio(c);return c.state==='running'?c:null}).catch(()=>null).finally(()=>{resumePromise=null});return resumePromise}
  function tone(c,freq,duration=.06,type='triangle',gain=.12,delay=0,endFreq=null){if(!c||c.state!=='running'||!enabled)return;const t=c.currentTime+delay,osc=c.createOscillator(),g=c.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,t);if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(1,endFreq),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(g);g.connect(compressor||master||c.destination);osc.start(t);osc.stop(t+duration+.03)}
  function play(kind,c){if(!enabled||!c||c.state!=='running')return;if(kind==='hover')return tone(c,180,.035,'triangle',.065,0,215);if(kind==='switch'){tone(c,260,.065,'triangle',.18,0,365);return tone(c,520,.055,'sine',.11,.035,610)}if(kind==='nav'){tone(c,185,.08,'triangle',.20,0,265);return tone(c,355,.07,'sine',.13,.045,440)}if(kind==='success'){tone(c,520,.11,'triangle',.28,0,720);tone(c,780,.14,'sine',.22,.055,1040);return tone(c,1120,.10,'triangle',.14,.12,1420)}if(kind==='delete'){tone(c,175,.13,'square',.17,0,92);return tone(c,105,.09,'triangle',.12,.045,68)}if(kind==='warning'){tone(c,430,.10,'triangle',.18);return tone(c,430,.10,'triangle',.18,.13)}tone(c,230,.055,'triangle',.15,0,165)}
  window.uiSound=function(kind='click'){if(!enabled)return;ensureAudio().then(c=>{if(c)play(kind,c)})};

  function unlockFromGesture(){if(!enabled)return;const c=getContext();if(!c)return;primeAudio(c);if(c.state!=='running')c.resume().then(()=>primeAudio(c)).catch(()=>{})}
  document.addEventListener('touchstart',unlockFromGesture,{capture:true,passive:true});document.addEventListener('pointerdown',unlockFromGesture,true);document.addEventListener('click',unlockFromGesture,true);document.addEventListener('keydown',unlockFromGesture,true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&enabled&&ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})});window.addEventListener('pageshow',()=>{if(enabled&&ctx&&ctx.state!=='running')ctx.resume().catch(()=>{})});

  function icon(){return enabled?'🔊':'🔇'}function label(){return enabled?'Звуки включены':'Звуки выключены'}
  document.addEventListener('click',e=>{
    const toggle=e.target.closest('#soundToggle');
    if(toggle){enabled=!enabled;localStorage.setItem('finance.uiSounds',enabled?'1':'0');if(enabled){unlocked=false;ensureAudio().then(c=>{if(c)play('switch',c)})}toggle.textContent=icon();toggle.title=label();toggle.setAttribute('aria-label',label());return}
    if(!enabled)return;if(e.target.closest('.nav-item'))return window.uiSound('nav');if(e.target.closest('#txForm .segmented [data-type],#txForm [data-group="personChoice"]'))return window.uiSound('switch');if(e.target.closest('.deleteTx,.deleteCat,.deleteBudget,.deleteRecurring,.deleteGoal'))return window.uiSound('delete');if(e.target.closest('button,.icon-btn,.text-action,.quick-pair,.tx-amount-edit'))return window.uiSound('click');
  },true);
  document.addEventListener('change',e=>{if(enabled&&e.target.matches('select'))window.uiSound('switch')},true);
  document.addEventListener('pointerover',e=>{if(!enabled||!ctx||ctx.state!=='running')return;const item=e.target.closest('.sidebar .nav-item');if(!item||(e.relatedTarget&&item.contains(e.relatedTarget)))return;const now=performance.now();if(item===lastHoverElement&&now-lastHoverAt<180)return;lastHoverElement=item;lastHoverAt=now;play('hover',ctx)},true);
})();
