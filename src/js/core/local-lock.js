// Optional local PIN lock for the installed/PWA app.
// This protects the local interface from casual access; Supabase Auth remains the server identity layer.
(function(){
  const PREFIX='finance.localLock.v1:';
  const ITERATIONS=180000;
  const DEFAULT_LOCK_AFTER=60;
  let unlockedUserId=null;
  let pendingUnlock=null;
  let hiddenAt=0;

  const userId=()=>state.user?.id||'';
  const storageKey=id=>PREFIX+id;
  const offerLock=()=>Boolean(window.__FINANCE_NATIVE__||window.matchMedia?.('(display-mode: standalone)').matches);
  const bytesToB64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const b64ToBytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

  function readConfig(id=userId()){
    if(!id)return null;
    try{return JSON.parse(localStorage.getItem(storageKey(id))||'null')}catch(_){return null}
  }
  function writeConfig(id,value){if(value)localStorage.setItem(storageKey(id),JSON.stringify(value));else localStorage.removeItem(storageKey(id))}
  function enabled(id=userId()){return Boolean(readConfig(id)?.hash)}
  function lockAfter(id=userId()){const value=Number(readConfig(id)?.lockAfter);return Number.isFinite(value)&&value>=0?value:DEFAULT_LOCK_AFTER}

  async function derive(pin,saltB64){
    if(!crypto?.subtle)throw new Error('Шифрование PIN недоступно на этом устройстве');
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
    const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:b64ToBytes(saltB64),iterations:ITERATIONS},key,256);
    return bytesToB64(bits);
  }
  function validPin(pin){return /^\d{6}$/.test(String(pin||''))}
  async function createConfig(pin){
    if(!validPin(pin))throw new Error('PIN должен состоять из 6 цифр');
    const salt=crypto.getRandomValues(new Uint8Array(16)),saltB64=bytesToB64(salt),hash=await derive(pin,saltB64);
    return {salt:saltB64,hash,createdAt:new Date().toISOString(),failed:0,blockedUntil:0,lockAfter:DEFAULT_LOCK_AFTER};
  }
  async function verify(pin,id=userId()){
    const cfg=readConfig(id);if(!cfg?.hash)return true;
    const now=Date.now();if(Number(cfg.blockedUntil||0)>now)return false;
    const actual=await derive(pin,cfg.salt),ok=actual===cfg.hash;
    if(ok){cfg.failed=0;cfg.blockedUntil=0;writeConfig(id,cfg);return true}
    cfg.failed=Number(cfg.failed||0)+1;
    if(cfg.failed>=5){cfg.failed=0;cfg.blockedUntil=Date.now()+30000}
    writeConfig(id,cfg);return false;
  }

  function lockScreenMessage(){
    const cfg=readConfig(),remaining=Math.max(0,Math.ceil((Number(cfg?.blockedUntil||0)-Date.now())/1000));
    return remaining?`Слишком много попыток. Повторите через ${remaining} сек.`:'Введите локальный 6-значный PIN';
  }
  function renderLock(){
    closeModal?.();
    app.innerHTML=`<div class="local-lock-shell"><div class="local-lock-card"><div class="local-lock-emblem">₸</div><span class="local-lock-kicker">Семейная казна</span><h2>Казна заблокирована</h2><p id="localLockText">${esc(lockScreenMessage())}</p><form id="localLockForm"><input id="localLockPin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{6}" maxlength="6" placeholder="••••••" aria-label="PIN" required><button class="btn btn-primary btn-wide">Открыть</button></form><button type="button" class="btn btn-soft btn-wide local-lock-signout" id="localLockSignout">Выйти из аккаунта</button></div></div>`;
    const form=document.getElementById('localLockForm'),input=document.getElementById('localLockPin'),text=document.getElementById('localLockText');
    form.onsubmit=async e=>{
      e.preventDefault();const cfg=readConfig(),blocked=Number(cfg?.blockedUntil||0)-Date.now();
      if(blocked>0){text.textContent=lockScreenMessage();return}
      const pin=input.value.replace(/\D/g,'').slice(0,6);input.value=pin;
      if(!validPin(pin)){text.textContent='Введите ровно 6 цифр';return}
      const ok=await verify(pin);if(!ok){input.value='';text.textContent=lockScreenMessage();input.focus();return}
      unlockedUserId=userId();hiddenAt=0;const resolve=pendingUnlock;pendingUnlock=null;resolve?.(true);
    };
    input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'').slice(0,6)});
    document.getElementById('localLockSignout').onclick=async()=>{pendingUnlock?.(false);pendingUnlock=null;unlockedUserId=null;hiddenAt=0;await sb.auth.signOut()};
    requestAnimationFrame(()=>input?.focus());
  }

  async function unlockIfNeeded(user=state.user){
    if(!user?.id||!enabled(user.id)){unlockedUserId=user?.id||null;return true}
    if(unlockedUserId===user.id)return true;
    if(pendingUnlock)return new Promise(resolve=>{const prior=pendingUnlock;pendingUnlock=value=>{prior(value);resolve(value)}});
    return new Promise(resolve=>{pendingUnlock=resolve;renderLock()});
  }

  async function setPin(pin){
    const id=userId();if(!id)throw new Error('Нет активного пользователя');
    const previous=readConfig(id),cfg=await createConfig(pin);if(previous&&Number.isFinite(Number(previous.lockAfter)))cfg.lockAfter=Number(previous.lockAfter);writeConfig(id,cfg);unlockedUserId=id;return true;
  }
  async function disablePin(currentPin){
    const id=userId();if(!id)return false;
    if(!await verify(currentPin,id))return false;writeConfig(id,null);unlockedUserId=id;hiddenAt=0;return true;
  }
  function setLockAfter(seconds){const id=userId(),cfg=readConfig(id);if(!cfg)return;cfg.lockAfter=Math.max(0,Number(seconds)||0);writeConfig(id,cfg)}
  function delayOptions(selected){return [[0,'Сразу'],[30,'Через 30 секунд'],[60,'Через 1 минуту'],[300,'Через 5 минут']].map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${label}</option>`).join('')}

  function openSettings(){
    closeModal();const active=enabled(),delay=lockAfter();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal local-lock-settings"><div class="modal-head"><div><h2>Блокировка приложения</h2><p class="quick-amount-context">PIN хранится только на этом устройстве</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="lockSettingsNotice"></div>${active?`<div class="field"><label>Блокировать после сворачивания</label><select id="lockDelay">${delayOptions(delay)}</select></div><form id="lockChangeForm"><div class="field"><label>Текущий PIN</label><input id="lockCurrentPin" type="password" inputmode="numeric" maxlength="6" required></div><div class="field"><label>Новый PIN</label><input id="lockNewPin" type="password" inputmode="numeric" maxlength="6" placeholder="6 цифр" required></div><button class="btn btn-primary btn-wide">Изменить PIN</button></form><div class="local-lock-setting-actions"><button type="button" class="btn btn-soft" id="lockNowBtn">Заблокировать сейчас</button><button type="button" class="btn btn-danger" id="disableLockBtn">Отключить PIN</button></div>`:`<form id="lockEnableForm"><div class="field"><label>Новый PIN</label><input id="lockNewPin" type="password" inputmode="numeric" maxlength="6" placeholder="6 цифр" required></div><div class="field"><label>Повторите PIN</label><input id="lockRepeatPin" type="password" inputmode="numeric" maxlength="6" placeholder="6 цифр" required></div><button class="btn btn-primary btn-wide">Включить PIN</button></form>`}</div></div>`);
    document.getElementById('closeModal').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
    document.querySelectorAll('#modal input[inputmode="numeric"]').forEach(i=>i.addEventListener('input',()=>{i.value=i.value.replace(/\D/g,'').slice(0,6)}));
    if(!active){
      document.getElementById('lockEnableForm').onsubmit=async e=>{e.preventDefault();const pin=document.getElementById('lockNewPin').value,repeat=document.getElementById('lockRepeatPin').value;if(pin!==repeat)return notice('lockSettingsNotice','PIN-коды не совпадают');try{await setPin(pin);notice('lockSettingsNotice','PIN включён','success');setTimeout(()=>{closeModal();renderApp()},350)}catch(err){notice('lockSettingsNotice',err.message)}};
      return;
    }
    document.getElementById('lockDelay').onchange=e=>{setLockAfter(e.target.value);notice('lockSettingsNotice','Время автоблокировки сохранено','success')};
    document.getElementById('lockChangeForm').onsubmit=async e=>{e.preventDefault();const current=document.getElementById('lockCurrentPin').value,next=document.getElementById('lockNewPin').value;if(!await verify(current))return notice('lockSettingsNotice','Неверный текущий PIN');try{await setPin(next);notice('lockSettingsNotice','PIN изменён','success')}catch(err){notice('lockSettingsNotice',err.message)}};
    document.getElementById('disableLockBtn').onclick=async()=>{const current=document.getElementById('lockCurrentPin').value;if(!current)return notice('lockSettingsNotice','Введите текущий PIN');if(!await disablePin(current))return notice('lockSettingsNotice','Неверный текущий PIN');closeModal();renderApp()};
    document.getElementById('lockNowBtn').onclick=()=>{closeModal();unlockedUserId=null;unlockIfNeeded(state.user).then(ok=>{if(ok)renderApp()})};
  }

  function decorate(){
    if(!offerLock())return;
    const list=document.querySelector('.mobile-more-list');if(!list||list.querySelector('#localLockSettings'))return;
    const button=document.createElement('button');button.type='button';button.id='localLockSettings';button.className='nav-item pirate-nav mobile-more-item';button.innerHTML=`<span class="nav-icon nav-more-icon" aria-hidden="true">${enabled()?'🔒':'🔓'}</span><span class="nav-label">Блокировка PIN</span>`;button.onclick=openSettings;list.appendChild(button);
  }

  async function handleVisibility(){
    if(document.hidden){hiddenAt=Date.now();return}
    if(!hiddenAt||!state.user||!enabled())return;
    const elapsed=Date.now()-hiddenAt,delay=lockAfter()*1000;hiddenAt=0;
    if(elapsed<delay)return;
    unlockedUserId=null;
    const ok=await unlockIfNeeded(state.user);if(ok&&state.family)renderApp();
  }

  window.FinanceLocalLock={enabled,unlockIfNeeded,setPin,disablePin,setLockAfter,openSettings,lockNow(){unlockedUserId=null;return unlockIfNeeded(state.user)},reset(){unlockedUserId=null;hiddenAt=0}};
  new MutationObserver(decorate).observe(document.getElementById('app'),{subtree:true,childList:true});
  document.addEventListener('visibilitychange',()=>{handleVisibility().catch(console.error)});
  window.addEventListener('pagehide',()=>{hiddenAt=Date.now()});
  window.addEventListener('DOMContentLoaded',decorate);setTimeout(decorate,0);
})();
