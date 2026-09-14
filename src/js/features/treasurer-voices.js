// Treasurer voice selector and selected-voice TTS bridge.
(function(){
  const MODE_KEY='finance.treasurerResponseMode';
  const VOICE_KEY='finance.treasurerVoice';
  const VOICES=[
    {id:'cedar',name:'Кедр',group:'male',note:'спокойный и уверенный'},
    {id:'onyx',name:'Оникс',group:'male',note:'глубокий и серьёзный'},
    {id:'echo',name:'Эхо',group:'male',note:'ровный и нейтральный'},
    {id:'marin',name:'Марин',group:'female',note:'естественный и мягкий'},
    {id:'nova',name:'Нова',group:'female',note:'светлый и живой'},
    {id:'shimmer',name:'Шиммер',group:'female',note:'мягкий и спокойный'}
  ];
  const nativeFetch=window.fetch.bind(window);
  let previewAudio=null;
  let previewUrl='';

  function mode(){
    return localStorage.getItem(MODE_KEY)==='text'?'text':'voice';
  }

  function voice(){
    const value=localStorage.getItem(VOICE_KEY);
    return VOICES.some(item=>item.id===value)?value:'cedar';
  }

  function meta(id=voice()){
    return VOICES.find(item=>item.id===id)||VOICES[0];
  }

  function setVoice(id){
    const next=VOICES.some(item=>item.id===id)?id:'cedar';
    localStorage.setItem(VOICE_KEY,next);
    syncUi();
  }

  function optionMarkup(item){
    const active=voice()===item.id;
    return `<div class="treasurer-voice-option">
      <button type="button" class="treasurer-voice-choice ${active?'active':''}" data-treasurer-voice="${item.id}" aria-pressed="${active}">
        <span>${item.name}</span><small>${item.note}</small>
      </button>
      <button type="button" class="treasurer-voice-preview" data-treasurer-preview="${item.id}" aria-label="Прослушать голос ${item.name}">▶</button>
    </div>`;
  }

  function cardMarkup(){
    const male=VOICES.filter(item=>item.group==='male').map(optionMarkup).join('');
    const female=VOICES.filter(item=>item.group==='female').map(optionMarkup).join('');
    return `<div class="card settings-card treasurer-voice-settings" data-treasurer-voice-settings ${mode()==='voice'?'':'hidden'}>
      <div class="settings-card-icon">🔊</div>
      <div class="settings-card-body">
        <h3>Голос Казначея</h3>
        <p>Выбран: <b data-treasurer-selected-voice>${meta().name}</b>. Нажмите ▶, чтобы прослушать пример.</p>
      </div>
      <div class="treasurer-voice-grid">
        <section><h4>Мужские варианты</h4>${male}</section>
        <section><h4>Женские варианты</h4>${female}</section>
      </div>
      <div class="treasurer-voice-disclosure">Голос синтезируется ИИ и не является записью реального человека.</div>
      <div class="treasurer-voice-preview-status" data-treasurer-preview-status></div>
    </div>`;
  }

  function installCard(){
    if(state?.view!=='settings')return;
    if(document.querySelector('[data-treasurer-voice-settings]'))return syncUi();
    const base=document.querySelector('.treasurer-settings-card');
    if(!base)return;
    base.insertAdjacentHTML('afterend',cardMarkup());
    bindCard();
    syncUi();
  }

  function syncUi(){
    const show=mode()==='voice';
    document.querySelectorAll('[data-treasurer-voice-settings]').forEach(card=>card.hidden=!show);
    document.querySelectorAll('[data-treasurer-voice]').forEach(button=>{
      const active=button.dataset.treasurerVoice===voice();
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    document.querySelectorAll('[data-treasurer-selected-voice]').forEach(node=>node.textContent=meta().name);
    const detail=document.querySelector('[data-treasurer-mode-detail]');
    if(detail&&show)detail.textContent=`Казначей будет отвечать голосом «${meta().name}».`;
  }

  function stopPreview(){
    if(previewAudio){
      try{previewAudio.pause();previewAudio.currentTime=0}catch(_){}
      previewAudio=null;
    }
    if(previewUrl){
      try{URL.revokeObjectURL(previewUrl)}catch(_){}
      previewUrl='';
    }
  }

  function base64Url(base64,mime='audio/mpeg'){
    const binary=atob(base64),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:mime}));
  }

  async function authHeaders(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Сеанс авторизации истёк.');
    return {Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_KEY,'Content-Type':'application/json'};
  }

  async function speechRequest(text,voiceId,purpose='answer'){
    const headers=await authHeaders();
    const response=await nativeFetch(`${SUPABASE_URL}/functions/v1/treasurer-speech`,{
      method:'POST',
      headers,
      body:JSON.stringify({text,voice:voiceId,purpose})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload?.ok||!payload.audio_base64){
      throw new Error(payload?.message||'Озвучивание Казначея временно недоступно.');
    }
    return payload;
  }

  async function previewVoice(button){
    if(!navigator.onLine)return;
    const id=button.dataset.treasurerPreview;
    const item=meta(id);
    const status=document.querySelector('[data-treasurer-preview-status]');
    stopPreview();
    const old=button.textContent;
    button.disabled=true;button.textContent='…';
    if(status)status.textContent=`Готовлю голос «${item.name}»…`;
    try{
      const payload=await speechRequest('',item.id,'preview');
      const url=base64Url(payload.audio_base64,payload.audio_mime||'audio/mpeg');
      const audio=new Audio(url);
      previewAudio=audio;previewUrl=url;
      audio.onplay=()=>{if(status)status.textContent=`Слушаем «${item.name}»`;};
      audio.onended=()=>{if(status)status.textContent='';stopPreview();};
      audio.onerror=()=>{if(status)status.textContent='Не удалось воспроизвести пример.';stopPreview();};
      await audio.play();
    }catch(error){
      if(status)status.textContent=error?.message||'Не удалось прослушать пример.';
    }finally{
      button.disabled=false;button.textContent=old;
    }
  }

  function bindCard(){
    document.querySelectorAll('[data-treasurer-voice]').forEach(button=>{
      button.onclick=()=>{
        setVoice(button.dataset.treasurerVoice);
        if(typeof uiSound==='function')uiSound('tap');
      };
    });
    document.querySelectorAll('[data-treasurer-preview]').forEach(button=>{
      button.onclick=()=>previewVoice(button);
    });
  }

  if(typeof bindSettings==='function'){
    const baseBindSettings=bindSettings;
    bindSettings=function(){
      baseBindSettings();
      installCard();
      document.querySelectorAll('[data-treasurer-mode]').forEach(button=>{
        button.addEventListener('click',()=>setTimeout(syncUi,0));
      });
    };
  }

  // Use the selected voice for real Treasurer answers without exposing the OpenAI key.
  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input?.url||'');
    const isTreasurer=url.includes('/functions/v1/treasurer-assistant');
    const form=init?.body;
    if(!isTreasurer||!(form instanceof FormData)||form.get('answer_mode')!=='voice'){
      return nativeFetch(input,init);
    }

    // Let the analysis endpoint return text only. The selected voice is generated
    // by the dedicated authenticated TTS function below.
    form.set('answer_mode','text');
    const response=await nativeFetch(input,init);
    const payload=await response.clone().json().catch(()=>null);
    if(!response.ok||!payload?.ok||!payload?.answer)return response;

    try{
      const speech=await speechRequest(String(payload.answer),voice(),'answer');
      payload.mode='voice';
      payload.voice=speech.voice||voice();
      payload.audio_base64=speech.audio_base64;
      payload.audio_mime=speech.audio_mime||'audio/mpeg';
      delete payload.tts_error;
    }catch(error){
      console.error('Treasurer selected voice fallback',error);
      payload.mode='text';
      payload.tts_error=true;
    }

    return new Response(JSON.stringify(payload),{
      status:response.status,
      statusText:response.statusText,
      headers:{'Content-Type':'application/json'}
    });
  };

  // Keep the modal footer informative.
  document.addEventListener('click',event=>{
    if(!event.target?.closest?.('[data-treasurer-open]'))return;
    setTimeout(()=>{
      const footer=document.querySelector('.treasurer-modal .treasurer-footer span');
      if(footer&&mode()==='voice')footer.textContent=`Ответ: голосом · ${meta().name}`;
    },0);
  });

  window.FinanceTreasurerVoices={
    get:voice,
    set:setVoice,
    list:()=>VOICES.map(item=>({...item}))
  };
})();
