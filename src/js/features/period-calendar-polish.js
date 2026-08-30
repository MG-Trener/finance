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

  function salonCalendarYears(){
    const years=new Set((availableYears?.()||[]).map(Number).filter(Number.isFinite));
    years.add(new Date().getFullYear());
    years.add(Number(state.year)||new Date().getFullYear());
    return [...years].sort((a,b)=>a-b);
  }

  const baseWifeCalendarPage=wifeCalendarPage;
  wifeCalendarPage=function(person){
    const monthName=MONTHS[Number(state.month)-1]||'';
    const controls=`<div class="salon-period-controls salon-swipe-period-controls" role="group" aria-label="Период календаря салона">
      <div class="salon-month-swipe" id="salonMonthSwipe" role="group" tabindex="0" aria-label="${esc(monthName)}. Проведите влево или вправо для смены месяца">
        <span class="salon-month-swipe-label">Месяц</span>
        <strong>${esc(monthName)}</strong>
        <small>Свайп влево или вправо для смены месяца</small>
      </div>
      <label class="salon-year-control"><span>Год</span><select id="salonYearSelect" aria-label="Год календаря">${salonCalendarYears().map(value=>`<option value="${value}" ${value===Number(state.year)?'selected':''}>${value}</option>`).join('')}</select></label>
    </div>`;
    return baseWifeCalendarPage(person).replace(/<div class="salon-month-title">[\s\S]*?<\/div>\s*(<div class="salon-date-ribbon")/,`${controls}$1`);
  };

  function bindSalonMonthSwipe(){
    const swipe=document.getElementById('salonMonthSwipe');
    if(!swipe)return;
    let startX=0,startY=0;
    swipe.addEventListener('touchstart',event=>{
      const touch=event.changedTouches?.[0];
      if(!touch)return;
      startX=touch.clientX;
      startY=touch.clientY;
    },{passive:true});
    swipe.addEventListener('touchend',event=>{
      const touch=event.changedTouches?.[0];
      if(!touch)return;
      const dx=touch.clientX-startX,dy=touch.clientY-startY;
      if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.2)return;
      calendarShiftMonth(dx<0?1:-1);
    },{passive:true});
    swipe.addEventListener('keydown',event=>{
      if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
      event.preventDefault();
      calendarShiftMonth(event.key==='ArrowRight'?1:-1);
    });
  }

  const baseBindWifeCalendar=bindWifeCalendar;
  bindWifeCalendar=function(){
    baseBindWifeCalendar();
    const year=document.getElementById('salonYearSelect');
    if(year)year.onchange=event=>{state.year=Number(event.target.value);calendarUi.selectedDate=null;renderApp()};
    bindSalonMonthSwipe();
    document.querySelectorAll('.salon-date[data-salon-date]').forEach(button=>{
      const date=calendarDateFromKey(button.dataset.salonDate);
      const weekday=date.getDay();
      button.classList.toggle('is-weekend',weekday===0||weekday===6);
    });
  };

  // When switching from the husband's calendar to the wife's calendar, start
  // from today's month. Subsequent swipes keep the selected month until the
  // user leaves or switches calendars again.
  const baseBindCalendarPersonSwitcher=bindCalendarPersonSwitcher;
  bindCalendarPersonSwitcher=function(){
    baseBindCalendarPersonSwitcher();
    document.querySelectorAll('[data-calendar-person]').forEach(button=>{
      const target=byId(state.people,button.dataset.calendarPerson);
      if(target?.label!=='wife')return;
      button.onclick=()=>{
        if(button.dataset.calendarPerson===calendarUi.personId)return;
        calendarUi.personId=button.dataset.calendarPerson;
        resetCalendarToToday();
        renderApp();
      };
    });
  };
})();
