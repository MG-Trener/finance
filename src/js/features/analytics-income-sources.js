// Personal income sources for annual analytics.
(function(){
  if(typeof analyticsPage!=='function')return;

  const baseAnalyticsPage=analyticsPage;
  const incomeFilters={};

  function personByLabel(personLabel){return state.people.find(p=>p.label===personLabel)}

  function filterFor(personLabel){
    const current=incomeFilters[personLabel];
    if(current)return current;
    return{year:+state.year,month:'all'};
  }

  function availableIncomeYears(personLabel){
    const person=personByLabel(personLabel),years=new Set([+state.year]);
    if(person){
      state.transactions
        .filter(x=>x.type==='income'&&x.person_id===person.id)
        .forEach(x=>years.add(new Date(x.occurred_at).getFullYear()));
    }
    return [...years].filter(Number.isFinite).sort((a,b)=>b-a);
  }

  function personIncomeCategories(personLabel,year,month='all'){
    const person=personByLabel(personLabel);
    if(!person)return{categories:[],total:0};
    const categorySums={};
    state.transactions
      .filter(x=>{
        if(x.type!=='income'||x.person_id!==person.id)return false;
        const date=new Date(x.occurred_at);
        return date.getFullYear()===+year&&(month==='all'||date.getMonth()===+month);
      })
      .forEach(x=>{categorySums[x.category_id]=(categorySums[x.category_id]||0)+Number(x.amount||0)});
    const categories=Object.entries(categorySums).sort((a,b)=>b[1]-a[1]);
    const total=categories.reduce((sum,[,value])=>sum+value,0);
    return{categories,total};
  }

  function periodLabel(year,month){return month==='all'?`${year} год`:`${MONTHS[+month]} ${year}`}

  function yearlyIncomeList(categories,total,year,month){
    if(!categories.length)return `<div class="empty">Доходов за ${esc(periodLabel(year,month))} пока нет</div>`;
    const max=categories[0][1]||1;
    return categories.slice(0,7).map(([id,val],i)=>`<div class="annual-category"><span class="annual-rank">${i+1}</span><div class="annual-category-main"><div><b>${esc(catName(id))}</b><span>${money(val)} · ${total?Math.round(val/total*100):0}%</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div></div></div>`).join('');
  }

  function monthOptions(selected){
    const options=[['all','Весь год'],...MONTHS.map((name,index)=>[String(index),name])];
    return options.map(([value,label])=>`<option value="${value}"${String(selected)===value?' selected':''}>${esc(label)}</option>`).join('');
  }

  function yearOptions(personLabel,selected){
    return availableIncomeYears(personLabel).map(year=>`<option value="${year}"${+selected===year?' selected':''}>${year}</option>`).join('');
  }

  function incomeCard(personLabel,title){
    const filter=filterFor(personLabel),data=personIncomeCategories(personLabel,filter.year,filter.month);
    return `<div class="card income-source-card" data-income-source-card="${personLabel}"><div class="income-source-card-head"><h3>${esc(title)}</h3><div class="income-source-filters"><label class="income-source-filter"><span>Месяц</span><select class="income-source-select" data-income-source-filter="month" data-person-label="${personLabel}" aria-label="Месяц для ${esc(title)}">${monthOptions(filter.month)}</select></label><label class="income-source-filter income-source-year"><span>Год</span><select class="income-source-select" data-income-source-filter="year" data-person-label="${personLabel}" aria-label="Год для ${esc(title)}">${yearOptions(personLabel,filter.year)}</select></label></div></div><div class="income-source-body">${yearlyIncomeList(data.categories,data.total,filter.year,filter.month)}</div></div>`;
  }

  function refreshIncomeCard(personLabel){
    const card=document.querySelector(`[data-income-source-card="${personLabel}"]`);
    if(!card)return;
    const filter=filterFor(personLabel),data=personIncomeCategories(personLabel,filter.year,filter.month),body=card.querySelector('.income-source-body');
    if(body)body.innerHTML=yearlyIncomeList(data.categories,data.total,filter.year,filter.month);
  }

  if(!window.__incomeSourceFiltersBound){
    window.__incomeSourceFiltersBound=true;
    document.addEventListener('change',event=>{
      const select=event.target instanceof Element?event.target.closest('[data-income-source-filter]'):null;
      if(!(select instanceof HTMLSelectElement))return;
      const personLabel=select.dataset.personLabel,card=select.closest('[data-income-source-card]');
      if(!personLabel||!card)return;
      const monthSelect=card.querySelector('[data-income-source-filter="month"]'),yearSelect=card.querySelector('[data-income-source-filter="year"]');
      incomeFilters[personLabel]={year:+yearSelect.value,month:monthSelect.value};
      refreshIncomeCard(personLabel);
    });
  }

  analyticsPage=function(){
    const html=baseAnalyticsPage();
    const marker='<div class="card"><h3>Куда ушло больше всего</h3>';
    if(!html.includes(marker))return html;
    const incomeCards=incomeCard('husband','Доход Михаила')+incomeCard('wife','Доход Огонька');
    return html.replace(marker,incomeCards+marker);
  };
})();
