// Paid status for wife's salon appointments: full-chain highlighting and monthly paid state.
(function(){
  if(typeof openSalonAppointment!=='function'||typeof saveCalendarRow!=='function'||typeof calendarModal!=='function')return;

  function currentAppointment(dateKey,editId){
    const person=calendarCurrentPerson();
    if(!person||!editId)return null;
    return calendarEntriesOn(person.id,dateKey,'appointment').find(row=>String(row.id)===String(editId))||null;
  }

  function wifeMonthAppointments(person){
    if(!person)return [];
    const prefix=`${state.year}-${calendarPad(state.month)}-`;
    return calendarPersonEntries(person.id)
      .filter(row=>row.kind==='appointment'&&String(row.entry_date||'').startsWith(prefix));
  }

  // Persist the checkbox through the existing shared calendar save pipeline.
  const baseSaveCalendarRowWithWifePaid=saveCalendarRow;
  saveCalendarRow=async function(options){
    const form=document.getElementById('salonAppointmentForm');
    const paidInput=document.getElementById('salonAppointmentPaid');
    const appointmentSave=!!form&&!!paidInput&&(options?.createPayload?.kind==='appointment'||!!options?.updatePayload);
    if(!appointmentSave)return baseSaveCalendarRowWithWifePaid(options);

    const isPaid=!!paidInput.checked;
    return baseSaveCalendarRowWithWifePaid({
      ...options,
      createPayload:options.createPayload?{...options.createPayload,is_paid:isPaid}:options.createPayload,
      updatePayload:options.updatePayload?{...options.updatePayload,is_paid:isPaid}:options.updatePayload
    });
  };

  // Add the paid switch to the final salon editor without duplicating the editor itself.
  const baseOpenSalonAppointmentWithPaid=openSalonAppointment;
  openSalonAppointment=function(dateKey,startTime,editId=null){
    baseOpenSalonAppointmentWithPaid(dateKey,startTime,editId);
    const form=document.getElementById('salonAppointmentForm');
    if(!form||document.getElementById('salonAppointmentPaid'))return;

    const edit=currentAppointment(dateKey,editId);
    const anchor=document.getElementById('salonComment')?.closest('.field')||form.querySelector('.calendar-form-actions');
    if(!anchor)return;

    const paidField=document.createElement('div');
    paidField.className='field husband-paid-field salon-paid-field';
    paidField.innerHTML=`<label class="husband-paid-toggle salon-paid-toggle"><input id="salonAppointmentPaid" type="checkbox" ${edit?.is_paid===true?'checked':''}><span class="husband-paid-check" aria-hidden="true">✓</span><span class="husband-paid-copy"><strong>ОПЛАЧЕНО</strong><small>Отметьте, если клиент уже оплатил эту запись</small></span></label>`;
    anchor.before(paidField);
  };

  // Month view: a day's dot is green only when every appointment on that day is paid.
  if(typeof wifeCalendarPage==='function'){
    const baseWifeCalendarPageWithPaid=wifeCalendarPage;
    wifeCalendarPage=function(person){
      let html=baseWifeCalendarPageWithPaid(person);
      const appointments=wifeMonthAppointments(person);
      const byDate=new Map();
      appointments.forEach(row=>{
        const rows=byDate.get(row.entry_date)||[];
        rows.push(row);
        byDate.set(row.entry_date,rows);
      });

      byDate.forEach((rows,dateKey)=>{
        if(!rows.length||!rows.every(row=>row.is_paid===true))return;
        const pattern=new RegExp(`(<button[^>]*class="calendar-day)([^\"]*\"[^>]*data-wife-calendar-date="${dateKey}")`);
        html=html.replace(pattern,'$1 is-paid-day$2');
      });

      const paidCount=appointments.filter(row=>row.is_paid===true).length;
      html=html.replace(
        /(<div class="wife-month-summary-item"><span>Записей за месяц<\/span><strong>[^<]*<\/strong>)(<\/div>)/,
        `$1<small class="wife-month-paid-count">из них оплачено <b>${paidCount}</b></small>$2`
      );
      return html;
    };
  }

  function decoratePaidSalonDay(){
    const schedule=document.querySelector('.salon-day-schedule');
    if(!schedule)return;
    const person=calendarCurrentPerson();
    const dateKey=calendarUi?.selectedDate;
    if(!person||!dateKey)return;

    const paidAppointments=calendarEntriesOn(person.id,dateKey,'appointment')
      .filter(row=>row.is_paid===true)
      .map(row=>({
        row,
        start:calendarMinutes(row.start_time),
        end:calendarMinutes(row.start_time)+Number(row.duration_minutes||30)
      }));

    schedule.querySelectorAll('.salon-day-slot').forEach(slot=>{
      slot.classList.remove('is-paid');
      slot.querySelector('.salon-paid-badge')?.remove();
      slot.querySelector('.salon-paid-checkmark')?.remove();

      const timeNode=slot.querySelector('.salon-time');
      const time=String(timeNode?.childNodes?.[0]?.textContent||timeNode?.textContent||'').trim();
      if(!time)return;
      const minute=calendarMinutes(time);
      const match=paidAppointments.find(item=>minute>=item.start&&minute<item.end);
      if(!match)return;

      slot.classList.add('is-paid');

      // Show the payment status once, beside the start time. Continuation rows
      // inherit the green block but do not repeat the icon.
      if(minute===match.start&&slot.querySelector('[data-appointment-id]')&&timeNode){
        const check=document.createElement('span');
        check.className='salon-paid-checkmark';
        check.textContent='✓';
        check.title='Оплачено';
        check.setAttribute('aria-label','Оплачено');
        timeNode.appendChild(check);
      }
    });
  }

  // Every day schedule is built through calendarModal. Decorate immediately and
  // once more after layout settles so long appointment chains are always updated.
  const baseCalendarModalWithWifePaid=calendarModal;
  calendarModal=function(markup){
    baseCalendarModalWithWifePaid(markup);
    decoratePaidSalonDay();
    if(typeof requestAnimationFrame==='function')requestAnimationFrame(decoratePaidSalonDay);
    setTimeout(decoratePaidSalonDay,0);
  };

  window.FinanceSalonPaid={decorate:decoratePaidSalonDay};
})();
