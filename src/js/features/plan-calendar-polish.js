// Final Plan calendar presentation details: generic event legend and persistent today marker.
(function(){
  if(typeof planPage!=='function')return;
  const basePlanPage=planPage;

  function polishCalendarMarkup(html){
    if(planSection!=='calendar')return html;
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=template.content.querySelector('.plan-baroque-page,.plan-vintage-page');
    if(!root)return html;

    // Untyped Plan rows are ordinary family events. Give them a real visual
    // identity instead of the old bullet / "Без типа" wording.
    root.querySelectorAll('.plan-day-type-icon.is-generic').forEach(icon=>{icon.textContent='✦'});
    root.querySelectorAll('.plan-day-event.type-other .plan-event-copy small').forEach(label=>{
      label.textContent=String(label.textContent||'').replace(/Без типа\s*$/,'Событие');
    });

    const legend=root.querySelector('.plan-calendar-legend');
    if(legend&&!legend.querySelector('[data-plan-legend-event]')){
      legend.insertAdjacentHTML('beforeend','<span data-plan-legend-event="1"><span class="plan-legend-icon plan-legend-event-icon" aria-hidden="true">✦</span>Событие</span>');
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