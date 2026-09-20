// Expanded selected-month analytics: full monthly KPIs plus category/subcategory linear widgets.
(function(){
  if(typeof analyticsMonthDetailsMarkup!=='function')return;

  function selectedMonthTransactions(){
    if(analyticsSelectedMonth==null)return[];
    return analyticsTransactions(+state.year,analyticsScope).filter(tx=>new Date(tx.occurred_at).getMonth()===+analyticsSelectedMonth);
  }

  function sumRows(rows){return rows.reduce((sum,row)=>sum+Number(row.amount||0),0)}

  function dimensionBuckets(type,dimension){
    const sums={};
    selectedMonthTransactions().filter(tx=>tx.type===type).forEach(tx=>{
      const raw=dimension==='subcategory'?tx.subcategory_id:tx.category_id;
      const key=raw||'__none__';
      sums[key]=(sums[key]||0)+Number(tx.amount||0);
    });
    return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  }

  function subcategoryLabel(id){
    if(id==='__none__')return'Без подкатегории';
    return subName(id)||'Без подкатегории';
  }

  function monthStats(){
    const tx=selectedMonthTransactions();
    const incomeRows=tx.filter(row=>row.type==='income');
    const expenseRows=tx.filter(row=>row.type==='expense');
    const income=sumRows(incomeRows),expense=sumRows(expenseRows),balance=income-expense;
    const largestIncome=incomeRows.reduce((max,row)=>Math.max(max,Number(row.amount||0)),0);
    const largestExpense=expenseRows.reduce((max,row)=>Math.max(max,Number(row.amount||0)),0);
    const categories=new Set(tx.map(row=>row.category_id).filter(Boolean));
    const subcategories=new Set(tx.map(row=>row.subcategory_id).filter(Boolean));
    return{
      tx,incomeRows,expenseRows,income,expense,balance,
      savingsRate:analyticsSavingsRate(income,expense),
      averageIncome:income/(incomeRows.length||1),
      averageExpense:expense/(expenseRows.length||1),
      largestIncome,largestExpense,
      categoryCount:categories.size,
      subcategoryCount:subcategories.size
    };
  }

  function statCard(label,value,tone='',hint=''){
    return `<article class="analytics-month-stat-card ${tone}"><span>${esc(label)}</span><b>${value}</b>${hint?`<small>${esc(hint)}</small>`:''}</article>`;
  }

  function fullStatsMarkup(stats){
    const balanceTone=stats.balance>=0?'is-positive':'is-negative';
    const savingsTone=stats.savingsRate>=0?'is-positive':'is-negative';
    return `<section class="analytics-month-full-stats" aria-label="Полная статистика выбранного месяца">
      ${statCard('Доход',money(stats.income),'is-positive')}
      ${statCard('Расход',money(stats.expense),'is-negative')}
      ${statCard('Баланс',money(stats.balance),balanceTone)}
      ${statCard('Сбережения',`${stats.savingsRate}%`,savingsTone)}
      ${statCard('Всего операций',String(stats.tx.length),'','доходы + расходы')}
      ${statCard('Доходных операций',String(stats.incomeRows.length),'is-positive')}
      ${statCard('Расходных операций',String(stats.expenseRows.length),'is-negative')}
      ${statCard('Средний доход',money(stats.averageIncome),'is-positive')}
      ${statCard('Средний расход',money(stats.averageExpense),'is-negative')}
      ${statCard('Крупнейший доход',money(stats.largestIncome),'is-positive')}
      ${statCard('Крупнейший расход',money(stats.largestExpense),'is-negative')}
      ${statCard('Структура',`${stats.categoryCount} / ${stats.subcategoryCount}`,'', 'категорий / подкатегорий')}
    </section>`;
  }

  function linearRows(buckets,total,labelFn){
    if(!buckets.length)return'<div class="analytics-linear-empty">Нет данных за выбранный месяц</div>';
    const max=Math.max(...buckets.map(([,value])=>Number(value||0)),1);
    return `<div class="analytics-linear-rows">${buckets.map(([id,value],index)=>{
      const share=total?Math.round(Number(value||0)/total*100):0;
      const width=Math.max(2,Number(value||0)/max*100);
      return `<div class="analytics-linear-row">
        <div class="analytics-linear-row-head"><span><i>${index+1}</i>${esc(labelFn(id))}</span><b>${money(value)} · ${share}%</b></div>
        <div class="analytics-linear-track"><div class="analytics-linear-fill" style="width:${width}%"></div></div>
      </div>`;
    }).join('')}</div>`;
  }

  function linearWidget(title,subtitle,type,buckets,labelFn){
    const total=buckets.reduce((sum,[,value])=>sum+Number(value||0),0);
    return `<article class="card analytics-linear-widget ${type==='income'?'is-income':'is-expense'}">
      <div class="analytics-linear-widget-head"><div><span>${esc(subtitle)}</span><h3>${esc(title)}</h3></div><b class="${type==='income'?'positive':'negative'}">${money(total)}</b></div>
      ${linearRows(buckets,total,labelFn)}
    </article>`;
  }

  function linearWidgetsMarkup(){
    const incomeCategories=dimensionBuckets('income','category');
    const incomeSubcategories=dimensionBuckets('income','subcategory');
    const expenseCategories=dimensionBuckets('expense','category');
    const expenseSubcategories=dimensionBuckets('expense','subcategory');
    return `<section class="analytics-linear-section">
      <div class="analytics-linear-section-head"><div><span>Структура месяца</span><h3>Категории и подкатегории</h3><p>Линейные шкалы показывают сумму и долю каждой статьи в выбранном месяце.</p></div></div>
      <div class="analytics-linear-grid">
        ${linearWidget('Категории доходов','Доход','income',incomeCategories,analyticsCategoryName)}
        ${linearWidget('Подкатегории доходов','Доход','income',incomeSubcategories,subcategoryLabel)}
        ${linearWidget('Категории расходов','Расход','expense',expenseCategories,analyticsCategoryName)}
        ${linearWidget('Подкатегории расходов','Расход','expense',expenseSubcategories,subcategoryLabel)}
      </div>
    </section>`;
  }

  // The detailed category list below each doughnut must show the whole month, not just the first six rows.
  analyticsCategoryList=function(buckets,total,type){
    if(!buckets.length)return `<div class="analytics-category-empty">${type==='income'?'Доходов':'Расходов'} в этом месяце нет.</div>`;
    return `<div class="analytics-category-list analytics-category-list-full">${buckets.map(([id,value])=>`<div><span>${esc(analyticsCategoryName(id))}</span><b>${money(value)}${total?` · ${Math.round(value/total*100)}%`:''}</b></div>`).join('')}</div>`;
  };

  analyticsMonthDetailsMarkup=function(){
    if(analyticsSelectedMonth==null)return `<section class="analytics-month-placeholder"><span>Выберите месяц</span><p>После выбора здесь появятся полная статистика месяца, круговые диаграммы и линейные виджеты категорий и подкатегорий.</p></section>`;
    const stats=monthStats();
    const incomeBuckets=analyticsCategoryBuckets('income',analyticsSelectedMonth);
    const expenseBuckets=analyticsCategoryBuckets('expense',analyticsSelectedMonth);
    const incomeTotal=incomeBuckets.reduce((sum,[,value])=>sum+value,0);
    const expenseTotal=expenseBuckets.reduce((sum,[,value])=>sum+value,0);
    return `<section class="analytics-month-detail" id="analyticsMonthDetail">
      <div class="analytics-month-detail-head"><div><span>Детализация месяца</span><h2>${MONTHS[analyticsSelectedMonth]} ${state.year}</h2><p>${esc(analyticsScopeTitle())}</p></div><button type="button" class="btn btn-soft analytics-month-close" data-analytics-close-month>Скрыть</button></div>
      ${fullStatsMarkup(stats)}
      <div class="analytics-month-chart-grid">${analyticsMonthChartCard('income',incomeBuckets,incomeTotal)}${analyticsMonthChartCard('expense',expenseBuckets,expenseTotal)}</div>
      ${linearWidgetsMarkup()}
    </section>`;
  };
})();
