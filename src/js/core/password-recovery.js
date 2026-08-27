// Password recovery for Supabase email/password accounts.
(function(){
  const RECOVERY_PARAM='password-recovery';
  const baseRenderAuth=window.renderAuth;

  function recoveryBaseUrl(){
    return window.__FINANCE_NATIVE__?'https://mg-trener.github.io/finance/':location.origin+location.pathname;
  }

  function recoveryRedirectUrl(){
    const url=new URL(recoveryBaseUrl());
    url.searchParams.set(RECOVERY_PARAM,'1');
    return url.toString();
  }

  function hasIntent(){
    return new URLSearchParams(location.search).get(RECOVERY_PARAM)==='1';
  }

  function clearRecoveryUrl(){
    try{
      const url=new URL(location.href);
      url.searchParams.delete(RECOVERY_PARAM);
      url.hash='';
      history.replaceState({},'',url.pathname+url.search);
    }catch(_){ }
  }

  function authFrame(inner){
    return `<div class="auth-shell"><section class="auth-hero"><div class="brand"><div class="brand-badge">₸</div><span>Семейная казна</span></div><div><h1>Семейные деньги под вашим флагом.</h1><p>Доступ только для участников этой семьи.</p></div><small style="color:#b7a88d">Закрытая семейная казна</small></section><section class="auth-card-wrap"><div class="auth-card">${inner}</div></section></div>`;
  }

  function renderRequest(prefill=''){
    app.innerHTML=authFrame(`<h2>Восстановление пароля</h2><p class="invite-auth-note">Укажите email аккаунта. Мы отправим ссылку для создания нового пароля.</p><div id="passwordRecoveryNotice"></div><form id="passwordRecoveryForm"><div class="field"><label>Email</label><input id="recoveryEmail" type="email" required autocomplete="email" value="${esc(prefill)}"></div><button class="btn btn-primary btn-wide" type="submit">Отправить ссылку</button></form><div class="auth-switch"><button class="link-btn" id="recoveryBack" type="button">Вернуться ко входу</button></div>`);
    document.getElementById('recoveryBack').onclick=()=>window.renderAuth(false);
    document.getElementById('passwordRecoveryForm').onsubmit=async event=>{
      event.preventDefault();
      notice('passwordRecoveryNotice','');
      const email=document.getElementById('recoveryEmail').value.trim();
      const button=event.currentTarget.querySelector('button[type="submit"]');
      button.disabled=true;button.textContent='Отправляем…';
      try{
        const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:recoveryRedirectUrl()});
        if(error)return notice('passwordRecoveryNotice',error.message);
        notice('passwordRecoveryNotice','Если аккаунт с таким email существует, письмо для восстановления уже отправлено. Откройте ссылку из письма и задайте новый пароль.','success');
      }catch(error){
        notice('passwordRecoveryNotice',error?.message||'Не удалось отправить письмо. Проверьте интернет и попробуйте ещё раз.');
      }finally{
        button.disabled=false;button.textContent='Отправить ссылку';
      }
    };
  }

  function renderReset(){
    app.innerHTML=authFrame(`<h2>Новый пароль</h2><p class="invite-auth-note">Придумайте новый пароль для входа в «Семейную казну».</p><div id="passwordResetNotice"></div><form id="passwordResetForm"><div class="field"><label>Новый пароль</label><input id="newPassword" type="password" required minlength="8" autocomplete="new-password"></div><div class="field"><label>Повторите пароль</label><input id="newPasswordRepeat" type="password" required minlength="8" autocomplete="new-password"></div><button class="btn btn-primary btn-wide" type="submit">Сохранить новый пароль</button></form></div>`);
    document.getElementById('passwordResetForm').onsubmit=async event=>{
      event.preventDefault();
      notice('passwordResetNotice','');
      const password=document.getElementById('newPassword').value;
      const repeat=document.getElementById('newPasswordRepeat').value;
      if(password!==repeat)return notice('passwordResetNotice','Пароли не совпадают.');
      if(password.length<8)return notice('passwordResetNotice','Пароль должен содержать не менее 8 символов.');
      const button=event.currentTarget.querySelector('button[type="submit"]');
      button.disabled=true;button.textContent='Сохраняем…';
      try{
        const {error}=await sb.auth.updateUser({password});
        if(error)return notice('passwordResetNotice',error.message);
        notice('passwordResetNotice','Пароль изменён. Сейчас откроется экран входа.','success');
        clearRecoveryUrl();
        setTimeout(async()=>{
          try{await sb.auth.signOut()}catch(_){ }
          state.user=null;state.family=null;
          window.renderAuth(false);
        },900);
      }catch(error){
        notice('passwordResetNotice',error?.message||'Не удалось изменить пароль. Откройте ссылку из письма повторно.');
      }finally{
        button.disabled=false;button.textContent='Сохранить новый пароль';
      }
    };
  }

  window.renderAuth=function(signup=false){
    baseRenderAuth(signup);
    if(signup)return;
    const form=document.getElementById('authForm');
    if(!form||document.getElementById('forgotPassword'))return;
    form.insertAdjacentHTML('afterend','<div class="auth-switch"><button class="link-btn" id="forgotPassword" type="button">Забыли пароль?</button></div>');
    document.getElementById('forgotPassword').onclick=()=>renderRequest(document.getElementById('email')?.value.trim()||'');
  };

  window.FinancePasswordRecovery={renderRequest,renderReset,hasIntent,recoveryRedirectUrl,clearRecoveryUrl};

  sb.auth.onAuthStateChange((event,session)=>{
    if(event!=='PASSWORD_RECOVERY')return;
    state.user=session?.user||state.user;
    setTimeout(()=>renderReset(),0);
  });
})();
