// Unified planning page: financial goals and recurring payments in one compact workspace.
let planSection='goals';

function recurringFrequencyLabel(value){return value==='weekly'?'Еженедельно':value==='yearly'?'Ежегодно':'Ежемесячно'}

recurringRow=function(r){
  const info=phase3DueDate(r),due=info?phase3DueText(info):'';
  return `<div class="recurring-row recurring-row-v3 ${phase3DueClass(info)}"><div><div class="recurring-title"><b>${esc(r.description||catName(r.category_id))}${r._offline?'<span class="offline-row-badge">Ожидает синхронизации</span>':''}</b>${r.active&&info?`<span class="due-chip ${phase3DueClass(info)}">${due}</span>`:''}</div><div class="muted plan-row-meta">${esc(personName(r.person_id))} · ${r.type==='expense'?'Расход':'Доход'} · ${recurringFrequencyLabel(r.frequency)} · ${info?info.date.toLocaleDateString('ru-RU'):'дата не задана'} · ${esc(catName(r.category_id))}</div></div><b class="${r.type==='expense'?'negative':'positive'}">${money(r.amount)}</b><div class="tx-actions"><span class="status-chip ${r.active?'on':'off'}">${r.active?'Активен':'Пауза'}</span><button class="btn btn-soft btn-small postRecurring" data-id="${r.id}">Оплачено</button><button class="icon-btn toggleRecurring" data-id="${r.id}" title="${r.active?'Поставить на паузу':'Возобновить'}">${r.active?'Ⅱ':'▶'}</button><button class="icon-btn deleteRecurring" data-id="${r.id}" title="Удалить">×</button></div></div>`;
};

function planTabsMarkup(){
  const alerts=typeof phase3Upcoming==='function'?phase3Upcoming(3):[];
  const activeGoals=state.goals.filter(g=>!g.archived).length;
  return `<div class="plan-tabs" role="tablist" aria-label="Разделы плана">
    <button type="button" class="plan-tab ${planSection==='goals'?'active':''}" data-plan-section="goals" role="tab" aria-selected="${planSection==='goals'}"><span>Цели</span><b>${activeGoals}</b></button>
    <button type="button" class="plan-tab ${planSection==='recurring'?'active':''}" data-plan-section="recurring" role="tab" aria-selected="${planSection==='recurring'}"><span>Ежемесячные затраты</span>${alerts.length?`<b class="plan-tab-alert">${alerts.length}</b>`:`<b>${state.recurring.filter(r=>r.active).length}</b>`}</button>
  </div>`;
}

function compactGoalCard(g){
  const p=goalProgress(g),recent=state.goalContributions.filter(x=>x.goal_id===g.id).slice(0,3),contributor=currentGoalContributor();
  return `<article class="card plan-goal-card ${g.archived?'archived':''}">
    <div class="plan-goal-head"><div><h3>${esc(g.name)}${g._offline?'<span class="offline-row-badge">Ожидает синхронизации</span>':''}</h3><div class="muted">${goalDateText(g)}${g.note?` · ${esc(g.note)}`:''}</div></div><b>${money(p.target)}</b></div>
    <div class="goal-progress"><div class="goal-progress-fill" style="width:${p.pct}%"></div></div>
    <div class="plan-goal-stats"><span>Накоплено <b class="positive">${money(p.saved)}</b></span><span>Осталось <b>${money(p.remaining)}</b></span><strong>${p.pct}%</strong></div>
    ${!g.archived?`<form class="goal-contribution-form plan-goal-contribution" data-goal="${g.id}" novalidate><input class="goal-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Пополнить, ₸" aria-label="Сумма пополнения"><input class="goal-note" placeholder="Комментарий" aria-label="Комментарий к пополнению"><button class="btn btn-soft btn-small goal-contribute-btn" type="submit" ${contributor?'':'disabled'}>Внести</button><div class="goal-contribution-notice" aria-live="polite"></div></form>`:''}
    ${recent.length?`<details class="plan-goal-history"><summary>Последние пополнения</summary>${recent.map(goalHistoryRow).join('')}</details>`:''}
    <div class="goal-actions plan-goal-actions">${!g.archived?`<button class="btn btn-soft btn-small goalWithdraw" data-id="${g.id}" ${contributor?'':'disabled'}>Уменьшить</button><button class="btn btn-soft btn-small goalArchive" data-id="${g.id}">В архив</button>`:`<button class="btn btn-soft btn-small goalRestore" data-id="${g.id}">Вернуть</button>`}<button class="btn btn-danger btn-small goalDelete" data-id="${g.id}">Удалить</button></div>
  </article>`;
}

function planGoalsPanel(){
  const active=state.goals.filter(g=>!g.archived),archived=state.goals.filter(g=>g.archived),totalTarget=active.reduce((s,g)=>s+Number(g.target_amount||0),0),totalSaved=active.reduce((s,g)=>s+goalSaved(g.id),0);
  return `<section class="plan-panel plan-goals-panel" data-plan-panel="goals">
    <div class="plan-summary-strip"><div><span>Целей</span><b>${active.length}</b></div><div><span>Накоплено</span><b class="positive">${money(totalSaved)}</b></div><div><span>Осталось</span><b>${money(Math.max(0,totalTarget-totalSaved))}</b></div></div>
    <div class="plan-workspace">
      <div class="card plan-editor-card"><div class="plan-card-title"><div><span>Новая цель</span><h3>Добавить накопление</h3></div></div><div id="goalNotice"></div><form id="goalForm" class="quick-form plan-compact-form"><div class="field full"><label>Название</label><input id="goalName" required placeholder="Например: Отпуск"></div><div class="field"><label>Сумма, ₸</label><input id="goalTarget" type="number" min="1" step="1" required></div><div class="field"><label>Срок</label><input id="goalDate" type="date"></div><div class="field full"><label>Комментарий</label><input id="goalNote" placeholder="Необязательно"></div><div class="full"><button class="btn btn-primary btn-wide">Создать цель</button></div></form></div>
      <div class="plan-list-column"><div class="plan-list-head"><div><span>Текущие цели</span><b>${active.length}</b></div>${archived.length?`<small>В архиве: ${archived.length}</small>`:''}</div><div class="plan-scroll-list">${active.length?active.map(compactGoalCard).join(''):'<div class="card empty compact-empty">Финансовых целей пока нет</div>'}${archived.length?`<details class="plan-archive"><summary>Архив целей · ${archived.length}</summary>${archived.map(compactGoalCard).join('')}</details>`:''}</div></div>
    </div>
  </section>`;
}

function planRecurringPanel(){
  const expenseCats=state.categories.filter(c=>c.type==='expense');
  const alerts=phase3Upcoming();
  const today=phase3DateValue(new Date());
  const activeCount=state.recurring.filter(r=>r.active).length;
  const monthlyTotal=state.recurring.filter(r=>r.active&&r.type==='expense'&&r.frequency==='monthly').reduce((sum,r)=>sum+Number(r.amount||0),0);
  return `<section class="plan-panel plan-recurring-panel" data-plan-panel="recurring">
    <div class="plan-summary-strip"><div><span>Активных</span><b>${activeCount}</b></div><div><span>Ежемесячно</span><b class="negative">${money(monthlyTotal)}</b></div><div><span>Требуют внимания</span><b class="${alerts.length?'negative':''}">${alerts.length}</b></div></div>
    <div class="plan-workspace">
      <div class="card plan-editor-card"><div class="plan-card-title"><div><span>Новый платёж</span><h3>Запланировать расход</h3></div></div><div id="recNotice"></div><form id="recForm" class="quick-form plan-compact-form"><div class="full segmented plan-type-switch"><button type="button" data-rtype="expense" class="active">Расход</button><button type="button" data-rtype="income">Доход</button></div><div class="field"><label>Кто</label><select id="recPerson">${state.people.map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join('')}</select></div><div class="field"><label>Сумма, ₸</label><input id="recAmount" type="number" min="1" required></div><div class="field"><label>Периодичность</label><select id="recFrequency"><option value="monthly" selected>Ежемесячно</option><option value="weekly">Еженедельно</option><option value="yearly">Ежегодно</option></select></div><div class="field"><label>Следующий платёж</label><input id="recNextDate" type="date" value="${today}" required></div><div class="field"><label>Напомнить за, дней</label><input id="recReminderDays" type="number" min="0" max="60" value="3" required></div><div class="field"><label>Категория</label><select id="recCategory">${expenseCats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field full"><label>Комментарий</label><input id="recDescription" placeholder="Например: Интернет"></div><div class="full"><button class="btn btn-primary btn-wide">Добавить в план</button></div></form></div>
      <div class="plan-list-column"><div class="plan-list-head"><div><span>Запланированные платежи</span><b>${state.recurring.length}</b></div>${alerts.length?`<small class="negative">${alerts.length} требуют внимания</small>`:''}</div><div class="plan-scroll-list">${alerts.length?`<div class="plan-alerts">${alerts.slice(0,4).map(({r,info})=>`<div class="reminder-card ${phase3DueClass(info)}"><span>${phase3DueText(info)}</span><b>${esc(r.description||catName(r.category_id))}</b><small>${money(r.amount)} · ${esc(personName(r.person_id))}</small></div>`).join('')}</div>`:''}${state.recurring.length?state.recurring.map(r=>recurringRow(r)).join(''):'<div class="card empty compact-empty">Регулярных платежей пока нет</div>'}</div></div>
    </div>
  </section>`;
}

function planPage(){
  if(state.view==='goals')planSection='goals';
  const subtitle=planSection==='goals'?'Финансовые цели и накопления':'Регулярные платежи и ежемесячные расходы';
  return `<div class="page-head plan-page-head"><div><h2 class="page-title">План</h2><div class="page-subtitle">${subtitle}</div></div></div>${planTabsMarkup()}${planSection==='goals'?planGoalsPanel():planRecurringPanel()}`;
}

recurringPage=function(){return planPage()};

function bindPlan(){
  document.querySelectorAll('[data-plan-section]').forEach(button=>button.onclick=()=>{
    const next=button.dataset.planSection;if(!['goals','recurring'].includes(next)||next===planSection)return;
    planSection=next;
    if(state.view==='goals')state.view='recurring';
    renderApp();
  });
  if(planSection==='goals')bindGoals?.();else bindRecurring?.();
}
