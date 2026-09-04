// Calendar status polish for husband's paid events.
(function(){
  if(typeof husbandCalendarPage!=='function'||typeof calendarPersonEntries!=='function')return;

  function paidHusbandDates(person){
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
    byDate.forEach((rows,dateKey)=>{
      // If several events share one date, keep the marker yellow until every
      // event for that day is paid so an unpaid item is never hidden.
      if(rows.length&&rows.every(row=>row.is_paid===true))paidDates.add(dateKey);
    });
    return paidDates;
  }

  const baseHusbandCalendarPageWithPaidStatus=husbandCalendarPage;
  husbandCalendarPage=function(person){
    let html=baseHusbandCalendarPageWithPaidStatus(person);
    paidHusbandDates(person).forEach(dateKey=>{
      const pattern=new RegExp(`(<button[^>]*class="calendar-day)([^"]*"[^>]*data-calendar-date="${dateKey}")`);
      html=html.replace(pattern,'$1 is-paid-day$2');
    });
    return html;
  };
})();
