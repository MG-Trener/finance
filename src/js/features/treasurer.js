// Voice AI treasurer: microphone capture, server analysis and optional spoken answers.
(function(){
  const MODE_KEY='finance.treasurerResponseMode';
  const MAX_RECORDING_MS=60000;
  let activeSession=null;

  function responseMode(){
    const stored=localStorage.getItem(MODE_KEY);
    return stored==='text'?'text':'voice';
  }

  function setResponseMode(value){
    const next=value==='text'?'text':'voice';
    localStorage.setItem(MODE_KEY,next);
    document.querySelectorAll('[data-treasurer-mode]').forEach(button=>{
      const active=button.dataset.treasurerMode===next;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const detail=document.querySelector('[data-treasurer-mode-detail]');
    if(detail)detail.textContent=next==='voice'?'Казначей будет отвечать спокойным мужским голосом.':'Ответ Казначея будет показан текстом.';
  }

  function settingsCardMarkup(){
    const mode=responseMode();
    return `<div class="card settings-card treasurer-settings-card"><div class="settings-card-icon">🎙</div><div class="settings-card-body"><h3>Ответы Казначея</h3><p data-treasurer-mode-detail>${mode==='voice'?'Казначей будет отвечать спокойным мужским голосом.':'Ответ Казначея будет показан текстом.'}</p></div><div class="treasurer-mode-switch settings-control" role="group" aria-label="Формат ответа Казначея"><button type="button" class="treasurer-mode-btn ${mode==='text'?'active':''}" data-treasurer-mode="text" aria-pressed="${mode==='text'}">Текст</button><button type="button" class="treasurer-mode-btn ${mode==='voice'?'active':''}" data-treasurer-mode="voice" aria-pressed="${mode==='voice'}">Голос</button></div></div>`;
  }

  if(typeof settingsPage==='function'){
    const baseSettingsPage=settingsPage;
    settingsPage=function(){
      const html=baseSettingsPage();
      const marker='<div class="settings-grid">';
      return html.includes(marker)?html.replace(marker,marker+settingsCardMarkup()):html;
    };
  }

  function bindTreasurerSettings(){
    document.querySelectorAll('[data-treasurer-mode]').forEach(button=>{
      button.onclick=()=>{setResponseMode(button.dataset.treasurerMode);if(typeof uiSound==='function')uiSound('tap')};
    });
  }

  if(typeof bindSettings==='function'){
    const baseBindSettings=bindSettings;
    bindSettings=function(){baseBindSettings();bindTreasurerSettings()};
  }

  function installLaunchButton(){
    if(state?.view!=='analytics'||document.querySelector('[data-treasurer-open]'))return;
    const actions=document.querySelector('.analytics-title-actions');
    const title=document.querySelector('.analytics-page-head .page-title');
    const host=actions||title?.parentElement;
    if(!host)return;
    const button=document.createElement('button');
    button.type='button';
    button.className='analytics-treasurer-button';
    button.dataset.treasurerOpen='1';
    button.setAttribute('aria-label','Вызов Казначея');
    button.innerHTML='<span class="analytics-treasurer-icon" aria-hidden="true">🎙</span><b>Вызов Казначея</b>';
    button.onclick=openTreasurer;
    host.appendChild(button);
  }

  if(typeof drawAnalytics==='function'){
    const baseDrawAnalytics=drawAnalytics;
    drawAnalytics=function(){const result=baseDrawAnalytics();installLaunchButton();return result};
  }

  function stopTracks(session=activeSession){
    session?.stream?.getTracks?.().forEach(track=>{try{track.stop()}catch(_){}});
    if(session)session.stream=null;
  }

  function stopPlayback(session=activeSession){
    if(!session)return;
    if(session.audio){try{session.audio.pause();session.audio.currentTime=0}catch(_){}session.audio=null}
    if(session.audioUrl){try{URL.revokeObjectURL(session.audioUrl)}catch(_){}session.audioUrl=''}
  }

  function cleanupSession(){
    const session=activeSession;
    if(!session)return;
    clearTimeout(session.maxTimer);
    stopTracks(session);
    stopPlayback(session);
    if(session.recorder&&session.recorder.state!=='inactive'){
      try{session.recorder.stop()}catch(_){}
    }
    activeSession=null;
  }

  function closeTreasurer(){cleanupSession();closeModal()}

  function setStatus(text,phase){
    const status=document.getElementById('treasurerStatus');
    const modal=document.querySelector('.treasurer-modal');
    if(status)status.textContent=text;
    if(modal){
      modal.dataset.phase=phase||'';
      modal.classList.toggle('is-recording',phase==='recording');
      modal.classList.toggle('is-thinking',phase==='processing');
      modal.classList.toggle('is-speaking',phase==='speaking');
    }
  }

  function setHint(text){const hint=document.getElementById('treasurerHint');if(hint)hint.textContent=text}

  function setMicDisabled(disabled){const mic=document.getElementById('treasurerMic');if(mic)mic.disabled=Boolean(disabled)}

  function showError(message){
    setStatus('Казначей не смог ответить','error');
    setHint('Нажмите микрофон, чтобы попробовать ещё раз.');
    setMicDisabled(false);
    const result=document.getElementById('treasurerResult');
    if(result){result.hidden=false;result.innerHTML=`<div class="treasurer-error">${esc(message)}</div>`}
    if(activeSession)activeSession.phase='idle';
  }

  function preferredMimeType(){
    if(typeof MediaRecorder==='undefined'||typeof MediaRecorder.isTypeSupported!=='function')return '';
    return ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type))||'';
  }

  function extensionForMime(mime){return String(mime||'').includes('mp4')?'m4a':'webm'}

  function openTreasurer(){
    cleanupSession();closeModal();
    const mode=responseMode();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop modal-layout-top" id="modal"><div class="modal treasurer-modal" role="dialog" aria-modal="true" aria-labelledby="treasurerTitle" data-phase="idle"><div class="modal-head treasurer-head"><div><span class="treasurer-kicker">ИИ · Семейная казна</span><h2 id="treasurerTitle">Казначей</h2></div><button type="button" class="icon-btn" id="closeTreasurer" aria-label="Закрыть">×</button></div><div class="treasurer-stage"><div class="treasurer-status" id="treasurerStatus">Вызов Казначея</div><button type="button" class="treasurer-mic" id="treasurerMic" aria-label="Начать запись"><span class="treasurer-mic-ripple ripple-one"></span><span class="treasurer-mic-ripple ripple-two"></span><span class="treasurer-mic-symbol" aria-hidden="true">🎙</span></button><p class="treasurer-hint" id="treasurerHint">Нажмите микрофон и задайте вопрос. Повторное нажатие отправит запись.</p><small class="treasurer-limit">Запись до 60 секунд · голос не сохраняется</small></div><div class="treasurer-result" id="treasurerResult" hidden></div><div class="treasurer-footer"><span>${mode==='voice'?'Ответ: голосом':'Ответ: текстом'}</span><button type="button" class="btn btn-soft btn-small" id="treasurerCloseBottom">Закрыть</button></div></div></div>`);
    activeSession={phase:'idle',recorder:null,stream:null,chunks:[],maxTimer:null,audio:null,audioUrl:'',lastAnswer:null};
    const modal=document.getElementById('modal');
    document.getElementById('closeTreasurer').onclick=closeTreasurer;
    document.getElementById('treasurerCloseBottom').onclick=closeTreasurer;
    document.getElementById('treasurerMic').onclick=handleMicPress;
    modal.onclick=event=>{if(event.target===modal)closeTreasurer()};
  }

  async function handleMicPress(){
    if(!activeSession)return;
    if(activeSession.phase==='recording')return finishRecordingAndAsk();
    if(activeSession.phase==='processing'||activeSession.phase==='requesting')return;
    return startRecording();
  }

  async function startRecording(){
    const session=activeSession;if(!session)return;
    stopPlayback(session);
    const result=document.getElementById('treasurerResult');if(result){result.hidden=true;result.innerHTML=''}
    if(!navigator.onLine)return showError('Для обращения к Казначею нужен интернет.');
    if(state.user?._offlineLocal)return showError('В локальном режиме Казначей недоступен. Войдите в семейную казну онлайн.');
    if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')return showError('На этом устройстве запись с микрофона не поддерживается.');
    session.phase='requesting';setMicDisabled(true);setStatus('Подключаю микрофон','requesting');setHint('Разрешите приложению использовать микрофон.');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      if(activeSession!==session){stream.getTracks().forEach(track=>track.stop());return}
      const mime=preferredMimeType();
      const recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      session.stream=stream;session.recorder=recorder;session.chunks=[];session.phase='recording';
      recorder.ondataavailable=event=>{if(event.data?.size)session.chunks.push(event.data)};
      recorder.start(250);
      setMicDisabled(false);setStatus('Говорите','recording');setHint('Когда закончите, нажмите микрофон ещё раз — вопрос отправится Казначею.');
      session.maxTimer=setTimeout(()=>{if(activeSession===session&&session.phase==='recording')finishRecordingAndAsk()},MAX_RECORDING_MS);
    }catch(error){
      console.error('Microphone access failed',error);
      session.phase='idle';setMicDisabled(false);showError('Не удалось получить доступ к микрофону. Проверьте разрешение приложения.');
    }
  }

  function stopRecorder(session){
    return new Promise((resolve,reject)=>{
      const recorder=session.recorder;
      if(!recorder||recorder.state==='inactive')return resolve(new Blob(session.chunks,{type:recorder?.mimeType||'audio/webm'}));
      const onStop=()=>resolve(new Blob(session.chunks,{type:recorder.mimeType||'audio/webm'}));
      const onError=event=>reject(event.error||new Error('Ошибка записи'));
      recorder.addEventListener('stop',onStop,{once:true});
      recorder.addEventListener('error',onError,{once:true});
      try{recorder.stop()}catch(error){reject(error)}
    });
  }

  async function finishRecordingAndAsk(){
    const session=activeSession;if(!session||session.phase!=='recording')return;
    clearTimeout(session.maxTimer);session.phase='processing';setMicDisabled(true);setStatus('Казначей смотрит записи','processing');setHint('Распознаю вопрос и анализирую семейную казну…');
    try{
      const blob=await stopRecorder(session);stopTracks(session);
      if(activeSession!==session)return;
      if(!blob.size)throw new Error('Запись получилась пустой.');
      await askTreasurer(blob,session);
    }catch(error){
      console.error('Treasurer request failed',error);
      if(activeSession===session)showError(error?.message||'Не удалось обработать вопрос.');
    }
  }

  async function askTreasurer(blob,session){
    const {data:{session:authSession}}=await sb.auth.getSession();
    if(!authSession?.access_token)throw new Error('Сеанс авторизации истёк. Войдите в приложение ещё раз.');
    const mode=responseMode(),mime=blob.type||'audio/webm';
    const form=new FormData();
    form.append('audio',new File([blob],`treasurer-question.${extensionForMime(mime)}`,{type:mime}));
    form.append('answer_mode',mode);
    form.append('timezone',Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Almaty');
    const response=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-assistant`,{method:'POST',headers:{Authorization:`Bearer ${authSession.access_token}`,apikey:SUPABASE_KEY},body:form});
    let payload={};
    try{payload=await response.json()}catch(_){ }
    if(!response.ok||!payload?.ok){
      const code=payload?.error||'';
      if(code==='OPENAI_NOT_CONFIGURED')throw new Error('Подключение Казначея к OpenAI ещё не настроено.');
      if(code==='QUESTION_REQUIRED')throw new Error('Казначей не расслышал вопрос. Попробуйте сказать его ещё раз.');
      throw new Error(payload?.message||'Казначей временно недоступен. Попробуйте ещё раз.');
    }
    if(activeSession!==session)return;
    session.lastAnswer=payload;
    renderAnswer(payload,session);
  }

  function answerMarkup(payload,voice){
    const question=payload.transcript?`<div class="treasurer-question"><span>Вы спросили</span><p>${esc(payload.transcript)}</p></div>`:'';
    if(!voice)return `${question}<div class="treasurer-answer"><span>Ответ Казначея</span><p>${esc(payload.answer||'').replace(/\n/g,'<br>')}</p></div>`;
    return `${question}<div class="treasurer-voice-answer"><div class="treasurer-voice-orb" aria-hidden="true">◉</div><div><b>Ответ воспроизводится голосом</b><p>Можно повторить озвучивание или открыть текст ответа.</p></div></div><div class="treasurer-answer treasurer-answer-collapsed" id="treasurerAnswerText"><span>Текст ответа</span><p>${esc(payload.answer||'').replace(/\n/g,'<br>')}</p></div><div class="treasurer-answer-actions"><button type="button" class="btn btn-soft btn-small" id="treasurerRepeatVoice">🔊 Повторить</button><button type="button" class="btn btn-soft btn-small" id="treasurerShowText">Показать текст</button></div>`;
  }

  function base64AudioUrl(base64,mime='audio/mpeg'){
    const binary=atob(base64),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes],{type:mime}));
  }

  function playAnswerAudio(payload,session){
    if(!payload.audio_base64)return false;
    stopPlayback(session);
    const url=base64AudioUrl(payload.audio_base64,payload.audio_mime||'audio/mpeg');
    const audio=new Audio(url);session.audio=audio;session.audioUrl=url;
    audio.onplay=()=>{if(activeSession===session)setStatus('Казначей говорит','speaking')};
    audio.onended=()=>{if(activeSession===session){setStatus('Казначей ответил','answer');session.phase='idle';setMicDisabled(false);setHint('Нажмите микрофон, чтобы задать следующий вопрос.')}};
    audio.onerror=()=>{if(activeSession===session){setStatus('Казначей ответил','answer');session.phase='idle';setMicDisabled(false)}};
    audio.play().catch(()=>{
      if(activeSession!==session)return;
      setStatus('Казначей готов ответить','answer');
      setHint('Автовоспроизведение заблокировано. Нажмите «Повторить».');
      session.phase='idle';setMicDisabled(false);
    });
    return true;
  }

  function renderAnswer(payload,session){
    const result=document.getElementById('treasurerResult');if(!result)return;
    const wantsVoice=responseMode()==='voice',hasVoice=wantsVoice&&payload.audio_base64;
    result.hidden=false;result.innerHTML=answerMarkup(payload,hasVoice);
    session.phase='idle';setMicDisabled(false);
    if(hasVoice){
      setStatus('Казначей говорит','speaking');setHint('Ответ озвучивается. После окончания можно задать следующий вопрос.');
      document.getElementById('treasurerRepeatVoice').onclick=()=>playAnswerAudio(payload,session);
      document.getElementById('treasurerShowText').onclick=()=>{
        document.getElementById('treasurerAnswerText')?.classList.toggle('treasurer-answer-collapsed');
        const hidden=document.getElementById('treasurerAnswerText')?.classList.contains('treasurer-answer-collapsed');
        document.getElementById('treasurerShowText').textContent=hidden?'Показать текст':'Скрыть текст';
      };
      playAnswerAudio(payload,session);
      return;
    }
    setStatus('Казначей пишет','writing');
    setHint(wantsVoice&&payload.tts_error?'Голос временно недоступен, поэтому показываю ответ текстом.':'Нажмите микрофон, чтобы задать следующий вопрос.');
  }

  window.FinanceTreasurer={open:openTreasurer,getResponseMode:responseMode,setResponseMode};
})();
