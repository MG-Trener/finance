// Calendar-first annual analytics for husband, wife and the whole family.
let chartJsPromise=null;
let analyticsScope='combined';
let analyticsSelectedMonth=null;

// Analytics starts in 2026. A new year appears here only when it actually begins.
if(typeof availableYears==='function'){
  const defaultAvailableYears=availableYears;
  availableYears=function(){
    if(state?.view!=='analytics')return defaultAvailableYears();
    const first=2026,current=Math.max(first,new Date().getFullYear());
    return Array.from({length:current-first+1},(_,index)=>first+index);
  };
}

function ensureChartJs(){
  if(window.Chart)return Promise.resolve(window.Chart);
  if(chartJsPromise)return chartJsPromise;
  chartJsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='vendor/chart.umd.js?v=analytics-calendar1';
    script.async=true;
    script.onload=()=>window.Chart?resolve(window.Chart):reject(new Error('Chart.js не инициализирован'));
    script.onerror=()=>reject(new Error('Не удалось загрузить графики'));
    document.head.appendChild(script);
  }).finally(()=>{if(!window.Chart)chartJsPromise=null});
  return chartJsPromise;
}

function analyticsPerson(scope=analyticsScope){
  if(scope==='combined')return null;
  return state.people.find(person=>person.label===scope)||null;
}

function analyticsScopeTitle(scope=analyticsScope){
  if(scope==='combined')return 'Сводный отчёт';
  const person=analyticsPerson(scope);
  return scope==='husband'?`Муж${person?.display_name?` · ${person.display_name}`:''}`:`Жена${person?.display_name?` · ${person.display_name}`:''}`;
}

function analyticsTransactions(year=+state.year,scope=analyticsScope){
  const person=analyticsPerson(scope);
  return state.transactions.filter(tx=>{
    if(tx.type!=='income'&&tx.type!=='expense')return false;
    const date=new Date(tx.occurred_at);
    if(date.getFullYear()!==+year)return false;
    return scope==='combined'||(person&&tx.person_id===person.id);
  });
}

function analyticsMonthSeries(year=+state.year,scope=analyticsScope){
  const income=Array(12).fill(0),expense=Array(12).fill(0),count=Array(12).fill(0);
  analyticsTransactions(year,scope).forEach(tx=>{
    const month=new Date(tx.occurred_at).getMonth(),amount=Number(tx.amount||0);
    if(tx.type==='income')income[month]+=amount;
    if(tx.type==='expense')expense[month]+=amount;
    count[month]++;
  });
  return{income,expense,count,balance:income.map((value,index)=>value-expense[index])};
}

function analyticsSavingsRate(income,expense){
  if(income>0)return Math.round((income-expense)/income*100);
  return expense>0?-100:0;
}

function analyticsYearSummary(year=+state.year,scope=analyticsScope){
  const tx=analyticsTransactions(year,scope),series=analyticsMonthSeries(year,scope);
  const income=series.income.reduce((sum,value)=>sum+value,0);
  const expense=series.expense.reduce((sum,value)=>sum+value,0);
  const balance=income-expense;
  const savingsRate=analyticsSavingsRate(income,expense);
  const positiveMonths=series.balance.filter((value,index)=>series.count[index]>0&&value>0).length;
  const negativeMonths=series.balance.filter((value,index)=>series.count[index]>0&&value<0).length;
  const activeMonths=series.count.filter(Boolean).length;
  const averageExpense=expense/(activeMonths||1);
  return{tx,series,income,expense,balance,savingsRate,positiveMonths,negativeMonths,activeMonths,averageExpense};
}

function analyticsCategoryName(id){return id==='__none__'?'Без категории':catName(id)}

function analyticsCategoryBuckets(type,monthIndex,year=+state.year,scope=analyticsScope){
  const sums={};
  analyticsTransactions(year,scope)
    .filter(tx=>tx.type===type&&new Date(tx.occurred_at).getMonth()===+monthIndex)
    .forEach(tx=>{
      const key=tx.category_id||'__none__';
      sums[key]=(sums[key]||0)+Number(tx.amount||0);
    });
  return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
}

function analyticsChartBuckets(buckets){
  if(buckets.length<=8)return buckets;
  const top=buckets.slice(0,7),other=buckets.slice(7).reduce((sum,[,value])=>sum+value,0);
  return [...top,['__other__',other]];
}

function analyticsCategoryLabel(id){return id==='__other__'?'Другие категории':analyticsCategoryName(id)}

function analyticsScopeSwitcherMarkup(){
  const options=[['husband','Муж'],['wife','Жена'],['combined','Сводный']];
  return `<div class="analytics-scope-switch" role="group" aria-label="Режим аналитики">${options.map(([value,label])=>`<button type="button" class="analytics-scope-btn ${analyticsScope===value?'active':''}" data-analytics-scope="${value}" aria-pressed="${analyticsScope===value}">${label}</button>`).join('')}</div>`;
}

function analyticsYearStatsMarkup(summary){
  const savingsTone=summary.balance>=0?'savings-positive':'negative';
  const rateTone=summary.savingsRate>=0?'savings-positive':'negative';
  return `<section class="analytics-year-stats" aria-label="Статистика за ${state.year} год">
    <article class="analytics-stat-card"><span>Доход за год</span><b class="positive">${money(summary.income)}</b></article>
    <article class="analytics-stat-card"><span>Расход за год</span><b class="negative">${money(summary.expense)}</b></article>
    <article class="analytics-stat-card"><span>Сбережения</span><b class="${savingsTone}">${money(summary.balance)}</b></article>
    <article class="analytics-stat-card"><span>% сбережений</span><b class="${rateTone}">${summary.savingsRate}%</b></article>
  </section>
  <section class="analytics-year-facts">
    <div><span>Операций</span><b>${summary.tx.length}</b></div>
    <div><span>Месяцев в плюсе</span><b class="positive">${summary.positiveMonths}</b></div>
    <div><span>Месяцев в минусе</span><b class="negative">${summary.negativeMonths}</b></div>
    <div><span>Средний расход активного месяца</span><b>${money(summary.averageExpense)}</b></div>
  </section>`;
}

function analyticsMonthCard(monthIndex,summary){
  const now=new Date(),isCurrent=+state.year===now.getFullYear()&&monthIndex===now.getMonth();
  const income=summary.series.income[monthIndex],expense=summary.series.expense[monthIndex],balance=summary.series.balance[monthIndex],count=summary.series.count[monthIndex];
  const savingsRate=analyticsSavingsRate(income,expense);
  const tone=count?(balance>0?'month-positive':balance<0?'month-negative':'month-neutral'):'month-empty';
  const selected=analyticsSelectedMonth===monthIndex?'is-selected':'';
  const current=isCurrent?'is-current':'';
  const status=isCurrent?'<span class="analytics-month-current">Текущий</span>':'';
  const savingsTone=savingsRate>=0?'savings-positive':'negative';
  return `<button type="button" class="analytics-month-card ${tone} ${current} ${selected}" data-analytics-month="${monthIndex}" aria-label="${MONTHS[monthIndex]} ${state.year}: доход ${money(income)}, расход ${money(expense)}, сбережения ${savingsRate}%">
    <div class="analytics-month-head"><h3>${MONTHS[monthIndex]}</h3>${status}</div>
    <div class="analytics-month-values">
      <div><span>Доход</span><b class="positive">${money(income)}</b></div>
      <div><span>Расход</span><b class="negative">${money(expense)}</b></div>
      <div class="analytics-month-savings"><span>Сбережения</span><b class="${savingsTone}">${savingsRate}%</b></div>
    </div>
  </button>`;
}

function analyticsCalendarMarkup(summary){
  return `<section class="analytics-calendar-section"><div class="analytics-section-head"><div><h3>${state.year} по месяцам</h3><p>Нажмите на месяц, чтобы увидеть отдельные графики доходов и расходов по категориям.</p></div></div><div class="analytics-month-grid">${MONTHS.map((_,index)=>analyticsMonthCard(index,summary)).join('')}</div></section>`;
}

function analyticsCategoryList(buckets,total,type){
  if(!buckets.length)return `<div class="analytics-category-empty">${type==='income'?'Доходов':'Расходов'} в этом месяце нет.</div>`;
  return `<div class="analytics-category-list">${buckets.slice(0,6).map(([id,value])=>`<div><span>${esc(analyticsCategoryName(id))}</span><b>${money(value)}${total?` · ${Math.round(value/total*100)}%`:''}</b></div>`).join('')}</div>`;
}

function analyticsMonthChartCard(type,buckets,total){
  const isIncome=type==='income',title=isIncome?'Доходы по категориям':'Расходы по категориям',canvasId=isIncome?'analyticsIncomeCategoryChart':'analyticsExpenseCategoryChart';
  return `<article class="card analytics-category-card"><div class="analytics-category-card-head"><div><span>${isIncome?'Доход':'Расход'} за месяц</span><h3>${title}</h3></div><b class="${isIncome?'positive':'negative'}">${money(total)}</b></div>${buckets.length?`<div class="analytics-category-chart"><canvas id="${canvasId}"></canvas></div>`:''}${analyticsCategoryList(buckets,total,type)}</article>`;
}

function analyticsMonthDetailsMarkup(){
  if(analyticsSelectedMonth==null)return `<section class="analytics-month-placeholder"><span>Выберите месяц</span><p>После выбора здесь появятся два отдельных графика: источники доходов и статьи расходов.</p></section>`;
  const incomeBuckets=analyticsCategoryBuckets('income',analyticsSelectedMonth),expenseBuckets=analyticsCategoryBuckets('expense',analyticsSelectedMonth);
  const incomeTotal=incomeBuckets.reduce((sum,[,value])=>sum+value,0),expenseTotal=expenseBuckets.reduce((sum,[,value])=>sum+value,0);
  return `<section class="analytics-month-detail" id="analyticsMonthDetail"><div class="analytics-month-detail-head"><div><span>Детализация месяца</span><h2>${MONTHS[analyticsSelectedMonth]} ${state.year}</h2><p>${esc(analyticsScopeTitle())}</p></div><button type="button" class="btn btn-soft analytics-month-close" data-analytics-close-month>Скрыть</button></div><div class="analytics-month-chart-grid">${analyticsMonthChartCard('income',incomeBuckets,incomeTotal)}${analyticsMonthChartCard('expense',expenseBuckets,expenseTotal)}</div></section>`;
}

function analyticsPage(){
  const first=2026,current=Math.max(first,new Date().getFullYear());
  state.year=Math.min(current,Math.max(first,+state.year||current));
  const summary=analyticsYearSummary();
  return `<div class="page-head analytics-page-head"><div><h2 class="page-title">Аналитика</h2><div class="page-subtitle">${esc(analyticsScopeTitle())} · ${state.year} год</div></div>${analyticsScopeSwitcherMarkup()}</div>${analyticsYearStatsMarkup(summary)}${analyticsCalendarMarkup(summary)}${analyticsMonthDetailsMarkup()}`;
}

function destroyCharts(){state.charts.forEach(chart=>{try{chart.destroy()}catch(_){}});state.charts=[]}

function analyticsCategoryChartOptions(total){
  return{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#d8c6a5',usePointStyle:true,padding:12,boxWidth:9}},tooltip:{callbacks:{label:ctx=>{const value=Number(ctx.raw||0),share=total?Math.round(value/total*100):0;return `${ctx.label}: ${money(value)} · ${share}%`;}}}}};
}

function drawAnalyticsCategoryChart(canvasId,buckets,type){
  const ChartLib=window.Chart,canvas=document.getElementById(canvasId);if(!ChartLib||!canvas||!buckets.length)return;
  const data=analyticsChartBuckets(buckets),total=buckets.reduce((sum,[,value])=>sum+value,0);
  const incomeColors=['#2F9E6F','#55B98A','#7ACA9F','#A5DDBB','#3D8B72','#80BFA1','#B7E4C7','#5AAE89'];
  const expenseColors=['#D85C5C','#E37862','#D99A5B','#C96F82','#E6A15C','#C85A6A','#D98972','#B85D68'];
  state.charts.push(new ChartLib(canvas,{type:'doughnut',data:{labels:data.map(([id])=>analyticsCategoryLabel(id)),datasets:[{data:data.map(([,value])=>value),backgroundColor:type==='income'?incomeColors:expenseColors,borderColor:'#081118',borderWidth:3,hoverBorderColor:'#f2d39a',hoverOffset:8}]},options:analyticsCategoryChartOptions(total)}));
}

function bindAnalyticsControls(){
  document.querySelectorAll('[data-analytics-scope]').forEach(button=>button.onclick=()=>{
    const next=button.dataset.analyticsScope;
    if(!['husband','wife','combined'].includes(next)||next===analyticsScope)return;
    analyticsScope=next;analyticsSelectedMonth=null;renderApp();
  });
  document.querySelectorAll('[data-analytics-month]').forEach(button=>button.onclick=()=>{
    analyticsSelectedMonth=Number(button.dataset.analyticsMonth);renderApp();
    requestAnimationFrame(()=>document.getElementById('analyticsMonthDetail')?.scrollIntoView({behavior:'smooth',block:'start'}));
  });
  document.querySelector('[data-analytics-close-month]')?.addEventListener('click',()=>{analyticsSelectedMonth=null;renderApp()});
}

function drawAnalytics(){
  bindAnalyticsControls();
  if(!window.Chart||analyticsSelectedMonth==null)return;
  window.Chart.defaults.color='#cbb994';
  window.Chart.defaults.borderColor='rgba(177,139,82,.20)';
  drawAnalyticsCategoryChart('analyticsIncomeCategoryChart',analyticsCategoryBuckets('income',analyticsSelectedMonth),'income');
  drawAnalyticsCategoryChart('analyticsExpenseCategoryChart',analyticsCategoryBuckets('expense',analyticsSelectedMonth),'expense');
}
