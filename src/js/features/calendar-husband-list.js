// Monthly event register shown under the husband's calendar.
(function(){
  if(typeof husbandCalendarPage!=='function'||typeof bindHusbandCalendar!=='function'||typeof openHusbandDay!=='function')return;

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

  function husbandEventPhone(row){return String(row?.client_phone||'').trim()}
  function normalizeHusbandPhone(phone){
    const raw=String(phone||'').trim();
    if(!raw)return '';
    const hasPlus=raw.startsWith('+');
    const digits=raw.replace(/\D/g,'');
    return digits?`${hasPlus?'+':''}${digits}`:'';
  }
  function husbandPhoneHref(phone){
    const normalized=normalizeHusbandPhone(phone);
    return normalized?`tel:${normalized}`:'';
  }

  function husbandMonthlyEventsMarkup(person){
    const events=husbandMonthEvents(person);
    return `<section class="card husband-month-events">
      <div class="husband-month-events-title">
        <div><h3>События за ${esc(calendarMonthTitle())}</h3><p>Записи выбранного месяца.</p></div>
        <span class="husband-month-events-count" title="Количество событий">${events.length}</span>
      </div>
      ${events.length?`<div class="husband-month-events-table">
        <div class="husband-month-events-head" aria-hidden="true"><span>Дата</span><span>Название</span><span>Сумма</span><span>Комментарий</span><span>Связь</span></div>
        <div class="husband-month-events-body">
          ${events.map(row=>{
            const phone=husbandEventPhone(row);
            const callHref=husbandPhoneHref(phone);
            return `<div class="husband-month-event-row">
              <button type="button" class="husband-month-event-main" data-husband-month-event="${row.id}" data-husband-month-date="${row.entry_date}" aria-label="Открыть ${esc(row.title||'мероприятие')} за ${esc(husbandEventDateLabel(row.entry_date))}">
                <span class="husband-event-date">${esc(husbandEventDateLabel(row.entry_date))}</span>
                <span class="husband-event-title">${esc(row.title||'Мероприятие')}</span>
                <span class="husband-event-amount">${row.amount!=null&&row.amount!==''?money(row.amount):'—'}</span>
                <span class="husband-event-comment">${row.comment?esc(row.comment):'—'}</span>
              </button>
              ${callHref?`<a class="salon-call-button husband-event-call" href="${callHref}" aria-label="Позвонить по номеру ${esc(phone)}" title="${esc(phone)}"><span aria-hidden="true">☎</span><span>Позвонить</span></a>`:'<span class="husband-event-no-phone">—</span>'}
            </div>`;
          }).join('')}
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

  // The table already has client_phone for the wife's appointments. Reuse the
  // same field for husband events and inject it into the existing editor so no
  // schema change is required.
  const baseSaveCalendarRowWithHusbandPhone=saveCalendarRow;
  saveCalendarRow=async function(options){
    const form=document.getElementById('husbandCalendarForm');
    const phoneInput=document.getElementById('husbandCalendarPhone');
    const husbandEventSave=!!form&&!!phoneInput&&(options?.createPayload?.kind==='event'||options?.updatePayload);
    if(!husbandEventSave)return baseSaveCalendarRowWithHusbandPhone(options);

    const phone=phoneInput.value.trim();
    if(phone&&!normalizeHusbandPhone(phone)){
      notice(options?.noticeId||'calendarNotice','Номер телефона указан неверно.');
      return null;
    }
    return baseSaveCalendarRowWithHusbandPhone({
      ...options,
      createPayload:options.createPayload?{...options.createPayload,client_phone:phone||null}:options.createPayload,
      updatePayload:options.updatePayload?{...options.updatePayload,client_phone:phone||null}:options.updatePayload
    });
  };

  function bindHusbandPhoneAction(){
    const input=document.getElementById('husbandCalendarPhone');
    const action=document.getElementById('husbandCalendarCall');
    if(!input||!action)return;
    const update=()=>{
      const href=husbandPhoneHref(input.value);
      action.dataset.phoneHref=href;
      action.disabled=!href;
      action.classList.toggle('is-disabled',!href);
    };
    input.addEventListener('input',update);
    action.onclick=()=>{
      const href=action.dataset.phoneHref;
      if(href)window.location.href=href;
    };
    update();
  }

  const baseOpenHusbandDayWithPhone=openHusbandDay;
  openHusbandDay=function(dateKey,editId=null){
    baseOpenHusbandDayWithPhone(dateKey,editId);
    const form=document.getElementById('husbandCalendarForm');
    if(!form)return;
    const person=calendarCurrentPerson();
    const edit=editId&&person?calendarEntriesOn(person.id,dateKey,'event').find(row=>row.id===editId):null;
    const comment=document.getElementById('calendarComment')?.closest('.field');
    if(!comment)return;
    const field=document.createElement('div');
    field.className='field husband-phone-field';
    field.innerHTML=`<label>Контактный телефон <span class="field-hint">необязательно</span></label><div class="salon-phone-control husband-phone-control"><input id="husbandCalendarPhone" type="tel" maxlength="40" inputmode="tel" value="${esc(husbandEventPhone(edit))}" placeholder="+7 700 000 00 00" autocomplete="tel"><button type="button" class="btn btn-soft salon-call-form-button husband-call-form-button" id="husbandCalendarCall"><span aria-hidden="true">☎</span> Позвонить</button></div>`;
    comment.before(field);
    bindHusbandPhoneAction();
  };
})();
