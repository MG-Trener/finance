// Family piggy bank: balances in several currencies inside the Plan section.
(function(){
  const PIGGY_CURRENCIES={
    KZT:{code:'KZT',name:'Казахстанский тенге',symbol:'₸',flag:'🇰🇿'},
    RUB:{code:'RUB',name:'Российский рубль',symbol:'₽',flag:'🇷🇺'},
    USD:{code:'USD',name:'Американский доллар',symbol:'$',flag:'🇺🇸'},
    CNY:{code:'CNY',name:'Китайский юань',symbol:'¥',flag:'🇨🇳'}
  };
  const PIGGY_ORDER=['KZT','RUB','USD','CNY'];

  state.piggyBank=state.piggyBank||[];

  function piggyCurrency(code){return PIGGY_CURRENCIES[code]||PIGGY_CURRENCIES.KZT}
  function piggyRow(code){return (state.piggyBank||[]).find(row=>row.currency_code===code)||null}
  function piggyNumber(value){
    const n=Number(value||0);
    return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n);
  }
  function piggyCacheKey(){return state.family?.id?`finance.piggy.${state.family.id}`:''}
  function savePiggyCache(){
    const key=piggyCacheKey();if(!key)return;
    try{localStorage.setItem(key,JSON.stringify(state.piggyBank||[]))}catch(_){ }
  }
  function restorePiggyCache(){
    const key=piggyCacheKey();if(!key)return false;
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||'null');
      if(!Array.isArray(parsed))return false;
      state.piggyBank=parsed;
      return true;
    }catch(_){return false}
  }
  function syncPiggyRow(row){
    if(!row)return;
    state.piggyBank=(state.piggyBank||[]).filter(item=>item.id!==row.id&&item.currency_code!==row.currency_code);
    state.piggyBank.push(row);
    state.piggyBank.sort((a,b)=>PIGGY_ORDER.indexOf(a.currency_code)-PIGGY_ORDER.indexOf(b.currency_code));
    savePiggyCache();
  }

  function piggyCurrencyCard(code){
    const currency=piggyCurrency(code),row=piggyRow(code),amount=Number(row?.amount||0);
    return `<article class="card piggy-currency-card ${amount>0?'has-savings':''}">
      <div class="piggy-currency-identity">
        <span class="piggy-flag" aria-hidden="true">${currency.flag}</span>
        <div><strong>${esc(currency.name)}</strong><small>${currency.code}</small></div>
      </div>
      <div class="piggy-balance" aria-label="Накоплено ${esc(currency.name)}: ${esc(piggyNumber(amount))}">
        <span class="piggy-symbol">${currency.symbol}</span><strong>${piggyNumber(amount)}</strong>
      </div>
      ${row?`<button type="button" class="btn btn-soft btn-small piggy-edit" data-piggy-edit="${currency.code}">Изменить</button>`:'<span class="piggy-empty-label">Пока пусто</span>'}
    </article>`;
  }

  window.piggyBankPanel=function(){
    const filled=PIGGY_ORDER.filter(code=>Number(piggyRow(code)?.amount||0)>0).length;
    return `<section class="plan-panel piggy-bank-panel" data-plan-panel="piggy">
      <div class="card piggy-toolbar">
        <div class="piggy-toolbar-copy"><span>ОТЛОЖЕННЫЕ СРЕДСТВА</span><h3>Семейная копилка</h3><p>Храните накопления отдельно в каждой валюте без пересчёта по курсу.</p></div>
        <button type="button" class="btn btn-primary piggy-add" id="piggyAddCoin"><span aria-hidden="true">🪙</span> Добавить монету</button>
      </div>
      <div class="piggy-meta"><span>Валют в копилке</span><b>${filled} / ${PIGGY_ORDER.length}</b></div>
      <div class="piggy-currency-list">${PIGGY_ORDER.map(piggyCurrencyCard).join('')}</div>
      <div class="piggy-chest-wrap" aria-label="Пиратский сундук с накоплениями">
        <img src="assets/piggy-chest.svg?v=piggy1" alt="Пиратский сундук, наполненный золотыми монетами" loading="lazy" decoding="async">
      </div>
    </section>`;
  };

  function piggyModal(markup){
    closeModal();
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal piggy-modal">${markup}</div></div>`);
    document.getElementById('piggyClose')?.addEventListener('click',closeModal);
    document.getElementById('modal').onclick=event=>{if(event.target.id==='modal')closeModal()};
  }

  function piggySelectOptions(selected='KZT'){
    return PIGGY_ORDER.map(code=>{
      const currency=piggyCurrency(code),row=piggyRow(code),current=row?` · сейчас ${currency.symbol} ${piggyNumber(row.amount)}`:'';
      return `<option value="${code}" ${code===selected?'selected':''}>${currency.flag} ${esc(currency.name)} (${currency.symbol})${current}</option>`;
    }).join('');
  }

  function openPiggyModal(mode='add',code='KZT'){
    const edit=mode==='edit',existing=edit?piggyRow(code):null,currency=piggyCurrency(code);
    if(edit&&!existing)return;
    piggyModal(`<div class="modal-head"><div><h2>${edit?'Изменить накопления':'Добавить монету'}</h2><p class="quick-amount-context">${edit?`${currency.flag} ${currency.name}`:'Выберите валюту и сумму пополнения'}</p></div><button type="button" class="icon-btn" id="piggyClose" aria-label="Закрыть">×</button></div>
      <div id="piggyModalNotice"></div>
      <form id="piggyForm" class="piggy-form">
        ${edit?`<input type="hidden" id="piggyCurrency" value="${currency.code}">`:`<div class="field"><label>Валюта</label><select id="piggyCurrency">${piggySelectOptions(code)}</select></div>`}
        <div class="field"><label>${edit?'Новый остаток':'Сколько добавить'}</label><div class="piggy-amount-control"><span id="piggyModalSymbol">${currency.symbol}</span><input id="piggyAmount" type="number" min="0" step="0.01" inputmode="decimal" autocomplete="off" required value="${edit?Number(existing.amount):''}" placeholder="0"></div></div>
        <p class="piggy-form-hint" id="piggyFormHint">${edit?'Сумма заменит текущий остаток этой валюты.':'Сумма будет добавлена к уже накопленным средствам этой валюты.'}</p>
        <div class="piggy-form-actions"><button type="submit" class="btn btn-primary btn-wide" id="piggySave">${edit?'Сохранить':'Добавить в копилку'}</button></div>
      </form>`);

    const form=document.getElementById('piggyForm'),select=document.getElementById('piggyCurrency'),symbol=document.getElementById('piggyModalSymbol');
    if(!edit&&select)select.onchange=()=>{symbol.textContent=piggyCurrency(select.value).symbol};
    form.onsubmit=async event=>{
      event.preventDefault();notice('piggyModalNotice','');
      if(!navigator.onLine||state.user?._offlineLocal)return notice('piggyModalNotice','Для изменения Копилки требуется подключение к интернету.');
      const currencyCode=select.value,amount=Number(document.getElementById('piggyAmount').value),button=document.getElementById('piggySave');
      if(!Number.isFinite(amount)||(edit?amount<0:amount<=0))return notice('piggyModalNotice',edit?'Укажите сумму 0 или больше.':'Укажите сумму больше нуля.');
      button.disabled=true;
      try{
        let result;
        if(edit){
          const row=piggyRow(currencyCode);
          result=await sb.from('piggy_bank_balances').update({amount:Math.round(amount*100)/100,updated_by:state.user.id,updated_at:new Date().toISOString()}).eq('id',row.id).select().single();
        }else{
          result=await sb.rpc('add_piggy_bank_amount',{p_family_id:state.family.id,p_currency_code:currencyCode,p_amount:Math.round(amount*100)/100});
        }
        if(result.error)throw result.error;
        const row=Array.isArray(result.data)?result.data[0]:result.data;
        if(row)syncPiggyRow(row);
        closeModal();
        if(typeof uiSound==='function')uiSound(edit?'success':'income');
        renderApp();
      }catch(error){
        button.disabled=false;
        notice('piggyModalNotice',error?.message||String(error));
      }
    };
    setTimeout(()=>document.getElementById('piggyAmount')?.focus(),0);
  }

  window.bindPiggyBank=function(){
    document.getElementById('piggyAddCoin')?.addEventListener('click',()=>openPiggyModal('add','KZT'));
    document.querySelectorAll('[data-piggy-edit]').forEach(button=>button.onclick=()=>openPiggyModal('edit',button.dataset.piggyEdit));
  };

  // Load balances alongside the rest of the family data. A small local cache keeps
  // the last known balances visible if the installed app is opened offline.
  const baseLoadDataWithPiggy=loadData;
  loadData=async function(){
    await baseLoadDataWithPiggy();
    if(!state.family)return;
    const restored=restorePiggyCache();
    if(!state.user||!navigator.onLine||state.user?._offlineLocal||window.FinanceOfflineSession?.isLocalSession?.()){
      if(restored&&typeof renderApp==='function')renderApp();
      return;
    }
    try{
      const {data,error}=await sb.from('piggy_bank_balances').select('*').eq('family_id',state.family.id).order('currency_code');
      if(error)throw error;
      state.piggyBank=data||[];
      savePiggyCache();
      if(typeof renderApp==='function')renderApp();
    }catch(error){
      console.error('Не удалось загрузить Копилку',error);
      if(restored&&typeof renderApp==='function')renderApp();
    }
  };

  // Extend the existing two-tab Plan page without disturbing goals/recurring logic.
  if(typeof planTabsMarkup==='function'&&typeof planPage==='function'&&typeof bindPlan==='function'){
    planTabsMarkup=function(){
      const alerts=typeof phase3Upcoming==='function'?phase3Upcoming(3):[];
      const activeGoals=state.goals.filter(g=>!g.archived).length;
      const filled=PIGGY_ORDER.filter(code=>Number(piggyRow(code)?.amount||0)>0).length;
      return `<div class="plan-tabs" role="tablist" aria-label="Разделы плана">
        <button type="button" class="plan-tab ${planSection==='goals'?'active':''}" data-plan-section="goals" role="tab" aria-selected="${planSection==='goals'}"><span>Цели</span><b>${activeGoals}</b></button>
        <button type="button" class="plan-tab ${planSection==='recurring'?'active':''}" data-plan-section="recurring" role="tab" aria-selected="${planSection==='recurring'}"><span>Ежемесячные затраты</span>${alerts.length?`<b class="plan-tab-alert">${alerts.length}</b>`:`<b>${state.recurring.filter(r=>r.active).length}</b>`}</button>
        <button type="button" class="plan-tab ${planSection==='piggy'?'active':''}" data-plan-section="piggy" role="tab" aria-selected="${planSection==='piggy'}"><span>Копилка</span><b>${filled}</b></button>
      </div>`;
    };

    planPage=function(){
      if(state.view==='goals')planSection='goals';
      const subtitle=planSection==='goals'?'Финансовые цели и накопления':planSection==='recurring'?'Регулярные платежи и ежемесячные расходы':'Отложенные средства в разных валютах';
      const panel=planSection==='goals'?planGoalsPanel():planSection==='recurring'?planRecurringPanel():piggyBankPanel();
      return `<div class="page-head plan-page-head"><div><h2 class="page-title">План</h2><div class="page-subtitle">${subtitle}</div></div></div>${planTabsMarkup()}${panel}`;
    };

    bindPlan=function(){
      document.querySelectorAll('[data-plan-section]').forEach(button=>button.onclick=()=>{
        const next=button.dataset.planSection;if(!['goals','recurring','piggy'].includes(next)||next===planSection)return;
        planSection=next;
        if(state.view==='goals')state.view='recurring';
        renderApp();
      });
      if(planSection==='goals')bindGoals?.();else if(planSection==='recurring')bindRecurring?.();else bindPiggyBank?.();
    };
  }
})();
