// Расчёт ближайших дат и напоминаний для регулярных платежей.
const PHASE3_DAY_MS=86400000;

function phase3MonthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function phase3LocalDate(value){
  if(!value)return null;
  const [y,m,d]=String(value).slice(0,10).split('-').map(Number);
  if(!y||!m||!d)return null;
  return new Date(y,m-1,d);
}
function phase3DateValue(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function phase3DueDate(r,base=new Date()){
  if(!r?.active)return null;
  const today=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  let due=phase3LocalDate(r.next_due_date);
  if(!due){
    const last=new Date(today.getFullYear(),today.getMonth()+1,0).getDate();
    due=new Date(today.getFullYear(),today.getMonth(),Math.min(Number(r.day_of_month)||1,last));
  }
  const days=Math.round((due-today)/PHASE3_DAY_MS);
  return{date:due,days,key:phase3DateValue(due)};
}
function phase3DueText(info){
  if(!info)return'';
  if(info.days<0){const n=Math.abs(info.days);return n===1?'Просрочено на 1 день':`Просрочено на ${n} дн.`}
  if(info.days===0)return'Сегодня';
  if(info.days===1)return'Завтра';
  if(info.days>=2&&info.days<=4)return`Через ${info.days} дня`;
  return`Через ${info.days} дней`;
}
function phase3DueClass(info){if(!info)return'';if(info.days<0)return'due-overdue';if(info.days===0)return'due-today';if(info.days<=3)return'due-soon';return''}
function phase3Upcoming(maxDays=null){
  return state.recurring.filter(r=>r.active).map(r=>({r,info:phase3DueDate(r)})).filter(({r,info})=>{
    if(!info)return false;
    if(info.days<0)return true;
    const limit=maxDays==null?Number(r.reminder_days??3):Math.min(Number(r.reminder_days??3),maxDays);
    return info.days<=limit;
  }).sort((a,b)=>a.info.days-b.info.days);
}
function phase3UpcomingAll(maxDays=14){return state.recurring.filter(r=>r.active).map(r=>({r,info:phase3DueDate(r)})).filter(x=>x.info&&x.info.days<=maxDays).sort((a,b)=>a.info.days-b.info.days)}
