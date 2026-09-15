// Final baroque presentation layer for Plan. This module only decorates markup.
(function(){
  if(typeof planPage!=='function')return;
  const basePlanPageBaroque=planPage;

  function addOuterFrame(root){
    if(root.querySelector('.plan-baroque-corner'))return;
    root.insertAdjacentHTML('afterbegin',
      '<span class="plan-baroque-top-ornament" aria-hidden="true"></span>'+
      '<span class="plan-baroque-corner is-tl" aria-hidden="true"></span>'+
      '<span class="plan-baroque-corner is-tr" aria-hidden="true"></span>'+
      '<span class="plan-baroque-corner is-bl" aria-hidden="true"></span>'+
      '<span class="plan-baroque-corner is-br" aria-hidden="true"></span>'+
      '<span class="plan-baroque-bottom-fleur" aria-hidden="true"></span>'
    );
  }

  function addCalendarDecor(root){
    root.classList.add('plan-baroque-page','is-baroque-calendar','plan-raster-artwork');
    addOuterFrame(root);
    if(!root.querySelector('.plan-baroque-side')){
      root.insertAdjacentHTML('afterbegin','<span class="plan-baroque-side is-left" aria-hidden="true"></span><span class="plan-baroque-side is-right" aria-hidden="true"></span>');
    }
    const actions=root.querySelector('.plan-vintage-actions');
    actions?.classList.add('plan-baroque-actions');
    actions?.querySelectorAll('.plan-vintage-action').forEach(button=>{
      button.classList.add('plan-baroque-action');
      if(!button.querySelector('.plan-baroque-button-glint'))button.insertAdjacentHTML('beforeend','<span class="plan-baroque-button-glint" aria-hidden="true"></span>');
    });

    const card=root.querySelector('.plan-vintage-calendar');
    if(card){
      card.classList.add('plan-baroque-calendar-shell');
      if(!card.querySelector('.plan-baroque-inner-frame'))card.insertAdjacentHTML('afterbegin','<span class="plan-baroque-inner-frame" aria-hidden="true"></span>');
    }
    const toolbar=root.querySelector('.plan-vintage-month-toolbar');
    if(toolbar){
      toolbar.classList.add('plan-baroque-month-stage');
      if(!toolbar.querySelector('.plan-baroque-laurel')){
        toolbar.insertAdjacentHTML('afterbegin','<span class="plan-baroque-laurel is-left" aria-hidden="true"></span><span class="plan-baroque-laurel is-right" aria-hidden="true"></span>');
      }
    }
    root.querySelector('#planPrevMonth')?.classList.add('plan-baroque-arrow','is-prev');
    root.querySelector('#planNextMonth')?.classList.add('plan-baroque-arrow','is-next');
    root.querySelector('.plan-vintage-month-title')?.classList.add('plan-baroque-month-title');
    root.querySelector('.husband-calendar-swipe')?.classList.add('plan-baroque-grid-frame');
    root.querySelector('.plan-calendar-legend')?.classList.add('plan-baroque-legend');

    const events=root.querySelector('.plan-vintage-events');
    if(events){
      events.classList.add('plan-baroque-events');
      if(!events.querySelector('.plan-baroque-event-crown'))events.insertAdjacentHTML('afterbegin','<span class="plan-baroque-event-crown" aria-hidden="true"></span>');
    }
    root.querySelector('.plan-vintage-motto')?.classList.add('plan-baroque-motto');
  }

  function addSubsectionDecor(root){
    const isExpenses=planSection==='recurring';
    root.classList.add('plan-baroque-page','is-baroque-subsection','plan-raster-artwork',isExpenses?'is-expenses-section':'is-piggy-section');
    addOuterFrame(root);
    root.querySelector('.plan-vintage-actions')?.classList.add('plan-baroque-actions');
    root.querySelectorAll('.plan-vintage-action').forEach(button=>button.classList.add('plan-baroque-action'));
    root.querySelector('.plan-vintage-subsection-heading')?.classList.add('plan-baroque-subsection-heading');
    root.querySelector('.plan-vintage-subsection-panel')?.classList.add('plan-baroque-subsection-panel');
    root.querySelector('.plan-vintage-back')?.classList.add('plan-baroque-back');
  }

  planPage=function(){
    const html=basePlanPageBaroque();
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=template.content.querySelector('.plan-vintage-page');
    if(!root)return html;
    if(planSection==='calendar')addCalendarDecor(root);else addSubsectionDecor(root);
    return template.innerHTML;
  };

  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();
