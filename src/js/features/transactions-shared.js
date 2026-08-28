// Shared transaction presentation and CRUD helpers.
function personCard(p){if(!p)return'';const s=stats(p.id);return `<div class="person-card"><div class="person-top"><div class="person-name"><div class="avatar">${p.label==='husband'?'М':'Ж'}</div><div><b>${esc(p.display_name)}</b><div class="muted" style="font-size:12px">${p.label==='husband'?'Муж':'Жена'}</div></div></div><b class="${s.balance>=0?'positive':'negative'}">${money(s.balance)}</b></div><div class="person-stats"><div class="mini"><span class="muted">Доход</span><b class="positive">${money(s.income)}</b></div><div class="mini"><span class="muted">Расход</span><b class="negative">${money(s.expense)}</b></div></div></div>`}
function personSwitch(selected=state.selectedPersonId,prefix='personChoice'){return `<div class="person-switch full">${state.people.map(p=>`<button type="button" class="person-choice ${p.id===selected?'active':''}" data-person="${p.id}" data-group="${prefix}"><span class="avatar">${p.label==='husband'?'М':'Ж'}</span><span><b>${esc(p.display_name)}</b><small>${p.label==='husband'?'Муж':'Жена'}</small></span></button>`).join('')}</div>`}
function transactionForm(tx=null){return '<form id="txForm"></form>'}
function bindTransactionForm(){}
function saveTransaction(){}

function transactionTypeLabel(type){return type==='income'?'Доход':type==='expense'?'Расход':type==='transfer'?'Перевод':String(type||'Операция')}
function transactionTone(type){return type==='income'?'positive':type==='expense'?'negative':'neutral'}
function transactionAmountText(x){return x.type==='income'?`+ ${money(x.amount)}`:x.type==='expense'?`− ${money(x.amount)}`:`↔ ${money(x.amount)}`}
function transactionIcon(x){return x.type==='income'?'↗':x.type==='expense'?'↘':'↔'}
function transactionTitle(x){return x.type==='transfer'?'Перевод между супругами':`${esc(catName(x.category_id))}${subName(x.subcategory_id)?` · ${esc(subName(x.subcategory_id))}`:''}`}
function transactionPeopleText(x){return x.type==='transfer'?`${personName(x.person_id)} → ${personName(x.transfer_to_person_id)}`:personName(x.person_id)}
function trashIcon(){return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false" style="display:block" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9 3h6l1 2H8l1-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6.5 7l.75 13h9.5l.75-13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 10.5v6M14 10.5v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'}

function transactionList(tx,actions=false){
  if(!tx.length)return `<div class="empty">Пока нет операций за этот период</div>`;
  return `<div class="list">${tx.map(x=>{const amount=transactionAmountText(x),tone=transactionTone(x.type),pending=x._offline?'<span class="offline-row-badge">Ожидает синхронизации</span>':'',amountMarkup=actions?`<button type="button" class="tx-amount amount-edit-trigger ${tone}" data-id="${x.id}" title="Исправить сумму"><span>${amount}</span><small>Исправить</small></button>`:`<div class="tx-amount ${tone}">${amount}</div>`;return `<div class="tx ${x.type==='transfer'?'transfer-row':''} ${x._offline?'tx-pending':''}"><div class="tx-icon">${transactionIcon(x)}</div><div><div class="tx-title">${transactionTitle(x)}</div><div class="tx-meta">${esc(transactionPeopleText(x))} · ${new Date(x.occurred_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}${x.description?' · '+esc(x.description):''}${pending}</div></div>${amountMarkup}${actions?`<div class="tx-actions"><button class="btn btn-soft btn-small editTx" data-id="${x.id}">Изменить</button><button class="btn btn-danger btn-small deleteTx" data-id="${x.id}" aria-label="В корзину" title="В корзину">${trashIcon()}</button></div>`:''}</div>`}).join('')}</div>`;
}

function bindTxButtons(){
  document.querySelectorAll('.editTx').forEach(b=>b.onclick=()=>openEditTransaction(b.dataset.id));
  document.querySelectorAll('.deleteTx').forEach(b=>b.onclick=()=>deleteTransaction(b.dataset.id));
  document.querySelectorAll('.restoreTx').forEach(b=>b.onclick=()=>restoreTransaction(b.dataset.id));
  document.querySelectorAll('.historyTx').forEach(b=>b.onclick=()=>openTransactionHistory(b.dataset.id));
  document.querySelectorAll('.amount-edit-trigger').forEach(b=>b.onclick=()=>openQuickAmountEdit(b.dataset.id));
}
function expenseBars(){const sums={};periodTx().filter(x=>x.type==='expense').forEach(x=>sums[x.category_id]=(sums[x.category_id]||0)+Number(x.amount));const arr=Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0,7),max=arr[0]?.[1]||1;if(!arr.length)return `<div class="empty">После первых расходов здесь появится структура трат</div>`;return arr.map(([id,val])=>`<div class="bar-row"><span>${esc(catName(id))}</span><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div><b>${money(val)}</b></div>`).join('')}
function openEditTransaction(id){const source=byId(state.transactions,id)||byId(state.trashTransactions,id);if(!source)return;if(source.type==='transfer'&&typeof openTransferModal==='function')return openTransferModal({...source});renderEditModal({...source})}
function renderEditModal(tx){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><h2>Редактировать операцию</h2><button class="icon-btn" id="closeModal">×</button></div><div id="editNotice"></div>${transactionForm(tx)}</div></div>`);document.getElementById('closeModal').onclick=closeModal;bindTransactionForm(tx.id)}

function openQuickAmountEdit(id){
  const tx=byId(state.transactions,id);if(!tx)return;closeModal();
  const context=tx.type==='transfer'?[transactionTitle(tx),transactionPeopleText(tx)]:[catName(tx.category_id),subName(tx.subcategory_id),personName(tx.person_id)];
  const contextText=context.filter(Boolean).map(esc).join(' · ');
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal quick-amount-modal"><div class="modal-head"><div><h2>Исправить сумму</h2><p class="quick-amount-context">${contextText}</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="quickAmountNotice"></div><form id="quickAmountForm"><div class="field"><label for="quickAmountInput">Сумма, ₸</label><input id="quickAmountInput" class="quick-amount-input" type="number" min="1" step="1" inputmode="decimal" value="${Number(tx.amount)||''}" required></div><div class="quick-amount-actions"><button type="button" class="btn btn-soft" id="cancelQuickAmount">Отмена</button><button type="submit" class="btn btn-primary" id="saveQuickAmount">Сохранить сумму</button></div></form></div></div>`);
  const input=document.getElementById('quickAmountInput'),save=document.getElementById('saveQuickAmount');document.getElementById('closeModal').onclick=closeModal;document.getElementById('cancelQuickAmount').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
  document.getElementById('quickAmountForm').onsubmit=async e=>{e.preventDefault();const amount=Number(input.value);if(!(amount>0))return notice('quickAmountNotice','Введите корректную сумму');save.disabled=true;save.textContent=navigator.onLine?'Сохраняю…':'Сохраняю офлайн…';try{const result=window.FinanceOffline?.updateTransaction?await window.FinanceOffline.updateTransaction(id,{amount}):await sb.from('transactions').update({amount}).eq('id',id).select().single();if(result.error)return notice('quickAmountNotice',`Не удалось изменить сумму: ${result.error.message||result.error}`);if(!result.data)return notice('quickAmountNotice','Изменение суммы не сохранено.');syncTransactionState(result.data);if(typeof uiSound==='function')uiSound('success');closeModal();renderStateChange()}catch(err){notice('quickAmountNotice',`Ошибка: ${err?.message||String(err)}`)}finally{if(save&&document.body.contains(save)){save.disabled=false;save.textContent='Сохранить сумму'}}};
  requestAnimationFrame(()=>{if(!matchMedia('(pointer:coarse)').matches){input?.focus();input?.select()}});
}

async function deleteTransaction(id){
  const localOnly=window.FinanceOffline?.isTempId?.(id),question=localOnly?'Отменить эту ещё не синхронизированную операцию?':'Переместить операцию в корзину? Её можно будет восстановить.';
  if(!confirm(question))return;
  const result=window.FinanceOffline?.setDeleted?await window.FinanceOffline.setDeleted(id,true):await sb.from('transactions').update({deleted_at:new Date().toISOString()}).eq('id',id).select().single();
  if(result.error)return alert(result.error.message||result.error);if(result.data)syncTransactionState(result.data);if(typeof uiSound==='function')uiSound('delete');renderStateChange();
}
async function restoreTransaction(id){
  const result=window.FinanceOffline?.setDeleted?await window.FinanceOffline.setDeleted(id,false):await sb.from('transactions').update({deleted_at:null}).eq('id',id).select().single();
  if(result.error)return alert(result.error.message||result.error);if(result.data)syncTransactionState(result.data);if(typeof uiSound==='function')uiSound('success');renderStateChange();
}

function historyActor(id){if(!id)return'Система';if(id===state.user?.id)return'Вы';return state.people.find(p=>p.linked_user_id===id)?.display_name||'Участник семьи'}
function historyChanges(row){
  if(row.action==='delete')return ['Операция перемещена в корзину'];if(row.action==='restore')return ['Операция восстановлена'];
  const before=row.before_data||{},after=row.after_data||{},changes=[];
  if(Number(before.amount)!==Number(after.amount))changes.push(`Сумма: ${money(before.amount)} → ${money(after.amount)}`);
  if(before.type!==after.type)changes.push(`Тип: ${transactionTypeLabel(before.type)} → ${transactionTypeLabel(after.type)}`);
  if(before.person_id!==after.person_id)changes.push(`${after.type==='transfer'?'От кого':'Участник'}: ${personName(before.person_id)} → ${personName(after.person_id)}`);
  if(before.transfer_to_person_id!==after.transfer_to_person_id)changes.push(`Кому: ${before.transfer_to_person_id?personName(before.transfer_to_person_id):'—'} → ${after.transfer_to_person_id?personName(after.transfer_to_person_id):'—'}`);
  if(before.category_id!==after.category_id)changes.push(`Категория: ${before.category_id?catName(before.category_id):'—'} → ${after.category_id?catName(after.category_id):'—'}`);
  if(before.subcategory_id!==after.subcategory_id)changes.push(`Подкатегория: ${subName(before.subcategory_id)||'—'} → ${subName(after.subcategory_id)||'—'}`);
  if((before.description||'')!==(after.description||''))changes.push(`Комментарий: ${before.description||'—'} → ${after.description||'—'}`);
  if(before.occurred_at!==after.occurred_at)changes.push(`Дата: ${new Date(before.occurred_at).toLocaleString('ru-RU')} → ${new Date(after.occurred_at).toLocaleString('ru-RU')}`);
  return changes.length?changes:['Служебное обновление записи'];
}
async function openTransactionHistory(id){
  closeModal();document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal history-modal"><div class="modal-head"><h2>История операции</h2><button class="icon-btn" id="closeModal">×</button></div><div id="historyBody"><div class="empty">Загружаю историю…</div></div></div></div>`);document.getElementById('closeModal').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
  const body=document.getElementById('historyBody');if(!body)return;if(window.FinanceOffline?.isTempId?.(id)){body.innerHTML='<div class="empty">Операция ещё не синхронизирована с сервером. История появится после подключения к интернету.</div>';return}if(!navigator.onLine){body.innerHTML='<div class="empty">История изменений хранится на сервере и будет доступна после подключения к интернету.</div>';return}
  const {data,error}=await sb.from('transaction_history').select('*').eq('transaction_id',id).order('changed_at',{ascending:false}).limit(50);if(error){body.innerHTML=`<div class="notice error">${esc(error.message)}</div>`;return}if(!data?.length){body.innerHTML='<div class="empty">Изменений этой операции пока не было</div>';return}body.innerHTML=`<div class="history-list">${data.map(row=>`<div class="history-row"><div class="history-row-head"><b>${row.action==='delete'?'Удаление':row.action==='restore'?'Восстановление':'Изменение'}</b><span>${new Date(row.changed_at).toLocaleString('ru-RU',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span></div><small>${esc(historyActor(row.changed_by))}</small>${historyChanges(row).map(x=>`<p>${esc(x)}</p>`).join('')}</div>`).join('')}</div>`;
}
