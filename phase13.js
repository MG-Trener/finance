// Phase 13 - make family access controls always visible.
(function(){
  function openAccess(){state.view='access';renderApp()}

  function ensureAccessControls(){
    if(!state?.user||!state?.family)return;

    const nav=document.querySelector('.side-nav');
    if(nav&&!nav.querySelector('[data-view="access"]')){
      const item=document.createElement('div');
      item.className='nav-item pirate-nav'+(state.view==='access'?' active':'');
      item.dataset.view='access';
      item.innerHTML='<span class="nav-icon pirate-icon icon-key" aria-hidden="true"></span><span class="nav-label">Доступ</span>';
      item.onclick=openAccess;
      item.setAttribute('data-tooltip','Управление доступом супруги');
      nav.appendChild(item);
    }

    const top=document.querySelector('.top-actions');
    const isOwner=state.family?.created_by===state.user?.id;
    if(top&&isOwner&&!document.getElementById('wifeAccessBtn')){
      const btn=document.createElement('button');
      btn.type='button';
      btn.id='wifeAccessBtn';
      btn.className='btn btn-soft wife-access-btn';
      btn.textContent='Доступ жены';
      btn.onclick=openAccess;
      btn.setAttribute('data-tooltip','Создать приглашение для жены');
      top.prepend(btn);
    }
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureAccessControls()})}
  const root=document.getElementById('app');
  const obs=new MutationObserver(schedule);
  obs.observe(root,{subtree:true,childList:true});
  window.addEventListener('load',schedule);
  window.addEventListener('DOMContentLoaded',schedule);
  setTimeout(schedule,0);
})();
