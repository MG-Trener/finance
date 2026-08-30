// Period filters and calendar presentation refinements.
(() => {
  // The compact top row duplicated the section titles and occupied valuable
  // vertical space on phones. Keep period selectors inside the sections that
  // actually need them instead of rendering a global application header.
  header=function(){return ''};

  // Analytics still needs a year selector after removing the global header.
  const baseAnalyticsPage=analyticsPage;
  analyticsPage=function(){
    const years=availableYears();
    const year=Number(state.year)||new Date().getFullYear();
    return `<div class="filters analytics-year-filter" role="group" aria-label="Год аналитики"><select class="pill" id="analyticsYearSelect" aria-label="Год аналитики">${years.map(value=>`<option value="${value}" ${value===year?'selected':''}>${value}</option>`).join('')}</select></div>${baseAnalyticsPage()}`;
  };

  const baseBindAnalyticsRoute=bindAnalyticsRoute;
  bindAnalyticsRoute=async function(){
    const result=await baseBindAnalyticsRoute();
    const year=document.getElementById('analyticsYearSelect');
    if(year)year.onchange=event=>{state.year=Number(event.target.value);renderApp()};
    return result;
  };

  function journalPeriodYear(filters){
    const value=Number(filters?.periodYear);
    return Number.isFinite(value)&&value>=2026?value:Number(state.year)||new Date().getFullYear();
  }
  function journalPeriodMonth(filters){
    const value=Number(filters?.periodMonth);
    return value>=1&&value<=12?value:Number(state.month)||new Date().getMonth()+1;
  }
  function journalFilterYears(selectedYear){
    const first=2026,current=new Date().getFullYear(),last=Math.max(first+6,current+5,Number(selectedYear)||first);
    return Array.from({length:last-first+1},(_,index)=>first+index);
  }
  function ensureJournalPeriod(filters){
    if(!filters.periodYear)filters.periodYear=Number(state.year)||new Date().getFullYear();
    if(!filters.periodMonth)filters.periodMonth=Number(state.month)||new Date().getMonth()+1;
    return filters;
  }

  const baseJournalFilteredTx=journalFilteredTx;
  journalFilteredTx=function(){
    const filters=ensureJournalPeriod(state.filters||(state.filters={}));
    const previousYear=state.year,previousMonth=state.month;
    state.year=journalPeriodYear(filters);
    state.month=journalPeriodMonth(filters);
    try{return baseJournalFilteredTx()}
    finally{state.year=previousYear;state.month=previousMonth}
  };

  const baseJournalActiveFilterCount=journalActiveFilterCount;
  journalActiveFilterCount=function(filters){
    const count=baseJournalActiveFilterCount(filters);
    const period=filters?.period||'month';
    if(period!=='month')return count;
    const changed=journalPeriodYear(filters)!==Number(state.year)||journalPeriodMonth(filters)!==Number(state.month);
    return count+(changed?1:0);
  };

  const baseOperationsPage=operationsPage;
  operationsPage=function(){
    const filters=ensureJournalPeriod(state.filters||(state.filters={}));
    const period=filters.period||'month';
    const year=journalPeriodYear(filters),month=journalPeriodMonth(filters);
    const years=journalFilterYears(year);
    const periodControls=`<div class="journal-period-filter" role="group" aria-label="Период операций">
      <select id="filterPeriod" aria-label="Тип периода"><option value="month" ${period==='month'?'selected':''}>За месяц</option><option value="year" ${period==='year'?'selected':''}>За год</option><option value="all" ${period==='all'?'selected':''}>За всё время</option></select>
      <select id="filterMonth" aria-label="Месяц операций" ${period==='month'?'':'hidden'}>${MONTHS.map((name,index)=>`<option value="${index+1}" ${index+1===month?'selected':''}>${name}</option>`).join('')}</select>
      <select id="filterYear" aria-label="Год операций" ${period==='all'?'hidden':''}>${years.map(value=>`<option value="${value}" ${value===year?'selected':''}>${value}</option>`).join('')}</select>
    </div>`;
    return baseOperationsPage().replace(/<select id="filterPeriod">[\s\S]*?<\/select>/,periodControls);
  };

  const baseBindOperations=bindOperations;
  bindOperations=function(){
    baseBindOperations();
    const filters=ensureJournalPeriod(state.filters||(state.filters={}));
    const month=document.getElementById('filterMonth');
    const year=document.getElementById('filterYear');
    if(month)month.onchange=event=>{filters.periodMonth=Number(event.target.value);state.journalLimit=50;renderApp()};
    if(year)year.onchange=event=>{filters.periodYear=Number(event.target.value);state.journalLimit=50;renderApp()};
  };

  const baseWifeCalendarPage=wifeCalendarPage;
  wifeCalendarPage=function(person){
    const controls=`<div class="salon-period-controls" role="group" aria-label="Период календаря салона">
      <label><span>Месяц</span><select id="salonMonthSelect" aria-label="Месяц календаря">${MONTHS.map((name,index)=>`<option value="${index+1}" ${index+1===Number(state.month)?'selected':''}>${name}</option>`).join('')}</select></label>
      <label><span>Год</span><select id="salonYearSelect" aria-label="Год календаря">${availableYears().map(value=>`<option value="${value}" ${value===Number(state.year)?'selected':''}>${value}</option>`).join('')}</select></label>
    </div>`;
    return baseWifeCalendarPage(person).replace(/<div class="salon-month-title">[\s\S]*?<\/div>\s*(<div class="salon-date-ribbon")/,`${controls}$1`);
  };

  const baseBindWifeCalendar=bindWifeCalendar;
  bindWifeCalendar=function(){
    baseBindWifeCalendar();
    const month=document.getElementById('salonMonthSelect');
    const year=document.getElementById('salonYearSelect');
    if(month)month.onchange=event=>{state.month=Number(event.target.value);calendarUi.selectedDate=null;renderApp()};
    if(year)year.onchange=event=>{state.year=Number(event.target.value);calendarUi.selectedDate=null;renderApp()};
    document.querySelectorAll('.salon-date[data-salon-date]').forEach(button=>{
      const date=calendarDateFromKey(button.dataset.salonDate);
      const weekday=date.getDay();
      button.classList.toggle('is-weekend',weekday===0||weekday===6);
    });
  };
})();
