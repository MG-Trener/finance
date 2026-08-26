// Central application shell, routing and common bindings.
const NAV_ITEMS=[
  {view:'overview',label:'Обзор',icon:'compass',primary:true},
  {view:'operations',label:'Операции',icon:'journal',primary:true},
  {view:'analytics',label:'Аналитика',icon:'map',primary:true},
  {view:'budgets',label:'Бюджеты',icon:'chest',primary:true},
  {view:'goals',label:'Цели',icon:'chest',primary:false},
  {view:'recurring',label:'Регулярные',icon:'hourglass',primary:false},
  {view:'categories',label:'Категории',icon:'tags',primary:false},
  {view:'access',label:'Доступ',icon:'key',primary:false}
];
const APK_DOWNLOAD_URL='https://github.com/MG-Trener/finance/releases/download/latest-apk/family-treasury.apk';

function navMarkup(item,extra=''){
  const due=item.view==='recurring'&&typeof phase3Upcoming==='function'?phase3Upcoming(3):[];
  const alert=due.length>0;
  return `<button type="button" class="nav-item pirate-nav ${item.primary?'nav-primary':'nav-secondary'} ${state.view===item.view?'active':''} ${alert?'payment-alert':''} ${extra}" data-view="${item.view}"><span class="nav-icon pirate-icon icon-${item.icon}" aria-hidden="true"></span><span class="nav-label">${item.label}</span>${alert?`<span class="nav-badge pirate-alert" title="Платежи в ближайшие 3 дня">${due.length}</span>`:''}</button>`;
}

function soundToggleMarkup(){
  const enabled=localStorage.getItem('finance.uiSounds')!=='0';
  const label=enabled?'Звуки включены':'Звуки выключены';
  return `<button class="btn btn-soft sound-toggle" id="soundToggle" title="${label}" aria-label="${label}">${enabled?'🔊':'🔇'}</button>`;
}

function currentDateMarkup(){
  const now=new Date(),day=String(now.getDate()).padStart(2,'0');
  const text=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  return `<div class="current-date-info" aria-label="Текущая дата"><div class="date-medallion">${day}</div><div><span>Сегодня</span><b>${esc(text)}</b></div></div>`;
}

function availableYears(){
  const first=2026,current=new Date().getFullYear(),last=Math.max(first+6,current+5,+state.year||first);
  return Array.from({length:last-first+1},(_,i)=>first+i);
}

function header(){
  const overview=state.view==='overview',connection=window.FinanceOffline?.statusMarkup?.()||'',authState=window.FinanceOfflineSession?.statusMarkup?.()||'';
  return `<header class="topbar"><div class="title"><h1>Семейный бюджет</h1><p>${overview?'Текущий обзор семейной казны':`${MONTHS[state.month-1]} ${state.year}`}</p></div><div class="top-actions">${overview?currentDateMarkup():`<select class="pill" id="monthSelect">${MONTHS.map((m,i)=>`<option value="${i+1}" ${i+1===+state.month?'selected':''}>${m}</option>`).join('')}</select><select class="pill" id="yearSelect">${availableYears().map(y=>`<option ${y===+state.year?'selected':''}>${y}</option>`).join('')}</select>`}${authState}${connection}${soundToggleMarkup()}<button class="btn btn-soft" id="logout">Выйти</button></div></header>`;
}

function desktopApkDownloadMarkup(){
  return `<a class="crest-apk-download" href="${APK_DOWNLOAD_URL}" target="_blank" rel="noopener" aria-label="Скачать последнюю версию Семейной казны для Android"><span class="crest-apk-icon" aria-hidden="true">📱</span><span><b>Скачать Android</b><small>Последняя версия APK</small></span></a>`;
}

function mobileUpdateMarkup(){
  const updater=window.FinanceAppUpdate,native=Boolean(window.__FINANCE_NATIVE__),available=Boolean(updater?.available);
  const label=updater?.label||(native?'Версия приложения':'Скачать Android APK');
  const detail=updater?.detail||(native?'Проверка обновлений выполняется автоматически':'Последняя версия приложения');
  return `<a class="mobile-update-notice ${native?'native-update':'web-apk-download'} ${available?'has-update':''}" href="${updater?.downloadUrl||APK_DOWNLOAD_URL}" target="_blank" rel="noopener" data-app-update-link aria-label="${esc(label)}. ${esc(detail)}"><span class="mobile-update-icon" aria-hidden="true">${available?'⬆️':'📱'}</span><span class="mobile-update-copy"><b data-app-update-label>${esc(label)}</b><small data-app-update-detail>${esc(detail)}</small></span><span class="mobile-update-pill" data-app-update-badge ${available?'':'hidden'}>NEW</span></a>`;
}

function shell(content){
  const local=window.FinanceOfflineSession?.isLocalSession?.();
  return `<div class="app-shell"><aside class="sidebar"><div class="side-brand"><div class="brand"><div class="brand-badge">₸</div><span class="brand-text">Казна</span></div></div><nav class="side-nav" aria-label="Разделы приложения">${NAV_ITEMS.map(x=>navMarkup(x)).join('')}</nav><div class="family-crest" aria-label="Семейный герб"><img src="assets/gerb.png" loading="lazy" decoding="async" alt="Герб семьи"></div>${desktopApkDownloadMarkup()}<div class="side-footer"><div class="side-copy"><b>${esc(state.family.name)}</b><div>${local?'Локальная копия · нужна авторизация для синхронизации':'Данные в Supabase'}</div></div></div></aside><main class="main">${header()}${content}</main>${mobileUpdateMarkup()}</div>`;
}

async function bindAnalyticsRoute(){
  if(typeof ensureAllActiveTransactionsLoaded==='function'&&state.activeTransactionsHasMore&&!state.user?._offlineLocal){
    try{
      const added=await ensureAllActiveTransactionsLoaded();
      if(added&&state.view==='analytics'){renderApp();return}
    }catch(error){
      console.error('Не удалось загрузить полную историю для аналитики',error);
    }
  }
  if(typeof ensureChartJs==='function')await ensureChartJs();
  drawAnalytics?.();
}

const ROUTES={
  overview:{page:()=>overviewPage(),bind:()=>bindOverview?.()},
  operations:{page:()=>operationsPage(),bind:()=>bindOperations?.()},
  categories:{page:()=>categoriesPage(),bind:()=>bindCategories?.()},
  analytics:{page:()=>analyticsPage(),bind:()=>{bindAnalyticsRoute()}},
  budgets:{page:()=>budgetsPage(),bind:()=>bindBudgets?.()},
  goals:{page:()=>goalsPage(),bind:()=>bindGoals?.()},
  recurring:{page:()=>recurringPage(),bind:()=>bindRecurring?.()},
  access:{page:()=>accessPage(),bind:()=>bindAccess?.()}
};

function releaseMobileScrollLock(){
  document.documentElement.classList.remove('mobile-more-open');
  const more=document.getElementById('mobileMore');
  if(more)more.hidden=true;
}

function keepActiveMobileNavVisible(){
  const nav=document.querySelector('.side-nav'),active=nav?.querySelector('.nav-item.active[data-view]');
  if(!nav||!active)return;
  requestAnimationFrame(()=>{
    if(nav.scrollWidth<=nav.clientWidth)return;
    const left=active.offsetLeft-(nav.clientWidth-active.offsetWidth)/2;
    nav.scrollTo({left:Math.max(0,left),behavior:'smooth'});
  });
}

function renderApp(){
  releaseMobileScrollLock();
  destroyCharts?.();
  const route=ROUTES[state.view]||ROUTES.overview;
  app.innerHTML=shell(route.page());
  bindCommon();
  route.bind?.();
  focusAmountDesktop?.();
  window.FinanceOffline?.updateStatus?.();
  window.FinanceOfflineSession?.bindStatus?.();
  window.FinanceAppUpdate?.refreshUi?.();
  keepActiveMobileNavVisible();
  window.FinanceOffline?.persistSnapshotSoon?.();
}

function bindCommon(){
  document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.onclick=()=>{
    const next=x.dataset.view;
    releaseMobileScrollLock();
    if(next==='overview'){
      const now=new Date();state.year=now.getFullYear();state.month=now.getMonth()+1;
    }
    state.view=next;state.journalLimit=50;renderApp();
  });
  const logout=document.getElementById('logout');if(logout)logout.onclick=async()=>{
    if(window.FinanceOfflineSession?.isLocalSession?.()){
      window.FinanceOfflineSession.clear();window.FinanceLocalLock?.reset?.();state.user=null;state.family=null;renderAuth();return;
    }
    await sb.auth.signOut();
  };
  const month=document.getElementById('monthSelect');if(month)month.onchange=e=>{state.month=+e.target.value;state.journalLimit=50;renderApp()};
  const year=document.getElementById('yearSelect');if(year)year.onchange=e=>{state.year=+e.target.value;state.journalLimit=50;renderApp()};
  document.querySelectorAll('[data-app-update-link]').forEach(updateLink=>{
    if(window.__FINANCE_NATIVE__)updateLink.onclick=e=>window.FinanceAppUpdate?.openDownload?.(e);
  });
}
