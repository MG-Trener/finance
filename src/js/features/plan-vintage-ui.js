// Vintage visual presentation layer for the Plan section.
// Keeps the existing Plan data/event logic intact and only decorates its markup.
(function(){
  if(typeof planPage!=='function')return;

  const basePlanPageVintage=planPage;

  function ensureReferenceFont(){
    if(document.querySelector('link[data-plan-reference-font]'))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap';
    link.dataset.planReferenceFont='1';
    document.head.appendChild(link);
  }
  ensureReferenceFont();

  const actionIcon=(kind)=>kind==='expenses'
    ?`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-11h2Z"/><path d="M2.5 7V5.8a2.3 2.3 0 0 1 2.3-2.3h11.7V7"/><path d="M15.5 11h5v4h-5a2 2 0 1 1 0-4Z"/><circle cx="16.3" cy="13" r=".6"/></svg>`
    :`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11.5c0-3.6 3-6.5 7-6.5 3.5 0 6.3 2 7.1 4.8l2.1 1v4l-2.1.8a6.7 6.7 0 0 1-2.2 2.2V21h-2.8v-2H9.4v2H6.7v-3.1A6.5 6.5 0 0 1 5 13.5v-2Z"/><path d="M8.5 6 7 3.8c2.6-.6 4.6-.2 6.2 1.2"/><circle cx="15.7" cy="9.4" r=".7"/><path d="M3 12H1.8"/></svg>`;

  function vintageEventIcon(type){
    if(type==='birthday')return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 23h28v16H10z"/><path d="M7 18h34v7H7z"/><path d="M24 18v21M11 31h26"/><path d="M24 18c-5-5-11-5-11-1 0 3 5 4 11 1Zm0 0c5-5 11-5 11-1 0 3-5 4-11 1Z"/></svg>`;
    if(type==='meeting')return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m8 20 8-7 8 6-7 8-9-7Zm32 0-8-7-8 6 7 8 9-7Z"/><path d="m17 27 7-7 8 8-8 8-7-7"/><path d="m14 25 10 10c2 2 5-1 3-3m3-1 2 2c2 2 5-1 3-3l-8-8"/></svg>`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 8 4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4L24 31.9l-9.4 4.9 1.8-10.4L8.8 19l10.5-1.5L24 8Z"/></svg>`;
  }

  function decorateActionTabs(root){
    const tabs=root.querySelector('.plan-tabs-v2');
    if(!tabs)return;
    tabs.classList.add('plan-vintage-actions');
    const buttons=[...tabs.querySelectorAll('[data-plan-section]')];
    const expenses=buttons.find(button=>button.dataset.planSection==='recurring');
    const piggy=buttons.find(button=>button.dataset.planSection==='piggy');
    if(expenses){
      expenses.classList.add('plan-vintage-action','is-expenses');
      expenses.title='Ежемесячные затраты';
      const label=expenses.querySelector('span');
      if(label)label.textContent='Затраты';
      if(!expenses.querySelector('.plan-action-icon'))expenses.insertAdjacentHTML('afterbegin',`<span class="plan-action-icon">${actionIcon('expenses')}</span>`);
    }
    if(piggy){
      piggy.classList.add('plan-vintage-action','is-piggy');
      const label=piggy.querySelector('span');
      if(label)label.textContent='Копилка';
      if(!piggy.querySelector('.plan-action-icon'))piggy.insertAdjacentHTML('afterbegin',`<span class="plan-action-icon">${actionIcon('piggy')}</span>`);
    }
  }

  function compactDateLabel(value){
    return String(value||'')
      .replace(/^[^,]+,\s*/,'')
      .replace(/\s+\d{4}\s*г?\.?$/i,'')
      .trim();
  }

  function decorateEventIcons(root){
    root.querySelectorAll('.plan-day-type-icon,.plan-event-icon').forEach(icon=>{
      const text=icon.textContent||'';
      const type=text.includes('🎂')?'birthday':text.includes('🤝')?'meeting':'other';
      icon.classList.add(type==='birthday'?'is-birthday':type==='meeting'?'is-meeting':'is-generic-event','plan-vintage-event-svg');
      icon.innerHTML=vintageEventIcon(type);
    });
    root.querySelectorAll('.plan-calendar-legend .plan-legend-icon').forEach(icon=>{
      const text=icon.textContent||'';
      const type=text.includes('🎂')?'birthday':text.includes('🤝')?'meeting':'other';
      icon.classList.add('plan-vintage-legend-svg');
      icon.innerHTML=vintageEventIcon(type);
    });
  }

  function decorateCalendar(root){
    const card=root.querySelector('.plan-calendar-card');
    if(!card)return;
    card.classList.add('plan-vintage-calendar');
    card.insertAdjacentHTML('afterbegin','<div class="plan-vintage-crown" aria-hidden="true"><span>⚜</span></div>');

    const toolbar=card.querySelector('.calendar-month-toolbar');
    if(toolbar){
      toolbar.classList.add('plan-vintage-month-toolbar');
      const center=toolbar.querySelector(':scope > div');
      const title=center?.querySelector('strong')?.textContent?.trim()||'';
      const match=title.match(/^(.*)\s+(\d{4})$/);
      const month=match?.[1]||title;
      const year=match?.[2]||String(state.year||'');
      if(center){
        center.classList.add('plan-vintage-month-title');
        center.innerHTML=`<span class="plan-vintage-flourish" aria-hidden="true">❦</span><strong>${esc(month)}</strong><span class="plan-vintage-year">${esc(year)}</span><small>Один клик — события · двойной — добавить</small>`;
      }
    }

    decorateEventIcons(root);

    const list=root.querySelector('.plan-day-list-card,.plan-day-empty');
    if(list)list.classList.add('plan-vintage-events');
    const listHead=root.querySelector('.plan-day-list-head');
    if(listHead){
      const label=listHead.querySelector('span');
      const title=listHead.querySelector('strong');
      if(label)label.textContent='Семейный план';
      if(title)title.textContent=`События на ${compactDateLabel(title.textContent)}`;
    }

    const workspace=root.querySelector('.plan-calendar-workspace');
    if(workspace&&!workspace.querySelector('.plan-vintage-motto')){
      workspace.insertAdjacentHTML('beforeend',`<div class="plan-vintage-motto" aria-hidden="true"><span></span><p>Большие дела<br>начинаются с сегодня</p><span></span></div>`);
    }
  }

  function decorateSubsection(root){
    const isExpenses=planSection==='recurring';
    const panel=root.querySelector(isExpenses?'.plan-recurring-panel':'.piggy-bank-panel');
    if(!panel)return;
    panel.classList.add('plan-vintage-subsection-panel',isExpenses?'is-expenses':'is-piggy');

    const heading=root.querySelector('.plan-vintage-heading');
    if(heading){
      heading.classList.add('plan-vintage-subsection-heading');
      const title=heading.querySelector('.page-title');
      const subtitle=heading.querySelector('.page-subtitle');
      if(title)title.textContent=isExpenses?'Ежемесячные затраты':'Семейная копилка';
      if(subtitle)subtitle.textContent=isExpenses
        ?'Регулярные обязательства и запланированные платежи'
        :'Накопления семьи в разных валютах';
      heading.insertAdjacentHTML('afterbegin',`<div class="plan-subsection-emblem" aria-hidden="true">${isExpenses?'◆':'♜'}</div>`);
    }

    const back=root.querySelector('.plan-subsection-back');
    if(back){
      back.classList.add('plan-vintage-back');
      const button=back.querySelector('#planBackToCalendar');
      if(button)button.innerHTML='<span aria-hidden="true">‹</span> Вернуться к календарю';
    }

    if(isExpenses){
      root.querySelector('.plan-summary-strip')?.classList.add('plan-vintage-summary');
      root.querySelector('.plan-editor-card')?.classList.add('plan-vintage-editor');
      root.querySelector('.plan-list-column')?.classList.add('plan-vintage-list');
      root.querySelectorAll('.recurring-row-v3').forEach(row=>row.classList.add('plan-vintage-recurring-row'));
      root.querySelectorAll('.reminder-card').forEach(row=>row.classList.add('plan-vintage-reminder'));
    }else{
      root.querySelector('.piggy-toolbar')?.classList.add('plan-vintage-piggy-toolbar');
      root.querySelector('.piggy-meta')?.classList.add('plan-vintage-piggy-meta');
      root.querySelectorAll('.piggy-currency-card').forEach(card=>card.classList.add('plan-vintage-currency-card'));
      root.querySelector('.piggy-chest-wrap')?.classList.add('plan-vintage-chest');
    }

    if(!panel.querySelector('.plan-vintage-subsection-footer')){
      panel.insertAdjacentHTML('beforeend',`<div class="plan-vintage-subsection-footer" aria-hidden="true"><span></span><b>⚜</b><span></span></div>`);
    }
  }

  function addReferenceOrnaments(root){
    root.classList.add('plan-reference-ornate');
    if(planSection==='calendar'&&!root.querySelector('.plan-frame-corner')){
      ['tl','tr','bl','br'].forEach(pos=>root.insertAdjacentHTML('beforeend',`<span class="plan-frame-corner ${pos}" aria-hidden="true"></span>`));
    }
  }

  planPage=function(){
    const html=basePlanPageVintage();
    const template=document.createElement('template');
    template.innerHTML=html;
    const root=document.createElement('div');
    root.className=`plan-vintage-page ${planSection==='calendar'?'is-calendar':'is-subsection'}`;
    while(template.content.firstChild)root.appendChild(template.content.firstChild);

    const heading=root.querySelector('.plan-page-head');
    if(heading)heading.classList.add('plan-vintage-heading');
    decorateActionTabs(root);
    if(planSection==='calendar')decorateCalendar(root);
    else decorateSubsection(root);
    addReferenceOrnaments(root);

    return root.outerHTML;
  };

  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();
