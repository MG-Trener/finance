// Transaction entry UX with render-safe delegated bindings.
let phase3Prefs={};
try{phase3Prefs=JSON.parse(localStorage.getItem('finance.phase3.prefs')||'{}')}catch(_){phase3Prefs={}}

function phase3QuickPairs(type,personId){
  const seen=new Set(),rows=[];
  for(const tx of state.transactions){if(tx.type!==type||tx.person_id!==personId)continue;const key=`${tx.category_id}:${tx.subcategory_id||''}`;if(seen.has(key))continue;seen.add(key);rows.push(tx);if(rows.length>=4)break}
  return rows;
}

function transactionForm(tx=null){
  const type=tx?.type||state.txType,person=tx?.person_id||state.selectedPersonId,pref=phase3Prefs?.[person]?.[type]||{},cats=state.categories.filter(c=>c.type===type);
  let catId=tx?.category_id||pref.category_id||cats[0]?.id;if(!cats.some(c=>c.id===catId))catId=cats[0]?.id;
  const subs=state.subcategories.filter(s=>s.category_id===catId);let subId=tx?.subcategory_id||pref.subcategory_id||subs[0]?.id;if(!subs.some(s=>s.id===subId))subId=subs[0]?.id;
  const quick=phase3QuickPairs(type,person);
  return `<form id="txForm" class="quick-form quick-form-v3" data-edit-id="${tx?.id||''}"><input type="hidden" id="txType" value="${type}"><div class="full segmented"><button type="button" data-type="expense" class="${type==='expense'?'active':''}">Расход</button><button type="button" data-type="income" class="${type==='income'?'active':''}">Доход</button></div><div class="field full amount-field"><label>Сумма, ₸</label><input class="amount-input amount-hero" id="amount" type="number" min="1" step="1" inputmode="decimal" value="${tx?Number(tx.amount):''}" placeholder="0" required></div><div class="field full"><label>Кто</label>${personSwitch(person)}</div><input type="hidden" id="personId" value="${person||''}">${quick.length?`<div class="field full quick-pairs"><label>Недавние</label><div class="quick-pair-list">${quick.map(q=>`<button type="button" class="quick-pair" data-qcat="${q.category_id}" data-qsub="${q.subcategory_id||''}">${esc(catName(q.category_id))}${q.subcategory_id?` · ${esc(subName(q.subcategory_id))}`:''}</button>`).join('')}</div></div>`:''}<div class="field"><label>Категория</label><select id="categoryId">${cats.map(c=>`<option value="${c.id}" ${c.id===catId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>Подкатегория</label><select id="subcategoryId" ${subs.length?'':'disabled'}>${subs.length?subs.map(s=>`<option value="${s.id}" ${s.id===subId?'selected':''}>${esc(s.name)}</option>`).join(''):'<option value="">Нет подкатегорий</option>'}</select></div><div class="field full"><label>Комментарий</label><input id="description" value="${esc(tx?.description||'')}" placeholder="Необязательно"></div><details class="time-details full" ${tx?'open':''}><summary><span>Дата и время</span><b>${tx?'Изменить':'Сейчас'}</b></summary><div class="field"><input id="occurredAt" type="datetime-local" value="${localDT(tx?.occurred_at)}" required></div></details><div class="full"><button type="submit" class="btn btn-primary btn-wide save-operation">${tx?'Сохранить изменения':'Сохранить операцию'}</button></div></form>`;
}

function txRefreshSubcategories(form,preferred=''){const category=form?.querySelector('#categoryId'),subcategory=form?.querySelector('#subcategoryId');if(!category||!subcategory)return;const subs=state.subcategories.filter(s=>s.category_id===category.value);if(!subs.length){subcategory.innerHTML='<option value="">Нет подкатегорий</option>';subcategory.value='';subcategory.disabled=true;return}subcategory.disabled=false;subcategory.innerHTML=subs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');subcategory.value=preferred&&subs.some(s=>s.id===preferred)?preferred:subs[0].id}
function txRefreshCategories(form,type,preferredCategory='',preferredSub=''){const category=form?.querySelector('#categoryId'),subcategory=form?.querySelector('#subcategoryId');if(!category)return;const cats=state.categories.filter(c=>c.type===type);category.innerHTML=cats.length?cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join(''):'<option value="">Нет категорий</option>';category.disabled=!cats.length;if(!cats.length){if(subcategory){subcategory.innerHTML='<option value="">Нет подкатегорий</option>';subcategory.disabled=true}return}category.value=preferredCategory&&cats.some(c=>c.id===preferredCategory)?preferredCategory:cats[0].id;txRefreshSubcategories(form,preferredSub)}

if(!window.__financeTxDelegation){
  window.__financeTxDelegation=true;
  document.addEventListener('click',e=>{const form=e.target.closest('#txForm');if(!form)return;const typeBtn=e.target.closest('.segmented [data-type]');if(typeBtn){const type=typeBtn.dataset.type,typeInput=form.querySelector('#txType');if(typeInput)typeInput.value=type;if(!form.dataset.editId)state.txType=type;form.querySelectorAll('.segmented [data-type]').forEach(x=>x.classList.toggle('active',x===typeBtn));const personId=form.querySelector('#personId')?.value||state.selectedPersonId,pref=phase3Prefs?.[personId]?.[type]||{};txRefreshCategories(form,type,pref.category_id||'',pref.subcategory_id||'');return}const personBtn=e.target.closest('[data-group="personChoice"]');if(personBtn){form.querySelectorAll('[data-group="personChoice"]').forEach(x=>x.classList.remove('active'));personBtn.classList.add('active');const personInput=form.querySelector('#personId');if(personInput)personInput.value=personBtn.dataset.person;state.selectedPersonId=personBtn.dataset.person;return}const quickBtn=e.target.closest('.quick-pair');if(quickBtn){const category=form.querySelector('#categoryId');if(!category)return;if([...category.options].some(o=>o.value===quickBtn.dataset.qcat)){category.value=quickBtn.dataset.qcat;txRefreshSubcategories(form,quickBtn.dataset.qsub||'')}}});
  document.addEventListener('change',e=>{if(e.target.matches('#txForm #categoryId'))txRefreshSubcategories(e.target.closest('#txForm'))});
  document.addEventListener('submit',e=>{const form=e.target;if(!(form instanceof HTMLFormElement)||form.id!=='txForm')return;e.preventDefault();e.stopPropagation();saveTransaction(e,form.dataset.editId||null)},true);
  document.addEventListener('keydown',e=>{const form=e.target.closest?.('#txForm');if(!form||e.key!=='Enter'||e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON'||e.target.tagName==='SELECT')return;e.preventDefault();form.requestSubmit()});
}

function bindTransactionForm(editId=null){const form=document.getElementById('modal')?.querySelector('#txForm')||document.querySelector('#txForm');if(form)form.dataset.editId=editId||form.dataset.editId||''}

async function saveTransaction(e,editId=null){
  e.preventDefault();const form=e.currentTarget?.id==='txForm'?e.currentTarget:e.target?.closest?.('#txForm')||document.querySelector('#txForm');if(!form)return;
  const noticeId=editId?'editNotice':'txNotice';notice(noticeId,'');
  const personId=form.querySelector('#personId')?.value||'',type=form.querySelector('#txType')?.value||state.txType,categoryId=form.querySelector('#categoryId')?.value||'',subcategoryId=form.querySelector('#subcategoryId')?.value||null,amount=Number(form.querySelector('#amount')?.value||0),occurred=form.querySelector('#occurredAt')?.value,description=form.querySelector('#description')?.value.trim()||null;
  if(!personId)return notice(noticeId,'Выберите участника');if(!categoryId)return notice(noticeId,'Выберите категорию');if(!(amount>0))return notice(noticeId,'Введите сумму');if(!occurred)return notice(noticeId,'Укажите дату и время');
  const submit=form.querySelector('.save-operation');if(submit){submit.disabled=true;submit.textContent=navigator.onLine?'Сохраняю…':'Сохраняю офлайн…'}
  try{
    const payload={person_id:personId,type,amount,category_id:categoryId,subcategory_id:subcategoryId,description,occurred_at:new Date(occurred).toISOString()};
    const createArgs={p_family_id:state.family.id,p_person_id:personId,p_type:type,p_amount:amount,p_category_id:categoryId,p_subcategory_id:subcategoryId,p_description:description,p_occurred_at:payload.occurred_at};
    let result;
    if(window.FinanceOffline?.saveTransaction)result=await window.FinanceOffline.saveTransaction({editId,payload,createArgs});
    else if(editId)result=await sb.from('transactions').update(payload).eq('id',editId).select().single();
    else result=await sb.rpc('create_family_transaction',createArgs);
    if(result.error)return notice(noticeId,`Не удалось сохранить: ${result.error.message||result.error}`);
    const row=Array.isArray(result.data)?result.data[0]:result.data;if(!row)return notice(noticeId,'Операция не была сохранена.');
    if(!editId){phase3Prefs[personId]=phase3Prefs[personId]||{};phase3Prefs[personId][type]={category_id:categoryId,subcategory_id:subcategoryId};try{localStorage.setItem('finance.phase3.prefs',JSON.stringify(phase3Prefs))}catch(_){}}
    syncTransactionState(row);if(typeof uiSound==='function')uiSound('success');if(editId)closeModal();renderStateChange();
  }catch(err){notice(noticeId,`Ошибка сохранения: ${err?.message||String(err)}`)}finally{if(submit&&document.body.contains(submit)){submit.disabled=false;submit.textContent=editId?'Сохранить изменения':'Сохранить операцию'}}
}
