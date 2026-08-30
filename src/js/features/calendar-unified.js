// Unified month calendar for husband and wife. Wife day details open in a modal
// with 30-minute salon slots and a client editor, while the month view remains
// visually consistent with the husband's calendar.
(function(){
  if(typeof wifeCalendarPage!=='function'||typeof bindWifeCalendar!=='function')return;

  const SALON_DAY_START=7*60;
  const SALON_DAY_END=22*60;

  function wifeMonthAppointments(person){
    const prefix=`${state.year}-${calendarPad(state.month)}-`;
    return calendarPersonEntries(person.id)
      .filter(row=>row.kind==='appointment'&&String(row.entry_date||'').startsWith(prefix));
  }

  function wifeMonthStats(person){
    const appointments=wifeMonthAppointments(person);
    return {
      count:appointments.length,
      amount:appointments.reduce((sum,row)=>sum+Number(row.amount||0),0)
    };
  }

  function wifeMonthGrid(person){
    const first=new Date(+state.year,+state.month-1,1);
    const daysInMonth=new Date(+state.year,+state.month,0).getDate();
    const leading=(first.getDay()+6)%7;
    const todayKey=calendarDateKey(new Date());
    const appointments=wifeMonthAppointments(person);
    const byDate=new Map();
    appointments.forEach(row=>{
      const list=byDate.get(row.entry_date)||[];
      list.push(row);
      byDate.set(row.entry_date,list);
    });
    const cells=[];
    for(let index=0;index<leading;index++)cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
    for(let day=1;day<=daysInMonth;day++){
      const date=new Date(+state.year,+state.month-1,day);
      const key=calendarDateKey(date);
      const weekend=date.getDay()===0||date.getDay()===6;
      const dayAppointments=byDate.get(key)||[];
      cells.push(`<button type="button" class="calendar-day ${weekend?'is-weekend':''} ${key===todayKey?'is-today':''} ${dayAppointments.length?'has-entry':''}" data-wife-calendar-date="${key}" aria-label="${esc(calendarDateLabel(key))}${dayAppointments.length?`, записей: ${dayAppointments.length}`:''}">
        <span class="calendar-day-number">${day}</span>
        ${dayAppointments.length?`<span class="calendar-entry-dot" aria-hidden="true"></span><span class="calendar-entry-count">${dayAppointments.length}</span>`:''}
      </button>`);
    }
    return cells.join('');
  }

  wifeCalendarPage=function(person){
    const stats=wifeMonthStats(person);
    return `<div class="calendar-page wife-calendar-page wife-month-calendar-page">
      <div class="page-head calendar-page-head">
        <div><h2 class="page-title">Календарь</h2><div class="page-subtitle">Записи ${esc(person.display_name)}. Выберите дату, чтобы открыть расписание дня.</div></div>
        ${calendarPersonSwitcher(person)}
      </div>
      <section class="card husband-calendar-card wife-unified-calendar-card">
        <div class="calendar-month-toolbar">
          <button type="button" class="calendar-arrow" id="calendarPrevMonth" aria-label="Предыдущий месяц">‹</button>
          <div><strong>${esc(calendarMonthTitle())}</strong><small>Проведите пальцем влево или вправо для смены месяца</small></div>
          <button type="button" class="calendar-arrow" id="calendarNextMonth" aria-label="Следующий месяц">›</button>
        </div>
        <div class="husband-calendar-swipe" id="wifeCalendarSwipe">
          <div class="calendar-weekdays">${CALENDAR_WEEKDAYS.map((day,index)=>`<div class="${index>4?'is-weekend':''}">${day}</div>`).join('')}</div>
          <div class="calendar-grid">${wifeMonthGrid(person)}</div>
        </div>
        <div class="calendar-legend"><span><i class="legend-weekend"></i>Выходной</span><span><i class="legend-entry"></i>Есть запись</span><span><i class="legend-today"></i>Сегодня</span></div>
      </section>
      <section class="card wife-month-summary" aria-label="Итоги месяца">
        <div class="wife-month-summary-item"><span>Записей за месяц</span><strong>${stats.count}</strong></div>
        <div class="wife-month-summary-item"><span>Сумма работ</span><strong>${money(stats.amount)}</strong></div>
      </section>
    </div>`;
  };

  function appointmentPhone(row){return String(row?.client_phone||'').trim()}
  function normalizePhone(phone){
    const raw=String(phone||'').trim();
    if(!raw)return '';
    const hasPlus=raw.startsWith('+');
    const digits=raw.replace(/\D/g,'');
    return digits?`${hasPlus?'+':''}${digits}`:'';
  }
  function phoneHref(phone){
    const normalized=normalizePhone(phone);
    return normalized?`tel:${normalized}`:'';
  }

  function salonDaySlotMarkup(person,dateKey){
    const appointments=calendarEntriesOn(person.id,dateKey,'appointment');
    const slots=[];
    for(let minute=SALON_DAY_START;minute<SALON_DAY_END;minute+=30){
      const time=calendarTimeFromMinutes(minute);
      const appointment=appointments.find(row=>calendarTimeText(row.start_time)===time);
      const covering=appointments.find(row=>{
        const start=calendarMinutes(row.start_time);
        const end=start+Number(row.duration_minutes||30);
        return minute>start&&minute<end;
      });
      if(appointment){
        const duration=Number(appointment.duration_minutes||30);
        const phone=appointmentPhone(appointment);
        const service=appointment.service_name?esc(appointment.service_name):'Запись';
        const amount=appointment.amount!=null&&appointment.amount!==''?money(appointment.amount):'Без суммы';
        slots.push(`<div class="salon-day-slot has-appointment">
          <span class="salon-time">${time}</span>
          <button type="button" class="salon-day-appointment" data-appointment-id="${appointment.id}">
            <strong>${esc(appointment.client_name||appointment.title||'Клиент')}</strong>
            <small>${service} · ${salonDurationLabel?.(duration)||`${duration} мин`} · ${amount}</small>
          </button>
          ${phone?`<a class="salon-call-button" href="${phoneHref(phone)}" aria-label="Позвонить ${esc(appointment.client_name||'клиенту')}"><span aria-hidden="true">☎</span><span>Позвонить</span></a>`:''}
        </div>`);
      }else if(covering){
        slots.push(`<div class="salon-day-slot is-covered"><span class="salon-time">${time}</span><span class="salon-day-continuation">Продолжение записи</span></div>`);
      }else{
        slots.push(`<button type="button" class="salon-day-slot is-free" data-salon-time="${time}"><span class="salon-time">${time}</span><span class="salon-free-label">+ Записать клиента</span></button>`);
      }
    }
    return {appointments,markup:slots.join('')};
  }

  function openSalonDay(dateKey){
    const person=calendarCurrentPerson();
    if(!person)return;
    calendarUi.selectedDate=dateKey;
    const day=salonDaySlotMarkup(person,dateKey);
    const amount=day.appointments.reduce((sum,row)=>sum+Number(row.amount||0),0);
    calendarModal(`${calendarModalHead('Записи на день',`${calendarDateLabel(dateKey)} · ${person.display_name}`)}
      <div class="salon-day-summary">
        <span><strong>${day.appointments.length}</strong> ${day.appointments.length===1?'запись':'записей'}</span>
        <span><strong>${money(amount)}</strong> сумма работ</span>
      </div>
      <div class="salon-day-schedule" aria-label="Расписание с 07:00 до 22:00">
        ${day.markup}
        <div class="salon-day-closing"><span>22:00</span><span>Конец расписания</span></div>
      </div>`);
    document.querySelectorAll('[data-salon-time]').forEach(button=>button.onclick=()=>openSalonAppointment(dateKey,button.dataset.salonTime));
    document.querySelectorAll('[data-appointment-id]').forEach(button=>button.onclick=()=>{
      const appointment=(state.calendarEntries||[]).find(row=>row.id===button.dataset.appointmentId);
      if(appointment)openSalonAppointment(appointment.entry_date,calendarTimeText(appointment.start_time),appointment.id);
    });
  }

  function salonEditorHead(title,subtitle,dateKey){
    return `<div class="modal-head salon-editor-head"><div class="salon-editor-heading"><button type="button" class="salon-back-button" id="salonBackToDay" aria-label="Вернуться к расписанию">‹</button><div><h2>${esc(title)}</h2><p class="quick-amount-context">${esc(subtitle)}</p></div></div><button type="button" class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div>`;
  }

  function bindSalonPhoneAction(){
    const input=document.getElementById('salonPhone');
    const action=document.getElementById('salonCallClient');
    if(!input||!action)return;
    const update=()=>{
      const href=phoneHref(input.value);
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

  openSalonAppointment=function(dateKey,startTime,editId=null){
    const person=calendarCurrentPerson();
    if(!person)return;
    const appointments=calendarEntriesOn(person.id,dateKey,'appointment');
    const edit=editId?appointments.find(row=>row.id===editId):null;
    const time=edit?calendarTimeText(edit.start_time):startTime;
    const durationOptions=typeof salonDurationOptions==='function'
      ?salonDurationOptions(edit?.duration_minutes||30)
      :'<option value="30">30 минут</option><option value="60">1 час</option>';
    calendarModal(`${salonEditorHead(edit?'Изменить запись':'Записать клиента',`${calendarDateLabel(dateKey)} · ${time} · ${person.display_name}`,dateKey)}
      <div id="calendarNotice"></div>
      <form id="salonAppointmentForm" class="calendar-form salon-client-form">
        <div class="field"><label>Клиент</label><input id="salonClient" maxlength="120" required value="${esc(edit?.client_name||edit?.title||'')}" placeholder="Имя клиента" autocomplete="name"></div>
        <div class="field salon-phone-field"><label>Телефон</label><div class="salon-phone-control"><input id="salonPhone" type="tel" maxlength="40" inputmode="tel" value="${esc(appointmentPhone(edit))}" placeholder="+7 700 000 00 00" autocomplete="tel"><button type="button" class="btn btn-soft salon-call-form-button" id="salonCallClient"><span aria-hidden="true">☎</span> Позвонить</button></div></div>
        <div class="field"><label>Услуга</label><input id="salonService" maxlength="160" value="${esc(edit?.service_name||'')}" placeholder="Например: стрижка, окрашивание"></div>
        <div class="salon-form-grid">
          <div class="field"><label>Длительность</label><select id="salonDuration">${durationOptions}</select></div>
          <div class="field"><label>Сумма, ₸</label><input id="salonAmount" type="number" min="0" step="1" inputmode="decimal" value="${edit?.amount??''}" placeholder="0"></div>
        </div>
        <div class="field"><label>Комментарий</label><textarea id="salonComment" rows="3" maxlength="500" placeholder="Пожелания и детали">${esc(edit?.comment||'')}</textarea></div>
        <div class="calendar-form-actions salon-form-actions">${edit?'<button type="button" class="btn btn-danger" id="deleteSalonAppointment">Удалить</button>':''}<button type="submit" class="btn btn-primary">${edit?'Сохранить изменения':'Записать'}</button></div>
      </form>`);
    document.getElementById('salonBackToDay').onclick=()=>openSalonDay(dateKey);
    document.getElementById('closeModal').onclick=closeModal;
    document.getElementById('modal').onclick=event=>{if(event.target.id==='modal')closeModal()};
    bindSalonPhoneAction();
    const remove=document.getElementById('deleteSalonAppointment');
    if(remove)remove.onclick=async()=>{
      if(!confirm('Удалить запись клиента?'))return;
      remove.disabled=true;
      if(await deleteCalendarRow(edit.id))openSalonDay(dateKey);else remove.disabled=false;
    };
    document.getElementById('salonAppointmentForm').onsubmit=async event=>{
      event.preventDefault();
      notice('calendarNotice','');
      const client=document.getElementById('salonClient').value.trim();
      const phone=document.getElementById('salonPhone').value.trim();
      const service=document.getElementById('salonService').value.trim();
      const duration=Number(document.getElementById('salonDuration').value);
      const amountValue=document.getElementById('salonAmount').value.trim();
      const amount=amountValue===''?null:Number(amountValue);
      const comment=document.getElementById('salonComment').value.trim();
      if(!client)return notice('calendarNotice','Укажите имя клиента.');
      if(phone&&!normalizePhone(phone))return notice('calendarNotice','Номер телефона указан неверно.');
      if(typeof SALON_DURATION_MINUTES!=='undefined'&&!SALON_DURATION_MINUTES.includes(duration))return notice('calendarNotice','Выберите допустимую длительность записи.');
      if(amount!=null&&(!Number.isFinite(amount)||amount<0))return notice('calendarNotice','Сумма указана неверно.');
      const end=calendarMinutes(time)+duration;
      if(end>SALON_DAY_END)return notice('calendarNotice','Запись должна завершиться не позднее 22:00.');
      if(appointmentOverlap(person.id,dateKey,time,duration,edit?.id||null))return notice('calendarNotice','Это время пересекается с другой записью.');
      const fields={title:client,client_name:client,client_phone:phone||null,service_name:service||null,start_time:time,duration_minutes:duration,amount,comment:comment||null};
      const row=await saveCalendarRow({
        id:edit?.id||null,
        createPayload:{family_id:state.family.id,person_id:person.id,kind:'appointment',entry_date:dateKey,created_by:state.user.id,...fields},
        updatePayload:fields
      });
      if(row)openSalonDay(dateKey);
    };
    setTimeout(()=>document.getElementById('salonClient')?.focus(),0);
  };

  bindWifeCalendar=function(){
    const prev=document.getElementById('calendarPrevMonth');
    const next=document.getElementById('calendarNextMonth');
    if(prev)prev.onclick=()=>calendarShiftMonth(-1);
    if(next)next.onclick=()=>calendarShiftMonth(1);
    document.querySelectorAll('[data-wife-calendar-date]').forEach(button=>button.onclick=()=>openSalonDay(button.dataset.wifeCalendarDate));
    const swipe=document.getElementById('wifeCalendarSwipe');
    if(!swipe)return;
    swipe.addEventListener('touchstart',event=>{
      const touch=event.changedTouches[0];
      calendarUi.touchStartX=touch.clientX;
      calendarUi.touchStartY=touch.clientY;
    },{passive:true});
    swipe.addEventListener('touchend',event=>{
      const touch=event.changedTouches[0];
      const dx=touch.clientX-calendarUi.touchStartX;
      const dy=touch.clientY-calendarUi.touchStartY;
      if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.2)return;
      calendarShiftMonth(dx<0?1:-1);
    },{passive:true});
  };

  window.FinanceSalonCalendar={openDay:openSalonDay,normalizePhone};
})();
