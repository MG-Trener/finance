// Monthly recurring expenses used by the rebuilt Plan section.
let planSection='calendar';

function recurringFrequencyLabel(value){return value==='weekly'?'Еженедельно':value==='yearly'?'Ежегодно':'Ежемесячно'}

recurringRow=function(r){
  const info=phase3DueDate(r),due=info?phase3DueText(info):'';
  return `<div class="recurring-row recurring-row-v3 ${phase3DueClass(info)}"><div><div class="recurring-title"><b>${esc(r.description||catName(r.category_id))}${r._offline?'<span class="offline-row-badge">Ожидает синхронизации</span>':''}</b>${r.active&&info?`<span class="due-chip ${phase3DueClass(info)}">${due}</span>`:''}</div><div class="muted plan-row-meta">${esc(personName(r.person_id))} · ${r.type==='expense'?'Расход':'Доход'} · ${recurringFrequencyLabel(r.frequency)} · ${info?info.date.toLocaleDateString('ru-RU'):'дата не задана'} · ${esc(catName(r.category_id))}</div></div><b class="${r.type==='expense'?'negative':'positive'}">${money(r.amount)}</b><div class="tx-actions"><span class="status-chip ${r.active?'on':'off'}">${r.active?'Активен':'Пауза'}</span><button class="btn btn-soft btn-small postRecurring" data-id="${r.id}">Оплачено</button><button class="icon-btn toggleRecurring" data-id="${r.id}" title="${r.active?'Поставить на паузу':'Возобновить'}">${r.active?'Ⅱ':'▶'}</button><button class="icon-btn deleteRecurring" data-id="${r.id}" title="Удалить">×</button></div></div>`;
};

function planRecurringPanel(){
  const expenseCats=state.categories.filter(c=>c.type==='expense');
  const alerts=phase3Upcoming();
  const today=phase3DateValue(new Date());
  const activeCount=state.recurring.filter(r=>r.active&&r.type==='expense').length;
  const monthlyTotal=state.recurring.filter(r=>r.active&&r.type==='expense'&&r.frequency==='monthly').reduce((sum,r)=>sum+Number(r.amount||0),0);
  return `<section class="plan-panel plan-recurring-panel" data-plan-panel="recurring">
    <div class="plan-summary-strip"><div><span>Активных</span><b>${activeCount}</b></div><div><span>Ежемесячно</span><b class="negative">${money(monthlyTotal)}</b></div><div><span>Требуют внимания</span><b class="${alerts.length?'negative':''}">${alerts.length}</b></div></div>
    <div class="plan-workspace">
      <div class="card plan-editor-card"><div class="plan-card-title"><div><span>Новый расход</span><h3>Запланировать расход</h3></div></div><div id="recNotice"></div><form id="recForm" class="quick-form plan-compact-form plan-expense-form"><div class="field"><label>Кто</label><select id="recPerson">${state.people.map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join('')}</select></div><div class="field"><label>Сумма, ₸</label><input id="recAmount" type="number" min="1" required></div><div class="field"><label>Периодичность</label><select id="recFrequency"><option value="monthly" selected>Ежемесячно</option><option value="weekly">Еженедельно</option><option value="yearly">Ежегодно</option></select></div><div class="field"><label>Следующий платёж</label><input id="recNextDate" type="date" value="${today}" required></div><div class="field"><label>Напомнить за, дней</label><input id="recReminderDays" type="number" min="0" max="60" value="3" required></div><div class="field"><label>Категория</label><select id="recCategory">${expenseCats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field full"><label>Комментарий</label><input id="recDescription" placeholder="Например: Интернет"></div><div class="full"><button class="btn btn-primary btn-wide">Добавить в план</button></div></form></div>
      <div class="plan-list-column"><div class="plan-list-head"><div><span>Запланированные расходы</span><b>${state.recurring.filter(r=>r.type==='expense').length}</b></div>${alerts.length?`<small class="negative">${alerts.length} требуют внимания</small>`:''}</div><div class="plan-scroll-list">${alerts.length?`<div class="plan-alerts">${alerts.slice(0,4).map(({r,info})=>`<div class="reminder-card ${phase3DueClass(info)}"><span>${phase3DueText(info)}</span><b>${esc(r.description||catName(r.category_id))}</b><small>${money(r.amount)} · ${esc(personName(r.person_id))}</small></div>`).join('')}</div>`:''}${state.recurring.filter(r=>r.type==='expense').length?state.recurring.filter(r=>r.type==='expense').map(r=>recurringRow(r)).join(''):'<div class="card empty compact-empty">Запланированных расходов пока нет</div>'}</div></div>
    </div>
  </section>`;
}

// Lightweight fallback. plan-calendar.js replaces this with the month calendar
// before the app is first rendered.
function planTabsMarkup(){
  return `<div class="plan-tabs"><button type="button" class="plan-tab active" data-plan-section="recurring"><span>Ежемесячные затраты</span><b>${state.recurring.filter(r=>r.active&&r.type==='expense').length}</b></button></div>`;
}
function planPage(){return `<div class="page-head plan-page-head"><div><h2 class="page-title">План</h2><div class="page-subtitle">Регулярные платежи и ежемесячные расходы</div></div></div>${planTabsMarkup()}${planRecurringPanel()}`}
recurringPage=function(){return planPage()};
function bindPlan(){bindRecurring?.()}
