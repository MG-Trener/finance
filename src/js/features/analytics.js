// Extended annual analytics.
function yearTx(){return state.transactions.filter(x=>new Date(x.occurred_at).getFullYear()===+state.year)}

function yearSeries(){
  const income=Array(12).fill(0),expense=Array(12).fill(0),count=Array(12).fill(0);
  yearTx().forEach(x=>{const m=new Date(x.occurred_at).getMonth();(x.type==='income'?income:expense)[m]+=Number(x.amount||0);count[m]++});
  const balance=income.map((v,i)=>v-expense[i]);
  let running=0;const cumulative=balance.map(v=>(running+=v));
  return{income,expense,balance,cumulative,count};
}

function yearSummary(){
  const tx=yearTx();
  const income=tx.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=tx.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
  const balance=income-expense;
  const saved=income?Math.round(balance/income*100):0;
  const now=new Date();
  const divisor=+state.year===now.getFullYear()?Math.max(1,now.getMonth()+1):12;
  const avgExpense=expense/divisor;
  const series=yearSeries();
  const bestIndex=series.balance.reduce((best,v,i)=>v>series.balance[best]?i:best,0);
  const worstIndex=series.balance.reduce((worst,v,i)=>v<series.balance[worst]?i:worst,0);
  const categorySums={};
  tx.filter(x=>x.type==='expense').forEach(x=>categorySums[x.category_id]=(categorySums[x.category_id]||0)+Number(x.amount||0));
  const categories=Object.entries(categorySums).sort((a,b)=>b[1]-a[1]);
  return{tx,income,expense,balance,saved,avgExpense,series,bestIndex,worstIndex,categories};
}

function yearPersonStats(personId){
  const tx=yearTx().filter(x=>x.person_id===personId);
  const income=tx.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense=tx.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
  return{income,expense,balance:income-expense};
}

function yearlyExpenseList(categories){
  if(!categories.length)return `<div class="empty">Расходов за ${state.year} год пока нет</div>`;
  const max=categories[0][1]||1;
  return categories.slice(0,7).map(([id,val],i)=>`<div class="annual-category"><span class="annual-rank">${i+1}</span><div class="annual-category-main"><div><b>${esc(catName(id))}</b><span>${money(val)}</span></div><div class="bar-track"><div class="bar" style="width:${Math.max(3,val/max*100)}%"></div></div></div></div>`).join('')
}

function analyticsPage(){
  const y=yearSummary();
  const topCategory=y.categories[0];
  return `<div class="page-head"><div><h2 class="page-title">Аналитика ${state.year}</h2><div class="page-subtitle">Годовая картина доходов, расходов и накопленного результата семьи.</div></div></div>
  <section class="grid kpis annual-kpis">
    <div class="card"><div class="kpi-label">Доходы за год</div><div class="kpi-value positive">${money(y.income)}</div></div>
    <div class="card"><div class="kpi-label">Расходы за год</div><div class="kpi-value negative">${money(y.expense)}</div></div>
    <div class="card"><div class="kpi-label">Финансовый результат</div><div class="kpi-value ${y.balance>=0?'positive':'negative'}">${money(y.balance)}</div></div>
    <div class="card"><div class="kpi-label">Доля сбережений</div><div class="kpi-value ${y.saved>=0?'positive':'negative'}">${y.saved}%</div></div>
  </section>
  <section class="annual-facts">
    <div class="annual-fact"><span>Операций</span><b>${y.tx.length}</b></div>
    <div class="annual-fact"><span>Средний расход / месяц</span><b>${money(y.avgExpense)}</b></div>
    <div class="annual-fact"><span>Лучший месяц</span><b>${MONTHS[y.bestIndex]}</b><small class="${y.series.balance[y.bestIndex]>=0?'positive':'negative'}">${money(y.series.balance[y.bestIndex])}</small></div>
    <div class="annual-fact"><span>Крупнейшая статья расходов</span><b>${topCategory?esc(catName(topCategory[0])):'—'}</b><small>${topCategory?money(topCategory[1]):''}</small></div>
  </section>
  <div class="grid analytics-grid annual-analytics-grid">
    <div class="card annual-wide"><h3>Доходы и расходы по месяцам</h3><div class="chart-box"><canvas id="yearChart"></canvas></div></div>
    <div class="card"><h3>Накопленный результат</h3><div class="chart-box small"><canvas id="balanceChart"></canvas></div></div>
    <div class="card"><h3>Расходы за год по категориям</h3><div class="chart-box small"><canvas id="categoryChart"></canvas></div></div>
    <div class="card"><h3>Муж и жена за год</h3><div class="chart-box small"><canvas id="peopleChart"></canvas></div></div>
    <div class="card"><h3>Куда ушло больше всего</h3>${yearlyExpenseList(y.categories)}</div>
  </div>`
}

function destroyCharts(){state.charts.forEach(c=>{try{c.destroy()}catch(_){}});state.charts=[]}

function drawAnalytics(){
  if(!window.Chart)return;
  Chart.defaults.color='#cbb994';Chart.defaults.borderColor='rgba(177,139,82,.20)';
  const y=yearSummary(),series=y.series;
  const common={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#d8c6a5'}}}};

  const yearEl=document.getElementById('yearChart');
  if(yearEl)state.charts.push(new Chart(yearEl,{type:'line',data:{labels:MONTHS,datasets:[{label:'Доходы',data:series.income,borderColor:'#67d29d',backgroundColor:'rgba(103,210,157,.14)',tension:.35,fill:true},{label:'Расходы',data:series.expense,borderColor:'#ff766f',backgroundColor:'rgba(255,118,111,.10)',tension:.35,fill:true}]},options:common}));

  const balanceEl=document.getElementById('balanceChart');
  if(balanceEl)state.charts.push(new Chart(balanceEl,{type:'line',data:{labels:MONTHS,datasets:[{label:'Накопленный баланс',data:series.cumulative,borderColor:'#d6ad62',backgroundColor:'rgba(214,173,98,.12)',tension:.3,fill:true}]},options:common}));

  const top=y.categories.slice(0,8),catEl=document.getElementById('categoryChart');
  if(catEl)state.charts.push(new Chart(catEl,{type:'doughnut',data:{labels:top.map(x=>catName(x[0])),datasets:[{data:top.map(x=>x[1]),backgroundColor:['#d6ad62','#8ca6b7','#9b7250','#6f8c79','#b58f5d','#7b6b8e','#a45f55','#638a91']}]},options:{...common,plugins:{legend:{position:'bottom',labels:{color:'#d8c6a5'}}}}}));

  const ps=state.people.map(p=>yearPersonStats(p.id)),peopleEl=document.getElementById('peopleChart');
  if(peopleEl)state.charts.push(new Chart(peopleEl,{type:'bar',data:{labels:state.people.map(p=>p.display_name),datasets:[{label:'Доход',data:ps.map(x=>x.income),backgroundColor:'#67d29d'},{label:'Расход',data:ps.map(x=>x.expense),backgroundColor:'#ff766f'}]},options:common}));
}
