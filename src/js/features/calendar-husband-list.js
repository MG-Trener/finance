// Monthly event register shown under the husband's calendar.
(function(){
  if(typeof husbandCalendarPage!=='function'||typeof bindHusbandCalendar!=='function')return;

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
        <div><h3>События за ${esc(calendarMonthTitle())}</h3><p>Записи выбранного месяца.</p></div>
        <span class="husband-month-events-count" title="Количество событий">${events.length}</span>
      </div>
      ${events.length?`<div class="husband-month-events-table">
        <div class="husband-month-events-head" aria-hidden="true"><span>Дата</span><span>Название</span><span>Сумма</span><span>Комментарий</span></div>
        <div class="husband-month-events-body">
          ${events.map(row=>`<button type="button" class="husband-month-event-row" data-husband-month-event="${row.id}" data-husband-month-date="${row.entry_date}" aria-label="Открыть ${esc(row.title||'мероприятие')} за ${esc(husbandEventDateLabel(row.entry_date))}">
            <span class="husband-event-date">${esc(husbandEventDateLabel(row.entry_date))}</span>
            <span class="husband-event-title">${esc(row.title||'Мероприятие')}</span>
            <span class="husband-event-amount">${row.amount!=null&&row.amount!==''?money(row.amount):'—'}</span>
            <span class="husband-event-comment">${row.comment?esc(row.comment):'—'}</span>
          </button>`).join('')}
        </div>
      </div>`:`<div class="husband-month-events-empty">В ${esc(MONTHS[state.month-1].toLowerCase())} мероприятий пока нет. Нажмите на дату в календаре, чтобы добавить запись.</div>`}
    </section>`;
  }

  const baseHusbandCalendarPageWithMonthlyList=husbandCalendarPage;
  husbandCalendarPage=function(person){
    const html=baseHusbandCalendarPageWithMonthlyList(person);
    return html.replace(/<\/div>\s*$/,`${husbandMonthlyEventsMarkup(person)}</div>`);
  };

  const baseBindHusbandCalendarWithMonthlyList=bindHusbandCalendar;
  bindHusbandCalendar=function(){
    baseBindHusbandCalendarWithMonthlyList();
    document.querySelectorAll('[data-husband-month-event]').forEach(button=>{
      button.onclick=()=>openHusbandDay(button.dataset.husbandMonthDate,button.dataset.husbandMonthEvent);
    });
  };
})();
