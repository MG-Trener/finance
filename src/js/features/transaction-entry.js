// Transaction entry UX: fully self-contained bindings after refactor.
let phase3Prefs={};
try{phase3Prefs=JSON.parse(localStorage.getItem('finance.phase3.prefs')||'{}')}catch(_){phase3Prefs={}}

function phase3QuickPairs(type,personId){
  const seen=new Set(),rows=[];
  for(const tx of state.transactions){
    if(tx.type!==type||tx.person_id!==personId)continue;
    const key=`${tx.category_id}:${tx.subcategory_id||''}`;
    if(seen.has(key))continue;
    seen.add(key);rows.push(tx);
    if(rows.length>=4)break;
  }
  return rows;
}

transactionForm=function(tx=null){
  const type=tx?.type||state.txType;
  const person=tx?.person_id||state.selectedPersonId;
  const pref=phase3Prefs?.[person]?.[type]||{};
  const cats=state.categories.filter(c=>c.type===type);
  let catId=tx?.category_id||pref.category_id||cats[0]?.id;
  if(!cats.some(c=>c.id===catId))catId=cats[0]?.id;
  const subs=state.subcategories.filter(s=>s.category_id===catId);
  let subId=tx?.subcategory_id||pref.subcategory_id||subs[0]?.id;
  if(!subs.some(s=>s.id===subId))subId=subs[0]?.id;
  const quick=phase3QuickPairs(type,person);
  return `<form id="txForm" class="quick-form quick-form-v3">
    <input type="hidden" id="txType" value="${type}">
    <div class="full segmented">
      <button type="button" data-type="expense" class="${type==='expense'?'active':''}">Расход</button>
      <button type="button" data-type="income" class="${type==='income'?'active':''}">Доход</button>
    </div>
    <div class="field full amount-field"><label>Сумма, ₸</label><input class="amount-input amount-hero" id="amount" type="number" min="1" step="1" inputmode="decimal" value="${tx?Number(tx.amount):''}" placeholder="0" required autofocus></div>
    <div class="field full"><label>Кто</label>${personSwitch(person)}</div>
    <input type="hidden" id="personId" value="${person||''}">
    ${quick.length?`<div class="field full quick-pairs"><label>Недавние</label><div class="quick-pair-list">${quick.map(q=>`<button type="button" class="quick-pair" data-qcat="${q.category_id}" data-qsub="${q.subcategory_id||''}">${esc(catName(q.category_id))}${q.subcategory_id?` · ${esc(subName(q.subcategory_id))}`:''}</button>`).join('')}</div></div>`:''}
    <div class="field"><label>Категория</label><select id="categoryId">${cats.map(c=>`<option value="${c.id}" ${c.id===catId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div>
    <div class="field"><label>Подкатегория</label><select id="subcategoryId">${subs.length?subs.map(s=>`<option value="${s.id}" ${s.id===subId?'selected':''}>${esc(s.name)}</option>`).join(''):'<option value="">Нет подкатегорий</option>'}</select></div>
    <div class="field full"><label>Комментарий</label><input id="description" value="${esc(tx?.description||'')}" placeholder="Необязательно"></div>
    <details class="time-details full" ${tx?'open':''}><summary><span>Дата и время</span><b>${tx?'Изменить':'Сейчас'}</b></summary><div class="field"><input id="occurredAt" type="datetime-local" value="${localDT(tx?.occurred_at)}" required></div></details>
    <div class="full"><button class="btn btn-primary btn-wide save-operation">${tx?'Сохранить изменения':'Сохранить операцию'}</button></div>
  </form>`;
};

bindTransactionForm=function(editId=null){
  const form=document.getElementById('txForm');
  if(!form)return;

  const typeInput=form.querySelector('#txType');
  const category=form.querySelector('#categoryId');
  const subcategory=form.querySelector('#subcategoryId');
  const personInput=form.querySelector('#personId');

  function refreshSubcategories(preferred=''){
    if(!category||!subcategory)return;
    const subs=state.subcategories.filter(s=>s.category_id===category.value);
    if(!subs.length){
      subcategory.innerHTML='<option value="">Нет подкатегорий</option>';
      subcategory.value='';
      subcategory.disabled=true;
      return;
    }
    subcategory.disabled=false;
    subcategory.innerHTML=subs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
    if(preferred&&subs.some(s=>s.id===preferred))subcategory.value=preferred;
    else subcategory.value=subs[0].id;
  }

  function refreshCategories(type,preferredCategory='',preferredSub=''){
    if(!category)return;
    const cats=state.categories.filter(c=>c.type===type);
    category.innerHTML=cats.length?cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(''):'<option value="">Нет категорий</option>';
    category.disabled=!cats.length;
    if(!cats.length){if(subcategory){subcategory.innerHTML='<option value="">Нет подкатегорий</option>';subcategory.disabled=true;}return;}
    if(preferredCategory&&cats.some(c=>c.id===preferredCategory))category.value=preferredCategory;
    else category.value=cats[0].id;
    refreshSubcategories(preferredSub);
  }

  form.querySelectorAll('[data-group="personChoice"]').forEach(btn=>{
    btn.onclick=()=>{
      form.querySelectorAll('[data-group="personChoice"]').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      if(personInput)personInput.value=btn.dataset.person;
      state.selectedPersonId=btn.dataset.person;
    };
  });

  form.querySelectorAll('.segmented [data-type]').forEach(btn=>{
    btn.onclick=()=>{
      const type=btn.dataset.type;
      if(typeInput)typeInput.value=type;
      if(!editId)state.txType=type;
      form.querySelectorAll('.segmented [data-type]').forEach(x=>x.classList.toggle('active',x===btn));
      const personId=personInput?.value||state.selectedPersonId;
      const pref=phase3Prefs?.[personId]?.[type]||{};
      refreshCategories(type,pref.category_id||'',pref.subcategory_id||'');
    };
  });

  if(category)category.onchange=()=>refreshSubcategories();

  form.querySelectorAll('.quick-pair').forEach(btn=>{
    btn.onclick=()=>{
      if(!category)return;
      const option=[...category.options].some(o=>o.value===btn.dataset.qcat);
      if(!option)return;
      category.value=btn.dataset.qcat;
      refreshSubcategories(btn.dataset.qsub||'');
    };
  });

  form.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&e.target.tagName!=='TEXTAREA'&&e.target.tagName!=='BUTTON'&&e.target.tagName!=='SELECT'){
      e.preventDefault();form.requestSubmit();
    }
  });
  form.onsubmit=e=>saveTransaction(e,editId);
};

saveTransaction=async function(e,editId=null){
  e.preventDefault();
  notice(editId?'editNotice':'txNotice','');
  const personId=document.getElementById('personId').value;
  const type=document.getElementById('txType')?.value||state.txType;
  const categoryId=document.getElementById('categoryId').value;
  const subcategoryId=document.getElementById('subcategoryId').value||null;
  if(!categoryId)return notice(editId?'editNotice':'txNotice','Выберите категорию');
  const payload={family_id:state.family.id,person_id:personId,type,amount:Number(document.getElementById('amount').value),category_id:categoryId,subcategory_id:subcategoryId,description:document.getElementById('description').value.trim()||null,occurred_at:new Date(document.getElementById('occurredAt').value).toISOString(),created_by:state.user.id,updated_at:new Date().toISOString()};
  const result=editId?await sb.from('transactions').update(payload).eq('id',editId):await sb.from('transactions').insert(payload);
  if(result.error)return notice(editId?'editNotice':'txNotice',result.error.message);
  if(!editId){
    phase3Prefs[personId]=phase3Prefs[personId]||{};
    phase3Prefs[personId][type]={category_id:categoryId,subcategory_id:subcategoryId};
    try{localStorage.setItem('finance.phase3.prefs',JSON.stringify(phase3Prefs))}catch(_){}
  }
  closeModal();await loadData();
};
