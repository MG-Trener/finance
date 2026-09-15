// Final baroque presentation layer for Plan. This module only decorates markup.
(function(){
  if(typeof planPage!=='function')return;
  const basePlanPageBaroque=planPage;
  const baseBindPlanBaroque=typeof bindPlan==='function'?bindPlan:null;

  const PLAN_ART_COMMON=[
    'assets/plan-runtime/corner-tr.webp',
    'assets/plan-runtime/corner-bl.webp',
    'assets/plan-runtime/divider-ornate.webp',
    'assets/plan-runtime/divider-thin.webp',
    'assets/plan-runtime/fleur-crest.webp'
  ];
  const PLAN_ART_CALENDAR=[
    'assets/plan-runtime/expenses-plaque.webp',
    'assets/plan-runtime/piggy-plaque.webp',
    'assets/plan-runtime/plaque-wide.webp',
    'assets/plan-runtime/side-ornament.webp',
    'assets/plan-runtime/plaque-thin.webp'
  ];
  const PLAN_ART_EXPENSES=['assets/plan-runtime/expenses-plaque.webp','assets/plan-runtime/expenses-medallion.webp','assets/plan-runtime/plaque-small.webp'];
  const PLAN_ART_PIGGY=['assets/plan-runtime/piggy-plaque.webp','assets/plan-runtime/piggy-medallion.webp','assets/plan-runtime/plaque-small.webp'];
  const planArtPromises=new Map();

  function preloadPlanArt(src){
    if(planArtPromises.has(src))return planArtPromises.get(src);
    const promise=new Promise(resolve=>{
      const image=new Image();
      const done=()=>resolve(src);
      image.onload=done;
      image.onerror=done;
      image.decoding='async';
      image.src=src;
      if(image.complete)done();
    });
    planArtPromises.set(src,promise);
    return promise;
  }

  function criticalPlanArt(){
    const extra=planSection==='calendar'?PLAN_ART_CALENDAR:planSection==='piggy'?PLAN_ART_PIGGY:PLAN_ART_EXPENSES;
    return [...new Set([...PLAN_ART_COMMON,...extra])];
  }

  function revealPlanArtwork(){
    const root=document.querySelector('.plan-baroque-page.plan-artwork-loading');
    if(!root)return;
    let finished=false;
    const reveal=()=>{
      if(finished||!root.isConnected)return;
      finished=true;
      root.classList.remove('plan-artwork-loading');
      root.classList.add('plan-artwork-ready');
    };
    Promise.allSettled(criticalPlanArt().map(preloadPlanArt)).then(()=>requestAnimationFrame(reveal));
    setTimeout(reveal,650);
  }

  // Warm the calendar artwork as soon as this module loads. This makes the first
  // transition into Plan paint directly in the final raster-led style instead of
  // briefly showing the older CSS/SVG treatment while WebP files decode.
  [...PLAN_ART_COMMON,...PLAN_ART_CALENDAR].forEach(preloadPlanArt);

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
    root.classList.add('plan-baroque-page','is-baroque-calendar','plan-raster-artwork','plan-artwork-loading');
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
    root.classList.add('plan-baroque-page','is-baroque-subsection','plan-raster-artwork','plan-artwork-loading',isExpenses?'is-expenses-section':'is-piggy-section');
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

  if(baseBindPlanBaroque){
    bindPlan=function(){
      baseBindPlanBaroque();
      revealPlanArtwork();
    };
  }

  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();
