// Selected-month detail analytics: categories and subcategories without nested scrolling.
(function(){
  if(typeof analyticsMonthDetailsMarkup!=='function')return;

  function selectedMonthTransactions(){
    if(analyticsSelectedMonth==null)return[];
    return analyticsTransactions(+state.year,analyticsScope).filter(tx=>new Date(tx.occurred_at).getMonth()===+analyticsSelectedMonth);
  }

  function resolvedCategoryId(tx){
    if(typeof analyticsResolvedCategoryId==='function')return analyticsResolvedCategoryId(tx);
    const direct=state.categories.find(category=>category.id===tx.category_id&&category.type===tx.type);
    return direct?.id||tx.category_id||'__none__';
  }

  function resolvedSubcategoryKey(tx){
    const categoryId=resolvedCategoryId(tx);
    const direct=state.subcategories.find(item=>item.id===tx.subcategory_id&&item.category_id===categoryId);
    if(direct)return direct.id;
    return `__category__:${categoryId}`;
  }

  function dimensionBuckets(type,dimension){
    const sums={};
    selectedMonthTransactions().filter(tx=>tx.type===type).forEach(tx=>{
      const key=dimension==='subcategory'?resolvedSubcategoryKey(tx):resolvedCategoryId(tx);
      sums[key]=(sums[key]||0)+Number(tx.amount||0);
    });
    return Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  }

  function subcategoryLabel(id){
    if(String(id).startsWith('__category__:')){
      const categoryId=String(id).slice('__category__:'.length);
      const category=analyticsCategoryName(categoryId);
      return category&&category!=='Без категории'?`Прочее · ${category}`:'Прочее';
    }
    return subName(id)||'Прочее';
  }

  function detailTotalMarkup(total,type){
    return `<div class="analytics-detail-total"><span>Итого</span><b class="${type==='income'?'positive':'negative'}">${money(total)}</b></div>`;
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
      <div class="analytics-linear-widget-head"><div><span>${esc(subtitle)}</span><h3>${esc(title)}</h3></div></div>
      ${linearRows(buckets,total,labelFn)}
      ${buckets.length?detailTotalMarkup(total,type):''}
    </article>`;
  }

  function linearWidgetsMarkup(){
    const incomeCategories=dimensionBuckets('income','category');
    const incomeSubcategories=dimensionBuckets('income','subcategory');
    const expenseCategories=dimensionBuckets('expense','category');
    const expenseSubcategories=dimensionBuckets('expense','subcategory');
    return `<section class="analytics-linear-section">
      <div class="analytics-linear-section-head"><div><span>Детальная аналитика месяца</span><h3>Категории и подкатегории</h3><p>Все статьи показаны полностью, без внутренней прокрутки.</p></div></div>
      <div class="analytics-linear-grid">
        ${linearWidget('Категории доходов','Доход','income',incomeCategories,analyticsCategoryName)}
        ${linearWidget('Подкатегории доходов','Доход','income',incomeSubcategories,subcategoryLabel)}
        ${linearWidget('Категории расходов','Расход','expense',expenseCategories,analyticsCategoryName)}
        ${linearWidget('Подкатегории расходов','Расход','expense',expenseSubcategories,subcategoryLabel)}
      </div>
    </section>`;
  }

  // Doughnut detail lists also show every category and a control total.
  analyticsCategoryList=function(buckets,total,type){
    if(!buckets.length)return `<div class="analytics-category-empty">${type==='income'?'Доходов':'Расходов'} в этом месяце нет.</div>`;
    return `<div class="analytics-category-list analytics-category-list-full">${buckets.map(([id,value])=>`<div><span>${esc(analyticsCategoryName(id))}</span><b>${money(value)}${total?` · ${Math.round(value/total*100)}%`:''}</b></div>`).join('')}${detailTotalMarkup(total,type)}</div>`;
  };

  analyticsMonthDetailsMarkup=function(){
    if(analyticsSelectedMonth==null)return `<section class="analytics-month-placeholder"><span>Выберите месяц</span><p>После выбора здесь появится детальная аналитика доходов и расходов по категориям и подкатегориям.</p></section>`;
    const incomeBuckets=analyticsCategoryBuckets('income',analyticsSelectedMonth);
    const expenseBuckets=analyticsCategoryBuckets('expense',analyticsSelectedMonth);
    const incomeTotal=incomeBuckets.reduce((sum,[,value])=>sum+value,0);
    const expenseTotal=expenseBuckets.reduce((sum,[,value])=>sum+value,0);
    return `<section class="analytics-month-detail" id="analyticsMonthDetail">
      <div class="analytics-month-detail-head"><div><span>Детальная аналитика месяца</span><h2>${MONTHS[analyticsSelectedMonth]} ${state.year}</h2><p>${esc(analyticsScopeTitle())}</p></div><button type="button" class="btn btn-soft analytics-month-close" data-analytics-close-month>Скрыть</button></div>
      <div class="analytics-month-chart-grid">${analyticsMonthChartCard('income',incomeBuckets,incomeTotal)}${analyticsMonthChartCard('expense',expenseBuckets,expenseTotal)}</div>
      ${linearWidgetsMarkup()}
    </section>`;
  };
})();
