// Shared calendar view: switch between spouses and show husband's monthly event register.
(function(){
  if(typeof calendarUi==='undefined'||typeof state==='undefined')return;

  calendarUi.viewPersonId=calendarUi.viewPersonId||null;

  function calendarOwnPerson(){
    return state.people.find(person=>person.linked_user_id===state.user?.id)
      ||byId(state.people,state.selectedPersonId)
      ||state.people[0]
      ||null;
  }

  function calendarViewedPerson(){
    const selected=calendarUi.viewPersonId?byId(state.people,calendarUi.viewPersonId):null;
    if(selected)return selected;
    const own=calendarOwnPerson();
    if(own)calendarUi.viewPersonId=own.id;
    return own;
  }

  // All existing calendar actions use calendarCurrentPerson(), so switching this resolver
  // makes both viewing and editing consistently target the calendar currently on screen.
  calendarCurrentPerson=calendarViewedPerson;

  function calendarPeopleForSwitch(){
    const order={husband:0,wife:1};
    return state.people
      .filter(person=>person.label==='husband'||person.label==='wife')
      .sort((a,b)=>(order[a.label]??9)-(order[b.label]??9));
  }

  function calendarOwnerSwitcher(activePerson){
    const people=calendarPeopleForSwitch();
    if(people.length<2)return '';
    return `<div class="calendar-owner-switch-wrap">
      <div class="calendar-owner-switch" role="group" aria-label="Чей календарь показать">
        ${people.map(person=>{
          const role=person.label==='wife'?'Жена':'Муж';
          const active=person.id===activePerson.id;
          return `<button type="button" class="calendar-owner-option ${active?'is-active':''}" data-calendar-person="${person.id}" aria-pressed="${active?'true':'false'}">
            <span class="calendar-owner-role">${role}</span>
            <small>${esc(person.display_name)}</small>
          </button>`;
        }).join('')}
      </div>
      <span class="calendar-owner-hint">Можно смотреть записи друг друга</span>
    </div>`;
  }

  function husbandMonthEvents(person){
    const monthPrefix=`${state.year}-${calendarPad(state.month)}-`;
    return calendarPersonEntries(person.id)
      .filter(row=>row.kind==='event'&&String(row.entry_date||'').startsWith(monthPrefix))
      .sort((a,b)=>String(a.entry_date).localeCompare(String(b.entry_date))||String(a.created_at||'').localeCompare(String(b.created_at||'')));
  }

  function husbandEventDateLabel(key){
    const date=calendarDateFromKey(key);
    if(Number.isNaN(date.getTime()))return '';
    const day=date.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
    const weekday=date.toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','');
    return `${day}, ${weekday}`;
  }

  function husbandMonthlyEventsMarkup(person){
    const events=husbandMonthEvents(person);
    return `<section class="card husband-month-events">
      <div class="husband-month-events-title">
        <div><h3>События за ${esc(calendarMonthTitle())}</h3><p>Все записи выбранного месяца в одном списке.</p></div>
        <span class="husband-month-events-count">${events.length}</span>
      </div>
      ${events.length?`<div class="husband-month-events-table">
        <div class="husband-month-events-head" aria-hidden="true"><span>Дата</span><span>Название</span><span>Сумма</span><span>Комментарий</span></div>
        <div class="husband-month-events-body">
          ${events.map(row=>`<button type="button" class="husband-month-event-row" data-husband-month-event="${row.id}" data-husband-month-date="${row.entry_date}" aria-label="Открыть ${esc(row.title||'мероприятие')} за ${esc(husbandEventDateLabel(row.entry_date))}">
            <span class="husband-event-date" data-label="Дата">${esc(husbandEventDateLabel(row.entry_date))}</span>
            <span class="husband-event-title" data-label="Название">${esc(row.title||'Мероприятие')}</span>
            <span class="husband-event-amount" data-label="Сумма">${row.amount!=null&&row.amount!==''?money(row.amount):'—'}</span>
            <span class="husband-event-comment" data-label="Комментарий">${row.comment?esc(row.comment):'—'}</span>
          </button>`).join('')}
        </div>
      </div>`:`<div class="husband-month-events-empty">В ${esc(MONTHS[state.month-1].toLowerCase())} мероприятий пока нет. Нажмите на дату в календаре, чтобы добавить запись.</div>`}
    </section>`;
  }

  function injectCalendarExtras(html,person,{husbandList=false}={}){
    const headMarker='<div class="page-head calendar-page-head">';
    let result=html.replace(headMarker,`${calendarOwnerSwitcher(person)}${headMarker}`);
    if(husbandList){
      const list=husbandMonthlyEventsMarkup(person);
      result=result.replace(/<\/div>\s*$/,`${list}</div>`);
    }
    return result;
  }

  const baseHusbandCalendarPage=husbandCalendarPage;
  husbandCalendarPage=function(person){
    return injectCalendarExtras(baseHusbandCalendarPage(person),person,{husbandList:true});
  };

  const baseWifeCalendarPage=wifeCalendarPage;
  wifeCalendarPage=function(person){
    return injectCalendarExtras(baseWifeCalendarPage(person),person);
  };

  function bindCalendarOwnerSwitcher(){
    document.querySelectorAll('[data-calendar-person]').forEach(button=>{
      button.onclick=()=>{
        const personId=button.dataset.calendarPerson;
        if(!personId||personId===calendarUi.viewPersonId)return;
        calendarUi.viewPersonId=personId;
        calendarUi.selectedDate=null;
        renderApp();
        scrollOverviewTop?.();
      };
    });
  }

  function bindHusbandMonthlyEvents(){
    document.querySelectorAll('[data-husband-month-event]').forEach(button=>{
      button.onclick=()=>openHusbandDay(button.dataset.husbandMonthDate,button.dataset.husbandMonthEvent);
    });
  }

  const baseBindHusbandCalendar=bindHusbandCalendar;
  bindHusbandCalendar=function(){
    baseBindHusbandCalendar();
    bindCalendarOwnerSwitcher();
    bindHusbandMonthlyEvents();
  };

  const baseBindWifeCalendar=bindWifeCalendar;
  bindWifeCalendar=function(){
    baseBindWifeCalendar();
    bindCalendarOwnerSwitcher();
  };

  // Opening the Calendar section always starts on the signed-in person's calendar.
  // Switching months or pressing "Сегодня" inside a spouse calendar does not change owner.
  const sharedCalendarBaseBindCommon=bindCommon;
  bindCommon=function(){
    sharedCalendarBaseBindCommon();
    const calendarNav=document.querySelector('.nav-item[data-view="calendar"]');
    if(calendarNav)calendarNav.onclick=()=>{
      releaseMobileScrollLock?.();
      calendarUi.viewPersonId=calendarOwnPerson()?.id||null;
      resetCalendarToToday();
      state.view='calendar';
      state.journalLimit=50;
      renderApp();
      scrollOverviewTop?.();
    };
  };
})();
