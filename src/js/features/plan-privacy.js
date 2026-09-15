// Plan privacy: birthdays are shared; meetings and generic events are visible only to their owner.
(function(){
  const PLAN_CONTEXT='plan';
  function ownPerson(){
    return state?.people?.find?.(person=>person.linked_user_id===state.user?.id)||null;
  }
  function isPlanEvent(row){return row?.kind==='event'&&row?.calendar_context===PLAN_CONTEXT}
  function canSee(row,own){return row?.event_type==='birthday'||Boolean(own&&row?.person_id===own.id)}
  function allOn(dateKey){
    return (state?.calendarEntries||[]).filter(row=>isPlanEvent(row)&&row.entry_date===dateKey)
      .sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
  }
  function visibleOn(dateKey,own){return allOn(dateKey).filter(row=>canSee(row,own))}
  function icon(type){return type==='birthday'?'🎂':type==='meeting'?'🤝':'✦'}
  function sanitizeDayButtons(root,own){
    root.querySelectorAll('[data-plan-date]').forEach(button=>{
      const key=button.dataset.planDate||'';
      const visible=visibleOn(key,own);
      button.classList.toggle('has-entry',visible.length>0);
      button.querySelector('.plan-day-icons')?.remove();
      button.querySelector('.calendar-entry-count')?.remove();
      const cleanLabel=(button.getAttribute('aria-label')||'').replace(/, мероприятий: \d+$/,'');
      button.setAttribute('aria-label',visible.length?`${cleanLabel}, мероприятий: ${visible.length}`:cleanLabel);
      if(!visible.length)return;
      const types=[...new Set(visible.map(row=>row.event_type||'other'))];
      const icons=document.createElement('span');icons.className='plan-day-icons';
      icons.innerHTML=types.map(type=>`<span class="plan-day-type-icon ${type==='other'?'is-generic':''}" aria-hidden="true">${icon(type)}</span>`).join('');
      const count=document.createElement('span');count.className='calendar-entry-count';count.textContent=String(visible.length);
      button.append(icons,count);
    });
  }
  function sanitizeSelectedList(root,own){
    const selected=root.querySelector('[data-plan-date].is-selected');
    const key=selected?.dataset?.planDate;
    if(!key)return;
    const all=allOn(key),visible=all.filter(row=>canSee(row,own));
    const list=root.querySelector('.plan-day-events');
    const card=root.querySelector('.plan-day-list-card');
    if(list&&card){
      [...list.querySelectorAll('.plan-day-event')].forEach((article,index)=>{
        if(!canSee(all[index],own))article.remove();
      });
      const counter=card.querySelector('.plan-day-list-head b');if(counter)counter.textContent=String(visible.length);
      const label=card.querySelector('.plan-day-list-head span');if(label)label.textContent='Мои планы и общие дни рождения';
      if(!visible.length){
        const empty=document.createElement('div');empty.className='card plan-day-empty';
        const dateText=card.querySelector('.plan-day-list-head strong')?.textContent||key;
        empty.innerHTML=`<strong>${typeof esc==='function'?esc(dateText):dateText}</strong><span>На эту дату у вас нет личных планов или общих дней рождения.</span><small>Двойной клик по дате — добавить своё мероприятие.</small>`;
        card.replaceWith(empty);
      }
    }
  }
  if(typeof planPage==='function'){
    const base=planPage;
    planPage=function(){
      const html=base();
      if(typeof planSection!=='undefined'&&planSection!=='calendar')return html;
      const template=document.createElement('template');template.innerHTML=html;
      const root=template.content.querySelector('.plan-vintage-page')||template.content;
      const own=ownPerson();
      sanitizeDayButtons(root,own);sanitizeSelectedList(root,own);
      return template.innerHTML;
    };
  }
  window.FinancePlanPrivacy={ownPerson,visibleOn};
})();