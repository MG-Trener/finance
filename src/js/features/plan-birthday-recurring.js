// Birthdays in Plan are annual shared events. Meetings and generic events remain one-off and private.
(function(){
  const PLAN_CONTEXT='plan';

  function ownPerson(){
    return state?.people?.find?.(person=>person.linked_user_id===state.user?.id)||null;
  }
  function isPlanEvent(row){
    return row?.kind==='event'&&row?.calendar_context===PLAN_CONTEXT;
  }
  function isBirthday(row){return row?.event_type==='birthday'}
  function monthDay(value){return String(value||'').slice(5,10)}
  function occursOn(row,dateKey){
    if(!isPlanEvent(row))return false;
    return isBirthday(row)?monthDay(row.entry_date)===monthDay(dateKey):String(row.entry_date||'')===String(dateKey||'');
  }
  function canSee(row,own){
    return isBirthday(row)||Boolean(own&&row?.person_id===own.id);
  }
  function allOn(dateKey){
    return (state?.calendarEntries||[])
      .filter(row=>occursOn(row,dateKey))
      .sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  }
  function visibleOn(dateKey,own=ownPerson()){
    return allOn(dateKey).filter(row=>canSee(row,own));
  }
  function icon(type){return type==='birthday'?'🎂':type==='meeting'?'🤝':'✦'}
  function label(type){return type==='birthday'?'День рождения':type==='meeting'?'Встреча':'Событие'}
  function html(value){
    if(typeof esc==='function')return esc(String(value??''));
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function personName(personId){
    const person=(state?.people||[]).find(item=>String(item.id)===String(personId));
    return person?.display_name||'Участник';
  }
  function dateLabel(dateKey){
    return typeof calendarDateLabel==='function'?calendarDateLabel(dateKey):dateKey;
  }

  function paintDays(root,own){
    root.querySelectorAll('[data-plan-date]').forEach(button=>{
      const key=button.dataset.planDate||'';
      const events=visibleOn(key,own);
      button.classList.toggle('has-entry',events.length>0);
      button.querySelector('.plan-day-icons')?.remove();
      button.querySelector('.calendar-entry-count')?.remove();
      const clean=(button.getAttribute('aria-label')||'').replace(/, мероприятий: \d+$/,'');
      button.setAttribute('aria-label',events.length?`${clean}, мероприятий: ${events.length}`:clean);
      if(!events.length)return;
      const types=[...new Set(events.map(row=>row.event_type||'other'))];
      const icons=document.createElement('span');
      icons.className='plan-day-icons';
      icons.innerHTML=types.map(type=>`<span class="plan-day-type-icon ${type==='other'?'is-generic':''}" aria-hidden="true">${icon(type)}</span>`).join('');
      const count=document.createElement('span');
      count.className='calendar-entry-count';
      count.textContent=String(events.length);
      button.append(icons,count);
    });
  }

  function eventListMarkup(dateKey,events,own){
    if(!events.length){
      return `<div class="card plan-day-empty"><strong>${html(dateLabel(dateKey))}</strong><span>На эту дату у вас нет личных планов или общих дней рождения.</span><small>Двойной клик по дате — добавить своё мероприятие.</small></div>`;
    }
    return `<section class="card plan-day-list-card">
      <div class="plan-day-list-head"><div><span>Мои планы и общие дни рождения</span><strong>${html(dateLabel(dateKey))}</strong></div><b>${events.length}</b></div>
      <div class="plan-day-events">${events.map(row=>{
        const editable=Boolean(own&&row.person_id===own.id);
        const annual=isBirthday(row)?' · ежегодно':'';
        return `<article class="plan-day-event ${row.event_type?`type-${row.event_type}`:'type-other'}">
          <span class="plan-event-icon" aria-hidden="true">${icon(row.event_type)}</span>
          <div class="plan-event-copy"><strong>${html(row.title||'Мероприятие')}</strong><small>${html(personName(row.person_id))} · ${html(label(row.event_type))}${annual}</small>${row.comment?`<p>${html(row.comment)}</p>`:''}</div>
          ${editable?`<button type="button" class="btn btn-soft btn-small plan-edit-event" data-plan-edit="${html(row.id)}">Изменить</button>`:''}
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  function paintSelectedList(root,own){
    const selected=root.querySelector('[data-plan-date].is-selected');
    const dateKey=selected?.dataset?.planDate;
    if(!dateKey)return;
    const workspace=root.querySelector('.plan-calendar-workspace');
    const current=workspace?.querySelector('.plan-day-list-card, .plan-day-empty');
    if(!current)return;
    const template=document.createElement('template');
    template.innerHTML=eventListMarkup(dateKey,visibleOn(dateKey,own),own);
    const replacement=template.content.firstElementChild;
    if(replacement)current.replaceWith(replacement);
  }

  if(typeof planPage==='function'){
    const base=planPage;
    planPage=function(){
      const markup=base();
      if(typeof planSection!=='undefined'&&planSection!=='calendar')return markup;
      const template=document.createElement('template');
      template.innerHTML=markup;
      const root=template.content.querySelector('.plan-vintage-page')||template.content;
      const own=ownPerson();
      paintDays(root,own);
      paintSelectedList(root,own);
      return template.innerHTML;
    };
  }

  window.FinanceAnnualBirthdays={occursOn,visibleOn};
})();