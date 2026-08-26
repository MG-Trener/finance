// In-app APK update checker for sideloaded Android builds.
(function(){
  const RELEASE_API='https://api.github.com/repos/MG-Trener/finance/releases/tags/latest-apk';
  const DOWNLOAD_URL='https://github.com/MG-Trener/finance/releases/download/latest-apk/family-treasury.apk';
  const CHECK_INTERVAL=15*60*1000;
  const native=Boolean(window.__FINANCE_NATIVE__);
  const currentBuild=Number(window.__FINANCE_BUILD__||0);
  let checked=false,checking=false,available=false,latestBuild=0,lastError='';

  function cachedLatest(){return Number(localStorage.getItem('finance.latestApkBuild')||0)}
  function applyCached(){
    latestBuild=cachedLatest();
    available=native&&currentBuild>0&&latestBuild>currentBuild;
  }
  function label(){
    if(!native)return 'Скачать Android APK';
    if(available)return 'Обновить приложение';
    if(checking)return 'Проверяю обновление…';
    return currentBuild?`Приложение · версия 1.0.${currentBuild}`:'Версия приложения';
  }
  function detail(){
    if(!native)return 'Установочный файл Android';
    if(available)return `Доступна версия 1.0.${latestBuild}`;
    if(lastError)return 'Не удалось проверить обновление';
    if(checked)return 'Установлена актуальная версия';
    return 'Проверка выполняется автоматически';
  }
  function refreshUi(){
    document.documentElement.classList.toggle('app-update-available',available);
    document.querySelectorAll('[data-app-update-label]').forEach(el=>el.textContent=label());
    document.querySelectorAll('[data-app-update-detail]').forEach(el=>el.textContent=detail());
    document.querySelectorAll('[data-app-update-badge]').forEach(el=>el.hidden=!available);
    document.querySelectorAll('[data-app-update-link]').forEach(el=>{
      el.href=DOWNLOAD_URL;
      el.classList.toggle('has-update',available);
      el.setAttribute('aria-label',available?'Скачать обновление приложения':'Открыть установочный APK');
    });
  }
  async function check({force=false}={}){
    if(!native){refreshUi();return false}
    applyCached();refreshUi();
    if(!navigator.onLine)return available;
    const last=Number(localStorage.getItem('finance.appUpdateCheckedAt')||0);
    if(!force&&last&&Date.now()-last<CHECK_INTERVAL){checked=true;refreshUi();return available}
    if(checking)return available;
    checking=true;lastError='';refreshUi();
    try{
      const response=await fetch(RELEASE_API,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
      if(!response.ok)throw new Error(`GitHub ${response.status}`);
      const release=await response.json();
      const match=String(release?.body||'').match(/Build:\s*(\d+)/i);
      latestBuild=Number(match?.[1]||0);
      if(latestBuild){
        localStorage.setItem('finance.latestApkBuild',String(latestBuild));
        localStorage.setItem('finance.appUpdateCheckedAt',String(Date.now()));
      }
      available=currentBuild>0&&latestBuild>currentBuild;
      checked=true;
    }catch(error){
      lastError=error?.message||String(error);
      applyCached();
    }finally{
      checking=false;refreshUi();
    }
    return available;
  }
  async function openDownload(event){
    event?.preventDefault?.();
    try{
      const browser=window.Capacitor?.Plugins?.Browser;
      if(native&&browser?.open){await browser.open({url:DOWNLOAD_URL});return true}
    }catch(error){console.warn('Не удалось открыть системный браузер для обновления',error)}
    window.open(DOWNLOAD_URL,'_blank','noopener');
    return true;
  }

  window.FinanceAppUpdate={check,refreshUi,openDownload,downloadUrl:DOWNLOAD_URL,get native(){return native},get currentBuild(){return currentBuild},get latestBuild(){return latestBuild},get checked(){return checked},get checking(){return checking},get available(){return available},get label(){return label()},get detail(){return detail()}};
  applyCached();
  window.addEventListener('online',()=>check({force:true}));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check()});
  window.addEventListener('load',()=>setTimeout(()=>check(),900));
})();
