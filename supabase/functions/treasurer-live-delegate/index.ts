import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY=Deno.env.get('OPENAI_API_KEY')||'';
const MODEL=Deno.env.get('OPENAI_TREASURER_MODEL')||'gpt-5.6-luna';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});

function safeTimezone(value:string){try{new Intl.DateTimeFormat('ru-RU',{timeZone:value}).format(new Date());return value}catch{return 'Asia/Almaty'}}
function localNow(timeZone:string){
  const now=new Date();
  const fmt=new Intl.DateTimeFormat('sv-SE',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  return fmt.format(now).replace(' ','T');
}
function responseText(payload:any){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
  const parts:string[]=[];
  for(const item of payload?.output||[])for(const content of item?.content||[])if(content?.type==='output_text'&&content?.text)parts.push(String(content.text));
  return parts.join('\n').trim();
}
async function paged(admin:any,table:string,select:string,familyId:string,orderColumn:string,extra?:(q:any)=>any){
  const rows:any[]=[];
  for(let from=0;from<5000;from+=1000){
    let q=admin.from(table).select(select).eq('family_id',familyId).order(orderColumn,{ascending:true}).range(from,from+999);
    if(extra)q=extra(q);
    const {data,error}=await q;if(error)throw error;
    const batch=data||[];rows.push(...batch);if(batch.length<1000)break;
  }
  return rows;
}
function round(value:number){return Math.round((Number(value)||0)*100)/100}

async function buildContext(admin:any,familyId:string,timeZone:string){
  const year=Number(localNow(timeZone).slice(0,4))||2026;
  const start=`${year}-01-01`;
  const [peopleResult,categoriesResult,piggyResult,recurringResult,transactions,calendar]=await Promise.all([
    admin.from('people').select('id,label,display_name').eq('family_id',familyId),
    admin.from('categories').select('id,name,type,family_id').or(`family_id.is.null,family_id.eq.${familyId}`),
    admin.from('piggy_bank_balances').select('currency_code,amount,updated_at').eq('family_id',familyId).order('currency_code'),
    admin.from('recurring_payments').select('*').eq('family_id',familyId).order('next_due_date',{ascending:true}),
    paged(admin,'transactions','occurred_at,type,amount,person_id,category_id,subcategory_id,description',''+familyId,'occurred_at',q=>q.is('deleted_at',null).gte('occurred_at',`${start}T00:00:00`).in('type',['income','expense'])),
    paged(admin,'calendar_entries','entry_date,start_time,duration_minutes,person_id,kind,calendar_context,event_type,title,client_name,client_phone,service_name,amount,is_paid,comment,created_at,updated_at',''+familyId,'entry_date',q=>q.gte('entry_date',start))
  ]);
  if(peopleResult.error)throw peopleResult.error;
  if(categoriesResult.error)throw categoriesResult.error;
  if(piggyResult.error)throw piggyResult.error;
  if(recurringResult.error)throw recurringResult.error;

  const people=peopleResult.data||[],categories=categoriesResult.data||[],piggy=piggyResult.data||[],recurring=recurringResult.data||[];
  const personMap=new Map(people.map((p:any)=>[String(p.id),String(p.display_name||p.label||'Участник семьи')]));
  const categoryMap=new Map(categories.map((c:any)=>[String(c.id),String(c.name||'Без категории')]));
  const totals:any={income:0,expense:0,balance:0,operations:transactions.length,by_person:{},by_month:{},expense_categories:{},income_categories:{}};
  for(const row of transactions){
    const amount=Number(row.amount||0),type=String(row.type||''),person=personMap.get(String(row.person_id))||'Участник семьи',month=String(row.occurred_at||'').slice(0,7),category=categoryMap.get(String(row.category_id))||'Без категории';
    if(!totals.by_person[person])totals.by_person[person]={income:0,expense:0,balance:0};
    if(!totals.by_month[month])totals.by_month[month]={income:0,expense:0,balance:0};
    if(type==='income'){
      totals.income+=amount;totals.by_person[person].income+=amount;totals.by_month[month].income+=amount;
      totals.income_categories[category]=(totals.income_categories[category]||0)+amount;
    }else if(type==='expense'){
      totals.expense+=amount;totals.by_person[person].expense+=amount;totals.by_month[month].expense+=amount;
      totals.expense_categories[category]=(totals.expense_categories[category]||0)+amount;
    }
  }
  totals.balance=round(totals.income-totals.expense);
  for(const bucket of Object.values(totals.by_person) as any[]){bucket.income=round(bucket.income);bucket.expense=round(bucket.expense);bucket.balance=round(bucket.income-bucket.expense)}
  for(const bucket of Object.values(totals.by_month) as any[]){bucket.income=round(bucket.income);bucket.expense=round(bucket.expense);bucket.balance=round(bucket.income-bucket.expense)}
  totals.income=round(totals.income);totals.expense=round(totals.expense);

  const tx=transactions.map((row:any)=>({
    at:row.occurred_at,type:row.type,amount:Number(row.amount||0),person:personMap.get(String(row.person_id))||'Участник семьи',category:categoryMap.get(String(row.category_id))||'Без категории',description:row.description||null
  }));
  const calendarRows=calendar.map((row:any)=>({
    date:row.entry_date,time:row.start_time||null,duration_minutes:row.duration_minutes||null,person:personMap.get(String(row.person_id))||'Участник семьи',kind:row.kind,context:row.calendar_context||null,event_type:row.event_type||null,title:row.title||null,client:row.client_name||null,phone:row.client_phone||null,service:row.service_name||null,amount:row.amount==null?null:Number(row.amount),paid:Boolean(row.is_paid),comment:row.comment||null
  }));
  const planEvents=calendarRows.filter((r:any)=>r.kind==='event'&&r.context==='plan').map((r:any)=>({...r,type_label:r.event_type==='birthday'?'День рождения':r.event_type==='meeting'?'Встреча':'Событие'}));
  const wifeSchedule=calendarRows.filter((r:any)=>r.kind==='appointment'||r.kind==='personal');
  const recurringRows=recurring.map((r:any)=>({person:personMap.get(String(r.person_id))||'Участник семьи',type:r.type,amount:Number(r.amount||0),category:categoryMap.get(String(r.category_id))||'Без категории',description:r.description||null,frequency:r.frequency,next_due_date:r.next_due_date,reminder_days:r.reminder_days,active:Boolean(r.active),last_paid_at:r.last_paid_at||null}));

  return {
    generated_at_local:localNow(timeZone),timezone:timeZone,year,
    people:people.map((p:any)=>({name:p.display_name,label:p.label})),
    finances:{totals,transactions:tx},
    piggy_bank:piggy.map((r:any)=>({currency:r.currency_code,amount:Number(r.amount||0),updated_at:r.updated_at})),
    plan:{events:planEvents,recurring_expenses:recurringRows.filter((r:any)=>r.type==='expense')},
    calendars:{all:calendarRows,wife_timed_schedule:wifeSchedule}
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!OPENAI_API_KEY)return json({ok:false,error:'OPENAI_NOT_CONFIGURED'},503);
  const auth=req.headers.get('Authorization')||'';
  const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({ok:false,error:'UNAUTHORIZED'},401);
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:membership,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id).limit(1).maybeSingle();
  if(membershipError)return json({ok:false,error:'FAMILY_LOOKUP_FAILED'},500);
  if(!membership?.family_id)return json({ok:false,error:'NO_FAMILY_ACCESS'},403);

  let body:any={};try{body=await req.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const question=String(body?.question||'').trim().slice(0,2000);
  const history=Array.isArray(body?.history)?body.history.slice(-12):[];
  const timeZone=safeTimezone(String(body?.timezone||'Asia/Almaty'));
  if(!question)return json({ok:false,error:'QUESTION_REQUIRED'},400);

  try{
    const context=await buildContext(admin,String(membership.family_id),timeZone);
    const instructions=`Ты — серверный интеллект Казначея приложения «Семейная казна». Тебе переданы проверенные приватные данные семьи. Ответ предназначен для GPT-Live, который произнесёт его вслух.

Правила:
- Отвечай только по переданным данным, ничего не выдумывай.
- Отвечай по-русски, естественно и компактно, но достаточно полно для вопроса.
- Суммы и даты сохраняй точно. Валюта основных финансов — тенге, если контекст не говорит иное.
- PLAN: context='plan', event_type birthday=день рождения, meeting=встреча, отсутствие типа=обычное событие.
- Личные записи жены kind='personal' блокируют её время, но не являются рабочей выручкой.
- Рабочие записи жены kind='appointment'. Для вопросов о заработке учитывай рабочие суммы; личные дела не включай.
- Если пользователь спрашивает свободное время жены, учитывай и appointment, и personal как занятые интервалы. Рабочее окно интерфейса 07:00–22:00.
- Для относительных дат используй generated_at_local и timezone.
- Если данных для ответа нет, так и скажи. Не подменяй отсутствие данных догадкой.
- При вопросах об аналитике используй totals и транзакции; арифметику делай внимательно.
- history — недавний разговор, используй его для уточняющих вопросов.`;
    const input=JSON.stringify({question,history,context});
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:MODEL,instructions,input,reasoning:{effort:'low'},max_output_tokens:900,store:false})
    });
    const text=await response.text();let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={}}
    if(!response.ok){console.error('Live delegate Responses failed',response.status,payload?.error?.message||text.slice(0,400));return json({ok:false,error:'DELEGATE_MODEL_FAILED'},502)}
    const answer=responseText(payload);
    if(!answer)return json({ok:false,error:'EMPTY_ANSWER'},502);
    return json({ok:true,answer});
  }catch(error){console.error('Live Treasurer delegation failed',error);return json({ok:false,error:'DELEGATION_FAILED',message:'Не удалось получить семейные данные.'},500)}
});
