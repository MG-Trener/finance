// Refactored from phase12.js: tooltips, draggable date ribbon, overview current-date header.
(function(){
  const previousHeader=header;

  function currentDateMarkup(){
    const now=new Date();
    const day=String(now.getDate()).padStart(2,'0');
    const text=now.toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    return `<div class="current-date-info" aria-label="Текущая дата"><div class="date-medallion">${day}</div><div><span>Сегодня</span><b>${esc(text)}</b></div></div>`;
  }

  header=function(){
    if(state.view!=='overview')return previousHeader();
    return `<header class="topbar"><div class="title"><h1>Семейный бюджет</h1><p>Текущий обзор семейной казны</p></div><div class="top-actions">${currentDateMarkup()}<button class="btn btn-soft" id="logout">Выйти</button></div></header>`;
  };

  bindCommon=function(){
    document.querySelectorAll('.nav-item').forEach(x=>x.onclick=()=>{
      const next=x.dataset.view;
      if(next==='overview'){
        const now=new Date();
        state.year=now.getFullYear();
        state.month=now.getMonth()+1;
      }
      state.view=next;
      renderApp();
    });
    const logout=document.getElementById('logout');
    if(logout)logout.onclick=()=>sb.auth.signOut();
    const month=document.getElementById('monthSelect');
    if(month)month.onchange=e=>{state.month=+e.target.value;renderApp()};
    const year=document.getElementById('yearSelect');
    if(year)year.onchange=e=>{state.year=+e.target.value;renderApp()};
  };

  /* Android/Yandex opens native <select> as a large light dialog. For the
     transaction form we replace that popup on phones with our own themed sheet. */
  let mobilePicker=null;
  let mobilePickerSelect=null;
  function isMobilePicker(){return window.matchMedia('(max-width:760px)').matches}
  function closeMobilePicker(){
    if(!mobilePicker)return;
    mobilePicker.remove();mobilePicker=null;mobilePickerSelect=null;
    document.documentElement.classList.remove('mobile-picker-open');
  }
  function openMobilePicker(select){
    if(!select||!isMobilePicker())return;
    closeMobilePicker();
    mobilePickerSelect=select;
    const label=select.closest('.field')?.querySelector('label')?.textContent?.trim()||'Выберите значение';
    const options=[...select.options];
    const backdrop=document.createElement('div');
    backdrop.className='mobile-select-backdrop';
    backdrop.setAttribute('role','presentation');
    const sheet=document.createElement('div');
    sheet.className='mobile-select-sheet';
    sheet.setAttribute('role','dialog');
    sheet.setAttribute('aria-modal','true');
    sheet.setAttribute('aria-label',label);
    const head=document.createElement('div');
    head.className='mobile-select-head';
    const title=document.createElement('div');
    title.className='mobile-select-title';title.textContent=label;
    const close=document.createElement('button');
    close.type='button';close.className='mobile-select-close';close.setAttribute('aria-label','Закрыть');close.textContent='×';
    head.append(title,close);
    const list=document.createElement('div');
    list.className='mobile-select-options';
    options.forEach(opt=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='mobile-select-option'+(opt.value===select.value?' selected':'');
      button.textContent=opt.textContent||'';
      button.disabled=opt.disabled;
      button.dataset.value=opt.value;
      button.onclick=()=>{
        if(button.disabled||!mobilePickerSelect)return;
        mobilePickerSelect.value=button.dataset.value;
        mobilePickerSelect.dispatchEvent(new Event('change',{bubbles:true}));
        closeMobilePicker();
      };
      list.appendChild(button);
    });
    sheet.append(head,list);backdrop.appendChild(sheet);document.body.appendChild(backdrop);
    mobilePicker=backdrop;
    document.documentElement.classList.add('mobile-picker-open');
    close.onclick=closeMobilePicker;
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)closeMobilePicker()});
    requestAnimationFrame(()=>list.querySelector('.selected')?.scrollIntoView({block:'nearest'}));
  }

  function initMobileSelects(){
    if(window.__financeMobileSelects)return;
    window.__financeMobileSelects=true;

    /* Do not open a category/subcategory selector on pointerdown. That used to
       turn a normal vertical swipe across the field into an accidental menu open.
       We now wait for pointerup and treat the gesture as a tap only when the finger
       stayed almost still. */
    let press=null;
    let suppressClickUntil=0;
    const TAP_DISTANCE=10;
    const TAP_TIME=750;

    document.addEventListener('pointerdown',e=>{
      const select=e.target.closest?.('#txForm select');
      if(!select||!isMobilePicker())return;
      press={
        select,
        pointerId:e.pointerId,
        x:e.clientX,
        y:e.clientY,
        startedAt:performance.now(),
        moved:false
      };
    },true);

    document.addEventListener('pointermove',e=>{
      if(!press||e.pointerId!==press.pointerId)return;
      if(Math.hypot(e.clientX-press.x,e.clientY-press.y)>TAP_DISTANCE)press.moved=true;
    },true);

    document.addEventListener('pointerup',e=>{
      if(!press||e.pointerId!==press.pointerId)return;
      const current=press;press=null;
      const elapsed=performance.now()-current.startedAt;
      const moved=current.moved||Math.hypot(e.clientX-current.x,e.clientY-current.y)>TAP_DISTANCE;
      suppressClickUntil=performance.now()+700;
      if(moved||elapsed>TAP_TIME)return;
      e.preventDefault();e.stopPropagation();
      openMobilePicker(current.select);
    },true);

    document.addEventListener('pointercancel',e=>{
      if(press&&e.pointerId===press.pointerId){
        press=null;
        suppressClickUntil=performance.now()+700;
      }
    },true);

    /* Block the native Android/Yandex <select> popup. A click without a preceding
       pointer gesture (for example accessibility/keyboard activation) still opens
       our custom picker. */
    document.addEventListener('click',e=>{
      const select=e.target.closest?.('#txForm select');
      if(!select||!isMobilePicker())return;
      e.preventDefault();e.stopPropagation();
      if(performance.now()<suppressClickUntil)return;
      openMobilePicker(select);
    },true);

    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMobilePicker()});
    window.addEventListener('resize',()=>{if(mobilePicker&&!isMobilePicker())closeMobilePicker()});
  }

  function initDateDrag(){
    document.querySelectorAll('.pirate-date-track:not([data-drag-ready])').forEach(track=>{
      track.dataset.dragReady='1';
      let down=false,startX=0,startScroll=0,moved=false;
      track.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;
        down=true;moved=false;startX=e.clientX;startScroll=track.scrollLeft;
        track.classList.add('dragging');
        track.setPointerCapture?.(e.pointerId);
      });
      track.addEventListener('pointermove',e=>{
        if(!down)return;
        const dx=e.clientX-startX;
        if(Math.abs(dx)>4)moved=true;
        track.scrollLeft=startScroll-dx;
      });
      const finish=e=>{
        if(!down)return;
        down=false;track.classList.remove('dragging');
        try{track.releasePointerCapture?.(e.pointerId)}catch(_){ }
        if(moved){
          const swallow=ev=>{ev.preventDefault();ev.stopPropagation();track.removeEventListener('click',swallow,true)};
          track.addEventListener('click',swallow,true);
        }
      };
      track.addEventListener('pointerup',finish);
      track.addEventListener('pointercancel',finish);
      track.addEventListener('pointerleave',e=>{if(down)finish(e)});
    });
  }

  const tips={logout:'Выйти из семейной казны',allOperations:'Открыть полный журнал операций',createInvite:'Создать персональную ссылку для супруги',copyInvite:'Скопировать ссылку приглашения'};
  function tipText(el){
    if(el.dataset.tooltip)return el.dataset.tooltip;
    if(el.id&&tips[el.id])return tips[el.id];
    if(el.classList.contains('save-operation'))return 'Сохранить операцию в семейный журнал';
    if(el.classList.contains('editTx')||el.classList.contains('editCat'))return 'Редактировать';
    if(el.classList.contains('deleteTx')||el.classList.contains('deleteCat')||el.classList.contains('deleteBudget')||el.classList.contains('deleteRecurring'))return 'Удалить';
    if(el.classList.contains('toggleRecurring'))return el.classList.contains('asset-pause')?'Приостановить регулярный платеж':'Возобновить регулярный платеж';
    if(el.classList.contains('postRecurring'))return 'Внести этот платеж сейчас';
    if(el.classList.contains('pirate-today'))return 'Вернуться к сегодняшней дате';
    if(el.classList.contains('quick-pair'))return 'Использовать эту недавнюю категорию';
    if(el.classList.contains('text-action'))return 'Открыть раздел';
    if(el.matches('.segmented button'))return `Выбрать: ${(el.textContent||'').trim()}`;
    if(el.classList.contains('person-choice'))return `Выбрать: ${(el.querySelector('b')?.textContent||'').trim()}`;
    const text=(el.textContent||'').replace(/\s+/g,' ').trim();
    if(text&&text.length<=42)return text;
    return '';
  }

  let tooltip=document.querySelector('.ui-tooltip');
  if(!tooltip){tooltip=document.createElement('div');tooltip.className='ui-tooltip';document.body.appendChild(tooltip)}
  let current=null;
  function showTip(el){
    const text=tipText(el);if(!text)return;
    current=el;tooltip.textContent=text;tooltip.classList.add('show');
    const r=el.getBoundingClientRect();
    const tr=tooltip.getBoundingClientRect();
    let left=r.left+r.width/2-tr.width/2;
    left=Math.max(8,Math.min(window.innerWidth-tr.width-8,left));
    let top=r.top-tr.height-9;
    if(top<8)top=r.bottom+9;
    tooltip.style.left=`${left}px`;tooltip.style.top=`${top}px`;
  }
  function hideTip(){current=null;tooltip.classList.remove('show')}
  function decorateTooltips(){
    document.querySelectorAll('button:not([data-tooltip-ready])').forEach(el=>{
      el.dataset.tooltipReady='1';
      el.addEventListener('mouseenter',()=>showTip(el));
      el.addEventListener('mouseleave',hideTip);
      el.addEventListener('focus',()=>showTip(el));
      el.addEventListener('blur',hideTip);
    });
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;initDateDrag();decorateTooltips()})}
  const observer=new MutationObserver(schedule);
  observer.observe(document.getElementById('app'),{subtree:true,childList:true});
  initMobileSelects();
  window.addEventListener('resize',()=>{if(current)showTip(current)});
  window.addEventListener('scroll',hideTip,true);
  window.addEventListener('load',schedule);
  window.addEventListener('DOMContentLoaded',schedule);
  setTimeout(schedule,0);
})();
