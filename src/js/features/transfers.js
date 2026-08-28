// Neutral transfers between spouses. Transfers affect personal balances only.
function transferPersonOptions(selected=''){
  return state.people.map(p=>`<option value="${p.id}" ${p.id===selected?'selected':''}>${esc(p.display_name)}</option>`).join('');
}

function transferNetForPerson(personId,tx=periodTx()){
  let incoming=0,outgoing=0;
  for(const row of tx){
    if(row.type!=='transfer')continue;
    if(row.transfer_to_person_id===personId)incoming+=Number(row.amount||0);
    if(row.person_id===personId)outgoing+=Number(row.amount||0);
  }
  return{incoming,outgoing,net:incoming-outgoing};
}

function transferParticipantsText(tx){
  if(!tx||tx.type!=='transfer')return'';
  return `${personName(tx.person_id)} → ${personName(tx.transfer_to_person_id)}`;
}

function transferCategoryLabel(tx){return tx?.type==='transfer'?'Перевод между супругами':catName(tx?.category_id)}

function openTransferModal(tx=null){
  if(state.people.length<2){alert('Для перевода нужны два участника семьи.');return}
  closeModal();
  const editing=tx?.type==='transfer';
  const from=editing?tx.person_id:(state.selectedPersonId||state.people[0].id);
  const to=editing?tx.transfer_to_person_id:(state.people.find(p=>p.id!==from)?.id||state.people[1]?.id||'');
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal transfer-modal"><div class="modal-head"><div><h2>${editing?'Изменить перевод':'Перевод между супругами'}</h2><p class="quick-amount-context">Не считается доходом или расходом семьи</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="transferNotice"></div><form id="transferForm"><div class="transfer-people-grid"><div class="field"><label for="transferFrom">От кого</label><select id="transferFrom">${transferPersonOptions(from)}</select></div><div class="transfer-arrow" aria-hidden="true">→</div><div class="field"><label for="transferTo">Кому</label><select id="transferTo">${transferPersonOptions(to)}</select></div></div><div class="field"><label for="transferAmount">Сумма, ₸</label><input id="transferAmount" class="quick-amount-input" type="number" min="1" step="1" inputmode="decimal" value="${editing?Number(tx.amount):''}" placeholder="0" required></div><div class="field"><label for="transferDescription">Комментарий</label><input id="transferDescription" value="${esc(tx?.description||'')}" placeholder="Необязательно"></div><div class="transfer-impact"><span>Семейные доходы</span><b>0 ₸</b><span>Семейные расходы</span><b>0 ₸</b></div><div class="quick-amount-actions"><button type="button" class="btn btn-soft" id="cancelTransfer">Отмена</button><button type="submit" class="btn btn-primary" id="saveTransfer">${editing?'Сохранить перевод':'Перевести'}</button></div></form></div></div>`);
  const modal=document.getElementById('modal'),fromSelect=document.getElementById('transferFrom'),toSelect=document.getElementById('transferTo'),amount=document.getElementById('transferAmount'),save=document.getElementById('saveTransfer');
  document.getElementById('closeModal').onclick=closeModal;document.getElementById('cancelTransfer').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
  const keepDifferent=changed=>{
    if(fromSelect.value!==toSelect.value)return;
    const other=state.people.find(p=>p.id!==(changed==='from'?fromSelect.value:toSelect.value));
    if(!other)return;
    if(changed==='from')toSelect.value=other.id;else fromSelect.value=other.id;
  };
  fromSelect.onchange=()=>keepDifferent('from');toSelect.onchange=()=>keepDifferent('to');
  document.getElementById('transferForm').onsubmit=async e=>{
    e.preventDefault();notice('transferNotice','');
    const fromId=fromSelect.value,toId=toSelect.value,value=Number(amount.value||0),description=document.getElementById('transferDescription').value.trim()||null;
    if(!fromId||!toId||fromId===toId)return notice('transferNotice','Выберите разных участников перевода');
    if(!(value>0))return notice('transferNotice','Введите сумму перевода');
    save.disabled=true;save.textContent=navigator.onLine?'Сохраняю…':'Сохраняю офлайн…';
    try{
      const occurredIso=editing?tx.occurred_at:new Date().toISOString();
      const payload={person_id:fromId,transfer_to_person_id:toId,type:'transfer',amount:value,category_id:null,subcategory_id:null,description,occurred_at:occurredIso};
      let result;
      if(editing){
        result=window.FinanceOffline?.updateTransaction?await window.FinanceOffline.updateTransaction(tx.id,payload):await sb.from('transactions').update(payload).eq('id',tx.id).select().single();
      }else{
        if(!navigator.onLine)return notice('transferNotice','Для нового перевода нужно подключение к интернету. После синхронизации он будет доступен офлайн.');
        const createArgs={p_family_id:state.family.id,p_from_person_id:fromId,p_to_person_id:toId,p_amount:value,p_description:description,p_occurred_at:occurredIso};
        result=await sb.rpc('create_family_transfer',createArgs);
      }
      if(result.error)return notice('transferNotice',`Не удалось сохранить перевод: ${result.error.message||result.error}`);
      const row=Array.isArray(result.data)?result.data[0]:result.data;if(!row)return notice('transferNotice','Перевод не был сохранён.');
      syncTransactionState(row);state.selectedPersonId=fromId;const now=new Date();const pad=n=>String(n).padStart(2,'0');state.overviewDateKey=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;if(typeof uiSound==='function')uiSound('success');closeModal();renderStateChange();
    }catch(error){notice('transferNotice',`Ошибка: ${error?.message||String(error)}`)}finally{if(save&&document.body.contains(save)){save.disabled=false;save.textContent=editing?'Сохранить перевод':'Перевести'}}
  };
  requestAnimationFrame(()=>{if(!matchMedia('(pointer:coarse)').matches)amount?.focus()});
}

function bindTransferEntryButton(){const button=document.getElementById('openTransfer');if(button)button.onclick=()=>openTransferModal()}

// Analytics keeps transfers neutral for the family while applying them to each spouse's balance.
function yearSeries(year=+state.year){
  const income=Array(12).fill(0),expense=Array(12).fill(0),count=Array(12).fill(0);
  yearTx(year).forEach(x=>{const m=new Date(x.occurred_at).getMonth();if(x.type==='income')income[m]+=Number(x.amount||0);else if(x.type==='expense')expense[m]+=Number(x.amount||0);count[m]++});
  const balance=income.map((v,i)=>v-expense[i]);let running=0;const cumulative=balance.map(v=>(running+=v));return{income,expense,balance,cumulative,count};
}
function yearPersonStats(personId,year=+state.year){
  const all=yearTx(year),incomeSeries=Array(12).fill(0),expenseSeries=Array(12).fill(0);let transferIn=0,transferOut=0;
  all.forEach(x=>{const month=new Date(x.occurred_at).getMonth();if(x.type==='income'&&x.person_id===personId)incomeSeries[month]+=Number(x.amount||0);else if(x.type==='expense'&&x.person_id===personId)expenseSeries[month]+=Number(x.amount||0);else if(x.type==='transfer'){if(x.transfer_to_person_id===personId)transferIn+=Number(x.amount||0);if(x.person_id===personId)transferOut+=Number(x.amount||0)}});
  const income=incomeSeries.reduce((a,b)=>a+b,0),expense=expenseSeries.reduce((a,b)=>a+b,0),balance=income-expense+transferIn-transferOut,savedRate=income?Math.round(balance/income*100):0;
  return{income,expense,balance,savedRate,incomeSeries,expenseSeries,transferIn,transferOut};
}

window.openTransferModal=openTransferModal;
