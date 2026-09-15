// Plan v2: family event calendar, salon month statistics cleanup and compact operations header.
(function(){
  const PLAN_CONTEXT='plan';
  const WORK_CONTEXT='work';
  const planUi={selectedDate:null,touchStartX:0,touchStartY:0,clickTimer:null,lastKey:'',lastClickAt:0};

  function rawCalendarEntries(){return state.calendarEntries||[]}
  function isPlanEvent(row){return row?.kind==='event'&&row?.calendar_context===PLAN_CONTEXT}
  function planEvents(){return rawCalendarEntries().filter(isPlanEvent)}
  function planEventsOn(dateKey){
    return planEvents().filter(row=>row.entry_date===dateKey)
      .sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  }
  function planOwnPerson(){
    return state.people.find(person=>person.linked_user_id===state.user?.id)
      ||calendarOwnPerson?.()
      ||null;
  }
  function planTypeLabel(type){return type==='birthday'?'День рождения':type==='meeting'?'Встреча':'Без типа'}
  function planTypeIcon(type){return type==='birthday'?'🎂':type==='meeting'?'🤝':'•'}
  function planMonthTitle(){return `${MONTHS[state.month-1]} ${state.year}`}
  function selectedDateForMonth(){
    const current=planUi.selectedDate?calendarDateFromKey(planUi.selectedDate):null;
    if(current&&current.getFullYear()===+state.year&&current.getMonth()+1===+state.month)return planUi.selectedDate;
    const now=new Date();
    const isCurrent=now.getFullYear()===+state.year&&now.getMonth()+1===+state.month;
    planUi.selectedDate=calendarDateKey(isCurrent?now:new Date(+state.year,+state.month-1,1));
    return planUi.selectedDate;
  }
  function shiftPlanMonth(delta){
    const date=new Date(+state.year,+state.month-1+delta,1);
    state.year=date.getFullYear();
    state.month=date.getMonth()+1;
    planUi.selectedDate=calendarDateKey(date);
    renderApp();
  }

  // Plan events are stored in the same calendar table but must not appear in the
  // husband's work calendar or the wife's salon calendar.
  if(typeof calendarPersonEntries==='function'){
    const baseCalendarPersonEntriesPlanV2=calendarPersonEntries;
    calendarPersonEntries=function(personId){
      return baseCalendarPersonEntriesPlanV2(personId).filter(row=>row?.calendar_context!==PLAN_CONTEXT);
    };
  }

  // Wife calendar: personal blocks keep the white indicator and reserve time,
  // but they never affect the monthly work counter or salon financial statistics.
  if(typeof wifeCalendarPage==='function'){
    const baseWifeCalendarPagePlanV2=wifeCalendarPage;
    wifeCalendarPage=function(person){
      const html=baseWifeCalendarPagePlanV2(person);
      const prefix=`${state.year}-${calendarPad(state.month)}-`;
      const appointments=rawCalendarEntries().filter(row=>
        row.person_id===person.id&&row.kind==='appointment'&&row.calendar_context!==PLAN_CONTEXT&&String(row.entry_date||'').startsWith(prefix)
      );
      const total=appointments.reduce((sum,row)=>sum+Number(row.amount||0),0);
      const average=appointments.length?total/appointments.length:0;
      const byDate=new Map();
      appointments.forEach(row=>byDate.set(row.entry_date,(byDate.get(row.entry_date)||0)+1));

      const template=document.createElement('template');
      template.innerHTML=html;
      template.content.querySelectorAll('[data-wife-calendar-date]').forEach(button=>{
        const key=button.dataset.wifeCalendarDate;
        const workCount=byDate.get(key)||0;
        let count=button.querySelector('.calendar-entry-count');
        if(workCount>0){
          if(!count){count=document.createElement('span');count.className='calendar-entry-count';button.appendChild(count)}
          count.textContent=String(workCount);
        }else if(count){
          count.remove();
        }
      });

      template.content.querySelectorAll('.wife-personal-summary-item').forEach(node=>node.remove());
      const summary=template.content.querySelector('.wife-month-summary');
      if(summary){
        const items=[...summary.querySelectorAll('.wife-month-summary-item')];
        const sumItem=items.find(item=>item.querySelector('span')?.textContent.trim()==='Сумма работ');
        if(sumItem)sumItem.querySelector('strong').textContent=money(total);
        if(!summary.querySelector('.wife-average-work-item')){
          const averageItem=document.createElement('div');
          averageItem.className='wife-month-summary-item wife-average-work-item';
          averageItem.innerHTML=`<span>Средняя стоимость</span><strong>${money(average)}</strong>`;
          summary.appendChild(averageItem);
        }
      }
      return template.innerHTML;
    };
  }

  // Operations: the journal remains a pure history screen. Entry and exports are
  // available elsewhere, so remove the three action buttons from the page header.
  if(typeof operationsPage==='function'){
    const baseOperationsPagePlanV2=operationsPage;
    operationsPage=function(){
      const template=document.createElement('template');
      template.innerHTML=baseOperationsPagePlanV2();
      ['newOperation','exportCsv','exportExcel'].forEach(id=>template.content.getElementById(id)?.remove());
      return template.innerHTML;
    };
  }

  function planCalendarGrid(){
    const first=new Date(+state.year,+state.month-1,1);
    const daysInMonth=new Date(+state.year,+state.month,0).getDate();
    const leading=(first.getDay()+6)%7;
    const todayKey=calendarDateKey(new Date());
    const selected=selectedDateForMonth();
    const monthPrefix=`${state.year}-${calendarPad(state.month)}-`;
    const monthEvents=planEvents().filter(row=>String(row.entry_date||'').startsWith(monthPrefix));
    const byDate=new Map();
    monthEvents.forEach(row=>{
      const list=byDate.get(row.entry_date)||[];
      list.push(row);byDate.set(row.entry_date,list);
    });
    const cells=[];
    for(let i=0;i<leading;i++)cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
    for(let day=1;day<=daysInMonth;day++){
      const date=new Date(+state.year,+state.month-1,day);
      const key=calendarDateKey(date);
      const events=byDate.get(key)||[];
      const types=[...new Set(events.map(row=>row.event_type||'other'))];
      const icons=types.map(type=>`<span class="plan-day-type-icon ${type==='other'?'is-generic':''}" aria-hidden="true">${planTypeIcon(type)}</span>`).join('');
      const weekend=date.getDay()===0||date.getDay()===6;
      cells.push(`<button type="button" class="calendar-day plan-calendar-day ${weekend?'is-weekend':''} ${key===todayKey?'is-today':''} ${key===selected?'is-selected':''} ${events.length?'has-entry':''}" data-plan-date="${key}" aria-label="${esc(calendarDateLabel(key))}${events.length?`, мероприятий: ${events.length}`:''}">
        <span class="calendar-day-number">${day}</span>
        ${events.length?`<span class="plan-day-icons">${icons}</span><span class="calendar-entry-count">${events.length}</span>`:''}
      </button>`);
    }
    return cells.join('');
  }

  function planEventList(dateKey){
    const events=planEventsOn(dateKey);
    const own=planOwnPerson();
    if(!events.length)return `<div class="card plan-day-empty"><strong>${esc(calendarDateLabel(dateKey))}</strong><span>Семейных мероприятий на эту дату пока нет.</span><small>Двойной клик по дате в календаре — добавить мероприятие.</small></div>`;
    return `<section class="card plan-day-list-card">
      <div class="plan-day-list-head"><div><span>Мероприятия семьи</span><strong>${esc(calendarDateLabel(dateKey))}</strong></div><b>${events.length}</b></div>
      <div class="plan-day-events">${events.map(row=>{
        const person=byId(state.people,row.person_id);
        const editable=own&&row.person_id===own.id;
        return `<article class="plan-day-event ${row.event_type?`type-${row.event_type}`:'type-other'}">
          <span class="plan-event-icon" aria-hidden="true">${planTypeIcon(row.event_type)}</span>
          <div class="plan-event-copy"><strong>${esc(row.title||'Мероприятие')}</strong><small>${esc(person?.display_name||'Участник')} · ${esc(planTypeLabel(row.event_type))}</small>${row.comment?`<p>${esc(row.comment)}</p>`:''}</div>
          ${editable?`<button type="button" class="btn btn-soft btn-small plan-edit-event" data-plan-edit="${row.id}">Изменить</button>`:''}
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  function planCalendarPanel(){
    const selected=selectedDateForMonth();
    return `<section class="plan-calendar-workspace">
      <section class="card husband-calendar-card plan-calendar-card">
        <div class="calendar-month-toolbar">
          <button type="button" class="calendar-arrow" id="planPrevMonth" aria-label="Предыдущий месяц">‹</button>
          <div><strong>${esc(planMonthTitle())}</strong><small>Один клик — список дел · двойной — добавить мероприятие</small></div>
          <button type="button" class="calendar-arrow" id="planNextMonth" aria-label="Следующий месяц">›</button>
        </div>
        <div class="husband-calendar-swipe" id="planCalendarSwipe">
          <div class="calendar-weekdays">${CALENDAR_WEEKDAYS.map((day,index)=>`<div class="${index>4?'is-weekend':''}">${day}</div>`).join('')}</div>
          <div class="calendar-grid plan-calendar-grid">${planCalendarGrid()}</div>
        </div>
        <div class="calendar-legend plan-calendar-legend"><span><i class="legend-today"></i>Сегодня</span><span><span class="plan-legend-icon">🎂</span>День рождения</span><span><span class="plan-legend-icon">🤝</span>Встреча</span></div>
      </section>
      ${planEventList(selected)}
    </section>`;
  }

  function planTabsV2(){
    const alerts=typeof phase3Upcoming==='function'?phase3Upcoming(3):[];
    const recurringCount=state.recurring.filter(row=>row.active&&row.type==='expense').length;
    const filled=Array.isArray(state.piggyBank)?state.piggyBank.filter(row=>Number(row.amount||0)>0).length:0;
    return `<div class="plan-tabs plan-tabs-v2" role="tablist" aria-label="Дополнительные разделы Плана">
      <button type="button" class="plan-tab ${planSection==='recurring'?'active':''}" data-plan-section="recurring" role="tab" aria-selected="${planSection==='recurring'}"><span>Ежемесячные затраты</span>${alerts.length?`<b class="plan-tab-alert">${alerts.length}</b>`:`<b>${recurringCount}</b>`}</button>
      <button type="button" class="plan-tab ${planSection==='piggy'?'active':''}" data-plan-section="piggy" role="tab" aria-selected="${planSection==='piggy'}"><span>Копилка</span><b>${filled}</b></button>
    </div>`;
  }

  function planSubsectionBack(){
    return `<div class="plan-subsection-back"><button type="button" class="btn btn-soft" id="planBackToCalendar">‹ Плановый календарь</button></div>`;
  }

  function workConflicts(person,dateKey){
    const rows=rawCalendarEntries().filter(row=>row.person_id===person.id&&row.entry_date===dateKey&&row.calendar_context!==PLAN_CONTEXT);
    if(person.label==='wife'){
      return rows.filter(row=>row.kind==='appointment').map(row=>({
        title:`${calendarTimeText(row.start_time)} — ${row.client_name||row.title||'Клиент'}${row.service_name?` (${row.service_name})`:''}`
      }));
    }
    return rows.filter(row=>row.kind==='event').map(row=>({title:row.title||'Мероприятие'}));
  }

  function openConflictWarning(dateKey,person,conflicts){
    const noun=person.label==='wife'?'рабочие записи':'рабочие мероприятия';
    calendarModal(`${calendarModalHead('На этот день уже есть записи',`${calendarDateLabel(dateKey)} · ${person.display_name}`)}
      <div class="plan-conflict-warning">
        <strong>В рабочем календаре уже есть ${noun}:</strong>
        <ul>${conflicts.map(item=>`<li>${esc(item.title)}</li>`).join('')}</ul>
        <p>Можно продолжить и добавить семейное мероприятие в План или отменить добавление.</p>
      </div>
      <div class="calendar-form-actions plan-conflict-actions">
        <button type="button" class="btn btn-soft" id="planConflictCancel">Отмена</button>
        <button type="button" class="btn btn-primary" id="planConflictContinue">Продолжить</button>
      </div>`);
    document.getElementById('planConflictCancel').onclick=closeModal;
    document.getElementById('planConflictContinue').onclick=()=>openPlanEventEditor(dateKey,null,true);
  }

  function openPlanEventEditor(dateKey,editId=null,skipConflict=false){
    const person=planOwnPerson();
    if(!person)return alert('Не удалось определить, кто из членов семьи сейчас пользуется приложением.');
    const edit=editId?planEventsOn(dateKey).find(row=>String(row.id)===String(editId)):null;
    if(edit&&edit.person_id!==person.id)return;
    if(!edit&&!skipConflict){
      const conflicts=workConflicts(person,dateKey);
      if(conflicts.length){openConflictWarning(dateKey,person,conflicts);return}
    }
    calendarModal(`${calendarModalHead(edit?'Изменить мероприятие':'Новое мероприятие',`${calendarDateLabel(dateKey)} · ${person.display_name}`)}
      <div id="planEventNotice"></div>
      <form id="planEventForm" class="calendar-form plan-event-form">
        <div class="plan-event-owner"><span>Чьё мероприятие</span><strong>${esc(person.display_name)}</strong></div>
        <div class="field"><label>Название мероприятия</label><input id="planEventTitle" maxlength="120" required value="${esc(edit?.title||'')}" placeholder="Например: семейный ужин"></div>
        <div class="field"><label>Тип мероприятия <span class="field-hint">необязательно</span></label><select id="planEventType"><option value="" ${!edit?.event_type?'selected':''}>Не выбран</option><option value="birthday" ${edit?.event_type==='birthday'?'selected':''}>🎂 День рождения</option><option value="meeting" ${edit?.event_type==='meeting'?'selected':''}>🤝 Встреча</option></select></div>
        <div class="field"><label>Комментарий</label><textarea id="planEventComment" rows="3" maxlength="500" placeholder="Дополнительные детали">${esc(edit?.comment||'')}</textarea></div>
        <div class="calendar-form-actions">${edit?'<button type="button" class="btn btn-danger" id="deletePlanEvent">Удалить</button>':''}<button type="submit" class="btn btn-primary">${edit?'Сохранить изменения':'Добавить'}</button></div>
      </form>`);

    const remove=document.getElementById('deletePlanEvent');
    if(remove)remove.onclick=async()=>{
      if(!confirm('Удалить это мероприятие из Плана?'))return;
      remove.disabled=true;
      if(await deleteCalendarRow(edit.id,'planEventNotice')){closeModal();renderApp()}else remove.disabled=false;
    };
    document.getElementById('planEventForm').onsubmit=async event=>{
      event.preventDefault();
      notice('planEventNotice','');
      const title=document.getElementById('planEventTitle').value.trim();
      const type=document.getElementById('planEventType').value||null;
      const comment=document.getElementById('planEventComment').value.trim();
      if(!title)return notice('planEventNotice','Укажите название мероприятия.');
      const fields={kind:'event',calendar_context:PLAN_CONTEXT,event_type:type,title,comment:comment||null,amount:null,client_name:null,client_phone:null,service_name:null,start_time:null,duration_minutes:null,is_paid:false};
      const row=await saveCalendarRow({
        id:edit?.id||null,
        createPayload:edit?null:{family_id:state.family.id,person_id:person.id,entry_date:dateKey,created_by:state.user.id,...fields},
        updatePayload:edit?fields:null,
        noticeId:'planEventNotice'
      });
      if(row){planUi.selectedDate=dateKey;closeModal();renderApp()}
    };
    setTimeout(()=>document.getElementById('planEventTitle')?.focus(),0);
  }

  function bindPlanCalendar(){
    document.getElementById('planPrevMonth')?.addEventListener('click',()=>shiftPlanMonth(-1));
    document.getElementById('planNextMonth')?.addEventListener('click',()=>shiftPlanMonth(1));
    document.querySelectorAll('[data-plan-date]').forEach(button=>{
      button.onclick=()=>{
        const key=button.dataset.planDate;
        const now=Date.now();
        if(planUi.lastKey===key&&now-planUi.lastClickAt<340){
          clearTimeout(planUi.clickTimer);planUi.clickTimer=null;planUi.lastKey='';planUi.lastClickAt=0;
          planUi.selectedDate=key;
          openPlanEventEditor(key);
          return;
        }
        clearTimeout(planUi.clickTimer);
        planUi.lastKey=key;planUi.lastClickAt=now;
        planUi.clickTimer=setTimeout(()=>{
          planUi.selectedDate=key;planUi.lastKey='';planUi.lastClickAt=0;renderApp();
        },260);
      };
      button.ondblclick=event=>event.preventDefault();
    });
    document.querySelectorAll('[data-plan-edit]').forEach(button=>button.onclick=()=>{
      const row=planEvents().find(item=>String(item.id)===String(button.dataset.planEdit));
      if(row)openPlanEventEditor(row.entry_date,row.id,true);
    });
    const swipe=document.getElementById('planCalendarSwipe');
    if(swipe){
      swipe.addEventListener('touchstart',event=>{const touch=event.changedTouches[0];planUi.touchStartX=touch.clientX;planUi.touchStartY=touch.clientY},{passive:true});
      swipe.addEventListener('touchend',event=>{
        const touch=event.changedTouches[0],dx=touch.clientX-planUi.touchStartX,dy=touch.clientY-planUi.touchStartY;
        if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.2)return;
        shiftPlanMonth(dx<0?1:-1);
      },{passive:true});
    }
  }

  // Replace the old Goals-based Plan workspace. Goals are no longer reachable or
  // used here; Plan opens on the family month calendar and has only two subpanels.
  if(typeof planPage==='function'&&typeof bindPlan==='function'){
    planSection='calendar';
    planTabsMarkup=planTabsV2;
    planPage=function(){
      if(!['calendar','recurring','piggy'].includes(planSection))planSection='calendar';
      const subtitle=planSection==='calendar'?'Семейные мероприятия и важные даты':planSection==='recurring'?'Регулярные платежи и ежемесячные расходы':'Семейная копилка';
      let panel;
      if(planSection==='recurring')panel=`${planSubsectionBack()}${typeof planRecurringPanel==='function'?planRecurringPanel():''}`;
      else if(planSection==='piggy')panel=`${planSubsectionBack()}${typeof window.piggyBankPanel==='function'?window.piggyBankPanel():''}`;
      else panel=planCalendarPanel();
      return `<div class="page-head plan-page-head"><div><h2 class="page-title">План</h2><div class="page-subtitle">${subtitle}</div></div></div>${planTabsV2()}${panel}`;
    };
    recurringPage=function(){return planPage()};
    bindPlan=function(){
      document.querySelectorAll('[data-plan-section]').forEach(button=>button.onclick=()=>{
        const next=button.dataset.planSection;
        if(!['recurring','piggy'].includes(next))return;
        planSection=planSection===next?'calendar':next;
        renderApp();
      });
      document.getElementById('planBackToCalendar')?.addEventListener('click',()=>{planSection='calendar';renderApp()});
      if(planSection==='recurring')bindRecurring?.();
      else if(planSection==='piggy')window.bindPiggyBank?.();
      else bindPlanCalendar();
    };
  }

  window.FinancePlanCalendar={events:planEvents,openEvent:openPlanEventEditor,selected:()=>planUi.selectedDate};
})();
