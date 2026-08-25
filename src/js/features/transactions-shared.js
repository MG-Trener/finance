// Shared transaction presentation and CRUD helpers.
function personCard(p){if(!p)return'';const s=stats(p.id);return `<div class="person-card"><div class="person-top"><div class="person-name"><div class="avatar">${p.label==='husband'?'М':'Ж'}</div><div><b>${esc(p.display_name)}</b><div class="muted" style="font-size:12px">${p.label==='husband'?'Муж':'Жена'}</div></div></div><b class="${s.balance>=0?'positive':'negative'}">${money(s.balance)}</b></div><div class="person-stats"><div class="mini"><span class="muted">Доход</span><b class="positive">${money(s.income)}</b></div><div class="mini"><span class="muted">Расход</span><b class="negative">${money(s.expense)}</b></div></div></div>`}
function personSwitch(selected=state.selectedPersonId,prefix='personChoice'){return `<div class="person-switch full">${state.people.map(p=>`<button type="button" class="person-choice ${p.id===selected?'active':''}" data-person="${p.id}" data-group="${prefix}"><span class="avatar">${p.label==='husband'?'М':'Ж'}</span><span><b>${esc(p.display_name)}</b><small>${p.label==='husband'?'Муж':'Жена'}</small></span></button>`).join('')}</div>`}
function transactionForm(tx=null){return '<form id="txForm"></form>'}
function bindTransactionForm(){}
function saveTransaction(){}
function transactionList(tx,actions=false){
  if(!tx.length)return `<div class="empty">Пока нет операций за этот период</div>`;
  return `<div class="list">${tx.map(x=>{
    const amount=`${x.type==='income'?'+':'−'} ${money(x.amount)}`;
    const amountMarkup=actions
      ?`<button type="button" class="tx-amount amount-edit-trigger ${x.type==='income'?'positive':'negative'}" data-id="${x.id}" title="Исправить сумму"><span>${amount}</span><small>Исправить</small></button>`
      :`<div class="tx-amount ${x.type==='income'?'positive':'negative'}">${amount}</div>`;
    return `<div class="tx"><div class="tx-icon">${x.type==='income'?'↗':'↘'}</div><div><div class="tx-title">${esc(catName(x.category_id))}${subName(x.subcategory_id)?` · ${esc(subName(x.subcategory_id))}`:''}</div><div class="tx-meta">${esc(personName(x.person_id))} · ${new Date(x.occurred_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}${x.description?' · '+esc(x.description):''}</div></div>${amountMarkup}${actions?`<div class="tx-actions"><button class="icon-btn editTx" data-id="${x.id}" title="Изменить всю операцию">✎</button><button class="icon-btn deleteTx" data-id="${x.id}" title="Удалить">×</button></div>`:''}</div>`
  }).join('')}</div>`
}
function bindTxButtons(){
  document.querySelectorAll('.editTx').forEach(b=>b.onclick=()=>openEditTransaction(b.dataset.id));
  document.querySelectorAll('.deleteTx').forEach(b=>b.onclick=()=>deleteTransaction(b.dataset.id));
  document.querySelectorAll('.amount-edit-trigger').forEach(b=>b.onclick=()=>openQuickAmountEdit(b.dataset.id));
}
function expenseBars(){const sums={};periodTx().filter(x=>x.type==='expense').forEach(x=>sums[x.category_id]=(sums[x.category_id]||0)+Number(x.amount));const arr=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,7),max=arr[0]?.[1]||1;if(!arr.length)return `<div class="empty">После первых расходов здесь появится структура трат</div>`;return arr.map(([id,val])=>`<div class="bar-row"><span>${esc(catName(id))}</span><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div><b>${money(val)}</b></div>`).join('')}
function openEditTransaction(id){const tx={...byId(state.transactions,id)};renderEditModal(tx)}
function renderEditModal(tx){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><h2>Редактировать операцию</h2><button class="icon-btn" id="closeModal">×</button></div><div id="editNotice"></div>${transactionForm(tx)}</div></div>`);document.getElementById('closeModal').onclick=closeModal;bindTransactionForm(tx.id)}

function openQuickAmountEdit(id){
  const tx=byId(state.transactions,id);if(!tx)return;
  closeModal();
  const context=[catName(tx.category_id),subName(tx.subcategory_id),personName(tx.person_id)].filter(Boolean).map(esc).join(' · ');
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal quick-amount-modal"><div class="modal-head"><div><h2>Исправить сумму</h2><p class="quick-amount-context">${context}</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="quickAmountNotice"></div><form id="quickAmountForm"><div class="field"><label for="quickAmountInput">Сумма, ₸</label><input id="quickAmountInput" class="quick-amount-input" type="number" min="1" step="1" inputmode="decimal" value="${Number(tx.amount)||''}" required></div><div class="quick-amount-actions"><button type="button" class="btn btn-soft" id="cancelQuickAmount">Отмена</button><button type="submit" class="btn btn-primary" id="saveQuickAmount">Сохранить сумму</button></div></form></div></div>`);
  const input=document.getElementById('quickAmountInput');
  document.getElementById('closeModal').onclick=closeModal;
  document.getElementById('cancelQuickAmount').onclick=closeModal;
  document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
  document.getElementById('quickAmountForm').onsubmit=async e=>{
    e.preventDefault();
    const amount=Number(input.value);
    if(!(amount>0))return notice('quickAmountNotice','Введите корректную сумму');
    const save=document.getElementById('saveQuickAmount');
    save.disabled=true;save.textContent='Сохраняю…';
    try{
      const {data,error}=await sb.from('transactions').update({amount,updated_at:new Date().toISOString()}).eq('id',id).select().single();
      if(error)return notice('quickAmountNotice',`Не удалось изменить сумму: ${error.message}`);
      if(!data)return notice('quickAmountNotice','Изменение суммы не подтверждено.');
      if(typeof uiSound==='function')uiSound('success');
      closeModal();await loadData();
    }catch(err){
      notice('quickAmountNotice',`Ошибка: ${err?.message||String(err)}`);
    }finally{
      if(save&&document.body.contains(save)){save.disabled=false;save.textContent='Сохранить сумму'}
    }
  };
  requestAnimationFrame(()=>{input?.focus();input?.select()});
}

async function deleteTransaction(id){if(!confirm('Удалить эту операцию?'))return;const {error}=await sb.from('transactions').delete().eq('id',id);if(error)return alert(error.message);await loadData()}
