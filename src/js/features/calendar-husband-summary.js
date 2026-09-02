// Monthly planned-work summary for the husband's calendar.
(function(){
  if(typeof husbandCalendarPage!=='function')return;

  function husbandMonthStats(person){
    const monthPrefix=`${state.year}-${calendarPad(state.month)}-`;
    const events=calendarPersonEntries(person.id)
      .filter(row=>row.kind==='event'&&String(row.entry_date||'').startsWith(monthPrefix));
    return {
      count:events.length,
      amount:events.reduce((sum,row)=>sum+Number(row.amount||0),0)
    };
  }

  const baseHusbandCalendarPageWithSummary=husbandCalendarPage;
  husbandCalendarPage=function(person){
    const html=baseHusbandCalendarPageWithSummary(person);
    const stats=husbandMonthStats(person);
    const summary=`<section class="card wife-month-summary husband-month-summary" aria-label="Итоги запланированных работ за месяц">
      <div class="wife-month-summary-item"><span>Запланировано работ</span><strong>${stats.count}</strong></div>
      <div class="wife-month-summary-item"><span>Сумма работ</span><strong>${money(stats.amount)}</strong></div>
    </section>`;
    return html.replace(/<\/div>\s*$/,`${summary}</div>`);
  };
})();
