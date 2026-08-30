// Keep salon appointment slots unique in local/offline state as well as in DB.
// This prevents a stale duplicate from keeping released 30-minute rows occupied
// after an appointment duration is shortened.
(function(){
  if(typeof calendarPersonEntries!=='function'||typeof calendarUpsert!=='function')return;

  function stamp(row){
    const value=row?.updated_at||row?.created_at||'';
    const parsed=Date.parse(value);
    return Number.isFinite(parsed)?parsed:0;
  }
  function slotKey(row){
    if(row?.kind!=='appointment')return '';
    return `${row.person_id||''}|${row.entry_date||''}|${calendarTimeText(row.start_time)}`;
  }
  function dedupeRows(rows){
    const chosen=new Map();
    const events=[];
    for(const row of rows||[]){
      const key=slotKey(row);
      if(!key){events.push(row);continue}
      const current=chosen.get(key);
      if(!current||stamp(row)>=stamp(current))chosen.set(key,row);
    }
    return events.concat([...chosen.values()]);
  }

  const baseCalendarPersonEntries=calendarPersonEntries;
  calendarPersonEntries=function(personId){
    return dedupeRows(baseCalendarPersonEntries(personId));
  };

  const baseCalendarUpsert=calendarUpsert;
  calendarUpsert=function(row){
    if(row?.kind==='appointment'){
      const key=slotKey(row);
      state.calendarEntries=(state.calendarEntries||[]).filter(item=>{
        if(item?.id===row.id)return false;
        return slotKey(item)!==key;
      });
    }
    baseCalendarUpsert(row);
  };

  window.FinanceCalendarSlotGuard={dedupeRows};
})();
