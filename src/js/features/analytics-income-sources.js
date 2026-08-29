// Personal income sources for annual analytics.
(function(){
  if(typeof analyticsPage!=='function')return;

  const baseAnalyticsPage=analyticsPage;

  function personIncomeCategories(personLabel,year=+state.year){
    const person=state.people.find(p=>p.label===personLabel);
    if(!person)return{categories:[],total:0};
    const categorySums={};
    yearTx(year)
      .filter(x=>x.type==='income'&&x.person_id===person.id)
      .forEach(x=>{categorySums[x.category_id]=(categorySums[x.category_id]||0)+Number(x.amount||0)});
    const categories=Object.entries(categorySums).sort((a,b)=>b[1]-a[1]);
    const total=categories.reduce((sum,[,value])=>sum+value,0);
    return{categories,total};
  }

  function yearlyIncomeList(categories,total){
    if(!categories.length)return `<div class="empty">Доходов за ${state.year} год пока нет</div>`;
    const max=categories[0][1]||1;
    return categories.slice(0,7).map(([id,val],i)=>`<div class="annual-category"><span class="annual-rank">${i+1}</span><div class="annual-category-main"><div><b>${esc(catName(id))}</b><span>${money(val)} · ${total?Math.round(val/total*100):0}%</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div></div></div>`).join('');
  }

  analyticsPage=function(){
    const html=baseAnalyticsPage();
    const marker='<div class="card"><h3>Куда ушло больше всего</h3>';
    if(!html.includes(marker))return html;
    const mikhail=personIncomeCategories('husband');
    const ogonek=personIncomeCategories('wife');
    const incomeCards=`<div class="card"><h3>Доход Михаила</h3>${yearlyIncomeList(mikhail.categories,mikhail.total)}</div><div class="card"><h3>Доход Огонька</h3>${yearlyIncomeList(ogonek.categories,ogonek.total)}</div>`;
    return html.replace(marker,incomeCards+marker);
  };
})();
