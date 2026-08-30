// Extended salon appointment durations: 30-minute steps up to 5 hours.
const SALON_DURATION_MINUTES=Array.from({length:10},(_,index)=>(index+1)*30);

function salonDurationLabel(minutes){
  const value=Number(minutes||30);
  if(value<60)return `${value} минут`;
  const hours=Math.floor(value/60);
  const rest=value%60;
  const hourWord=hours===1?'час':hours<5?'часа':'часов';
  return rest?`${hours} ${hourWord} 30 минут`:`${hours} ${hourWord}`;
}

function salonDurationOptions(selected){
  const current=Number(selected||30);
  return SALON_DURATION_MINUTES.map(minutes=>`<option value="${minutes}" ${current===minutes?'selected':''}>${salonDurationLabel(minutes)}</option>`).join('');
}

// Replace only the appointment editor. Calendar rendering and overlap detection
// already support arbitrary durations and mark every covered 30-minute slot busy.
openSalonAppointment=function(dateKey,startTime,editId=null){
  const person=calendarCurrentPerson();
  if(!person)return;
  const appointments=calendarEntriesOn(person.id,dateKey,'appointment');
  const edit=editId?appointments.find(row=>row.id===editId):null;
  const time=edit?calendarTimeText(edit.start_time):startTime;
  calendarModal(`${calendarModalHead(edit?'Изменить запись':'Записать клиента',`${calendarDateLabel(dateKey)} · ${time} · ${person.display_name}`)}
    <div id="calendarNotice"></div>
    <form id="salonAppointmentForm" class="calendar-form">
      <div class="field"><label>Клиент</label><input id="salonClient" maxlength="120" required value="${esc(edit?.client_name||edit?.title||'')}" placeholder="Имя клиента"></div>
      <div class="field"><label>Услуга</label><input id="salonService" maxlength="160" value="${esc(edit?.service_name||'')}" placeholder="Например: стрижка, окрашивание"></div>
      <div class="field"><label>Длительность</label><select id="salonDuration">${salonDurationOptions(edit?.duration_minutes||30)}</select></div>
      <div class="field"><label>Сумма, ₸</label><input id="salonAmount" type="number" min="0" step="1" inputmode="decimal" value="${edit?.amount??''}" placeholder="0"></div>
      <div class="field"><label>Комментарий</label><textarea id="salonComment" rows="3" maxlength="500" placeholder="Телефон, пожелания, детали">${esc(edit?.comment||'')}</textarea></div>
      <div class="calendar-form-actions">${edit?'<button type="button" class="btn btn-danger" id="deleteSalonAppointment">Удалить</button>':''}<button type="submit" class="btn btn-primary">${edit?'Сохранить изменения':'Записать'}</button></div>
    </form>`);
  const remove=document.getElementById('deleteSalonAppointment');
  if(remove)remove.onclick=async()=>{
    if(!confirm('Удалить запись клиента?'))return;
    remove.disabled=true;
    if(await deleteCalendarRow(edit.id)){closeModal();renderApp()}else remove.disabled=false;
  };
  document.getElementById('salonAppointmentForm').onsubmit=async event=>{
    event.preventDefault();
    notice('calendarNotice','');
    const client=document.getElementById('salonClient').value.trim();
    const service=document.getElementById('salonService').value.trim();
    const duration=Number(document.getElementById('salonDuration').value);
    const amountValue=document.getElementById('salonAmount').value.trim();
    const amount=amountValue===''?null:Number(amountValue);
    const comment=document.getElementById('salonComment').value.trim();
    if(!client)return notice('calendarNotice','Укажите имя клиента.');
    if(!SALON_DURATION_MINUTES.includes(duration))return notice('calendarNotice','Выберите длительность от 30 минут до 5 часов с шагом 30 минут.');
    if(amount!=null&&(!Number.isFinite(amount)||amount<0))return notice('calendarNotice','Сумма указана неверно.');
    const end=calendarMinutes(time)+duration;
    if(end>22*60)return notice('calendarNotice','Запись должна завершиться не позднее 22:00.');
    if(appointmentOverlap(person.id,dateKey,time,duration,edit?.id||null))return notice('calendarNotice','Это время пересекается с другой записью.');
    const fields={title:client,client_name:client,service_name:service||null,start_time:time,duration_minutes:duration,amount,comment:comment||null};
    const row=await saveCalendarRow({
      id:edit?.id||null,
      createPayload:{family_id:state.family.id,person_id:person.id,kind:'appointment',entry_date:dateKey,created_by:state.user.id,...fields},
      updatePayload:fields
    });
    if(row){closeModal();renderApp()}
  };
  setTimeout(()=>document.getElementById('salonClient')?.focus(),0);
};
