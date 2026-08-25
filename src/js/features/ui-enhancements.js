// Refactored from phase12.js: tooltips, draggable date ribbon and overview current-date header.
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
  window.addEventListener('resize',()=>{if(current)showTip(current)});
  window.addEventListener('scroll',hideTip,true);
  window.addEventListener('load',schedule);
  window.addEventListener('DOMContentLoaded',schedule);
  setTimeout(schedule,0);
})();
