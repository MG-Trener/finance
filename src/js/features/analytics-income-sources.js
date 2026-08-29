// Personal income and expense sources for annual analytics.
(function(){
  if(typeof analyticsPage!=='function')return;

  const baseAnalyticsPage=analyticsPage;
  const sourceFilters={income:{},expense:{}};

  function personByLabel(personLabel){return state.people.find(p=>p.label===personLabel)}

  function filterFor(type,personLabel){
    const current=sourceFilters[type]?.[personLabel];
    if(current)return current;
    return{year:+state.year,month:'all'};
  }

  function availableYears(type,personLabel){
    const person=personByLabel(personLabel),years=new Set([+state.year]);
    if(person){
      state.transactions
        .filter(x=>x.type===type&&x.person_id===person.id)
        .forEach(x=>years.add(new Date(x.occurred_at).getFullYear()));
    }
    return [...years].filter(Number.isFinite).sort((a,b)=>b-a);
  }

  function personCategories(type,personLabel,year,month='all'){
    const person=personByLabel(personLabel);
    if(!person)return{categories:[],total:0};
    const categorySums={};
    state.transactions
      .filter(x=>{
        if(x.type!==type||x.person_id!==person.id)return false;
        const date=new Date(x.occurred_at);
        return date.getFullYear()===+year&&(month==='all'||date.getMonth()===+month);
      })
      .forEach(x=>{categorySums[x.category_id]=(categorySums[x.category_id]||0)+Number(x.amount||0)});
    const categories=Object.entries(categorySums).sort((a,b)=>b[1]-a[1]);
    const total=categories.reduce((sum,[,value])=>sum+value,0);
    return{categories,total};
  }

  function periodLabel(year,month){return month==='all'?`${year} год`:`${MONTHS[+month]} ${year}`}

  function sourceList(type,categories,total,year,month){
    if(!categories.length){
      const word=type==='income'?'Доходов':'Расходов';
      return `<div class="empty">${word} за ${esc(periodLabel(year,month))} пока нет</div>`;
    }
    const max=categories[0][1]||1;
    return categories.slice(0,7).map(([id,val],i)=>`<div class="annual-category"><span class="annual-rank">${i+1}</span><div class="annual-category-main"><div><b>${esc(catName(id))}</b><span>${money(val)} · ${total?Math.round(val/total*100):0}%</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div></div></div>`).join('');
  }

  function monthOptions(selected){
    const options=[['all','Весь год'],...MONTHS.map((name,index)=>[String(index),name])];
    return options.map(([value,label])=>`<option value="${value}"${String(selected)===value?' selected':''}>${esc(label)}</option>`).join('');
  }

  function yearOptions(type,personLabel,selected){
    return availableYears(type,personLabel).map(year=>`<option value="${year}"${+selected===year?' selected':''}>${year}</option>`).join('');
  }

  function sourceCard(type,personLabel,title){
    const filter=filterFor(type,personLabel),data=personCategories(type,personLabel,filter.year,filter.month);
    const cardKey=`${type}-${personLabel}`;
    return `<div class="card income-source-card" data-source-card="${cardKey}" data-source-type="${type}" data-person-label="${personLabel}"><div class="income-source-card-head"><h3>${esc(title)}</h3><div class="income-source-filters"><label class="income-source-filter"><span>Месяц</span><select class="income-source-select" data-source-filter="month" aria-label="Месяц для ${esc(title)}">${monthOptions(filter.month)}</select></label><label class="income-source-filter income-source-year"><span>Год</span><select class="income-source-select" data-source-filter="year" aria-label="Год для ${esc(title)}">${yearOptions(type,personLabel,filter.year)}</select></label></div></div><div class="income-source-body">${sourceList(type,data.categories,data.total,filter.year,filter.month)}</div></div>`;
  }

  function refreshSourceCard(type,personLabel){
    const card=document.querySelector(`[data-source-card="${type}-${personLabel}"]`);
    if(!card)return;
    const filter=filterFor(type,personLabel),data=personCategories(type,personLabel,filter.year,filter.month),body=card.querySelector('.income-source-body');
    if(body)body.innerHTML=sourceList(type,data.categories,data.total,filter.year,filter.month);
  }

  if(!window.__personalSourceFiltersBound){
    window.__personalSourceFiltersBound=true;
    document.addEventListener('change',event=>{
      const select=event.target instanceof Element?event.target.closest('[data-source-filter]'):null;
      if(!(select instanceof HTMLSelectElement))return;
      const card=select.closest('[data-source-card]');
      if(!card)return;
      const type=card.dataset.sourceType,personLabel=card.dataset.personLabel;
      if(!sourceFilters[type]||!personLabel)return;
      const monthSelect=card.querySelector('[data-source-filter="month"]'),yearSelect=card.querySelector('[data-source-filter="year"]');
      sourceFilters[type][personLabel]={year:+yearSelect.value,month:monthSelect.value};
      refreshSourceCard(type,personLabel);
    });
  }

  analyticsPage=function(){
    const html=baseAnalyticsPage();
    const marker='<div class="card"><h3>Куда ушло больше всего</h3>';
    if(!html.includes(marker))return html;
    const personalCards=
      sourceCard('income','husband','Доход Михаила')+
      sourceCard('income','wife','Доход Огонька')+
      sourceCard('expense','husband','Расход Михаила')+
      sourceCard('expense','wife','Расход Огонька');
    return html.replace(marker,personalCards+marker);
  };
})();
