// Paid status for wife's salon appointments: same interaction as husband's events.
(function(){
  if(typeof openSalonAppointment!=='function'||typeof saveCalendarRow!=='function'||typeof calendarModal!=='function')return;

  function currentAppointment(dateKey,editId){
    const person=calendarCurrentPerson();
    if(!person||!editId)return null;
    return calendarEntriesOn(person.id,dateKey,'appointment').find(row=>String(row.id)===String(editId))||null;
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

  function decoratePaidSalonDay(){
    const schedule=document.querySelector('.salon-day-schedule');
    if(!schedule)return;
    const person=calendarCurrentPerson();
    const dateKey=calendarUi?.selectedDate;
    if(!person||!dateKey)return;
    const appointments=calendarEntriesOn(person.id,dateKey,'appointment');

    schedule.querySelectorAll('.salon-day-slot').forEach(slot=>{
      slot.classList.remove('is-paid');
      slot.querySelector('.salon-paid-badge')?.remove();

      const appointmentButton=slot.querySelector('[data-appointment-id]');
      let appointment=appointmentButton
        ?appointments.find(row=>String(row.id)===String(appointmentButton.dataset.appointmentId))
        :null;

      if(!appointment&&slot.classList.contains('is-covered')){
        const time=String(slot.querySelector('.salon-time')?.textContent||'').trim();
        if(time){
          const minute=calendarMinutes(time);
          appointment=appointments.find(row=>{
            const start=calendarMinutes(row.start_time);
            const end=start+Number(row.duration_minutes||30);
            return minute>start&&minute<end;
          })||null;
        }
      }

      if(appointment?.is_paid!==true)return;
      slot.classList.add('is-paid');

      if(appointmentButton){
        const badge=document.createElement('span');
        badge.className='salon-paid-badge';
        badge.textContent='✓ Оплачено';
        appointmentButton.appendChild(badge);
      }
    });
  }

  // Every day schedule is built through calendarModal, so decorate it immediately
  // after rendering. Unpaid appointments receive no extra class and stay unchanged.
  const baseCalendarModalWithWifePaid=calendarModal;
  calendarModal=function(markup){
    baseCalendarModalWithWifePaid(markup);
    decoratePaidSalonDay();
  };

  window.FinanceSalonPaid={decorate:decoratePaidSalonDay};
})();
