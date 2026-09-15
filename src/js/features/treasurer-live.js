// Experimental GPT-Live-1 Treasurer: WebRTC conversation + private server delegation.
(function(){
  const EXPERIENCE_KEY='finance.treasurerExperience';
  const LIVE_VOICE_KEY='finance.treasurerLiveVoice';
  const LIVE_VOICES=[
    {id:'stone',name:'Stone'},
    {id:'vesper',name:'Vesper'},
    {id:'meridian',name:'Meridian'},
    {id:'quartz',name:'Quartz'},
    {id:'beacon',name:'Beacon'},
    {id:'cinder',name:'Cinder'}
  ];
  let liveSession=null;

  function experience(){return localStorage.getItem(EXPERIENCE_KEY)==='live'?'live':'classic'}
  function liveVoice(){const value=localStorage.getItem(LIVE_VOICE_KEY);return LIVE_VOICES.some(v=>v.id===value)?value:'stone'}
  function setExperience(value){localStorage.setItem(EXPERIENCE_KEY,value==='live'?'live':'classic');syncSettings()}
  function setLiveVoice(value){if(LIVE_VOICES.some(v=>v.id===value))localStorage.setItem(LIVE_VOICE_KEY,value);syncSettings()}
  function timezone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Almaty'}

  async function authHeaders(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Сеанс авторизации истёк.');
    return {Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_KEY,'Content-Type':'application/json'};
  }

  function settingsMarkup(){
    return `<div class="card treasurer-live-mode-card" data-treasurer-live-settings>
      <div class="treasurer-live-mode-head"><div class="treasurer-live-mode-icon">◉</div><div><h3>Режим разговора</h3><p>«Обычный голос» использует проверенную схему Казначея. «Живой разговор» — экспериментальный GPT‑Live‑1 с перебиваниями и естественной речью.</p></div></div>
      <div class="treasurer-experience-switch" role="group" aria-label="Режим Казначея">
        <button type="button" class="treasurer-experience-btn" data-treasurer-experience="classic">Обычный голос</button>
        <button type="button" class="treasurer-experience-btn" data-treasurer-experience="live">Живой разговор · эксперимент</button>
      </div>
      <div class="treasurer-live-voices" data-treasurer-live-voices><span>Голос живого Казначея</span><div class="treasurer-live-voice-grid">${LIVE_VOICES.map(v=>`<button type="button" class="treasurer-live-voice" data-treasurer-live-voice="${v.id}">${v.name}</button>`).join('')}</div></div>
    </div>`;
  }

  function installSettings(){
    if(state?.view!=='settings'||document.querySelector('[data-treasurer-live-settings]'))return syncSettings();
    const hub=document.querySelector('[data-treasurer-settings-hub]');
    const controls=hub?.querySelector('[data-treasurer-hub-controls]');
    const base=document.querySelector('.treasurer-settings-card');
    const host=controls||base?.parentElement;
    if(!host)return;
    const wrapper=document.createElement('div');wrapper.innerHTML=settingsMarkup();
    const card=wrapper.firstElementChild;
    if(controls)controls.insertBefore(card,controls.firstChild);else host.insertBefore(card,base);
    card.querySelectorAll('[data-treasurer-experience]').forEach(button=>button.onclick=()=>{setExperience(button.dataset.treasurerExperience);if(typeof uiSound==='function')uiSound('switch')});
    card.querySelectorAll('[data-treasurer-live-voice]').forEach(button=>button.onclick=()=>{setLiveVoice(button.dataset.treasurerLiveVoice);if(typeof uiSound==='function')uiSound('tap')});
    syncSettings();
  }

  function syncSettings(){
    const isLive=experience()==='live';
    document.body.classList.toggle('treasurer-live-selected',isLive);
    document.querySelectorAll('[data-treasurer-experience]').forEach(button=>button.classList.toggle('active',button.dataset.treasurerExperience===(isLive?'live':'classic')));
    document.querySelectorAll('[data-treasurer-live-voices]').forEach(node=>node.hidden=!isLive);
    document.querySelectorAll('[data-treasurer-live-voice]').forEach(button=>button.classList.toggle('active',button.dataset.treasurerLiveVoice===liveVoice()));
  }

  if(typeof bindSettings==='function'){
    const baseBindSettings=bindSettings;
    bindSettings=function(){baseBindSettings();installSettings()};
  }

  function modalMarkup(){
    return `<div class="modal-backdrop modal-layout-top" id="modal"><div class="modal treasurer-live-modal" role="dialog" aria-modal="true" aria-labelledby="liveTreasurerTitle">
      <div class="modal-head treasurer-head"><div><span class="treasurer-kicker">GPT‑Live‑1 · эксперимент</span><h2 id="liveTreasurerTitle">Живой Казначей</h2></div><button type="button" class="icon-btn" id="closeLiveTreasurer" aria-label="Закрыть">×</button></div>
      <div class="treasurer-live-call">
        <audio id="treasurerLiveAudio" autoplay playsinline hidden></audio>
        <div class="treasurer-live-orb" aria-hidden="true"><span class="treasurer-live-crown">♜</span></div>
        <div class="treasurer-live-status"><strong id="treasurerLiveStatus">Соединяю с Казначеем…</strong><span id="treasurerLiveHint">Подготавливаю защищённую голосовую сессию.</span></div>
        <div class="treasurer-live-controls"><button type="button" class="treasurer-live-control" id="treasurerLiveMute">🎙 Микрофон включён</button><button type="button" class="treasurer-live-control end" id="treasurerLiveEnd">Завершить разговор</button></div>
        <div class="treasurer-live-transcript" id="treasurerLiveTranscript" hidden><div class="treasurer-live-transcript-log" id="treasurerLiveTranscriptLog"></div></div>
        <div class="treasurer-live-footer"><span id="treasurerLiveUsage">Live · ${LIVE_VOICES.find(v=>v.id===liveVoice())?.name||'Stone'}</span><button type="button" class="treasurer-live-show-text" id="treasurerLiveShowText">Показать текст</button></div>
      </div>
    </div></div>`;
  }

  function setLiveStatus(title,hint,phase=''){
    const modal=document.querySelector('.treasurer-live-modal');
    if(modal){modal.classList.toggle('is-connected',phase==='connected'||phase==='listening'||phase==='speaking');modal.classList.toggle('is-speaking',phase==='speaking')}
    const a=document.getElementById('treasurerLiveStatus'),b=document.getElementById('treasurerLiveHint');
    if(a)a.textContent=title;if(b)b.textContent=hint||'';
  }

  function appendTranscript(role,text,id){
    if(!text)return;
    const log=document.getElementById('treasurerLiveTranscriptLog');if(!log)return;
    let line=id?log.querySelector(`[data-live-line="${id}"]`):null;
    if(!line){line=document.createElement('div');line.className='treasurer-live-line';if(id)line.dataset.liveLine=id;line.innerHTML=`<b>${role}</b><span></span>`;log.appendChild(line)}
    const span=line.querySelector('span');if(span)span.textContent=text;
    log.scrollTop=log.scrollHeight;
  }

  function waitIce(pc,timeout=2500){
    if(pc.iceGatheringState==='complete')return Promise.resolve();
    return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve()};const check=()=>{if(pc.iceGatheringState==='complete')finish()};const timer=setTimeout(finish,timeout);pc.addEventListener('icegatheringstatechange',check)});
  }

  function sendLive(session,event){
    if(session?.dc?.readyState!=='open')return false;
    try{session.dc.send(JSON.stringify(event));return true}catch(error){console.warn('Live send failed',error);return false}
  }

  async function delegate(session,event){
    const delegationId=event?.delegation?.id;if(!delegationId||session.ended)return;
    const current=session.inputTranscript.slice(session.delegatedOffset).trim();
    const question=current||session.inputTranscript.slice(-1600).trim();
    if(!question){sendLive(session,{type:'session.commentary.append',delegation_id:delegationId,content:'Я не расслышал сам вопрос. Попроси пользователя повторить его.'});return}
    session.delegatedOffset=session.inputTranscript.length;
    setLiveStatus('Казначей смотрит данные','Проверяю семейную казну и календари…','connected');
    try{
      const headers=await authHeaders();
      const response=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-live-delegate`,{method:'POST',headers,body:JSON.stringify({question,history:session.history,timezone:timezone()})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload?.ok||!payload.answer)throw new Error(payload?.message||'Не удалось получить данные.');
      session.history.push({role:'user',text:question},{role:'assistant',text:String(payload.answer)});session.history=session.history.slice(-12);
      sendLive(session,{type:'session.commentary.append',delegation_id:delegationId,content:String(payload.answer)});
      appendTranscript('Данные:',String(payload.answer),`delegate-${delegationId}`);
    }catch(error){
      console.error('Live delegation failed',error);
      sendLive(session,{type:'session.commentary.append',delegation_id:delegationId,content:'Сейчас не удалось получить данные семейной казны. Скажи пользователю, что проверка данных временно недоступна и предложи повторить запрос.'});
    }
  }

  function handleEvent(session,event){
    if(!event||session.ended)return;
    switch(event.type){
      case 'session.started':
        session.started=true;clearTimeout(session.startTimer);setLiveStatus('Казначей на связи','Говорите свободно. Его можно перебивать.','connected');break;
      case 'session.input_transcript.delta':
        session.inputTranscript+=String(event.delta||'');appendTranscript('Вы:',session.inputTranscript.slice(-2500),'live-user');setLiveStatus('Слушаю','Можно говорить без повторного нажатия на микрофон.','listening');break;
      case 'session.output_transcript.delta':
        session.outputTranscript+=String(event.delta||'');appendTranscript('Казначей:',session.outputTranscript.slice(-3000),'live-assistant');setLiveStatus('Казначей говорит','Можно перебить его в любой момент.','speaking');clearTimeout(session.speechTimer);session.speechTimer=setTimeout(()=>{if(!session.ended)setLiveStatus('Казначей на связи','Говорите, когда будете готовы.','connected')},1400);break;
      case 'session.delegation.created':delegate(session,event);break;
      case 'session.input_audio.muted':session.muted=true;syncMute(session);break;
      case 'session.input_audio.unmuted':session.muted=false;syncMute(session);break;
      case 'session.usage.updated':{
        const seconds=Number(event?.usage?.seconds||0),node=document.getElementById('treasurerLiveUsage');if(node&&seconds>0)node.textContent=`Live · ${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')} · ${LIVE_VOICES.find(v=>v.id===liveVoice())?.name||'Stone'}`;break;
      }
      case 'session.closed':cleanupLive(session,false);if(document.getElementById('modal'))closeModal();break;
      case 'error':console.error('GPT Live event error',event);setLiveStatus('Ошибка Live-сессии','Можно завершить разговор и попробовать обычного Казначея.','');break;
    }
  }

  function syncMute(session){
    const button=document.getElementById('treasurerLiveMute');if(!button)return;
    button.classList.toggle('is-muted',session.muted);button.textContent=session.muted?'🔇 Микрофон выключен':'🎙 Микрофон включён';
    session.stream?.getAudioTracks?.().forEach(track=>track.enabled=!session.muted);
  }

  function toggleMute(session){
    if(session.ended)return;
    const next=!session.muted;
    sendLive(session,{type:next?'session.input_audio.mute':'session.input_audio.unmute'});
    session.muted=next;syncMute(session);
  }

  function cleanupLive(session,stopModal=true){
    if(!session||session.cleaned)return;session.cleaned=true;session.ended=true;
    clearTimeout(session.startTimer);clearTimeout(session.speechTimer);
    try{session.stream?.getTracks?.().forEach(track=>track.stop())}catch(_){}
    try{session.dc?.close()}catch(_){}
    try{session.pc?.close()}catch(_){}
    const audio=document.getElementById('treasurerLiveAudio');if(audio)audio.srcObject=null;
    if(liveSession===session)liveSession=null;
    if(stopModal&&document.getElementById('modal'))closeModal();
  }

  function endLive(session){
    if(session.ended)return;session.userEnded=true;
    sendLive(session,{type:'session.close'});
    setLiveStatus('Завершаю разговор','Закрываю Live-сессию…','');
    setTimeout(()=>cleanupLive(session,true),450);
  }

  function fallbackClassic(session,error){
    if(session?.userEnded||session?.fallbackStarted)return;if(session)session.fallbackStarted=true;
    console.warn('GPT Live unavailable, fallback to classic Treasurer',error);
    cleanupLive(session,true);
    setTimeout(()=>window.FinanceTreasurer?.open?.(),120);
  }

  async function startLive(session){
    try{
      if(!navigator.onLine)throw new Error('Нет подключения к интернету.');
      if(!window.RTCPeerConnection||!navigator.mediaDevices?.getUserMedia)throw new Error('WebRTC недоступен на этом устройстве.');
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(session.ended){stream.getTracks().forEach(t=>t.stop());return}
      session.stream=stream;
      const pc=new RTCPeerConnection();session.pc=pc;
      const audio=document.getElementById('treasurerLiveAudio');
      pc.ontrack=event=>{if(audio){audio.srcObject=event.streams?.[0]||new MediaStream([event.track]);audio.play().catch(()=>{})}};
      pc.onconnectionstatechange=()=>{if(['failed','disconnected'].includes(pc.connectionState)&&!session.userEnded)fallbackClassic(session,new Error(`WebRTC: ${pc.connectionState}`))};
      stream.getTracks().forEach(track=>pc.addTrack(track,stream));
      const dc=pc.createDataChannel('oai-events');session.dc=dc;
      dc.onmessage=message=>{try{handleEvent(session,JSON.parse(message.data))}catch(error){console.warn('Invalid Live event',error)}};
      dc.onclose=()=>{if(!session.userEnded&&!session.ended)fallbackClassic(session,new Error('Канал Live закрыт.'))};
      const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitIce(pc);
      const headers=await authHeaders();
      const response=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-live-session`,{method:'POST',headers,body:JSON.stringify({sdp:pc.localDescription?.sdp||offer.sdp,voice:liveVoice(),timezone:timezone()})});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok||!payload?.ok||!payload?.transport?.sdp)throw new Error(payload?.message||'Не удалось создать Live-сессию.');
      session.sessionId=payload.session?.id||'';
      await pc.setRemoteDescription({type:'answer',sdp:payload.transport.sdp});
      session.startTimer=setTimeout(()=>{if(!session.started&&!session.ended)fallbackClassic(session,new Error('Live-сессия не ответила вовремя.'))},12000);
    }catch(error){fallbackClassic(session,error)}
  }

  function openLiveTreasurer(){
    if(liveSession)cleanupLive(liveSession,true);
    closeModal();document.body.insertAdjacentHTML('beforeend',modalMarkup());
    const session={started:false,ended:false,cleaned:false,userEnded:false,fallbackStarted:false,muted:false,pc:null,dc:null,stream:null,sessionId:'',inputTranscript:'',outputTranscript:'',delegatedOffset:0,history:[],startTimer:null,speechTimer:null};
    liveSession=session;
    document.getElementById('closeLiveTreasurer').onclick=()=>endLive(session);
    document.getElementById('treasurerLiveEnd').onclick=()=>endLive(session);
    document.getElementById('treasurerLiveMute').onclick=()=>toggleMute(session);
    document.getElementById('treasurerLiveShowText').onclick=()=>{const panel=document.getElementById('treasurerLiveTranscript');if(!panel)return;panel.hidden=!panel.hidden;document.getElementById('treasurerLiveShowText').textContent=panel.hidden?'Показать текст':'Скрыть текст'};
    document.getElementById('modal').onclick=event=>{if(event.target?.id==='modal')endLive(session)};
    startLive(session);
  }

  // Capture before treasurer.js button onclick. Classic mode remains untouched.
  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-treasurer-open]');
    if(!button||experience()!=='live')return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openLiveTreasurer();
  },true);

  syncSettings();
  window.FinanceTreasurerLive={open:openLiveTreasurer,getExperience:experience,setExperience,getVoice:liveVoice,setVoice:setLiveVoice,voices:()=>LIVE_VOICES.map(v=>({...v}))};
})();
