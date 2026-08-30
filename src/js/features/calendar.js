// Independent family calendar: husband events and wife salon appointments.
const CALENDAR_WEEKDAYS=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const CALENDAR_MONTHS_GENITIVE=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const calendarUi={selectedDate:null,touchStartX:0,touchStartY:0};

function calendarPad(value){return String(value).padStart(2,'0')}
function calendarDateKey(date){return `${date.getFullYear()}-${calendarPad(date.getMonth()+1)}-${calendarPad(date.getDate())}`}
function calendarDateFromKey(key){
  const [year,month,day]=String(key||'').split('-').map(Number);
  return new Date(year,month-1,day);
}
function calendarDateLabel(key,{weekday=true}={}){
  const date=calendarDateFromKey(key);
  if(Number.isNaN(date.getTime()))return '';
  const text=date.toLocaleDateString('ru-RU',{weekday:weekday?'long':undefined,day:'numeric',month:'long',year:'numeric'});
  return text.charAt(0).toUpperCase()+text.slice(1);
}
function calendarCurrentPerson(){
  return state.people.find(person=>person.linked_user_id===state.user?.id)
    ||byId(state.people,state.selectedPersonId)
    ||state.people[0]
    ||null;
}
function calendarPersonEntries(personId){
  return (state.calendarEntries||[]).filter(row=>row.person_id===personId);
}
function calendarEntriesOn(personId,dateKey,kind=null){
  return calendarPersonEntries(personId)
    .filter(row=>row.entry_date===dateKey&&(!kind||row.kind===kind))
    .sort((a,b)=>String(a.start_time||'').localeCompare(String(b.start_time||''))||String(a.created_at||'').localeCompare(String(b.created_at||'')));
}
function calendarMonthTitle(){
  return `${MONTHS[state.month-1]} ${state.year}`;
}
function calendarShiftMonth(delta){
  const date=new Date(+state.year,+state.month-1+delta,1);
  state.year=date.getFullYear();
  state.month=date.getMonth()+1;
  calendarUi.selectedDate=null;
  renderApp();
}
function resetCalendarToToday(){
  const now=new Date();
  state.year=now.getFullYear();
  state.month=now.getMonth()+1;
  calendarUi.selectedDate=calendarDateKey(now);
}
function calendarEnsureSelectedDate(){
  const now=new Date();
  const currentMonth=+state.year===now.getFullYear()&&+state.month===now.getMonth()+1;
  const selected=calendarUi.selectedDate?calendarDateFromKey(calendarUi.selectedDate):null;
  if(!selected||selected.getFullYear()!==+state.year||selected.getMonth()+1!==+state.month){
    calendarUi.selectedDate=currentMonth?calendarDateKey(now):calendarDateKey(new Date(+state.year,+state.month-1,1));
  }
  return calendarUi.selectedDate;
}
function calendarTimeText(value){return String(value||'').slice(0,5)}
function calendarMinutes(time){
  const [hours,minutes]=calendarTimeText(time).split(':').map(Number);
  return hours*60+minutes;
}
function calendarTimeFromMinutes(total){return `${calendarPad(Math.floor(total/60))}:${calendarPad(total%60)}`}
function calendarUpsert(row){
  if(!row)return;
  state.calendarEntries=state.calendarEntries||[];
  const index=state.calendarEntries.findIndex(item=>item.id===row.id);
  if(index>=0)state.calendarEntries[index]=row;else state.calendarEntries.push(row);
  window.FinanceOffline?.persistSnapshotSoon?.();
}
function calendarRemove(id){
  state.calendarEntries=(state.calendarEntries||[]).filter(row=>row.id!==id);
  window.FinanceOffline?.persistSnapshotSoon?.();
}
function calendarRequireOnline(noticeId='calendarNotice'){
  if(navigator.onLine)return true;
  notice(noticeId,'Для сохранения календаря сейчас требуется подключение к интернету.');
  return false;
}
function calendarModal(markup){
  closeModal();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal calendar-modal">${markup}</div></div>`);
  const close=document.getElementById('closeModal');
  if(close)close.onclick=closeModal;
  document.getElementById('modal').onclick=event=>{if(event.target.id==='modal')closeModal()};
}
function calendarModalHead(title,subtitle=''){
  return `<div class="modal-head"><div><h2>${esc(title)}</h2>${subtitle?`<p class="quick-amount-context">${esc(subtitle)}</p>`:''}</div><button type="button" class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div>`;
}
function calendarDayHasEntries(personId,dateKey){return calendarEntriesOn(personId,dateKey).length>0}

function husbandCalendarPage(person){
  const first=new Date(+state.year,+state.month-1,1);
  const daysInMonth=new Date(+state.year,+state.month,0).getDate();
  const leading=(first.getDay()+6)%7;
  const todayKey=calendarDateKey(new Date());
  const entries=calendarPersonEntries(person.id);
  const entryDates=new Set(entries.map(row=>row.entry_date));
  const cells=[];
  for(let index=0;index<leading;index++)cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
  for(let day=1;day<=daysInMonth;day++){
    const date=new Date(+state.year,+state.month-1,day);
    const key=calendarDateKey(date);
    const weekday=date.getDay();
    const weekend=weekday===0||weekday===6;
    const dayEntries=entries.filter(row=>row.entry_date===key);
    cells.push(`<button type="button" class="calendar-day ${weekend?'is-weekend':''} ${key===todayKey?'is-today':''} ${entryDates.has(key)?'has-entry':''}" data-calendar-date="${key}" aria-label="${esc(calendarDateLabel(key))}${dayEntries.length?`, записей: ${dayEntries.length}`:''}"><span class="calendar-day-number">${day}</span>${dayEntries.length?`<span class="calendar-entry-dot" aria-hidden="true"></span><span class="calendar-entry-count">${dayEntries.length}</span>`:''}</button>`);
  }
  return `<div class="calendar-page husband-calendar-page">
    <div class="page-head calendar-page-head">
      <div><h2 class="page-title">Календарь</h2><div class="page-subtitle">Мероприятия ${esc(person.display_name)}. Выходные выделены отдельно.</div></div>
    </div>
    <section class="card husband-calendar-card">
      <div class="calendar-month-toolbar">
        <button type="button" class="calendar-arrow" id="calendarPrevMonth" aria-label="Предыдущий месяц">‹</button>
        <div><strong>${esc(calendarMonthTitle())}</strong><small>Проведите пальцем влево или вправо для смены месяца</small></div>
        <button type="button" class="calendar-arrow" id="calendarNextMonth" aria-label="Следующий месяц">›</button>
      </div>
      <div class="husband-calendar-swipe" id="husbandCalendarSwipe">
        <div class="calendar-weekdays">${CALENDAR_WEEKDAYS.map((day,index)=>`<div class="${index>4?'is-weekend':''}">${day}</div>`).join('')}</div>
        <div class="calendar-grid">${cells.join('')}</div>
      </div>
      <div class="calendar-legend"><span><i class="legend-weekend"></i>Выходной</span><span><i class="legend-entry"></i>Есть запись</span><span><i class="legend-today"></i>Сегодня</span></div>
    </section>
  </div>`;
}

function wifeCalendarPage(person){
  const selectedKey=calendarEnsureSelectedDate();
  const daysInMonth=new Date(+state.year,+state.month,0).getDate();
  const todayKey=calendarDateKey(new Date());
  const entries=calendarPersonEntries(person.id);
  const entryDates=new Set(entries.map(row=>row.entry_date));
  const dateButtons=[];
  for(let day=1;day<=daysInMonth;day++){
    const date=new Date(+state.year,+state.month-1,day);
    const key=calendarDateKey(date);
    const week=date.toLocaleDateString('ru-RU',{weekday:'short'}).replace('.','');
    dateButtons.push(`<button type="button" class="salon-date ${key===selectedKey?'is-selected':''} ${key===todayKey?'is-today':''} ${entryDates.has(key)?'has-entry':''}" data-salon-date="${key}"><span>${esc(week)}</span><strong>${day}</strong>${entryDates.has(key)?'<i aria-hidden="true"></i>':''}</button>`);
  }
  const appointments=calendarEntriesOn(person.id,selectedKey,'appointment');
  const slots=[];
  for(let minute=7*60;minute<22*60;minute+=30){
    const time=calendarTimeFromMinutes(minute);
    const appointment=appointments.find(row=>calendarTimeText(row.start_time)===time);
    const covering=appointments.find(row=>{
      const start=calendarMinutes(row.start_time),end=start+Number(row.duration_minutes||30);
      return minute>start&&minute<end;
    });
    if(appointment){
      const duration=Number(appointment.duration_minutes||30);
      slots.push(`<button type="button" class="salon-slot has-appointment" data-appointment-id="${appointment.id}">
        <span class="salon-time">${time}</span>
        <span class="salon-slot-content"><strong>${esc(appointment.client_name||appointment.title||'Клиент')}</strong><small>${appointment.service_name?esc(appointment.service_name):'Запись'} · ${duration} мин</small></span>
        <span class="salon-edit">Изменить</span>
      </button>`);
    }else if(covering){
      slots.push(`<div class="salon-slot is-covered"><span class="salon-time">${time}</span><span class="salon-slot-content"><small>Занято · продолжение записи</small></span></div>`);
    }else{
      slots.push(`<button type="button" class="salon-slot is-free" data-salon-time="${time}"><span class="salon-time">${time}</span><span class="salon-slot-content"><span>+ Записать клиента</span></span></button>`);
    }
  }
  return `<div class="calendar-page wife-calendar-page">
    <div class="page-head calendar-page-head">
      <div><h2 class="page-title">Календарь салона</h2><div class="page-subtitle">Запись клиентов ${esc(person.display_name)} с 07:00 до 22:00.</div></div>
    </div>
    <section class="card salon-calendar-card">
      <div class="salon-month-title"><strong>${esc(calendarMonthTitle())}</strong><span>Год и месяц можно выбрать сверху</span></div>
      <div class="salon-date-ribbon" id="salonDateRibbon" aria-label="Даты месяца">${dateButtons.join('')}</div>
      <div class="salon-day-head"><div><strong>${esc(calendarDateLabel(selectedKey))}</strong><span>${appointments.length?`Записей: ${appointments.length}`:'Записей пока нет'}</span></div><button type="button" class="btn btn-soft btn-small" id="salonToday">Сегодня</button></div>
      <div class="salon-schedule">${slots.join('')}<div class="salon-closing"><span>22:00</span><span>Закрытие расписания</span></div></div>
    </section>
  </div>`;
}

function calendarPage(){
  const person=calendarCurrentPerson();
  if(!person)return `<div class="calendar-page"><div class="card empty">Не удалось определить участника семьи для календаря.</div></div>`;
  return person.label==='wife'?wifeCalendarPage(person):husbandCalendarPage(person);
}

async function saveCalendarRow({id=null,createPayload,updatePayload,noticeId='calendarNotice'}){
  if(!calendarRequireOnline(noticeId))return null;
  try{
    const query=id
      ?sb.from('calendar_entries').update({...updatePayload,updated_at:new Date().toISOString()}).eq('id',id)
      :sb.from('calendar_entries').insert(createPayload);
    const {data,error}=await query.select().single();
    if(error){notice(noticeId,error.message);return null}
    calendarUpsert(data);
    return data;
  }catch(error){
    notice(noticeId,error?.message||String(error));
    return null;
  }
}
async function deleteCalendarRow(id,noticeId='calendarNotice'){
  if(!calendarRequireOnline(noticeId))return false;
  try{
    const {error}=await sb.from('calendar_entries').delete().eq('id',id);
    if(error){notice(noticeId,error.message);return false}
    calendarRemove(id);
    return true;
  }catch(error){
    notice(noticeId,error?.message||String(error));
    return false;
  }
}

function openHusbandDay(dateKey,editId=null){
  const person=calendarCurrentPerson();
  if(!person)return;
  const events=calendarEntriesOn(person.id,dateKey,'event');
  const edit=editId?events.find(row=>row.id===editId):null;
  const existing=events.length?`<div class="calendar-existing-list">${events.map(row=>`<div class="calendar-existing-item"><button type="button" class="calendar-existing-main" data-edit-calendar="${row.id}"><strong>${esc(row.title||'Мероприятие')}</strong><small>${row.amount!=null&&row.amount!==''?money(row.amount):'Без суммы'}${row.comment?` · ${esc(row.comment)}`:''}</small></button><button type="button" class="calendar-delete" data-delete-calendar="${row.id}" aria-label="Удалить запись">Удалить</button></div>`).join('')}</div>`:'<div class="calendar-empty-day">На этот день записей пока нет.</div>';
  calendarModal(`${calendarModalHead(edit?'Изменить мероприятие':'Мероприятие',calendarDateLabel(dateKey))}
    <div id="calendarNotice"></div>
    ${existing}
    <form id="husbandCalendarForm" class="calendar-form">
      <div class="field"><label>Что за мероприятие</label><input id="calendarTitle" maxlength="120" required value="${esc(edit?.title||'')}" placeholder="Например: день рождения, поездка"></div>
      <div class="field"><label>Сумма, ₸ <span class="field-hint">необязательно</span></label><input id="calendarAmount" type="number" min="0" step="1" inputmode="decimal" value="${edit?.amount??''}" placeholder="0"></div>
      <div class="field"><label>Комментарий</label><textarea id="calendarComment" rows="3" maxlength="500" placeholder="Дополнительные детали">${esc(edit?.comment||'')}</textarea></div>
      <div class="calendar-form-actions">${edit?'<button type="button" class="btn btn-soft" id="cancelCalendarEdit">Новая запись</button>':''}<button type="submit" class="btn btn-primary">${edit?'Сохранить изменения':'Сохранить'}</button></div>
    </form>`);
  document.querySelectorAll('[data-edit-calendar]').forEach(button=>button.onclick=()=>openHusbandDay(dateKey,button.dataset.editCalendar));
  document.querySelectorAll('[data-delete-calendar]').forEach(button=>button.onclick=async()=>{
    if(!confirm('Удалить эту запись календаря?'))return;
    button.disabled=true;
    if(await deleteCalendarRow(button.dataset.deleteCalendar)){openHusbandDay(dateKey)}
    else button.disabled=false;
  });
  const cancel=document.getElementById('cancelCalendarEdit');
  if(cancel)cancel.onclick=()=>openHusbandDay(dateKey);
  document.getElementById('husbandCalendarForm').onsubmit=async event=>{
    event.preventDefault();
    notice('calendarNotice','');
    const title=document.getElementById('calendarTitle').value.trim();
    const amountValue=document.getElementById('calendarAmount').value.trim();
    const comment=document.getElementById('calendarComment').value.trim();
    const amount=amountValue===''?null:Number(amountValue);
    if(!title)return notice('calendarNotice','Укажите мероприятие.');
    if(amount!=null&&(!Number.isFinite(amount)||amount<0))return notice('calendarNotice','Сумма указана неверно.');
    const fields={title,amount,comment:comment||null,client_name:null,service_name:null,start_time:null,duration_minutes:null};
    const row=await saveCalendarRow({
      id:edit?.id||null,
      createPayload:{family_id:state.family.id,person_id:person.id,kind:'event',entry_date:dateKey,created_by:state.user.id,...fields},
      updatePayload:fields
    });
    if(row){closeModal();renderApp()}
  };
  setTimeout(()=>document.getElementById('calendarTitle')?.focus(),0);
}

function appointmentOverlap(personId,dateKey,startTime,duration,ignoreId=null){
  const start=calendarMinutes(startTime),end=start+duration;
  return calendarEntriesOn(personId,dateKey,'appointment').some(row=>{
    if(row.id===ignoreId)return false;
    const rowStart=calendarMinutes(row.start_time),rowEnd=rowStart+Number(row.duration_minutes||30);
    return start<rowEnd&&end>rowStart;
  });
}
function openSalonAppointment(dateKey,startTime,editId=null){
  const person=calendarCurrentPerson();
  if(!person)return;
  const appointments=calendarEntriesOn(person.id,dateKey,'appointment');
  const edit=editId?appointments.find(row=>row.id===editId):null;
  const time=edit?calendarTimeText(edit.start_time):startTime;
  calendarModal(`${calendarModalHead(edit?'Изменить запись':'Записать клиента',`${calendarDateLabel(dateKey)} · ${time}`)}
    <div id="calendarNotice"></div>
    <form id="salonAppointmentForm" class="calendar-form">
      <div class="field"><label>Клиент</label><input id="salonClient" maxlength="120" required value="${esc(edit?.client_name||edit?.title||'')}" placeholder="Имя клиента"></div>
      <div class="field"><label>Услуга</label><input id="salonService" maxlength="160" value="${esc(edit?.service_name||'')}" placeholder="Например: стрижка, окрашивание"></div>
      <div class="field"><label>Длительность</label><select id="salonDuration"><option value="30" ${Number(edit?.duration_minutes||30)===30?'selected':''}>30 минут</option><option value="60" ${Number(edit?.duration_minutes||30)===60?'selected':''}>1 час</option></select></div>
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
    const comment=document.getElementById('salonComment').value.trim();
    if(!client)return notice('calendarNotice','Укажите имя клиента.');
    const end=calendarMinutes(time)+duration;
    if(end>22*60)return notice('calendarNotice','Запись должна завершиться не позднее 22:00.');
    if(appointmentOverlap(person.id,dateKey,time,duration,edit?.id||null))return notice('calendarNotice','Это время пересекается с другой записью.');
    const fields={title:client,client_name:client,service_name:service||null,start_time:time,duration_minutes:duration,amount:null,comment:comment||null};
    const row=await saveCalendarRow({
      id:edit?.id||null,
      createPayload:{family_id:state.family.id,person_id:person.id,kind:'appointment',entry_date:dateKey,created_by:state.user.id,...fields},
      updatePayload:fields
    });
    if(row){closeModal();renderApp()}
  };
  setTimeout(()=>document.getElementById('salonClient')?.focus(),0);
}

function bindHusbandCalendar(){
  document.getElementById('calendarPrevMonth').onclick=()=>calendarShiftMonth(-1);
  document.getElementById('calendarNextMonth').onclick=()=>calendarShiftMonth(1);
  document.querySelectorAll('[data-calendar-date]').forEach(button=>button.onclick=()=>openHusbandDay(button.dataset.calendarDate));
  const swipe=document.getElementById('husbandCalendarSwipe');
  if(!swipe)return;
  swipe.addEventListener('touchstart',event=>{
    const touch=event.changedTouches[0];
    calendarUi.touchStartX=touch.clientX;
    calendarUi.touchStartY=touch.clientY;
  },{passive:true});
  swipe.addEventListener('touchend',event=>{
    const touch=event.changedTouches[0];
    const dx=touch.clientX-calendarUi.touchStartX,dy=touch.clientY-calendarUi.touchStartY;
    if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.2)return;
    calendarShiftMonth(dx<0?1:-1);
  },{passive:true});
}
function bindWifeCalendar(){
  document.querySelectorAll('[data-salon-date]').forEach(button=>button.onclick=()=>{
    calendarUi.selectedDate=button.dataset.salonDate;
    renderApp();
  });
  document.querySelectorAll('[data-salon-time]').forEach(button=>button.onclick=()=>openSalonAppointment(calendarUi.selectedDate,button.dataset.salonTime));
  document.querySelectorAll('[data-appointment-id]').forEach(button=>{
    button.onclick=()=>{
      const appointment=(state.calendarEntries||[]).find(row=>row.id===button.dataset.appointmentId);
      if(appointment)openSalonAppointment(appointment.entry_date,calendarTimeText(appointment.start_time),appointment.id);
    };
  });
  const today=document.getElementById('salonToday');
  if(today)today.onclick=()=>{resetCalendarToToday();renderApp()};
  requestAnimationFrame(()=>document.querySelector('.salon-date.is-selected')?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'}));
}
function bindCalendar(){
  const person=calendarCurrentPerson();
  if(!person)return;
  if(person.label==='wife')bindWifeCalendar();else bindHusbandCalendar();
}

// Register the calendar without coupling it to the finance runtime modules.
state.calendarEntries=state.calendarEntries||[];

if(typeof NAV_ITEMS!=='undefined'&&!NAV_ITEMS.some(item=>item.view==='calendar')){
  const settingsIndex=NAV_ITEMS.findIndex(item=>item.view==='settings');
  NAV_ITEMS.splice(settingsIndex>=0?settingsIndex:NAV_ITEMS.length,0,{view:'calendar',label:'Календарь',icon:'calendar',primary:true});
}
if(typeof ROUTES!=='undefined'){
  ROUTES.calendar={page:()=>calendarPage(),bind:()=>bindCalendar()};
}

const calendarBaseBindCommon=bindCommon;
bindCommon=function(){
  calendarBaseBindCommon();
  const calendarNav=document.querySelector('.nav-item[data-view="calendar"]');
  if(calendarNav)calendarNav.onclick=()=>{
    releaseMobileScrollLock?.();
    resetCalendarToToday();
    state.view='calendar';
    state.journalLimit=50;
    renderApp();
    scrollOverviewTop?.();
  };
};

const calendarBaseLoadData=loadData;
loadData=async function(){
  await calendarBaseLoadData();
  if(!state.user||!state.family||!navigator.onLine||window.FinanceOfflineSession?.isLocalSession?.())return;
  try{
    const {data,error}=await sb.from('calendar_entries').select('*').eq('family_id',state.family.id).order('entry_date',{ascending:true}).order('start_time',{ascending:true});
    if(error)throw error;
    state.calendarEntries=data||[];
    if(typeof renderApp==='function')renderApp();
  }catch(error){
    console.error('Не удалось загрузить календарь',error);
  }
};
