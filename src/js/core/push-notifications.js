// Native Android push notifications for family transaction changes and spouse messages.
(function(){
  const native=Boolean(window.__FINANCE_NATIVE__);
  const configured=Boolean(window.__FINANCE_PUSH_CONFIGURED__);
  const TOKEN_KEY='finance.pushToken';
  const WANTED_KEY='finance.pushWanted';
  const ASKED_KEY='finance.pushPermissionAsked';
  const MESSAGE_LIMIT=200;
  const MESSAGE_EMOJIS=['👍','❤️','😊','😔','🌸','🍺','😂','😘','😍','🙏','🎉','🔥','😉','🤗'];
  let listenersBound=false,dispatchChannel=null,dispatchFamilyId=null,dispatchTimer=null,registering=false,lastError='';

  function plugin(){return window.Capacitor?.Plugins?.PushNotifications}
  function wanted(){return localStorage.getItem(WANTED_KEY)!=='0'}
  function token(){return localStorage.getItem(TOKEN_KEY)||''}
  function setStatus(message,type=''){lastError=type==='error'?message:'';window.dispatchEvent(new CustomEvent('finance-push-status',{detail:{message,type}}))}
  function partner(){return state.people.find(p=>p.linked_user_id&&p.linked_user_id!==state.user?.id)||null}
  function charCount(value){return Array.from(String(value||'')).length}
  function clampMessage(value){return Array.from(String(value||'')).slice(0,MESSAGE_LIMIT).join('')}

  async function saveToken(value){
    if(!value||!state.user?.id||!state.family?.id)return false;
    localStorage.setItem(TOKEN_KEY,value);
    const {error}=await sb.rpc('register_push_device',{p_token:value,p_platform:'android'});
    if(error){setStatus(`Не удалось зарегистрировать push: ${error.message}`,'error');return false}
    setStatus('Push-уведомления включены на этом телефоне','success');
    return true;
  }

  async function disable(){
    localStorage.setItem(WANTED_KEY,'0');
    const current=token();
    if(current&&state.user?.id){try{await sb.rpc('set_push_device_enabled',{p_token:current,p_enabled:false})}catch(_){ }}
    setStatus('Push-уведомления выключены на этом телефоне');
    return true;
  }

  async function createChannel(){
    const push=plugin();if(!push?.createChannel)return;
    try{await push.createChannel({id:'finance_operations',name:'Операции семьи',description:'Доходы, расходы, изменения и личные сообщения семейной казны',importance:5,visibility:1,sound:'default',vibration:true})}catch(_){ }
  }

  function bindListeners(){
    if(listenersBound)return;const push=plugin();if(!push?.addListener)return;
    listenersBound=true;
    push.addListener('registration',event=>{registering=false;saveToken(event?.value||'')});
    push.addListener('registrationError',event=>{registering=false;setStatus(`Push недоступен: ${event?.error||'ошибка регистрации'}`,'error')});
    push.addListener('pushNotificationActionPerformed',event=>{
      const data=event?.notification?.data||{};
      if(typeof state==='undefined')return;
      if(data.kind==='transaction'){
        state.view='operations';state.journalLimit=50;
        if(typeof renderApp==='function')renderApp();
        if(typeof scrollOverviewTop==='function')scrollOverviewTop();
      }else if(data.kind==='family_message'){
        state.view='settings';
        if(typeof renderApp==='function')renderApp();
        if(typeof scrollOverviewTop==='function')scrollOverviewTop();
      }
    });
  }

  async function register({ask=false}={}){
    if(!native||!configured||!state.user?.id||state.user?._offlineLocal)return false;
    const push=plugin();if(!push)return false;
    bindListeners();await createChannel();
    try{
      let permission=await push.checkPermissions();
      if(permission?.receive==='prompt'&&ask){permission=await push.requestPermissions()}
      if(permission?.receive!=='granted'){
        if(permission?.receive==='denied')setStatus('Уведомления запрещены в настройках Android');
        return false;
      }
      if(registering)return true;registering=true;await push.register();return true;
    }catch(error){registering=false;setStatus(`Push недоступен: ${error?.message||error}`,'error');return false}
  }

  async function enable(){
    localStorage.setItem(WANTED_KEY,'1');
    if(!native)return false;
    if(!configured){setStatus('Для push ещё не подключён Firebase','error');return false}
    return register({ask:true});
  }

  async function autoRegister(){
    if(!native||!configured||!wanted()||!state.user?.id||state.user?._offlineLocal)return false;
    const push=plugin();if(!push)return false;
    bindListeners();await createChannel();
    try{
      const permission=await push.checkPermissions();
      if(permission?.receive==='granted')return register({ask:false});
      if(permission?.receive==='prompt'&&localStorage.getItem(ASKED_KEY)!=='1'){
        localStorage.setItem(ASKED_KEY,'1');return register({ask:true});
      }
    }catch(_){ }
    return false;
  }

  async function dispatchPending(){
    if(!navigator.onLine||!state.user?.id||state.user?._offlineLocal||!state.family?.id)return false;
    try{
      const {data,error}=await sb.functions.invoke('push-transaction-events',{body:{family_id:state.family.id}});
      if(error){if(!/FIREBASE_NOT_CONFIGURED|503/i.test(String(error.message||error)))console.warn('Push dispatch failed',error);return false}
      return Boolean(data?.ok);
    }catch(error){console.warn('Push dispatch unavailable',error);return false}
  }
  function dispatchPendingSoon(){clearTimeout(dispatchTimer);dispatchTimer=setTimeout(dispatchPending,450)}

  async function sendFamilyMessage(rawMessage){
    const message=String(rawMessage||'').trim();
    if(!message)return{ok:false,error:'Напишите сообщение'};
    if(charCount(message)>MESSAGE_LIMIT)return{ok:false,error:`Максимум ${MESSAGE_LIMIT} символов`};
    if(!navigator.onLine)return{ok:false,error:'Для отправки сообщения нужен интернет'};
    if(!state.user?.id||state.user?._offlineLocal||!state.family?.id)return{ok:false,error:'Нужно войти в семейную казну'};
    if(!partner())return{ok:false,error:'Второй участник семьи ещё не подключён'};
    try{
      const {data,error}=await sb.functions.invoke('push-transaction-events',{body:{action:'family_message',message}});
      if(error)return{ok:false,error:error.message||String(error)};
      if(!data?.ok){
        const code=String(data?.error||'');
        if(code==='NO_RECIPIENT_DEVICE')return{ok:false,error:'На телефоне супруга push-уведомления не включены'};
        if(code==='FIREBASE_NOT_CONFIGURED')return{ok:false,error:'Сервис push временно недоступен'};
        return{ok:false,error:data?.message||code||'Не удалось отправить сообщение'};
      }
      if(!Number(data.sent||0))return{ok:false,error:'Не найден телефон получателя с включёнными push'};
      return{ok:true,sent:Number(data.sent||0)};
    }catch(error){return{ok:false,error:error?.message||String(error)}}
  }

  function messageComposerMarkup(){
    const recipient=partner(),recipientName=recipient?.display_name||'второму участнику';
    const disabled=!recipient?.linked_user_id;
    return `<div class="family-message-composer"><div class="family-message-heading"><div><h3>Сообщение супругу</h3><p>Отправьте короткое личное сообщение прямо в push на другой телефон.</p></div><span class="family-message-recipient">→ ${esc(recipientName)}</span></div><div class="family-message-emojis" aria-label="Быстрые смайлики">${MESSAGE_EMOJIS.map(emoji=>`<button type="button" class="family-message-emoji" data-family-emoji="${emoji}" aria-label="Добавить ${emoji}">${emoji}</button>`).join('')}</div><label class="family-message-field" for="familyPushMessage"><span>Текст сообщения</span><textarea id="familyPushMessage" rows="3" maxlength="400" placeholder="Например: Купи, пожалуйста, хлеб 😊" ${disabled?'disabled':''}></textarea></label><div class="family-message-footer"><span id="familyPushCounter">0 / ${MESSAGE_LIMIT}</span><button type="button" class="btn btn-primary" id="sendFamilyPush" ${disabled?'disabled':''}>Отправить push</button></div><div id="familyPushNotice"></div>${disabled?'<p class="access-note">Отправка станет доступна, когда второй семейный аккаунт будет подключён.</p>':''}</div>`;
  }

  function bindMessageComposer(){
    const input=document.getElementById('familyPushMessage'),send=document.getElementById('sendFamilyPush'),counter=document.getElementById('familyPushCounter');
    if(!input||!send)return;
    const paintCounter=()=>{const count=charCount(input.value);if(counter){counter.textContent=`${count} / ${MESSAGE_LIMIT}`;counter.classList.toggle('limit',count>=MESSAGE_LIMIT)}};
    input.addEventListener('input',()=>{const clipped=clampMessage(input.value);if(clipped!==input.value)input.value=clipped;paintCounter()});
    document.querySelectorAll('[data-family-emoji]').forEach(button=>button.onclick=()=>{
      const emoji=button.dataset.familyEmoji||'';
      input.value=clampMessage(`${input.value}${emoji}`);paintCounter();input.focus();
    });
    send.onclick=async()=>{
      notice('familyPushNotice','');
      const message=input.value.trim();
      if(!message)return notice('familyPushNotice','Напишите сообщение');
      send.disabled=true;send.textContent='Отправляю…';
      const result=await sendFamilyMessage(message);
      send.disabled=false;send.textContent='Отправить push';
      if(!result.ok)return notice('familyPushNotice',result.error||'Не удалось отправить сообщение');
      input.value='';paintCounter();notice('familyPushNotice','Сообщение отправлено на другой телефон.','success');
      if(typeof uiSound==='function')uiSound('success');
    };
    paintCounter();
  }

  function actorFromPayload(payload){
    const row=payload?.new||payload?.old||{};
    if(payload?.eventType==='INSERT')return row.created_by||'';
    if(row.deleted_at)return row.deleted_by||row.updated_by||'';
    return row.updated_by||row.created_by||'';
  }
  function subscribeDispatch(){
    const familyId=state.family?.id;
    if(!familyId||state.user?._offlineLocal||dispatchFamilyId===familyId&&dispatchChannel)return;
    if(dispatchChannel){try{sb.removeChannel(dispatchChannel)}catch(_){ }}
    dispatchFamilyId=familyId;
    dispatchChannel=sb.channel(`finance-push-${familyId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:`family_id=eq.${familyId}`},payload=>{
        if(actorFromPayload(payload)===state.user?.id)dispatchPendingSoon();
      })
      .subscribe();
  }

  function waitForSession(attempt=0){
    if(!state.user||state.user?._offlineLocal)return;
    if(state.family?.id){subscribeDispatch();autoRegister();dispatchPendingSoon();return}
    if(attempt<50)setTimeout(()=>waitForSession(attempt+1),250);
  }

  function settingsMarkup(){
    if(!native)return '<div class="notice">Push-уведомления доступны в Android-приложении.</div>';
    if(!configured)return '<div class="notice warning">Push подготовлены, но Firebase ещё не подключён к сборке Android.</div>';
    const active=wanted();
    return `<div class="push-settings"><p class="access-note">Уведомления о добавлении, изменении и удалении доходов/расходов. Автор операции сам себе push не получает.</p><div id="pushSettingsState" class="access-state ${active?'ok':'wait'}">${active?'Уведомления включены':'Уведомления выключены'}</div><button type="button" class="btn ${active?'btn-soft':'btn-primary'}" id="pushSettingsToggle">${active?'Выключить push':'Включить push'}</button></div>`;
  }
  function bindSettings(){
    const button=document.getElementById('pushSettingsToggle'),stateBox=document.getElementById('pushSettingsState');if(!button)return;
    const paint=(message,type='')=>{if(stateBox){stateBox.textContent=message;stateBox.className=`access-state ${type==='success'?'ok':'wait'}`}};
    const handler=event=>paint(event.detail?.message||'',event.detail?.type||'');window.addEventListener('finance-push-status',handler,{once:true});
    button.onclick=async()=>{
      button.disabled=true;
      if(wanted()){await disable();button.textContent='Включить push';button.className='btn btn-primary';paint('Уведомления выключены')}
      else{const ok=await enable();if(ok){button.textContent='Выключить push';button.className='btn btn-soft';paint('Разрешение запрошено…')}else paint(lastError||'Не удалось включить push')}
      button.disabled=false;
    };
  }

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'||!session?.user){if(dispatchChannel){try{sb.removeChannel(dispatchChannel)}catch(_){ }}dispatchChannel=null;dispatchFamilyId=null;return}
    setTimeout(()=>waitForSession(),0);
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){waitForSession();dispatchPendingSoon()}});
  window.addEventListener('focus',()=>{waitForSession();dispatchPendingSoon()});

  window.FinancePush={enable,disable,register,dispatchPending,dispatchPendingSoon,sendFamilyMessage,messageComposerMarkup,bindMessageComposer,settingsMarkup,bindSettings,get configured(){return configured},get wanted(){return wanted()},get token(){return token()},get messageLimit(){return MESSAGE_LIMIT}};
})();
