// Unified Treasurer settings hub: response format, voice controls and API spend/balance stats.
(function(){
  let loading=false;

  function fmtUsd(value,{dash=true}={}){
    const number=Number(value);
    if(!Number.isFinite(number))return dash?'—':'$0.00';
    return `$${number.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4})}`;
  }
  function localDateInput(iso){
    const date=new Date(iso||Date.now());
    if(Number.isNaN(date.getTime()))return '';
    const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),d=String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function timezone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'Asia/Almaty'}

  async function authHeaders(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.access_token)throw new Error('Сеанс авторизации истёк.');
    return {Authorization:`Bearer ${session.access_token}`,apikey:SUPABASE_KEY,'Content-Type':'application/json'};
  }

  async function requestUsage(body={action:'status'}){
    const headers=await authHeaders();
    const response=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-usage`,{
      method:'POST',headers,body:JSON.stringify({...body,timezone:timezone()})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload?.ok)throw new Error(payload?.message||'Не удалось получить статистику API.');
    return payload;
  }

  function apiMarkup(){
    return `<section class="treasurer-api-card" data-treasurer-api-card>
      <div class="treasurer-api-head">
        <div><h3>API · баланс и расходы</h3><p>Расходы OpenAI и расчётный остаток средств Казначея.</p></div>
        <button type="button" class="btn btn-soft btn-small" data-treasurer-api-refresh>↻ Обновить</button>
      </div>
      <div class="treasurer-api-metrics" aria-live="polite">
        <div class="treasurer-api-metric is-balance"><span>Расчётный остаток</span><strong data-api-balance>—</strong><small>пополнения − фактические расходы</small></div>
        <div class="treasurer-api-metric"><span>Сегодня</span><strong data-api-today>—</strong><small>расход API</small></div>
        <div class="treasurer-api-metric"><span>Этот месяц</span><strong data-api-month>—</strong><small>расход API</small></div>
        <div class="treasurer-api-metric"><span>С начала учёта</span><strong data-api-total>—</strong><small data-api-since>—</small></div>
      </div>
      <div class="treasurer-api-status" data-api-status>Нажмите «Обновить», чтобы запросить статистику.</div>
      <details class="treasurer-api-funding">
        <summary>База расчёта баланса</summary>
        <div class="treasurer-api-funding-row">
          <label><span>Всего пополнено, $</span><input type="number" min="0" step="0.01" inputmode="decimal" data-api-funded value="5.00"></label>
          <label><span>Считать расходы с</span><input type="date" data-api-started value="2026-09-14"></label>
          <button type="button" class="btn btn-soft btn-small" data-api-save-funding>Сохранить</button>
        </div>
        <p>Если пополните OpenAI ещё раз, увеличьте сумму «Всего пополнено». Остаток рассчитывается от этой суммы.</p>
      </details>
      <div class="treasurer-api-note">OpenAI публично отдаёт точные расходы через Costs API, но не предоставляет отдельный публичный endpoint текущего prepaid-баланса. Поэтому остаток здесь расчётный.</div>
    </section>`;
  }

  function buildHub(){
    if(state?.view!=='settings')return null;
    let hub=document.querySelector('[data-treasurer-settings-hub]');
    if(hub)return hub;
    const base=document.querySelector('.treasurer-settings-card');
    if(!base)return null;
    const voice=document.querySelector('[data-treasurer-voice-settings]');
    const parent=base.parentElement;
    if(!parent)return null;

    hub=document.createElement('section');
    hub.className='treasurer-settings-hub';
    hub.dataset.treasurerSettingsHub='1';
    hub.innerHTML=`<div class="treasurer-settings-hub-head"><div class="treasurer-settings-hub-icon">♜</div><div><h2>Казначей</h2><p>ИИ-помощник семьи: формат ответа, голос и контроль расходов API.</p></div></div><div class="treasurer-settings-hub-controls" data-treasurer-hub-controls></div>${apiMarkup()}`;
    parent.insertBefore(hub,base);
    const controls=hub.querySelector('[data-treasurer-hub-controls]');
    controls.appendChild(base);
    if(voice)controls.appendChild(voice);
    bindHub(hub);
    return hub;
  }

  function renderUsage(payload,hub=document.querySelector('[data-treasurer-settings-hub]')){
    if(!hub||!payload)return;
    const set=(selector,text)=>{const node=hub.querySelector(selector);if(node)node.textContent=text};
    const funded=hub.querySelector('[data-api-funded]');
    const started=hub.querySelector('[data-api-started]');
    if(funded&&Number.isFinite(Number(payload.funded_usd)))funded.value=Number(payload.funded_usd).toFixed(2);
    if(started&&payload.tracking_started_at)started.value=localDateInput(payload.tracking_started_at);
    set('[data-api-since]',payload.tracking_started_at?`с ${new Date(payload.tracking_started_at).toLocaleDateString('ru-RU')}`:'—');

    if(payload.costs_available){
      set('[data-api-balance]',fmtUsd(payload.estimated_balance_usd));
      set('[data-api-today]',fmtUsd(payload.spent_today_usd));
      set('[data-api-month]',fmtUsd(payload.spent_month_usd));
      set('[data-api-total]',fmtUsd(payload.spent_total_usd));
      const fetched=payload.fetched_at?new Date(payload.fetched_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}):'';
      set('[data-api-status]',`Данные OpenAI обновлены${fetched?` в ${fetched}`:''}. Пополнено: ${fmtUsd(payload.funded_usd)}.`);
      hub.querySelector('[data-treasurer-api-card]')?.classList.remove('is-unconfigured');
      return;
    }

    set('[data-api-balance]','—');
    set('[data-api-today]','—');
    set('[data-api-month]','—');
    set('[data-api-total]','—');
    const status=payload.error==='ADMIN_KEY_REQUIRED'
      ?'Статистика расходов подготовлена, но ещё нужен OpenAI Admin API key в Supabase.'
      :payload.error==='ADMIN_KEY_INVALID'
        ?'Admin API key не подходит или не имеет доступа к статистике OpenAI.'
        :(payload.message||'Статистика расходов сейчас недоступна.');
    set('[data-api-status]',status);
    hub.querySelector('[data-treasurer-api-card]')?.classList.add('is-unconfigured');
  }

  async function refreshUsage(hub=document.querySelector('[data-treasurer-settings-hub]')){
    if(!hub||loading)return;
    loading=true;
    const button=hub.querySelector('[data-treasurer-api-refresh]');
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='… Обновляю';}
    const status=hub.querySelector('[data-api-status]');
    if(status)status.textContent='Запрашиваю расходы OpenAI…';
    try{renderUsage(await requestUsage({action:'status'}),hub)}
    catch(error){if(status)status.textContent=error?.message||'Не удалось обновить статистику API.';}
    finally{loading=false;if(button){button.disabled=false;button.textContent=old||'↻ Обновить';}}
  }

  async function saveFunding(hub){
    const amount=Number(hub.querySelector('[data-api-funded]')?.value);
    const date=hub.querySelector('[data-api-started]')?.value;
    const button=hub.querySelector('[data-api-save-funding]');
    if(!Number.isFinite(amount)||amount<0)return;
    const started=new Date(`${date||localDateInput(new Date())}T00:00:00`);
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Сохраняю…';}
    try{
      const payload=await requestUsage({action:'save_funding',funded_usd:amount,tracking_started_at:started.toISOString()});
      renderUsage(payload,hub);
      const status=hub.querySelector('[data-api-status]');if(status)status.textContent='База расчёта сохранена. Нажмите «Обновить» для свежих расходов.';
    }catch(error){const status=hub.querySelector('[data-api-status]');if(status)status.textContent=error?.message||'Не удалось сохранить сумму пополнения.';}
    finally{if(button){button.disabled=false;button.textContent=old||'Сохранить';}}
  }

  function bindHub(hub){
    hub.querySelector('[data-treasurer-api-refresh]')?.addEventListener('click',()=>refreshUsage(hub));
    hub.querySelector('[data-api-save-funding]')?.addEventListener('click',()=>saveFunding(hub));
  }

  function install(){
    const hub=buildHub();
    if(hub)setTimeout(()=>refreshUsage(hub),0);
  }

  if(typeof bindSettings==='function'){
    const baseBindSettings=bindSettings;
    bindSettings=function(){baseBindSettings();install()};
  }

  window.FinanceTreasurerSettings={refresh:refreshUsage};
})();
