// Действия регулярных платежей: создание, пауза, удаление и отметка «Оплачено».
function recurringNextDate(r){
  const base=phase3LocalDate(r.next_due_date)||new Date();
  const d=new Date(base.getFullYear(),base.getMonth(),base.getDate());
  if(r.frequency==='weekly'){d.setDate(d.getDate()+7);return d;}
  if(r.frequency==='yearly'){
    const month=d.getMonth(),day=d.getDate(),year=d.getFullYear()+1;
    const last=new Date(year,month+1,0).getDate();
    return new Date(year,month,Math.min(day,last));
  }
  const targetMonth=d.getMonth()+1,targetYear=d.getFullYear()+Math.floor(targetMonth/12),month=((targetMonth%12)+12)%12;
  const preferred=Number(r.day_of_month)||d.getDate();
  const last=new Date(targetYear,month+1,0).getDate();
  return new Date(targetYear,month,Math.min(preferred,last));
}

function bindRecurring(){
  let recType='expense';
  const form=document.getElementById('recForm');
  if(!form)return;

  form.querySelectorAll('[data-rtype]').forEach(b=>b.onclick=()=>{
    recType=b.dataset.rtype;
    form.querySelectorAll('[data-rtype]').forEach(x=>x.classList.toggle('active',x===b));
    const cats=state.categories.filter(c=>c.type===recType);
    form.querySelector('#recCategory').innerHTML=cats.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if(typeof uiSound==='function')uiSound('switch');
  });

  form.onsubmit=async e=>{
    e.preventDefault();
    const nextDate=form.querySelector('#recNextDate').value;
    const parsed=phase3LocalDate(nextDate);
    const payload={
      family_id:state.family.id,
      person_id:form.querySelector('#recPerson').value,
      type:recType,
      amount:Number(form.querySelector('#recAmount').value),
      category_id:form.querySelector('#recCategory').value,
      subcategory_id:null,
      description:form.querySelector('#recDescription').value.trim()||null,
      day_of_month:parsed?.getDate()||1,
      frequency:form.querySelector('#recFrequency').value,
      next_due_date:nextDate,
      reminder_days:Number(form.querySelector('#recReminderDays').value||0),
      active:true,
      created_by:state.user.id
    };
    const {error}=await sb.from('recurring_payments').insert(payload);
    if(error)return notice('recNotice',error.message);
    if(typeof uiSound==='function')uiSound('success');
    await loadData();
  };

  document.querySelectorAll('.toggleRecurring').forEach(b=>b.onclick=async()=>{
    const r=byId(state.recurring,b.dataset.id);
    const {error}=await sb.from('recurring_payments').update({active:!r.active,updated_at:new Date().toISOString()}).eq('id',r.id);
    if(error)return alert(error.message);
    if(typeof uiSound==='function')uiSound('switch');
    await loadData();
  });

  document.querySelectorAll('.deleteRecurring').forEach(b=>b.onclick=async()=>{
    if(!confirm('Удалить регулярный платёж?'))return;
    const {error}=await sb.from('recurring_payments').delete().eq('id',b.dataset.id);
    if(error)return alert(error.message);
    if(typeof uiSound==='function')uiSound('delete');
    await loadData();
  });

  document.querySelectorAll('.postRecurring').forEach(b=>b.onclick=()=>postRecurring(b.dataset.id));
}

async function postRecurring(id){
  const r=byId(state.recurring,id);if(!r)return;
  const now=new Date();
  const payload={family_id:state.family.id,person_id:r.person_id,type:r.type,amount:r.amount,category_id:r.category_id,subcategory_id:r.subcategory_id,description:r.description,occurred_at:now.toISOString(),created_by:state.user.id};
  const {error}=await sb.from('transactions').insert(payload);
  if(error)return alert(error.message);
  const next=recurringNextDate(r);
  const {error:updateError}=await sb.from('recurring_payments').update({next_due_date:phase3DateValue(next),last_paid_at:now.toISOString(),last_generated_month:phase3MonthKey(now),updated_at:now.toISOString()}).eq('id',r.id);
  if(updateError)return alert(updateError.message);
  if(typeof uiSound==='function')uiSound('success');
  await loadData();
}
