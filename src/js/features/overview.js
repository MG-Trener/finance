// Overview composition: key numbers first, fast entry second, details after.
function phase3BudgetPreview(){const current=state.budgets.filter(b=>b.year===+state.year&&b.month===+state.month);if(!current.length)return `<div class="empty compact-empty">Лимиты пока не заданы</div>`;return current.map(b=>{const spent=periodTx().filter(x=>x.type==='expense'&&x.category_id===b.category_id).reduce((a,x)=>a+Number(x.amount),0);const limit=Number(b.limit_amount)||0;const pct=limit?Math.round(spent/limit*100):0;return{b,spent,limit,pct}}).sort((a,b)=>b.pct-a.pct).slice(0,4).map(x=>`<div class="mini-budget"><div class="mini-budget-head"><span>${esc(catName(x.b.category_id))}</span><b class="${x.pct>100?'negative':x.pct>=80?'warning-text':''}">${x.pct}%</b></div><div class="budget-progress"><div class="budget-fill ${x.pct>100?'over':''}" style="width:${Math.min(100,x.pct)}%"></div></div><small>${money(x.spent)} из ${money(x.limit)}</small></div>`).join('')}

function phase3UpcomingPreview(){const rows=phase3UpcomingAll(10).slice(0,4);if(!rows.length)return `<div class="empty compact-empty">В ближайшие 10 дней платежей нет</div>`;return rows.map(({r,info})=>`<div class="upcoming-row ${phase3DueClass(info)}"><div><b>${esc(r.description||catName(r.category_id))}</b><small>${esc(personName(r.person_id))} · ${info.date.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}</small></div><div class="upcoming-right"><b class="${r.type==='expense'?'negative':'positive'}">${money(r.amount)}</b><span>${phase3DueText(info)}</span></div></div>`).join('')}

function phase3PeopleStrip(){return `<div class="people-compact">${state.people.map(p=>{const s=stats(p.id);return `<div class="person-compact"><div class="person-compact-name"><span class="avatar small-avatar">${p.label==='husband'?'М':'Ж'}</span><div><b>${esc(p.display_name)}</b><small>${p.label==='husband'?'Муж':'Жена'}</small></div></div><div class="person-compact-stat"><span>Доход</span><b class="positive">${money(s.income)}</b></div><div class="person-compact-stat"><span>Расход</span><b class="negative">${money(s.expense)}</b></div><div class="person-compact-stat balance-stat"><span>Баланс</span><b class="${s.balance>=0?'positive':'negative'}">${money(s.balance)}</b></div></div>`}).join('')}</div>`}

function overviewKpis(s,saved){return `<div class="summary-kpis overview-kpis"><div class="summary-kpi primary"><div class="summary-kpi-top"><span>Баланс семьи</span><em><span class="saving-word">Сбережено </span>${saved}%</em></div><b class="${s.balance>=0?'positive':'negative'}">${money(s.balance)}</b></div><div class="summary-kpi income-kpi"><span>Доходы</span><b class="positive">${money(s.income)}</b></div><div class="summary-kpi expense-kpi"><span>Расходы</span><b class="negative">${money(s.expense)}</b></div></div>`}

function overviewDateKey(date){const d=date instanceof Date?date:new Date(date),pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function overviewDateFromKey(key){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key||''));if(!m)return null;const d=new Date(+m[1],+m[2]-1,+m[3]);return Number.isNaN(d.getTime())?null:d}
function overviewSelectedDate(){return overviewDateFromKey(state.overviewDateKey)||new Date()}
function overviewDayTransactions(date=overviewSelectedDate()){const y=date.getFullYear(),m=date.getMonth(),day=date.getDate();return state.transactions.filter(x=>{const d=new Date(x.occurred_at);return d.getFullYear()===y&&d.getMonth()===m&&d.getDate()===day})}
function overviewDayLabel(date){const now=new Date();if(overviewDateKey(date)===overviewDateKey(now))return 'сегодня';return date.toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:date.getFullYear()===now.getFullYear()?undefined:'numeric'})}
function overviewHistorySubtitle(date,tx){return `${tx.length} записей за ${overviewDayLabel(date)}`}
function refreshOverviewHistory(date){
  if(state.view!=='overview')return;
  const selected=date instanceof Date?date:overviewSelectedDate(),tx=overviewDayTransactions(selected),subtitle=document.getElementById('overviewHistorySubtitle'),body=document.getElementById('overviewHistoryList');
  if(subtitle)subtitle.textContent=overviewHistorySubtitle(selected,tx);
  if(body){body.innerHTML=transactionList(tx.slice(0,7),true);bindTxButtons?.()}
}

function overviewPage(){
  const s=stats(),saved=s.income?Math.max(0,Math.round(s.balance/s.income*100)):0,selectedDate=overviewSelectedDate(),dayTx=overviewDayTransactions(selectedDate);
  return `<section class="overview-v4">${overviewKpis(s,saved)}<div class="overview-entry card entry-card"><div class="entry-head"><div><h3>Добавить операцию</h3><p>Сумма, человек и категория. Дата и время уже выставлены автоматически.</p></div><span class="entry-shortcut">Enter — сохранить</span></div><div id="txNotice"></div>${transactionForm()}</div><div class="overview-side"><div class="card overview-last"><div class="entry-head"><div><h3>Последние операции</h3><p id="overviewHistorySubtitle">${overviewHistorySubtitle(selectedDate,dayTx)}</p></div><button class="btn btn-soft btn-small" id="allOperations">Все операции</button></div><div id="overviewHistoryList">${transactionList(dayTx.slice(0,7),true)}</div></div><div class="overview-insights"><div class="card"><div class="entry-head"><div><h3>Бюджеты месяца</h3><p>Самые заполненные лимиты</p></div><button class="text-action" data-go="budgets">Открыть</button></div>${phase3BudgetPreview()}</div><div class="card"><div class="entry-head"><div><h3>Ближайшие платежи</h3><p>Регулярные обязательства</p></div><button class="text-action" data-go="recurring">Открыть</button></div>${phase3UpcomingPreview()}</div></div></div></section><section class="card people-strip-card"><div class="entry-head"><div><h3>Муж и жена</h3><p>Сводка за выбранный месяц</p></div></div>${phase3PeopleStrip()}</section>`;
}

function bindOverview(){
  bindTransactionForm?.();
  bindTxButtons?.();
  const all=document.getElementById('allOperations');if(all)all.onclick=()=>{state.view='operations';state.journalLimit=50;renderApp()};
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{state.view=b.dataset.go;renderApp()});
  if(window.__financeOverviewDateHandler)window.removeEventListener('finance:overview-date-selected',window.__financeOverviewDateHandler);
  window.__financeOverviewDateHandler=e=>{const date=overviewDateFromKey(e.detail?.dateKey);if(date)refreshOverviewHistory(date)};
  window.addEventListener('finance:overview-date-selected',window.__financeOverviewDateHandler);
}
