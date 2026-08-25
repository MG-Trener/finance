// Refactor stage 1: spouse access controls live in a feature module, not a phase file.
(function(){
  function isOwner(){return !!state?.family&&!!state?.user&&state.family.created_by===state.user.id}
  function freeSpouse(){return state?.people?.find(p=>!p.linked_user_id)||null}
  function openAccess(){state.view='access';renderApp()}

  async function createInvite(person,host){
    const btn=host.querySelector('[data-create-spouse-invite]');
    const result=host.querySelector('[data-spouse-invite-result]');
    if(btn){btn.disabled=true;btn.textContent='Создаю…'}
    const {data,error}=await sb.rpc('create_spouse_invite',{target_person:person.id});
    if(btn){btn.disabled=false;btn.textContent='Обновить ссылку'}
    if(error){result.innerHTML=`<div class="spouse-access-error">${esc(error.message)}</div>`;return}
    const row=Array.isArray(data)?data[0]:data;
    const url=`${location.origin}${location.pathname}?invite=${encodeURIComponent(row.token)}`;
    result.innerHTML=`<input class="spouse-access-url" data-spouse-invite-url value="${esc(url)}" readonly><div class="spouse-access-actions"><button type="button" class="btn btn-primary btn-small" data-copy-spouse-invite>Скопировать ссылку</button><button type="button" class="btn btn-soft btn-small" data-open-access>Открыть раздел «Доступ»</button></div>`;
    result.querySelector('[data-copy-spouse-invite]').onclick=async()=>{
      await navigator.clipboard.writeText(url);
      result.querySelector('[data-copy-spouse-invite]').textContent='Скопировано ✓';
    };
    result.querySelector('[data-open-access]').onclick=openAccess;
  }

  function ensureOverviewAccess(){
    if(state?.view!=='overview'||!isOwner())return;
    const person=freeSpouse();
    if(!person)return;
    const entry=document.querySelector('.overview-entry');
    if(!entry||document.querySelector('.spouse-access-card'))return;
    const card=document.createElement('div');
    card.className='spouse-access-card';
    card.innerHTML=`<div class="spouse-access-head"><div><h4>Доступ жены</h4><p>${esc(person.display_name)} ещё не подключена к семейной казне.</p></div><span class="spouse-access-status">1 место свободно</span></div><div class="spouse-access-actions"><button type="button" class="btn btn-primary btn-small" data-create-spouse-invite>Создать ссылку для жены</button><button type="button" class="btn btn-soft btn-small" data-open-access>Настройки доступа</button></div><div data-spouse-invite-result></div>`;
    entry.insertAdjacentElement('afterend',card);
    card.querySelector('[data-create-spouse-invite]').onclick=()=>createInvite(person,card);
    card.querySelector('[data-open-access]').onclick=openAccess;
  }

  function ensureNavAccess(){
    if(!state?.user||!state?.family)return;
    const nav=document.querySelector('.side-nav');
    if(nav&&!nav.querySelector('[data-view="access"]')){
      const item=document.createElement('div');
      item.className='nav-item pirate-nav'+(state.view==='access'?' active':'');
      item.dataset.view='access';
      item.innerHTML='<span class="nav-icon pirate-icon icon-key" aria-hidden="true"></span><span class="nav-label">Доступ</span>';
      item.onclick=openAccess;
      item.dataset.tooltip='Управление доступом супруги';
      nav.appendChild(item);
    }
  }

  let queued=false;
  function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;ensureNavAccess();ensureOverviewAccess()})}
  const root=document.getElementById('app');
  new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
  window.addEventListener('load',schedule);
  window.addEventListener('DOMContentLoaded',schedule);
  setTimeout(schedule,0);
})();
