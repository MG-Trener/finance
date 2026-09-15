// Vintage visual presentation layer for the Plan section.
// Keeps the existing Plan data/event logic intact and only decorates its markup.
(function(){
  if(typeof planPage!=='function')return;

  const basePlanPageVintage=planPage;

  const actionIcon=(kind)=>kind==='expenses'
    ?`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 6.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2v-11h2Z"/><path d="M2.5 7V5.8a2.3 2.3 0 0 1 2.3-2.3h11.7V7"/><path d="M15.5 11h5v4h-5a2 2 0 1 1 0-4Z"/><circle cx="16.3" cy="13" r=".6"/></svg>`
    :`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11.5c0-3.6 3-6.5 7-6.5 3.5 0 6.3 2 7.1 4.8l2.1 1v4l-2.1.8a6.7 6.7 0 0 1-2.2 2.2V21h-2.8v-2H9.4v2H6.7v-3.1A6.5 6.5 0 0 1 5 13.5v-2Z"/><path d="M8.5 6 7 3.8c2.6-.6 4.6-.2 6.2 1.2"/><circle cx="15.7" cy="9.4" r=".7"/><path d="M3 12H1.8"/></svg>`;

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

    root.querySelectorAll('.plan-day-type-icon,.plan-event-icon').forEach(icon=>{
      const text=icon.textContent||'';
      if(text.includes('🎂'))icon.classList.add('is-birthday');
      else if(text.includes('🤝'))icon.classList.add('is-meeting');
      else icon.classList.add('is-generic-event');
    });

    const list=root.querySelector('.plan-day-list-card,.plan-day-empty');
    if(list)list.classList.add('plan-vintage-events');
    const workspace=root.querySelector('.plan-calendar-workspace');
    if(workspace&&!workspace.querySelector('.plan-vintage-motto')){
      workspace.insertAdjacentHTML('beforeend',`<div class="plan-vintage-motto" aria-hidden="true"><span></span><p>Большие дела<br>начинаются с сегодня</p><span></span></div>`);
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
    else root.querySelector('.plan-subsection-back')?.classList.add('plan-vintage-back');

    return root.outerHTML;
  };

  if(typeof recurringPage==='function')recurringPage=function(){return planPage()};
})();
