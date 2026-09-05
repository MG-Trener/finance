// Daily current exchange-rate layer for the Family Piggy Bank.
(function(){
  const FX_CODES=['USD','CNY','RUB'];
  const CACHE_KEY='finance.piggy.fx.current.v1';
  const NBK_URL='https://nationalbank.kz/rss/rates_all.xml';
  const FALLBACK_URL='https://open.er-api.com/v6/latest/KZT';
  let inflight=null;

  state.piggyRates=state.piggyRates||null;

  function dayKey(date=new Date()){
    const pad=value=>String(value).padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }
  function number(value){
    const parsed=Number(value);
    return Number.isFinite(parsed)?parsed:null;
  }
  function kzt(value){
    const n=Number(value||0);
    return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Math.round(n));
  }
  function rate(value){
    const n=Number(value||0);
    return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:4}).format(n);
  }
  function readCache(){
    try{
      const parsed=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      if(!parsed||typeof parsed!=='object'||!parsed.rates)return null;
      state.piggyRates=parsed;
      return parsed;
    }catch(_){return null}
  }
  function writeCache(snapshot){
    if(!snapshot)return;
    try{localStorage.setItem(CACHE_KEY,JSON.stringify(snapshot))}catch(_){ }
    state.piggyRates=snapshot;
  }
  function rateFor(code){
    if(code==='KZT')return 1;
    const value=Number(state.piggyRates?.rates?.[code]);
    return Number.isFinite(value)&&value>0?value:null;
  }
  function toKzt(code,amount){
    const value=Number(amount||0),fx=rateFor(code);
    if(!Number.isFinite(value)||fx==null)return null;
    return value*fx;
  }
  function piggyRow(code){return (state.piggyBank||[]).find(row=>row.currency_code===code)||null}
  function totalKzt(){
    let total=0;
    for(const code of ['KZT',...FX_CODES]){
      const amount=Number(piggyRow(code)?.amount||0);
      if(!amount)continue;
      const converted=toKzt(code,amount);
      if(converted==null)return null;
      total+=converted;
    }
    return total;
  }
  function parseNbkDate(raw){
    const match=/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/.exec(String(raw||'').trim());
    if(!match)return String(raw||'').trim();
    const year=match[3].length===2?`20${match[3]}`:match[3];
    return `${match[1]}.${match[2]}.${year}`;
  }
  async function fetchText(url,timeout=6500){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return await response.text();
    }finally{clearTimeout(timer)}
  }
  async function fetchJson(url,timeout=6500){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      return await response.json();
    }finally{clearTimeout(timer)}
  }
  async function fetchNbkRates(){
    const xml=await fetchText(NBK_URL);
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('НБК вернул некорректный XML');
    const rates={},dates=[];
    doc.querySelectorAll('item').forEach(item=>{
      const code=item.querySelector('title')?.textContent?.trim();
      if(!FX_CODES.includes(code))return;
      const description=number(String(item.querySelector('description')?.textContent||'').replace(',','.'));
      const quant=number(String(item.querySelector('quant')?.textContent||'1').replace(',','.'))||1;
      if(description!=null&&description>0)rates[code]=description/quant;
      const published=parseNbkDate(item.querySelector('pubDate')?.textContent||'');
      if(published)dates.push(published);
    });
    if(FX_CODES.some(code=>!Number.isFinite(rates[code])))throw new Error('НБК не вернул все необходимые валюты');
    return {rates,source:'nbk',publishedDate:dates[0]||''};
  }
  async function fetchFallbackRates(){
    const data=await fetchJson(FALLBACK_URL);
    if(data?.result&&data.result!=='success')throw new Error('Резервный сервис не вернул курс');
    const rates={};
    FX_CODES.forEach(code=>{
      const foreignPerKzt=number(data?.rates?.[code]);
      if(foreignPerKzt&&foreignPerKzt>0)rates[code]=1/foreignPerKzt;
    });
    if(FX_CODES.some(code=>!Number.isFinite(rates[code])))throw new Error('Резервный сервис не вернул все необходимые валюты');
    const publishedDate=data?.time_last_update_utc?new Date(data.time_last_update_utc).toLocaleDateString('ru-RU'):'';
    return {rates,source:'fallback',publishedDate};
  }
  function sourceText(){
    const snapshot=state.piggyRates;
    if(!snapshot?.rates)return 'Курс пока не загружен';
    const source=snapshot.source==='nbk'?'НБК':'онлайн-курс';
    const stale=snapshot.cacheDate&&snapshot.cacheDate!==dayKey();
    const date=snapshot.publishedDate?` · ${snapshot.publishedDate}`:'';
    return `${stale?'Последний доступный курс':'Курс'} ${source}${date}`;
  }
  function rateLine(){
    if(!state.piggyRates?.rates)return '';
    return FX_CODES.map(code=>{
      const symbol=code==='USD'?'$':code==='CNY'?'¥':'₽';
      const value=rateFor(code);
      return value?`${symbol}1 = ${rate(value)} ₸`:'';
    }).filter(Boolean).join(' · ');
  }
  function decorate(){
    const panel=document.querySelector('[data-plan-panel="piggy"]');
    if(!panel)return;

    panel.querySelector('.piggy-rate-summary')?.remove();
    panel.querySelectorAll('.piggy-kzt-equivalent').forEach(node=>node.remove());

    panel.querySelectorAll('.piggy-currency-card').forEach(card=>{
      const code=card.querySelector('.piggy-currency-identity small')?.textContent?.trim();
      if(!FX_CODES.includes(code))return;
      const amount=Number(piggyRow(code)?.amount||0);
      if(amount<=0)return;
      const balance=card.querySelector('.piggy-balance');
      if(!balance)return;
      const converted=toKzt(code,amount);
      const note=document.createElement('small');
      note.className='piggy-kzt-equivalent';
      note.textContent=converted==null?'курс недоступен':`≈ ${kzt(converted)} ₸`;
      balance.appendChild(note);
    });

    const total=totalKzt();
    const summary=document.createElement('div');
    summary.className='card piggy-rate-summary';
    summary.innerHTML=`<div class="piggy-rate-total"><span>Общий баланс сбережений</span><strong>${total==null?'—':`${kzt(total)} ₸`}</strong></div><div class="piggy-rate-meta"><span>${sourceText()}</span>${rateLine()?`<small>${rateLine()}</small>`:''}</div>`;
    panel.querySelector('.piggy-meta')?.insertAdjacentElement('afterend',summary);
  }
  async function ensureDailyRates(){
    const today=dayKey(),cached=readCache();
    if(cached?.cacheDate===today||cached?.attemptDate===today){decorate();return cached}
    if(!navigator.onLine){decorate();return cached}
    if(inflight)return inflight;

    inflight=(async()=>{
      try{
        let fresh;
        try{fresh=await fetchNbkRates()}
        catch(primaryError){
          console.warn('Не удалось получить курс НБК, используем резервный источник',primaryError);
          fresh=await fetchFallbackRates();
        }
        const snapshot={...fresh,cacheDate:today,attemptDate:today,fetchedAt:new Date().toISOString()};
        writeCache(snapshot);
        decorate();
        return snapshot;
      }catch(error){
        console.error('Не удалось обновить курсы валют для Копилки',error);
        const failed={...(cached||{}),attemptDate:today};
        try{localStorage.setItem(CACHE_KEY,JSON.stringify(failed))}catch(_){ }
        if(cached)state.piggyRates=cached;
        decorate();
        return cached;
      }finally{inflight=null}
    })();
    return inflight;
  }

  readCache();

  const baseBindPiggyBank=window.bindPiggyBank;
  window.bindPiggyBank=function(){
    baseBindPiggyBank?.();
    decorate();
  };

  const baseLoadDataWithRates=loadData;
  loadData=async function(){
    readCache();
    const result=await baseLoadDataWithRates();
    void ensureDailyRates();
    return result;
  };

  window.addEventListener('online',()=>void ensureDailyRates());
  window.FinancePiggyRates={refresh:ensureDailyRates,decorate};
})();
