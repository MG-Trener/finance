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
  let fromId=editing?tx.person_id:(state.selectedPersonId||state.people[0].id);
  let toId=editing?tx.transfer_to_person_id:(state.people.find(p=>p.id!==fromId)?.id||state.people[1]?.id||'');
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal transfer-modal"><div class="modal-head"><div><h2>${editing?'Изменить перевод':'Перевод между супругами'}</h2><p class="quick-amount-context">Не считается доходом или расходом семьи</p></div><button class="icon-btn" id="closeModal" aria-label="Закрыть">×</button></div><div id="transferNotice" aria-live="polite"></div><form id="transferForm"><div class="transfer-people-grid" style="grid-template-columns:minmax(0,1fr) 44px minmax(0,1fr)"><div class="field"><label for="transferFrom">От кого</label><input id="transferFrom" value="${esc(personName(fromId))}" readonly aria-readonly="true"></div><button type="button" class="icon-btn" id="reverseTransfer" aria-label="Поменять супругов местами" title="Поменять местами" style="align-self:end;width:44px;height:44px;margin-bottom:8px;font-size:22px">⇄</button><div class="field"><label for="transferTo">Кому</label><input id="transferTo" value="${esc(personName(toId))}" readonly aria-readonly="true"></div></div><div class="field"><label for="transferAmount">Сумма, ₸</label><input id="transferAmount" class="quick-amount-input" type="number" min="1" step="1" inputmode="decimal" value="${editing?Number(tx.amount):''}" placeholder="0" required></div><div class="field"><label for="transferDescription">Комментарий</label><input id="transferDescription" value="${esc(tx?.description||'')}" placeholder="Необязательно"></div><div class="quick-amount-actions"><button type="button" class="btn btn-soft" id="cancelTransfer">Отмена</button><button type="submit" class="btn btn-primary" id="saveTransfer">${editing?'Сохранить перевод':'Перевести'}</button></div></form></div></div>`);
  const modal=document.getElementById('modal'),fromInput=document.getElementById('transferFrom'),toInput=document.getElementById('transferTo'),amount=document.getElementById('transferAmount'),save=document.getElementById('saveTransfer'),cancel=document.getElementById('cancelTransfer'),reverse=document.getElementById('reverseTransfer');
  document.getElementById('closeModal').onclick=closeModal;cancel.onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
  const renderParticipants=()=>{fromInput.value=personName(fromId);toInput.value=personName(toId)};
  reverse.onclick=()=>{[fromId,toId]=[toId,fromId];renderParticipants()};
  document.getElementById('transferForm').onsubmit=async e=>{
    e.preventDefault();notice('transferNotice','');
    const value=Number(amount.value||0),description=document.getElementById('transferDescription').value.trim()||null;
    if(!fromId||!toId||fromId===toId)return notice('transferNotice','Выберите разных участников перевода');
    if(!(value>0))return notice('transferNotice','Введите сумму перевода');
    save.disabled=true;reverse.disabled=true;save.textContent=navigator.onLine?'Сохраняю…':'Сохраняю офлайн…';
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
      syncTransactionState(row);state.selectedPersonId=fromId;const now=new Date();const pad=n=>String(n).padStart(2,'0');state.overviewDateKey=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;if(typeof uiSound==='function')uiSound('success');renderStateChange();
      const success=document.getElementById('transferNotice');
      if(success)success.innerHTML=`<div role="status" style="margin:10px 0;padding:11px 13px;border:1px solid rgba(93,166,105,.55);border-radius:10px;background:rgba(38,92,50,.24);color:#d8f2dc;font-weight:800">✓ ${editing?'Перевод успешно изменён':'Перевод успешно выполнен'}</div>`;
      save.textContent=editing?'Изменения сохранены':'Перевод выполнен';cancel.textContent='Закрыть';
    }catch(error){notice('transferNotice',`Ошибка: ${error?.message||String(error)}`)}finally{if(save&&document.body.contains(save)&&!save.textContent.includes('выполнен')&&!save.textContent.includes('сохранены')){save.disabled=false;reverse.disabled=false;save.textContent=editing?'Сохранить перевод':'Перевести'}}
  };
  requestAnimationFrame(()=>{if(!matchMedia('(pointer:coarse)').matches)amount?.focus()});
}

function bindTransferEntryButton(){const button=document.getElementById('openTransfer');if(button)button.onclick=()=>openTransferModal()}

// Analytics keeps transfers neutral for the family while applying them to each spouse's balance.
function ensureChartJs(){
  if(window.Chart)return Promise.resolve(window.Chart);
  if(chartJsPromise)return chartJsPromise;
  chartJsPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='vendor/chart.umd.js';s.async=true;s.onload=()=>window.Chart?resolve(window.Chart):reject(new Error('Chart.js не инициализирован'));s.onerror=()=>reject(new Error('Не удалось загрузить графики'));document.head.appendChild(s)}).finally(()=>{if(!window.Chart)chartJsPromise=null});
  return chartJsPromise;
}
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
