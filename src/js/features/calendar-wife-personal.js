// Personal blocks in wife's salon calendar. Personal entries share the same
// time grid with client appointments and therefore participate in overlap checks.
(function(){
  if(typeof wifeCalendarPage!=='function'||typeof bindWifeCalendar!=='function'||typeof openSalonAppointment!=='function')return;

  const DAY_START=7*60;
  const DAY_END=22*60;
  const MAX_DURATION=300;

  function isTimedEntry(row){return row?.kind==='appointment'||row?.kind==='personal'}
  function timedEntries(personId,dateKey){
    return calendarPersonEntries(personId)
      .filter(row=>row.entry_date===dateKey&&isTimedEntry(row))
      .sort((a,b)=>calendarMinutes(a.start_time)-calendarMinutes(b.start_time));
  }
  function entryById(personId,dateKey,id){
    const key=String(id??'');
    return timedEntries(personId,dateKey).find(row=>String(row?.id??'')===key)||null;
  }
  function availableDuration(personId,dateKey,startTime,ignoreId=null){
    const start=calendarMinutes(startTime);
    if(!Number.isFinite(start))return 0;
    const ignored=ignoreId==null?'':String(ignoreId);
    let boundary=DAY_END;
    for(const row of timedEntries(personId,dateKey)){
      if(ignored&&String(row?.id??'')===ignored)continue;
      const rowStart=calendarMinutes(row.start_time);
      const rowEnd=rowStart+Number(row.duration_minutes||30);
      if(rowStart<start&&rowEnd>start)return 0;
      if(rowStart>=start&&rowStart<boundary)boundary=rowStart;
    }
    return Math.max(0,Math.min(MAX_DURATION,boundary-start));
  }
  function overlaps(personId,dateKey,startTime,duration,ignoreId=null){
    const start=calendarMinutes(startTime),end=start+Number(duration||30);
    const ignored=ignoreId==null?'':String(ignoreId);
    return timedEntries(personId,dateKey).some(row=>{
      if(ignored&&String(row?.id??'')===ignored)return false;
      const rowStart=calendarMinutes(row.start_time);
      const rowEnd=rowStart+Number(row.duration_minutes||30);
      return start<rowEnd&&end>rowStart;
    });
  }
  function phoneValue(row){return String(row?.client_phone||'').trim()}
  function phoneDigits(value){return String(value||'').replace(/\D/g,'')}
  function normalizePhone(value){
    const raw=String(value||'').trim();
    if(!raw)return '';
    const digits=phoneDigits(raw);
    return digits?`${raw.startsWith('+')?'+':''}${digits}`:'';
  }
  function phoneHref(value){const normalized=normalizePhone(value);return normalized?`tel:${normalized}`:''}
  function durationLabel(value){
    return typeof salonDurationLabel==='function'?salonDurationLabel(value):`${Number(value||30)} мин`;
  }
  function minuteTime(total){return calendarTimeFromMinutes(total)}

  const baseWifeCalendarPagePersonal=wifeCalendarPage;
  wifeCalendarPage=function(person){
    const html=baseWifeCalendarPagePersonal(person);
    const prefix=`${state.year}-${calendarPad(state.month)}-`;
    const personal=calendarPersonEntries(person.id)
      .filter(row=>row.kind==='personal'&&String(row.entry_date||'').startsWith(prefix));
    if(!personal.length)return html;

    const byDate=new Map();
    personal.forEach(row=>{
      const rows=byDate.get(row.entry_date)||[];
      rows.push(row);
      byDate.set(row.entry_date,rows);
    });
    const template=document.createElement('template');
    template.innerHTML=html;
    byDate.forEach((rows,dateKey)=>{
      const button=template.content.querySelector(`[data-wife-calendar-date="${dateKey}"]`);
      if(!button)return;
      button.classList.add('has-personal-entry');
      const clientCount=calendarPersonEntries(person.id).filter(row=>row.kind==='appointment'&&row.entry_date===dateKey).length;
      if(clientCount)button.classList.add('has-client-entry');
      else button.classList.add('has-personal-only');
      if(!button.querySelector('.calendar-personal-dot')){
        const dot=document.createElement('span');
        dot.className='calendar-personal-dot';
        dot.setAttribute('aria-hidden','true');
        button.appendChild(dot);
      }
      const total=clientCount+rows.length;
      let count=button.querySelector('.calendar-entry-count');
      if(!count){count=document.createElement('span');count.className='calendar-entry-count';button.appendChild(count)}
      count.textContent=String(total);
      const label=button.getAttribute('aria-label')||calendarDateLabel(dateKey);
      if(!label.includes('личных'))button.setAttribute('aria-label',`${label}, личных дел: ${rows.length}`);
    });
    const legend=template.content.querySelector('.calendar-legend');
    if(legend&&!legend.querySelector('.legend-personal')){
      const item=document.createElement('span');
      item.innerHTML='<i class="legend-personal"></i>Личное';
      legend.appendChild(item);
    }
    const summary=template.content.querySelector('.wife-month-summary');
    if(summary&&!summary.querySelector('.wife-personal-summary-item')){
      const item=document.createElement('div');
      item.className='wife-month-summary-item wife-personal-summary-item';
      item.innerHTML=`<span>Личных дел</span><strong>${personal.length}</strong>`;
      summary.appendChild(item);
    }
    return template.innerHTML;
  };

  function dayMarkup(person,dateKey){
    const rows=timedEntries(person.id,dateKey);
    const appointments=rows.filter(row=>row.kind==='appointment');
    const personal=rows.filter(row=>row.kind==='personal');
    const slots=[];
    for(let minute=DAY_START;minute<DAY_END;minute+=30){
      const time=minuteTime(minute);
      const row=rows.find(item=>calendarTimeText(item.start_time)===time);
      const covering=rows.find(item=>{
        const start=calendarMinutes(item.start_time),end=start+Number(item.duration_minutes||30);
        return minute>start&&minute<end;
      });
      if(row?.kind==='appointment'){
        const duration=Number(row.duration_minutes||30);
        const phone=phoneValue(row);
        const service=row.service_name?esc(row.service_name):'Запись';
        const amount=row.amount!=null&&row.amount!==''?money(row.amount):'Без суммы';
        slots.push(`<div class="salon-day-slot has-appointment" data-wife-entry-kind="appointment">
          <span class="salon-time">${time}</span>
          <button type="button" class="salon-day-appointment" data-appointment-id="${row.id}">
            <strong>${esc(row.client_name||row.title||'Клиент')}</strong>
            <small>${service} · ${esc(durationLabel(duration))} · ${amount}</small>
          </button>
          ${phone?`<a class="salon-call-button" href="${phoneHref(phone)}" aria-label="Позвонить ${esc(row.client_name||'клиенту')}"><span aria-hidden="true">☎</span><span>Позвонить</span></a>`:''}
        </div>`);
      }else if(row?.kind==='personal'){
        const duration=Number(row.duration_minutes||30);
        const end=minuteTime(minute+duration);
        slots.push(`<div class="salon-day-slot has-personal" data-wife-entry-kind="personal">
          <span class="salon-time">${time}</span>
          <button type="button" class="salon-day-personal" data-personal-id="${row.id}">
            <strong>${esc(row.title||'Личное дело')}</strong>
            <small>Личное · ${time}–${end}${row.comment?` · ${esc(row.comment)}`:''}</small>
          </button>
          <span class="salon-personal-badge">Личное</span>
        </div>`);
      }else if(covering){
        const personalCover=covering.kind==='personal';
        slots.push(`<div class="salon-day-slot is-covered ${personalCover?'is-personal-covered':''}" data-wife-entry-kind="${personalCover?'personal':'appointment'}"><span class="salon-time">${time}</span><span class="salon-day-continuation">${personalCover?'Личное · продолжение':'Продолжение записи'}</span></div>`);
      }else{
        slots.push(`<button type="button" class="salon-day-slot is-free" data-wife-free-time="${time}"><span class="salon-time">${time}</span><span class="salon-free-label">+ Добавить запись</span></button>`);
      }
    }
    return {rows,appointments,personal,markup:slots.join('')};
  }

  function openWifeDay(dateKey){
    const person=calendarCurrentPerson();
    if(!person)return;
    calendarUi.selectedDate=dateKey;
    const day=dayMarkup(person,dateKey);
    const amount=day.appointments.reduce((sum,row)=>sum+Number(row.amount||0),0);
    calendarModal(`${calendarModalHead('Расписание на день',`${calendarDateLabel(dateKey)} · ${person.display_name}`)}
      <div class="salon-day-summary salon-day-summary-personal">
        <span><strong>${day.appointments.length}</strong> клиентских</span>
        <span><strong>${day.personal.length}</strong> личных</span>
        <span><strong>${money(amount)}</strong> сумма работ</span>
      </div>
      <div class="salon-day-schedule" aria-label="Расписание с 07:00 до 22:00">
        ${day.markup}
        <div class="salon-day-closing"><span>22:00</span><span>Конец расписания</span></div>
      </div>`);
    document.querySelectorAll('[data-wife-free-time]').forEach(button=>button.onclick=()=>openSalonAppointment(dateKey,button.dataset.wifeFreeTime));
    document.querySelectorAll('[data-appointment-id]').forEach(button=>button.onclick=()=>{
      const entry=entryById(person.id,dateKey,button.dataset.appointmentId);
      if(entry)openSalonAppointment(dateKey,calendarTimeText(entry.start_time),entry.id);
    });
    document.querySelectorAll('[data-personal-id]').forEach(button=>button.onclick=()=>{
      const entry=entryById(person.id,dateKey,button.dataset.personalId);
      if(entry)openSalonAppointment(dateKey,calendarTimeText(entry.start_time),entry.id);
    });
  }

  function editorHead(title,subtitle){
    return `<div class="modal-head salon-editor-head"><div class="salon-editor-heading"><button type="button" class="salon-back-button" id="salonBackToDay" aria-label="Вернуться к расписанию">‹</button><div><h2>${esc(title)}</h2><p class="quick-amount-context">${esc(subtitle)}</p></div></div><button type="button" class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div>`;
  }
  function clientDurationOptions(selected,maxDuration){
    const values=typeof SALON_DURATION_MINUTES!=='undefined'?SALON_DURATION_MINUTES:Array.from({length:10},(_,i)=>(i+1)*30);
    const current=Number(selected||30);
    return values.map(minutes=>`<option value="${minutes}" ${current===minutes?'selected':''} ${minutes>maxDuration?'disabled':''}>${esc(durationLabel(minutes))}${minutes>maxDuration?' — занято':''}</option>`).join('');
  }
  function personalEndOptions(startTime,selectedDuration,maxDuration){
    const start=calendarMinutes(startTime);
    const selected=start+Number(selectedDuration||30);
    let html='';
    for(let duration=30;duration<=MAX_DURATION&&start+duration<=DAY_END;duration+=30){
      const end=start+duration;
      const disabled=duration>maxDuration;
      html+=`<option value="${end}" ${end===selected?'selected':''} ${disabled?'disabled':''}>${minuteTime(end)}${disabled?' — занято':''}</option>`;
    }
    return html;
  }
  function bindPhone(){
    const input=document.getElementById('salonPhone'),action=document.getElementById('salonCallClient');
    if(!input||!action)return;
    const update=()=>{const href=phoneHref(input.value);action.dataset.phoneHref=href;action.disabled=!href;action.classList.toggle('is-disabled',!href)};
    input.addEventListener('input',update);
    action.onclick=()=>{if(action.dataset.phoneHref)window.location.href=action.dataset.phoneHref};
    update();
  }

  openSalonAppointment=function(dateKey,startTime,editId=null){
    const person=calendarCurrentPerson();
    if(!person)return;
    const edit=editId?entryById(person.id,dateKey,editId):null;
    const time=edit?calendarTimeText(edit.start_time):startTime;
    const initialPersonal=edit?.kind==='personal';
    const maxDuration=availableDuration(person.id,dateKey,time,edit?.id||null);
    const selectedDuration=Math.min(Number(edit?.duration_minutes||30),Math.max(30,maxDuration||30));
    const paid=edit?.kind==='appointment'&&window.FinanceSalonPaid?.isPaid?.(edit);
    const autoPaid=paid&&edit?.is_paid!==true;
    const limitHint=maxDuration>0?`Свободно до ${minuteTime(calendarMinutes(time)+maxDuration)} · максимум ${durationLabel(maxDuration)}`:'Выбранное время уже занято';

    calendarModal(`${editorHead(edit?'Изменить запись':'Добавить запись',`${calendarDateLabel(dateKey)} · ${time} · ${person.display_name}`)}
      <div id="calendarNotice"></div>
      <form id="salonAppointmentForm" class="calendar-form salon-client-form salon-personal-editor">
        <label class="salon-personal-toggle"><input id="salonIsPersonal" type="checkbox" ${initialPersonal?'checked':''}><span class="salon-personal-toggle-mark" aria-hidden="true">✓</span><span><strong>Личное</strong><small>Заблокировать время для личного дела</small></span></label>

        <div data-salon-client-field>
          <div class="field"><label>Клиент</label><input id="salonClient" maxlength="120" value="${esc(initialPersonal?'':(edit?.client_name||edit?.title||''))}" placeholder="Имя клиента" autocomplete="name"></div>
          <div class="field salon-phone-field"><label>Телефон</label><div class="salon-phone-control"><input id="salonPhone" type="tel" maxlength="40" inputmode="tel" value="${esc(initialPersonal?'':phoneValue(edit))}" placeholder="+7 700 000 00 00" autocomplete="tel"><button type="button" class="btn btn-soft salon-call-form-button" id="salonCallClient"><span aria-hidden="true">☎</span> Позвонить</button></div></div>
          <div class="field"><label>Услуга</label><input id="salonService" maxlength="160" value="${esc(initialPersonal?'':(edit?.service_name||''))}" placeholder="Например: стрижка, окрашивание"></div>
          <div class="salon-form-grid">
            <div class="field"><label>Длительность</label><select id="salonDuration">${clientDurationOptions(selectedDuration,maxDuration)}</select><small class="salon-time-limit">${esc(limitHint)}</small></div>
            <div class="field"><label>Сумма, ₸</label><input id="salonAmount" type="number" min="0" step="1" inputmode="decimal" value="${initialPersonal?'':(edit?.amount??'')}" placeholder="0"></div>
          </div>
          <div class="field husband-paid-field salon-paid-field" id="salonPaidField"><label class="husband-paid-toggle salon-paid-toggle"><input id="salonAppointmentPaid" type="checkbox" ${paid?'checked':''}><span class="husband-paid-check" aria-hidden="true">✓</span><span class="husband-paid-copy"><strong>ОПЛАЧЕНО</strong><small>${autoPaid?'Отмечено автоматически: время записи прошло и сумма указана':'Отметьте, если клиент уже оплатил эту запись'}</small></span></label></div>
        </div>

        <div data-salon-personal-field>
          <div class="field"><label>Название дела</label><input id="salonPersonalTitle" maxlength="120" value="${esc(initialPersonal?(edit?.title||''):'')}" placeholder="Например: встреча, обед, личные дела"></div>
          <div class="field"><label>Временной отрезок</label><div class="salon-personal-time-range"><span><small>С</small><strong>${esc(time)}</strong></span><span class="salon-personal-time-arrow">→</span><label><small>До</small><select id="salonPersonalEnd">${personalEndOptions(time,selectedDuration,maxDuration)}</select></label></div><small class="salon-time-limit">${esc(limitHint)}</small></div>
        </div>

        <div class="field"><label>Комментарий</label><textarea id="salonComment" rows="3" maxlength="500" placeholder="Дополнительные детали">${esc(edit?.comment||'')}</textarea></div>
        <div class="calendar-form-actions salon-form-actions">${edit?'<button type="button" class="btn btn-danger" id="deleteSalonAppointment">Удалить</button>':''}<button type="submit" class="btn btn-primary" id="saveSalonEntry">${edit?'Сохранить изменения':'Добавить'}</button></div>
      </form>`);

    const modal=document.getElementById('modal');
    document.getElementById('salonBackToDay').onclick=()=>openWifeDay(dateKey);
    document.getElementById('closeModal').onclick=closeModal;
    if(modal)modal.onclick=event=>{if(event.target===modal)closeModal()};
    bindPhone();

    const personalToggle=document.getElementById('salonIsPersonal');
    const clientFields=[...document.querySelectorAll('[data-salon-client-field]')];
    const personalFields=[...document.querySelectorAll('[data-salon-personal-field]')];
    const syncMode=()=>{
      const personal=personalToggle.checked;
      clientFields.forEach(node=>node.hidden=personal);
      personalFields.forEach(node=>node.hidden=!personal);
      const client=document.getElementById('salonClient'),title=document.getElementById('salonPersonalTitle');
      if(client)client.required=!personal;
      if(title)title.required=personal;
      document.querySelector('.salon-personal-editor')?.classList.toggle('is-personal-mode',personal);
    };
    personalToggle.addEventListener('change',syncMode);
    syncMode();

    const remove=document.getElementById('deleteSalonAppointment');
    if(remove)remove.onclick=async()=>{
      if(!confirm(initialPersonal?'Удалить личное дело?':'Удалить запись клиента?'))return;
      remove.disabled=true;
      if(await deleteCalendarRow(edit.id))openWifeDay(dateKey);else remove.disabled=false;
    };

    document.getElementById('salonAppointmentForm').onsubmit=async event=>{
      event.preventDefault();
      notice('calendarNotice','');
      const personal=personalToggle.checked;
      const comment=document.getElementById('salonComment').value.trim();
      let duration;
      if(personal){
        const title=document.getElementById('salonPersonalTitle').value.trim();
        if(!title)return notice('calendarNotice','Укажите название личного дела.');
        const end=Number(document.getElementById('salonPersonalEnd').value);
        duration=end-calendarMinutes(time);
        if(!Number.isFinite(duration)||duration<30||duration>MAX_DURATION||duration%30!==0)return notice('calendarNotice','Укажите корректный временной отрезок.');
        if(calendarMinutes(time)+duration>DAY_END)return notice('calendarNotice','Личное дело должно завершиться не позднее 22:00.');
        if(overlaps(person.id,dateKey,time,duration,edit?.id||null))return notice('calendarNotice','Этот временной отрезок пересекается с другой записью.');
        const fields={kind:'personal',title,client_name:null,client_phone:null,service_name:null,start_time:time,duration_minutes:duration,amount:null,is_paid:false,comment:comment||null};
        const row=await saveCalendarRow({id:edit?.id||null,createPayload:edit?null:{family_id:state.family.id,person_id:person.id,entry_date:dateKey,created_by:state.user.id,...fields},updatePayload:edit?fields:null});
        if(row)openWifeDay(dateKey);
        return;
      }

      const client=document.getElementById('salonClient').value.trim();
      const phone=document.getElementById('salonPhone').value.trim();
      const service=document.getElementById('salonService').value.trim();
      duration=Number(document.getElementById('salonDuration').value);
      const amountText=document.getElementById('salonAmount').value.trim();
      const amount=amountText===''?null:Number(amountText);
      if(!client)return notice('calendarNotice','Укажите имя клиента.');
      if(phone&&!normalizePhone(phone))return notice('calendarNotice','Номер телефона указан неверно.');
      if(!Number.isFinite(duration)||duration<30||duration>MAX_DURATION||duration%30!==0)return notice('calendarNotice','Выберите допустимую длительность записи.');
      if(amount!=null&&(!Number.isFinite(amount)||amount<0))return notice('calendarNotice','Сумма указана неверно.');
      if(calendarMinutes(time)+duration>DAY_END)return notice('calendarNotice','Запись должна завершиться не позднее 22:00.');
      if(overlaps(person.id,dateKey,time,duration,edit?.id||null))return notice('calendarNotice','Это время пересекается с другой записью или личным делом.');
      const fields={kind:'appointment',title:client,client_name:client,client_phone:phone||null,service_name:service||null,start_time:time,duration_minutes:duration,amount,comment:comment||null};
      const row=await saveCalendarRow({id:edit?.id||null,createPayload:edit?null:{family_id:state.family.id,person_id:person.id,entry_date:dateKey,created_by:state.user.id,...fields},updatePayload:edit?fields:null});
      if(row)openWifeDay(dateKey);
    };

    setTimeout(()=>document.getElementById(initialPersonal?'salonPersonalTitle':'salonClient')?.focus(),0);
  };

  const baseBindWifeCalendarPersonal=bindWifeCalendar;
  bindWifeCalendar=function(){
    baseBindWifeCalendarPersonal();
    document.querySelectorAll('[data-wife-calendar-date]').forEach(button=>button.onclick=()=>openWifeDay(button.dataset.wifeCalendarDate));
  };

  window.FinanceSalonPersonal={openDay:openWifeDay,entries:timedEntries,overlaps,availableDuration};
})();