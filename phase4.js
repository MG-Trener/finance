// Phase 4: turn Operations into a real transaction journal instead of a second overview.
function journalFilteredTx(){
  const f=state.filters||(state.filters={});
  let tx=[...state.transactions];
  const period=f.period||'month';
  if(period==='month')tx=tx.filter(x=>{const d=new Date(x.occurred_at);return d.getFullYear()===+state.year&&d.getMonth()+1===+state.month});
  if(period==='year')tx=tx.filter(x=>new Date(x.occurred_at).getFullYear()===+state.year);
  if(f.person&&f.person!=='all')tx=tx.filter(x=>x.person_id===f.person);
  if(f.type&&f.type!=='all')tx=tx.filter(x=>x.type===f.type);
  if(f.category&&f.category!=='all')tx=tx.filter(x=>x.category_id===f.category);
  const q=(f.search||'').trim().toLowerCase();
  if(q)tx=tx.filter(x=>{
    const hay=[catName(x.category_id),subName(x.subcategory_id),personName(x.person_id),x.description||'',String(x.amount)].join(' ').toLowerCase();
    return hay.includes(q)
  });
  const sort=f.sort||'newest';
  tx.sort((a,b)=>{
    if(sort==='oldest')return new Date(a.occurred_at)-new Date(b.occurred_at);
    if(sort==='amount-desc')return Number(b.amount)-Number(a.amount);
    if(sort==='amount-asc')return Number(a.amount)-Number(b.amount);
    return new Date(b.occurred_at)-new Date(a.occurred_at)
  });
  return tx
}

shell=function(content){return `<div class="app-shell"><aside class="sidebar"><div class="side-brand"><div class="brand"><div class="brand-badge">₸</div><span class="brand-text">Казна</span></div></div><nav class="side-nav">${nav('overview','⌂','Обзор')}${nav('operations','☷','Журнал')}${nav('analytics','⌁','Аналитика')}${nav('budgets','◎','Бюджеты')}${nav('recurring','↻','Регулярные')}${nav('categories','▦','Категории')}</nav><div class="side-footer"><div class="side-copy"><b>${esc(state.family.name)}</b><div>Данные в Supabase</div></div></div></aside><main class="main">${header()}${content}</main></div>`}

operationsPage=function(){
  const f=state.filters||(state.filters={});
  if(!f.period)f.period='month';
  if(!f.sort)f.sort='newest';
  if(f.search==null)f.search='';
  const tx=journalFilteredTx();
  const expense=tx.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount),0);
  const income=tx.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount),0);
  return `<div class="page-head journal-head"><div><h2 class="page-title">Журнал операций</h2><div class="page-subtitle">Полная история доходов и расходов. Здесь удобно искать, фильтровать, редактировать и удалять записи.</div></div><button class="btn btn-primary" id="newOperation">+ Новая операция</button></div>
  <div class="card journal-toolbar">
    <div class="journal-search"><span>⌕</span><input id="journalSearch" value="${esc(f.search)}" placeholder="Поиск по категории, комментарию, человеку или сумме"></div>
    <div class="journal-filters">
      <select id="filterPeriod"><option value="month" ${f.period==='month'?'selected':''}>${MONTHS[state.month-1]} ${state.year}</option><option value="year" ${f.period==='year'?'selected':''}>Весь ${state.year} год</option><option value="all" ${f.period==='all'?'selected':''}>За всё время</option></select>
      <select id="filterPerson"><option value="all">Все участники</option>${state.people.map(p=>`<option value="${p.id}" ${f.person===p.id?'selected':''}>${esc(p.display_name)}</option>`).join('')}</select>
      <select id="filterType"><option value="all">Доходы и расходы</option><option value="expense" ${f.type==='expense'?'selected':''}>Только расходы</option><option value="income" ${f.type==='income'?'selected':''}>Только доходы</option></select>
      <select id="filterCategory"><option value="all">Все категории</option>${state.categories.map(c=>`<option value="${c.id}" ${f.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="filterSort"><option value="newest" ${f.sort==='newest'?'selected':''}>Сначала новые</option><option value="oldest" ${f.sort==='oldest'?'selected':''}>Сначала старые</option><option value="amount-desc" ${f.sort==='amount-desc'?'selected':''}>Сумма: больше → меньше</option><option value="amount-asc" ${f.sort==='amount-asc'?'selected':''}>Сумма: меньше → больше</option></select>
      <button class="btn btn-soft btn-small" id="resetJournal">Сбросить</button>
    </div>
  </div>
  <div class="journal-meta"><span>Найдено: <b>${tx.length}</b></span><span class="positive">Доходы ${money(income)}</span><span class="negative">Расходы ${money(expense)}</span></div>
  <div class="card journal-card">${journalTable(tx)}</div>`
}

function journalTable(tx){
  if(!tx.length)return `<div class="empty">По выбранным условиям операций нет</div>`;
  return `<div class="journal-table"><div class="journal-row journal-header"><div>Дата</div><div>Кто</div><div>Категория</div><div>Комментарий</div><div class="journal-amount">Сумма</div><div></div></div>${tx.map(x=>`<div class="journal-row"><div class="journal-date"><b>${new Date(x.occurred_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'})}</b><small>${new Date(x.occurred_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</small></div><div><span class="journal-person">${esc(personName(x.person_id))}</span></div><div><b>${esc(catName(x.category_id))}</b>${subName(x.subcategory_id)?`<small>${esc(subName(x.subcategory_id))}</small>`:''}</div><div class="journal-comment">${x.description?esc(x.description):'<span class="muted">—</span>'}</div><div class="journal-amount ${x.type==='income'?'positive':'negative'}">${x.type==='income'?'+':'−'} ${money(x.amount)}</div><div class="tx-actions journal-actions"><button class="icon-btn editTx" data-id="${x.id}" title="Редактировать">✎</button><button class="icon-btn deleteTx" data-id="${x.id}" title="Удалить">×</button></div></div>`).join('')}</div>`
}

bindOperations=function(){
  const rerender=()=>renderApp();
  document.getElementById('filterPeriod').onchange=e=>{state.filters.period=e.target.value;rerender()};
  document.getElementById('filterPerson').onchange=e=>{state.filters.person=e.target.value;rerender()};
  document.getElementById('filterType').onchange=e=>{state.filters.type=e.target.value;rerender()};
  document.getElementById('filterCategory').onchange=e=>{state.filters.category=e.target.value;rerender()};
  document.getElementById('filterSort').onchange=e=>{state.filters.sort=e.target.value;rerender()};
  let timer;
  document.getElementById('journalSearch').oninput=e=>{clearTimeout(timer);const value=e.target.value;timer=setTimeout(()=>{state.filters.search=value;rerender()},220)};
  document.getElementById('resetJournal').onclick=()=>{state.filters={person:'all',type:'all',category:'all',period:'month',sort:'newest',search:''};rerender()};
  document.getElementById('newOperation').onclick=()=>{state.view='overview';renderApp();setTimeout(()=>{document.querySelector('.entry-card')?.scrollIntoView({behavior:'smooth'});document.getElementById('amount')?.focus()},0)};
  bindTxButtons()
}
