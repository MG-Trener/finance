// Phase 2 hotfix: keep transaction form values while switching type and make edit type reliable.
function bindTransactionForm(editId=null){
  const form=document.getElementById('txForm');
  if(!form)return;
  let typeInput=document.getElementById('txType');
  if(!typeInput){typeInput=document.createElement('input');typeInput.type='hidden';typeInput.id='txType';typeInput.value=editId?(byId(state.transactions,editId)?.type||state.txType):state.txType;form.appendChild(typeInput)}
  document.querySelectorAll('[data-group="personChoice"]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-group="personChoice"]').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.getElementById('personId').value=b.dataset.person;state.selectedPersonId=b.dataset.person});
  document.querySelectorAll('.segmented [data-type]').forEach(b=>b.onclick=()=>{const type=b.dataset.type;typeInput.value=type;if(!editId)state.txType=type;document.querySelectorAll('.segmented [data-type]').forEach(x=>x.classList.toggle('active',x===b));const cats=state.categories.filter(c=>c.type===type);const cat=document.getElementById('categoryId');cat.innerHTML=cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');refreshSubcategories()});
  const cat=document.getElementById('categoryId');
  function refreshSubcategories(){const subs=state.subcategories.filter(s=>s.category_id===cat.value);document.getElementById('subcategoryId').innerHTML=subs.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}
  if(cat)cat.onchange=refreshSubcategories;
  form.onsubmit=e=>saveTransaction(e,editId)
}
async function saveTransaction(e,editId=null){
  e.preventDefault();notice(editId?'editNotice':'txNotice','');
  const payload={family_id:state.family.id,person_id:document.getElementById('personId').value,type:document.getElementById('txType')?.value||state.txType,amount:Number(document.getElementById('amount').value),category_id:document.getElementById('categoryId').value,subcategory_id:document.getElementById('subcategoryId').value||null,description:document.getElementById('description').value.trim()||null,occurred_at:new Date(document.getElementById('occurredAt').value).toISOString(),created_by:state.user.id,updated_at:new Date().toISOString()};
  const result=editId?await sb.from('transactions').update(payload).eq('id',editId):await sb.from('transactions').insert(payload);
  if(result.error)return notice(editId?'editNotice':'txNotice',result.error.message);
  closeModal();await loadData()
}