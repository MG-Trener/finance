// Calendar status polish for husband's paid and overdue unpaid events.
(function(){
  if(typeof husbandCalendarPage!=='function'||typeof calendarPersonEntries!=='function')return;

  function husbandDateStatuses(person){
    const prefix=`${state.year}-${calendarPad(state.month)}-`;
    const byDate=new Map();
    calendarPersonEntries(person.id)
      .filter(row=>row.kind==='event'&&String(row.entry_date||'').startsWith(prefix))
      .forEach(row=>{
        const list=byDate.get(row.entry_date)||[];
        list.push(row);
        byDate.set(row.entry_date,list);
      });

    const paidDates=new Set();
    const overdueUnpaidDates=new Set();
    const now=new Date();
    const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());

    byDate.forEach((rows,dateKey)=>{
      // If several events share one date, show green only when every event is
      // paid. A past date with at least one unpaid event always takes priority
      // and gets the overdue red marker.
      if(rows.length&&rows.every(row=>row.is_paid===true)){
        paidDates.add(dateKey);
        return;
      }

      const date=calendarDateFromKey(dateKey);
      if(Number.isNaN(date.getTime()))return;
      const eventDay=new Date(date.getFullYear(),date.getMonth(),date.getDate());
      if(eventDay<today&&rows.some(row=>row.is_paid!==true))overdueUnpaidDates.add(dateKey);
    });

    return {paidDates,overdueUnpaidDates};
  }

  function addHusbandDayClass(html,dateKey,className){
    const pattern=new RegExp(`(<button[^>]*class="calendar-day)([^"]*"[^>]*data-calendar-date="${dateKey}")`);
    return html.replace(pattern,`$1 ${className}$2`);
  }

  function addStatusLegend(html){
    if(html.includes('legend-paid')||html.includes('legend-overdue'))return html;
    return html.replace(
      /(<div class="calendar-legend">[\s\S]*?)(<\/div>)/,
      '$1<span><i class="legend-paid"></i>Оплачено</span><span><i class="legend-overdue"></i>Просрочено / не оплачено</span>$2'
    );
  }

  const baseHusbandCalendarPageWithPaidStatus=husbandCalendarPage;
  husbandCalendarPage=function(person){
    let html=baseHusbandCalendarPageWithPaidStatus(person);
    const {paidDates,overdueUnpaidDates}=husbandDateStatuses(person);
    paidDates.forEach(dateKey=>{html=addHusbandDayClass(html,dateKey,'is-paid-day')});
    overdueUnpaidDates.forEach(dateKey=>{html=addHusbandDayClass(html,dateKey,'is-overdue-unpaid-day')});
    return addStatusLegend(html);
  };
})();
