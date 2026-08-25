// Refactored from phase3.js: recurring payment due-date calculations and reminder helpers.
const PHASE3_DAY_MS=86400000;

function phase3MonthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function phase3DueDate(r,base=new Date()){
  if(!r?.active)return null;
  const today=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  const make=(year,month)=>{const last=new Date(year,month+1,0).getDate();return new Date(year,month,Math.min(Number(r.day_of_month)||1,last))};
  let due=make(today.getFullYear(),today.getMonth());
  if(due<today||r.last_generated_month===phase3MonthKey(due))due=make(today.getFullYear(),today.getMonth()+1);
  const days=Math.round((due-today)/PHASE3_DAY_MS);
  return{date:due,days,key:phase3MonthKey(due)}
}
function phase3DueText(info){if(!info)return'';if(info.days===0)return'Сегодня';if(info.days===1)return'Завтра';if(info.days<=4)return`Через ${info.days} дня`;return`Через ${info.days} дней`}
function phase3DueClass(info){if(!info)return'';if(info.days===0)return'due-today';if(info.days<=3)return'due-soon';return''}
function phase3Upcoming(maxDays=3){return state.recurring.filter(r=>r.active).map(r=>({r,info:phase3DueDate(r)})).filter(x=>x.info&&x.info.days>=0&&x.info.days<=maxDays).sort((a,b)=>a.info.days-b.info.days)}
function phase3UpcomingAll(maxDays=14){return state.recurring.filter(r=>r.active).map(r=>({r,info:phase3DueDate(r)})).filter(x=>x.info&&x.info.days>=0&&x.info.days<=maxDays).sort((a,b)=>a.info.days-b.info.days)}
