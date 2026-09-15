// Vintage event/conflict modal decorator for the family Plan.
// Wraps the shared calendarModal without changing Plan persistence logic.
(function(){
  if(typeof calendarModal!=='function')return;

  const baseCalendarModalVintage=calendarModal;

  function choiceIcon(type){
    if(type==='birthday')return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 23h28v16H10z"/><path d="M7 18h34v7H7z"/><path d="M24 18v21M11 31h26"/><path d="M24 18c-5-5-11-5-11-1 0 3 5 4 11 1Zm0 0c5-5 11-5 11-1 0 3-5 4-11 1Z"/></svg>`;
    if(type==='meeting')return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m8 20 8-7 8 6-7 8-9-7Zm32 0-8-7-8 6 7 8 9-7Z"/><path d="m17 27 7-7 8 8-8 8-7-7"/><path d="m14 25 10 10c2 2 5-1 3-3m3-1 2 2c2 2 5-1 3-3l-8-8"/></svg>`;
    return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m24 8 4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4L24 31.9l-9.4 4.9 1.8-10.4L8.8 19l10.5-1.5L24 8Z"/></svg>`;
  }

  function typeChoice(value,label,caption,current){
    const selected=current===value;
    return `<button type="button" class="plan-event-type-choice ${selected?'is-selected':''}" data-plan-event-type-choice="${value}" role="radio" aria-checked="${selected?'true':'false'}">
      <span class="plan-event-type-choice-icon">${choiceIcon(value)}</span>
      <strong>${label}</strong>
      <small>${caption}</small>
    </button>`;
  }

  function installTypeChoices(modal){
    const select=modal.querySelector('#planEventType');
    if(!select||modal.querySelector('.plan-event-type-choices'))return;
    const field=select.closest('.field');
    if(!field)return;
    const current=select.value||'';
    const hidden=document.createElement('input');
    hidden.type='hidden';
    hidden.id='planEventType';
    hidden.value=current;
    select.replaceWith(hidden);
    field.classList.add('plan-event-type-field');
    hidden.insertAdjacentHTML('afterend',`<div class="plan-event-type-choices" role="radiogroup" aria-label="Тип мероприятия">
      ${typeChoice('','Без типа','Обычное дело',current)}
      ${typeChoice('birthday','День рождения','Важная дата',current)}
      ${typeChoice('meeting','Встреча','Личная встреча',current)}
    </div>`);
    const buttons=[...field.querySelectorAll('[data-plan-event-type-choice]')];
    buttons.forEach(button=>button.addEventListener('click',()=>{
      hidden.value=button.dataset.planEventTypeChoice||'';
      buttons.forEach(item=>{
        const active=item===button;
        item.classList.toggle('is-selected',active);
        item.setAttribute('aria-checked',active?'true':'false');
      });
    }));
  }

  function decorateEventModal(modal){
    modal.classList.add('plan-event-editor-modal','plan-vintage-modal-shell');
    if(!modal.querySelector('.plan-modal-crest'))modal.insertAdjacentHTML('afterbegin','<div class="plan-modal-crest" aria-hidden="true"><span>⚜</span></div>');
    const owner=modal.querySelector('.plan-event-owner');
    if(owner&&!owner.querySelector('.plan-owner-seal'))owner.insertAdjacentHTML('afterbegin','<span class="plan-owner-seal" aria-hidden="true">✦</span>');
    installTypeChoices(modal);
    const title=modal.querySelector('#planEventTitle');
    const comment=modal.querySelector('#planEventComment');
    if(title)title.closest('.field')?.classList.add('plan-vintage-input-field');
    if(comment)comment.closest('.field')?.classList.add('plan-vintage-input-field');
    modal.querySelector('.calendar-form-actions')?.classList.add('plan-vintage-form-actions');
    const submit=modal.querySelector('#planEventForm button[type="submit"]');
    if(submit)submit.classList.add('plan-vintage-save-event');
    const remove=modal.querySelector('#deletePlanEvent');
    if(remove)remove.classList.add('plan-vintage-delete-event');
  }

  function decorateConflictModal(modal){
    modal.classList.add('plan-conflict-modal-vintage','plan-vintage-modal-shell');
    if(!modal.querySelector('.plan-modal-crest'))modal.insertAdjacentHTML('afterbegin','<div class="plan-modal-crest is-warning" aria-hidden="true"><span>!</span></div>');
    modal.querySelectorAll('.plan-conflict-warning li').forEach(item=>{
      if(!item.querySelector('.plan-conflict-bullet'))item.insertAdjacentHTML('afterbegin','<span class="plan-conflict-bullet" aria-hidden="true">◆</span>');
    });
    modal.querySelector('.plan-conflict-actions')?.classList.add('plan-vintage-form-actions');
  }

  calendarModal=function(markup){
    baseCalendarModalVintage(markup);
    const modal=document.querySelector('#modal .calendar-modal');
    if(!modal)return;
    if(String(markup).includes('id="planEventForm"'))decorateEventModal(modal);
    else if(String(markup).includes('plan-conflict-warning'))decorateConflictModal(modal);
  };
  window.calendarModal=calendarModal;
})();
