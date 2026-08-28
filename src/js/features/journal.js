// Full transaction journal with search, filters, history and recoverable trash.
function journalFilteredTx(){
  const f=state.filters||(state.filters={});
  let tx=[...(f.trash?state.trashTransactions:state.transactions)];
  const period=f.period||'month';
  if(period==='month')tx=tx.filter(x=>{const d=new Date(x.occurred_at);return d.getFullYear()===+state.year&&d.getMonth()+1===+state.month});
  if(period==='year')tx=tx.filter(x=>new Date(x.occurred_at).getFullYear()===+state.year);
  if(f.person&&f.person!=='all')tx=tx.filter(x=>x.person_id===f.person);
  if(f.type&&f.type!=='all')tx=tx.filter(x=>x.type===f.type);
  if(f.category&&f.category!=='all')tx=tx.filter(x=>x.category_id===f.category);
  const q=(f.search||'').trim().toLowerCase();
  if(q)tx=tx.filter(x=>[catName(x.category_id),subName(x.subcategory_id),personName(x.person_id),x.description||'',String(x.amount)].join(' ').toLowerCase().includes(q));
  const sort=f.sort||'newest';
  tx.sort((a,b)=>{if(sort==='oldest')return new Date(a.occurred_at)-new Date(b.occurred_at);if(sort==='amount-desc')return Number(b.amount)-Number(a.amount);if(sort==='amount-asc')return Number(a.amount)-Number(b.amount);return new Date(b.occurred_at)-new Date(a.occurred_at)});
  return tx;
}

function journalActiveFilterCount(f){let count=0;if((f.period||'month')!=='month')count++;if(f.person&&f.person!=='all')count++;if(f.type&&f.type!=='all')count++;if(f.category&&f.category!=='all')count++;if((f.sort||'newest')!=='newest')count++;return count}
function journalHasRemoteHistory(){return state.filters?.trash?!!state.trashTransactionsHasMore:!!state.activeTransactionsHasMore}

async function permanentlyDeleteTrashTransaction(id,button){
  if(!navigator.onLine)return alert('Для окончательного удаления нужно подключение к интернету.');
  const tx=byId(state.trashTransactions,id);if(!tx)return;
  const label=[catName(tx.category_id),money(tx.amount)].filter(Boolean).join(' · ');
  if(!confirm(`Удалить операцию «${label}» навсегда?\n\nЗапись и её история изменений будут удалены без возможности восстановления.`))return;
  if(button){button.disabled=true;button.textContent='Удаляю…'}
  try{
    const {data,error}=await sb.rpc('purge_family_transaction',{p_transaction_id:id});
    if(error)throw error;
    if(data===false)throw new Error('Операция уже удалена или не найдена.');
    state.trashTransactions=state.trashTransactions.filter(x=>x.id!==id);
    if(typeof uiSound==='function')uiSound('delete');
    renderApp();
  }catch(error){
    if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Удалить навсегда'}
    alert(`Не удалось удалить операцию навсегда: ${error?.message||error}`);
  }
}

async function permanentlyEmptyTransactionTrash(button){
  if(!navigator.onLine)return alert('Для очистки корзины нужно подключение к интернету.');
  if(!state.family?.id)return;
  if(!state.trashTransactions.length&&!state.trashTransactionsHasMore)return alert('Корзина уже пуста.');
  const loaded=state.trashTransactions.length,more=state.trashTransactionsHasMore?' и более ранние записи':'';
  if(!confirm(`Очистить корзину навсегда?\n\nБудут полностью удалены ${loaded?`${loaded} загруженных операций${more}`:'все удалённые операции'} вместе с историей изменений. Восстановить их после очистки будет невозможно.`))return;
  if(button){button.disabled=true;button.textContent='Очищаю…'}
  try{
    const {data,error}=await sb.rpc('purge_family_trash',{p_family_id:state.family.id});
    if(error)throw error;
    state.trashTransactions=[];
    state.trashTransactionsHasMore=false;
    state.journalLimit=50;
    if(typeof uiSound==='function')uiSound('delete');
    renderApp();
  }catch(error){
    if(button&&document.body.contains(button)){button.disabled=false;button.textContent='Очистить корзину'}
    alert(`Не удалось очистить корзину: ${error?.message||error}`);
  }
}

function operationsPage(){
  const f=state.filters||(state.filters={});
  if(!f.period)f.period='month';if(!f.sort)f.sort='newest';if(f.search==null)f.search='';if(f.trash==null)f.trash=false;
  const tx=journalFilteredTx(),shown=tx.slice(0,state.journalLimit||50),expense=tx.filter(x=>x.type==='expense').reduce((a,x)=>a+Number(x.amount),0),income=tx.filter(x=>x.type==='income').reduce((a,x)=>a+Number(x.amount),0),activeFilters=journalActiveFilterCount(f),filtersOpen=!!f.filtersOpen;
  const localMore=tx.length>shown.length,remoteMore=journalHasRemoteHistory();
  const moreLabel=localMore?`Показать ещё ${Math.min(50,tx.length-shown.length)}`:(remoteMore?'Загрузить более ранние операции':'');
  const loadedTotal=f.trash?state.trashTransactions.length:state.transactions.length;
  const trashActions=f.trash&&(state.trashTransactions.length||state.trashTransactionsHasMore)?'<button class="btn btn-danger" id="emptyTransactionTrash">Очистить корзину</button>':'';
  return `<div class="page-head journal-head"><div><h2 class="page-title">${f.trash?'Корзина операций':'Журнал операций'}</h2><div class="page-subtitle">${f.trash?'Удалённые операции можно восстановить или удалить навсегда. Окончательное удаление необратимо.':'Полная история доходов и расходов. Сумму можно исправить прямо в журнале.'}</div></div><div class="journal-head-actions">${f.trash?trashActions:`<button class="btn btn-soft" id="exportCsv">CSV</button><button class="btn btn-soft" id="exportExcel">Excel</button><button class="btn btn-primary" id="newOperation">+ Новая операция</button>`}</div></div>
  <div class="journal-mode-switch"><button class="btn ${!f.trash?'btn-primary':'btn-soft'}" id="showActiveJournal">Операции</button><button class="btn ${f.trash?'btn-primary':'btn-soft'}" id="showTrashJournal">Корзина${state.trashTransactions.length?` (${state.trashTransactions.length}${state.trashTransactionsHasMore?'+':''})`:''}</button></div>
  <div class="card journal-toolbar"><div class="journal-toolbar-top"><div class="journal-search"><span>⌕</span><input id="journalSearch" value="${esc(f.search)}" placeholder="Поиск по категории, комментарию, человеку или сумме"></div><button type="button" class="btn btn-soft journal-filter-toggle" id="toggleJournalFilters" aria-expanded="${filtersOpen?'true':'false'}">Фильтры${activeFilters?` <span class="journal-filter-count">${activeFilters}</span>`:''}</button></div><div class="journal-filters ${filtersOpen?'is-open':''}" id="journalFilters"><select id="filterPeriod"><option value="month" ${f.period==='month'?'selected':''}>${MONTHS[state.month-1]} ${state.year}</option><option value="year" ${f.period==='year'?'selected':''}>Весь ${state.year} год</option><option value="all" ${f.period==='all'?'selected':''}>За всё время</option></select><select id="filterPerson"><option value="all">Все участники</option>${state.people.map(p=>`<option value="${p.id}" ${f.person===p.id?'selected':''}>${esc(p.display_name)}</option>`).join('')}</select><select id="filterType"><option value="all">Доходы и расходы</option><option value="expense" ${f.type==='expense'?'selected':''}>Только расходы</option><option value="income" ${f.type==='income'?'selected':''}>Только доходы</option></select><select id="filterCategory"><option value="all">Все категории</option>${state.categories.map(c=>`<option value="${c.id}" ${f.category===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select><select id="filterSort"><option value="newest" ${f.sort==='newest'?'selected':''}>Сначала новые</option><option value="oldest" ${f.sort==='oldest'?'selected':''}>Сначала старые</option><option value="amount-desc" ${f.sort==='amount-desc'?'selected':''}>Сумма: больше → меньше</option><option value="amount-asc" ${f.sort==='amount-asc'?'selected':''}>Сумма: меньше → больше</option></select><button class="btn btn-soft btn-small" id="resetJournal">Сбросить</button></div></div>
  <div class="journal-meta"><span>Найдено в загруженной истории: <b>${tx.length}</b>${tx.length>shown.length?` · показано ${shown.length}`:''}${remoteMore?` · загружено ${loadedTotal}+`:''}</span><span class="positive">Доходы ${money(income)}</span><span class="negative">Расходы ${money(expense)}</span></div><div class="card journal-card">${journalTable(shown,f.trash)}</div>${moreLabel?`<div class="journal-more-wrap"><button class="btn btn-soft" id="loadMoreJournal" ${state.transactionHistoryLoading?'disabled':''}>${state.transactionHistoryLoading?'Загружаю…':moreLabel}</button></div>`:''}`;
}

function journalTable(tx,trash=false){
  if(!tx.length)return `<div class="empty">${trash?'Корзина пуста':'По выбранным условиям операций нет'}</div>`;
  return `<div class="journal-table"><div class="journal-row journal-header"><div>Дата</div><div>Кто</div><div>Категория</div><div>Комментарий</div><div class="journal-amount">Сумма</div><div></div></div>${tx.map(x=>{
    const amount=`${x.type==='income'?'+':'−'} ${money(x.amount)}`;
    const amountCell=trash?`<div class="journal-amount ${x.type==='income'?'positive':'negative'}">${amount}</div>`:`<button type="button" class="journal-amount journal-amount-edit amount-edit-trigger ${x.type==='income'?'positive':'negative'}" data-id="${x.id}" title="Исправить сумму"><span>${amount}</span><small>Исправить</small></button>`;
    const actions=trash?`<button class="btn btn-soft btn-small historyTx" data-id="${x.id}">История</button><button class="btn btn-primary btn-small restoreTx" data-id="${x.id}">Восстановить</button><button class="btn btn-danger btn-small purgeTx" data-id="${x.id}">Удалить навсегда</button>`:`<button class="btn btn-soft btn-small historyTx" data-id="${x.id}">История</button><button class="btn btn-soft btn-small editTx" data-id="${x.id}">Изменить</button><button class="btn btn-danger btn-small deleteTx" data-id="${x.id}">В корзину</button>`;
    return `<div class="journal-row ${trash?'is-trash':''}" data-id="${x.id}"><div class="journal-date"><b>${new Date(x.occurred_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'})}</b><small>${new Date(x.occurred_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}${trash&&x.deleted_at?` · удалено ${new Date(x.deleted_at).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}`:''}</small></div><div class="journal-person-cell"><span class="journal-person">${esc(personName(x.person_id))}</span></div><div class="journal-category"><b>${esc(catName(x.category_id))}</b>${subName(x.subcategory_id)?`<small>${esc(subName(x.subcategory_id))}</small>`:''}</div><div class="journal-comment">${x.description?esc(x.description):'<span class="muted">Без комментария</span>'}</div>${amountCell}<div class="tx-actions journal-actions">${actions}</div></div>`;
  }).join('')}</div>`;
}

function bindOperations(){
  const rerender=()=>{state.journalLimit=50;renderApp()};
  document.getElementById('showActiveJournal').onclick=()=>{state.filters.trash=false;rerender()};
  document.getElementById('showTrashJournal').onclick=()=>{state.filters.trash=true;state.filters.period='all';rerender()};
  document.getElementById('filterPeriod').onchange=e=>{state.filters.period=e.target.value;rerender()};document.getElementById('filterPerson').onchange=e=>{state.filters.person=e.target.value;rerender()};document.getElementById('filterType').onchange=e=>{state.filters.type=e.target.value;rerender()};document.getElementById('filterCategory').onchange=e=>{state.filters.category=e.target.value;rerender()};document.getElementById('filterSort').onchange=e=>{state.filters.sort=e.target.value;rerender()};
  const filterToggle=document.getElementById('toggleJournalFilters'),filterPanel=document.getElementById('journalFilters');if(filterToggle&&filterPanel)filterToggle.onclick=()=>{state.filters.filtersOpen=!state.filters.filtersOpen;filterPanel.classList.toggle('is-open',!!state.filters.filtersOpen);filterToggle.setAttribute('aria-expanded',state.filters.filtersOpen?'true':'false')};
  let timer;document.getElementById('journalSearch').oninput=e=>{clearTimeout(timer);const value=e.target.value;timer=setTimeout(()=>{state.filters.search=value;rerender()},220)};
  document.getElementById('resetJournal').onclick=()=>{const trash=!!state.filters.trash;state.filters={person:'all',type:'all',category:'all',period:trash?'all':'month',sort:'newest',search:'',filtersOpen:false,trash};rerender()};
  const newOperation=document.getElementById('newOperation');if(newOperation)newOperation.onclick=()=>{state.view='overview';renderApp();setTimeout(()=>{document.querySelector('.entry-card')?.scrollIntoView({behavior:'smooth'});document.getElementById('amount')?.focus()},0)};
  const emptyTrash=document.getElementById('emptyTransactionTrash');if(emptyTrash)emptyTrash.onclick=()=>permanentlyEmptyTransactionTrash(emptyTrash);
  const csv=document.getElementById('exportCsv');if(csv)csv.onclick=()=>window.FinanceExport?.exportCSV();const xlsx=document.getElementById('exportExcel');if(xlsx)xlsx.onclick=()=>window.FinanceExport?.exportExcel();
  const more=document.getElementById('loadMoreJournal');if(more)more.onclick=async()=>{
    const filtered=journalFilteredTx(),limit=state.journalLimit||50;
    if(filtered.length>limit){state.journalLimit=limit+50;return renderApp()}
    more.disabled=true;more.textContent='Загружаю…';
    try{
      const added=await loadMoreTransactionHistory({trash:!!state.filters.trash,render:false});
      if(added)state.journalLimit=limit+50;
      renderApp();
    }catch(error){
      more.disabled=false;more.textContent='Повторить загрузку';
      alert(`Не удалось загрузить старые операции: ${error?.message||error}`);
    }
  };
  bindTxButtons();
  document.querySelectorAll('.purgeTx').forEach(button=>button.onclick=()=>permanentlyDeleteTrashTransaction(button.dataset.id,button));
}
