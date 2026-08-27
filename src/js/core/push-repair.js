// Repairs native FCM registration when permission is granted but no token reached Supabase.
(function(){
  if(!window.__FINANCE_NATIVE__)return;
  const TOKEN_KEY='finance.pushToken';
  const WANTED_KEY='finance.pushWanted';
  let attempts=0,timer=null;

  function hasSession(){return Boolean(window.state?.user?.id&&window.state?.family?.id&&!window.state?.user?._offlineLocal)}
  function hasToken(){return Boolean(localStorage.getItem(TOKEN_KEY)||window.FinancePush?.token)}
  function schedule(delay=1200){clearTimeout(timer);timer=setTimeout(run,delay)}

  async function run(){
    if(!window.FinancePush||!hasSession()){if(attempts<12)schedule(1000);return false}
    if(hasToken())return true;
    localStorage.setItem(WANTED_KEY,'1');
    attempts++;
    try{await window.FinancePush.register({ask:true})}catch(_){ }
    if(!hasToken()&&attempts<8)schedule(2500);
    return hasToken();
  }

  const originalMarkup=window.FinancePush?.settingsMarkup?.bind(window.FinancePush);
  const originalBind=window.FinancePush?.bindSettings?.bind(window.FinancePush);
  if(originalMarkup){
    window.FinancePush.settingsMarkup=function(){
      const registered=hasToken();
      return originalMarkup()+`<div class="push-settings" style="margin-top:10px"><div id="pushDeviceState" class="access-state ${registered?'ok':'wait'}">${registered?'Телефон зарегистрирован для push':'Телефон ещё не зарегистрирован для push'}</div><button type="button" class="btn btn-primary" id="pushRepairButton">Перерегистрировать телефон</button></div>`;
    };
  }
  if(originalBind){
    window.FinancePush.bindSettings=function(){
      originalBind();
      const button=document.getElementById('pushRepairButton'),box=document.getElementById('pushDeviceState');
      if(!button)return;
      button.onclick=async()=>{
        button.disabled=true;if(box)box.textContent='Регистрируем телефон…';
        attempts=0;await run();
        setTimeout(()=>{const ok=hasToken();if(box){box.textContent=ok?'Телефон зарегистрирован для push':'FCM-токен не получен. Перезапустите приложение и повторите.';box.className=`access-state ${ok?'ok':'wait'}`}button.disabled=false},3000);
      };
    };
  }

  window.addEventListener('focus',()=>{if(!hasToken()){attempts=0;schedule(400)}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!hasToken()){attempts=0;schedule(400)}});
  schedule(1500);
})();
