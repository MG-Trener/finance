// Person-specific subcategory visibility for transaction entry.
(function(){
  const labelForPerson=id=>state.people.find(p=>p.id===id)?.label||'';
  const allowedSubs=(categoryId,personId)=>{
    const label=labelForPerson(personId);
    return state.subcategories.filter(s=>s.category_id===categoryId&&(!s.person_label||s.person_label===label));
  };

  function syncForm(form,preferred=''){
    const category=form?.querySelector('#categoryId');
    const subcategory=form?.querySelector('#subcategoryId');
    const personId=form?.querySelector('#personId')?.value||state.selectedPersonId||'';
    if(!category||!subcategory)return;
    const subs=allowedSubs(category.value,personId);
    const current=preferred||subcategory.value;
    if(!subs.length){
      subcategory.innerHTML='<option value="">Нет подкатегорий</option>';
      subcategory.value='';
      subcategory.disabled=true;
      return;
    }
    subcategory.disabled=false;
    subcategory.innerHTML=subs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    subcategory.value=subs.some(s=>s.id===current)?current:subs[0].id;
  }

  function syncVisibleForms(){document.querySelectorAll('#txForm').forEach(form=>syncForm(form))}

  document.addEventListener('click',e=>{
    const form=e.target.closest('#txForm');
    if(!form)return;
    if(e.target.closest('[data-group="personChoice"]'))queueMicrotask(()=>syncForm(form));
    const quick=e.target.closest('.quick-pair');
    if(quick)queueMicrotask(()=>syncForm(form,quick.dataset.qsub||''));
  });

  document.addEventListener('change',e=>{
    if(e.target.matches('#txForm #categoryId'))queueMicrotask(()=>syncForm(e.target.closest('#txForm')));
  });

  new MutationObserver(syncVisibleForms).observe(document.getElementById('app'),{subtree:true,childList:true});
  window.FinancePersonSubcategories={syncForm,allowedSubs};
  queueMicrotask(syncVisibleForms);
})();
