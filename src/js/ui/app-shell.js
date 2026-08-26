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
  const overview=state.view==='overview';
  return `<header class="topbar"><div class="title"><h1>Семейный бюджет</h1><p>${overview?'Текущий обзор семейной казны':`${MONTHS[state.month-1]} ${state.year}`}</p></div><div class="top-actions">${overview?currentDateMarkup():`<select class="pill" id="monthSelect">${MONTHS.map((m,i)=>`<option value="${i+1}" ${i+1===+state.month?'selected':''}>${m}</option>`).join('')}</select><select class="pill" id="yearSelect">${availableYears().map(y=>`<option ${y===+state.year?'selected':''}>${y}</option>`).join('')}</select>`}${soundToggleMarkup()}<button class="btn btn-soft" id="logout">Выйти</button></div></header>`;
}

function mobileMoreMarkup(){
  const secondary=NAV_ITEMS.filter(x=>!x.primary);
  return `<div class="mobile-more-backdrop" id="mobileMore" hidden><div class="mobile-more-sheet"><div class="mobile-more-head"><div><b>Ещё</b><small>Дополнительные разделы</small></div><button type="button" class="mobile-more-close" id="mobileMoreClose" aria-label="Закрыть">×</button></div><div class="mobile-more-list">${secondary.map(x=>navMarkup(x,'mobile-more-item')).join('')}</div></div></div>`;
}

function shell(content){
  return `<div class="app-shell"><aside class="sidebar"><div class="side-brand"><div class="brand"><div class="brand-badge">₸</div><span class="brand-text">Казна</span></div></div><nav class="side-nav">${NAV_ITEMS.map(x=>navMarkup(x)).join('')}<button type="button" class="nav-item pirate-nav nav-more" id="navMore"><span class="nav-icon nav-more-icon" aria-hidden="true">•••</span><span class="nav-label">Ещё</span></button></nav><div class="family-crest" aria-label="Семейный герб"><img src="assets/gerb.png" loading="lazy" decoding="async" alt="Герб семьи"></div><div class="side-footer"><div class="side-copy"><b>${esc(state.family.name)}</b><div>Данные в Supabase</div></div></div></aside><main class="main">${header()}${content}</main>${mobileMoreMarkup()}</div>`;
}

async function bindAnalyticsRoute(){
  if(typeof ensureAllActiveTransactionsLoaded==='function'&&state.activeTransactionsHasMore){
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

function renderApp(){
  destroyCharts?.();
  const route=ROUTES[state.view]||ROUTES.overview;
  app.innerHTML=shell(route.page());
  bindCommon();
  route.bind?.();
}

function bindCommon(){
  document.querySelectorAll('.nav-item[data-view]').forEach(x=>x.onclick=()=>{
    const next=x.dataset.view;
    if(next==='overview'){
      const now=new Date();state.year=now.getFullYear();state.month=now.getMonth()+1;
    }
    state.view=next;state.journalLimit=50;renderApp();
  });
  const logout=document.getElementById('logout');if(logout)logout.onclick=()=>sb.auth.signOut();
  const month=document.getElementById('monthSelect');if(month)month.onchange=e=>{state.month=+e.target.value;state.journalLimit=50;renderApp()};
  const year=document.getElementById('yearSelect');if(year)year.onchange=e=>{state.year=+e.target.value;state.journalLimit=50;renderApp()};

  const more=document.getElementById('mobileMore'),open=document.getElementById('navMore'),close=document.getElementById('mobileMoreClose');
  if(open&&more)open.onclick=()=>{more.hidden=false;document.documentElement.classList.add('mobile-more-open')};
  const closeMore=()=>{if(more)more.hidden=true;document.documentElement.classList.remove('mobile-more-open')};
  if(close)close.onclick=closeMore;
  if(more)more.onclick=e=>{if(e.target===more)closeMore()};
}
