// Editing an existing salon appointment must never collide with itself.
// In particular, shortening an appointment only releases time and cannot create
// a new overlap, so it is always safe when the start time is unchanged.
(function(){
  if(typeof appointmentOverlap!=='function')return;

  appointmentOverlap=function(personId,dateKey,startTime,duration,ignoreId=null){
    const appointments=calendarEntriesOn(personId,dateKey,'appointment');
    const ignoredId=ignoreId==null?'':String(ignoreId);
    const nextStart=calendarTimeText(startTime);
    const nextDuration=Number(duration||30);

    if(ignoredId){
      const current=appointments.find(row=>String(row?.id??'')===ignoredId);
      if(current){
        const currentStart=calendarTimeText(current.start_time);
        const currentDuration=Number(current.duration_minutes||30);
        // Shrinking an existing block with the same start only frees slots.
        if(currentStart===nextStart&&nextDuration<=currentDuration)return false;
      }
    }

    const start=calendarMinutes(nextStart);
    const end=start+nextDuration;
    return appointments.some(row=>{
      if(ignoredId&&String(row?.id??'')===ignoredId)return false;
      const rowStart=calendarMinutes(row.start_time);
      const rowEnd=rowStart+Number(row.duration_minutes||30);
      return start<rowEnd&&end>rowStart;
    });
  };
})();
