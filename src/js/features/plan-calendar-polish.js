// Final Plan calendar presentation details: baroque event artwork and persistent today marker.
(function(){
  if(typeof planPage!=='function')return;
  const basePlanPage=planPage;

  function polishCalendarMarkup(html){
    if(planSection!=='calendar')return html;
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=template.content.querySelector('.plan-baroque-page,.plan-vintage-page');
    if(!root)return html;

    // Normalize legacy Plan event markers. No system emoji are shown in the final UI:
    // birthday, meeting and generic event all use dedicated baroque runtime artwork.
    root.querySelectorAll('.plan-day-type-icon').forEach(icon=>{
      const text=String(icon.textContent||'').trim();
      if(text==='🎂')icon.classList.add('is-birthday');
      else if(text==='🤝')icon.classList.add('is-meeting');
      else icon.classList.add('is-generic');
      icon.textContent='';
    });
    root.querySelectorAll('.plan-day-event.type-birthday .plan-event-icon').forEach(icon=>{icon.classList.add('is-birthday');icon.textContent=''});
    root.querySelectorAll('.plan-day-event.type-meeting .plan-event-icon').forEach(icon=>{icon.classList.add('is-meeting');icon.textContent=''});
    root.querySelectorAll('.plan-day-event.type-other .plan-event-icon').forEach(icon=>{icon.classList.add('is-generic');icon.textContent=''});
    root.querySelectorAll('.plan-day-event.type-other .plan-event-copy small').forEach(label=>{
      label.textContent=String(label.textContent||'').replace(/Без типа\s*$/,'Событие');
    });

    const legend=root.querySelector('.plan-calendar-legend');
    if(legend){
      const items=[...legend.querySelectorAll(':scope > span')];
      items.forEach(item=>{
        const text=String(item.textContent||'');
        const icon=item.querySelector('.plan-legend-icon');
        if(!icon)return;
        if(/День рождения/i.test(text))icon.classList.add('plan-legend-birthday-icon');
        else if(/Встреча/i.test(text))icon.classList.add('plan-legend-meeting-icon');
        icon.textContent='';
      });
      if(!legend.querySelector('[data-plan-legend-event]')){
        legend.insertAdjacentHTML('beforeend','<span data-plan-legend-event="1"><span class="plan-legend-icon plan-legend-event-icon" aria-hidden="true"></span>Событие</span>');
      }
    }

    // Today has its own overlay so the blinking gold frame remains visible even
    // when today is also the selected date.
    root.querySelectorAll('.plan-calendar-day.is-today').forEach(day=>{
      if(!day.querySelector('.plan-today-frame'))day.insertAdjacentHTML('afterbegin','<span class="plan-today-frame" aria-hidden="true"></span>');
    });

    return template.innerHTML;
  }

  planPage=function(){return polishCalendarMarkup(basePlanPage())};
  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();