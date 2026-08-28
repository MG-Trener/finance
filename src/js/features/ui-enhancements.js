// Isolated UI enhancements: mobile selects, date dragging and tooltips.
(function(){
  let mobilePicker=null,mobilePickerSelect=null;

  function isMobilePicker(){
    const narrow=window.matchMedia('(max-width:760px)').matches;
    const coarse=window.matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
    const android=/Android/i.test(navigator.userAgent||'');
    return narrow||(android&&coarse&&window.innerWidth<=1400);
  }

  function closeMobilePicker(){
    if(!mobilePicker)return;
    mobilePicker.remove();mobilePicker=null;mobilePickerSelect=null;
    document.documentElement.classList.remove('mobile-picker-open');
  }

  function openMobilePicker(select){
    if(!select||select.disabled||!isMobilePicker())return;
    closeMobilePicker();mobilePickerSelect=select;
    const label=select.closest('.field')?.querySelector('label')?.textContent?.trim()||'Выберите значение';
    const options=[...select.options];
    const backdrop=document.createElement('div');backdrop.className='mobile-select-backdrop';backdrop.setAttribute('role','presentation');
    const sheet=document.createElement('div');sheet.className='mobile-select-sheet';sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-label',label);
    const head=document.createElement('div');head.className='mobile-select-head';
    const title=document.createElement('div');title.className='mobile-select-title';title.textContent=label;
    const close=document.createElement('button');close.type='button';close.className='mobile-select-close';close.setAttribute('aria-label','Закрыть');close.textContent='×';head.append(title,close);
    const list=document.createElement('div');list.className='mobile-select-options';
    options.forEach(opt=>{
      const button=document.createElement('button');button.type='button';
      button.className='mobile-select-option'+(opt.value===select.value?' selected':'');
      button.textContent=opt.textContent||'';button.disabled=opt.disabled;button.dataset.value=opt.value;
      button.onclick=()=>{
        if(button.disabled||!mobilePickerSelect)return;
        const target=mobilePickerSelect;
        target.value=button.dataset.value;
        target.dispatchEvent(new Event('change',{bubbles:true}));
        closeMobilePicker();
      };
      list.appendChild(button);
    });
    sheet.append(head,list);backdrop.appendChild(sheet);document.body.appendChild(backdrop);mobilePicker=backdrop;
    document.documentElement.classList.add('mobile-picker-open');
    close.onclick=closeMobilePicker;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeMobilePicker()});
    requestAnimationFrame(()=>list.querySelector('.selected')?.scrollIntoView({block:'nearest'}));
  }

  function selectFromTapTarget(target){
    const direct=target.closest?.('#txForm select');
    if(direct)return direct;
    const field=target.closest?.('#txForm .field');
    return field?.querySelector('select')||null;
  }

  function initMobileSelects(){
    if(window.__financeMobileSelects)return;window.__financeMobileSelects=true;

    // On phones the native select itself does not receive pointer events (CSS below).
    // Therefore a real tap ends as a normal click on its field, while a scrolling
    // gesture produces no click. This avoids both accidental opening while scrolling
    // and the Android/WebView issue where a second select (subcategory) would not open.
    document.addEventListener('click',e=>{
      if(!isMobilePicker())return;
      const select=selectFromTapTarget(e.target);
      if(!select||select.disabled)return;
      e.preventDefault();e.stopPropagation();
      openMobilePicker(select);
    },true);

    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobilePicker()});
    window.addEventListener('resize',()=>{if(mobilePicker&&!isMobilePicker())closeMobilePicker()});
  }

  function initDateDrag(){
    document.querySelectorAll('.pirate-date-track:not([data-drag-ready])').forEach(track=>{
      track.dataset.dragReady='1';let down=false,startX=0,startScroll=0,moved=false,capturedPointer=null;
      track.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        down=true;moved=false;capturedPointer=null;startX=e.clientX;startScroll=track.scrollLeft;
      });
      track.addEventListener('pointermove',e=>{
        if(!down)return;
        const dx=e.clientX-startX;
        if(!moved&&Math.abs(dx)>4){
          moved=true;track.classList.add('dragging');
          try{track.setPointerCapture?.(e.pointerId);capturedPointer=e.pointerId}catch(_){capturedPointer=null}
        }
        if(moved)track.scrollLeft=startScroll-dx;
      });
      const finish=e=>{
        if(!down)return;
        down=false;track.classList.remove('dragging');
        if(capturedPointer!==null){try{track.releasePointerCapture?.(capturedPointer)}catch(_){ }capturedPointer=null}
        if(moved){
          const swallow=ev=>{ev.preventDefault();ev.stopPropagation();track.removeEventListener('click',swallow,true)};
          track.addEventListener('click',swallow,true);
        }
      };
      track.addEventListener('pointerup',finish);track.addEventListener('pointercancel',finish);track.addEventListener('pointerleave',e=>{if(down&&moved)finish(e)});
    });
  }

  const tips={logout:'Выйти из семейной казны',allOperations:'Открыть полный журнал операций',createInvite:'Создать персональную ссылку для супруги',copyInvite:'Скопировать ссылку приглашения',navMore:'Открыть дополнительные разделы'};
  function tipText(el){if(el.dataset.tooltip)return el.dataset.tooltip;if(el.id&&tips[el.id])return tips[el.id];if(el.classList.contains('save-operation'))return'Сохранить операцию в семейный журнал';if(el.classList.contains('editTx')||el.classList.contains('editCat'))return'Редактировать';if(el.classList.contains('deleteTx')||el.classList.contains('deleteCat')||el.classList.contains('deleteBudget')||el.classList.contains('deleteRecurring'))return'Удалить';if(el.classList.contains('restoreTx'))return'Восстановить операцию';if(el.classList.contains('historyTx'))return'Показать историю изменений';if(el.classList.contains('toggleRecurring'))return'Пауза / возобновить';if(el.classList.contains('postRecurring'))return'Внести этот платеж сейчас';if(el.classList.contains('pirate-today'))return'Вернуться к сегодняшней дате';if(el.classList.contains('quick-pair'))return'Использовать эту недавнюю категорию';if(el.classList.contains('text-action'))return'Открыть раздел';if(el.matches('.segmented button'))return`Выбрать: ${(el.textContent||'').trim()}`;if(el.classList.contains('person-choice'))return`Выбрать: ${(el.querySelector('b')?.textContent||'').trim()}`;const text=(el.textContent||'').replace(/\s+/g,' ').trim();return text&&text.length<=42?text:''}

  let tooltip=document.querySelector('.ui-tooltip');if(!tooltip){tooltip=document.createElement('div');tooltip.className='ui-tooltip';document.body.appendChild(tooltip)}let current=null;
  function showTip(el){const text=tipText(el);if(!text)return;current=el;tooltip.textContent=text;tooltip.classList.add('show');const r=el.getBoundingClientRect(),tr=tooltip.getBoundingClientRect();let left=r.left+r.width/2-tr.width/2;left=Math.max(8,Math.min(window.innerWidth-tr.width-8,left));let top=r.top-tr.height-9;if(top<8)top=r.bottom+9;tooltip.style.left=`${left}px`;tooltip.style.top=`${top}px`}
  function hideTip(){current=null;tooltip.classList.remove('show')}
  function decorateTooltips(){document.querySelectorAll('button:not([data-tooltip-ready])').forEach(el=>{el.dataset.tooltipReady='1';el.addEventListener('mouseenter',()=>showTip(el));el.addEventListener('mouseleave',hideTip);el.addEventListener('focus',()=>showTip(el));el.addEventListener('blur',hideTip)})}
  let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;initDateDrag();decorateTooltips()})}
  new MutationObserver(schedule).observe(document.getElementById('app'),{subtree:true,childList:true});initMobileSelects();window.addEventListener('resize',()=>{if(current)showTip(current)});window.addEventListener('scroll',hideTip,true);window.addEventListener('load',schedule);window.addEventListener('DOMContentLoaded',schedule);setTimeout(schedule,0);
})();
