import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY=Deno.env.get('OPENAI_API_KEY')||'';
const TREASURER_MODEL=Deno.env.get('OPENAI_TREASURER_MODEL')||'gpt-5.6-luna';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});

function isPlanQuestion(text:string){
  return /(\bплан\b|планов\w*\s+календар|дн(?:ень|и|я|ей)?\s+рожд|рождени|встреч|событ|мероприят|важн\w*\s+дат|семейн\w*\s+календар|что\s+(?:у нас\s+)?запланирован|копилк|ежемесячн\w*\s+затрат|регулярн\w*\s+плат|запланирован\w*\s+расход)/iu.test(text);
}

function localDate(timeZone:string){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }catch{
    return new Date().toISOString().slice(0,10);
  }
}

function responseText(payload:any){
  if(typeof payload?.output_text==='string'&&payload.output_text.trim())return payload.output_text.trim();
  const parts:string[]=[];
  for(const item of payload?.output||[])for(const content of item?.content||[])if(content?.type==='output_text'&&content?.text)parts.push(String(content.text));
  return parts.join('\n').trim();
}

async function enrichPlanAnswer(transcript:string,baseAnswer:string,familyId:string,timeZone:string){
  if(!OPENAI_API_KEY)return baseAnswer;
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const [eventsResult,peopleResult,recurringResult,piggyResult,categoriesResult]=await Promise.all([
    admin.from('calendar_entries')
      .select('entry_date,event_type,title,comment,person_id,created_at')
      .eq('family_id',familyId)
      .eq('calendar_context','plan')
      .eq('kind','event')
      .gte('entry_date','2026-01-01')
      .order('entry_date',{ascending:true})
      .order('created_at',{ascending:true}),
    admin.from('people').select('id,label,display_name').eq('family_id',familyId),
    admin.from('recurring_payments')
      .select('person_id,type,amount,category_id,description,day_of_month,frequency,next_due_date,reminder_days,active')
      .eq('family_id',familyId)
      .order('next_due_date',{ascending:true}),
    admin.from('piggy_bank_balances').select('currency_code,amount,updated_at').eq('family_id',familyId).order('currency_code'),
    admin.from('categories').select('id,name,family_id').or(`family_id.is.null,family_id.eq.${familyId}`)
  ]);
  const firstError=[eventsResult,peopleResult,recurringResult,piggyResult,categoriesResult].find(result=>result.error)?.error;
  if(firstError)throw firstError;

  const personMap=new Map<string,string>((peopleResult.data||[]).map((person:any)=>[String(person.id),String(person.display_name||person.label||'Участник семьи')]));
  const categoryMap=new Map<string,string>((categoriesResult.data||[]).map((category:any)=>[String(category.id),String(category.name||'Без категории')]));

  const planEvents=(eventsResult.data||[]).map((row:any)=>({
    date:String(row.entry_date||''),
    type:row.event_type==='birthday'?'День рождения':row.event_type==='meeting'?'Встреча':'Событие',
    type_code:row.event_type||'event',
    title:row.title||'Событие',
    person:personMap.get(String(row.person_id||''))||'Участник семьи',
    comment:row.comment||null
  }));

  const recurringExpenses=(recurringResult.data||[]).filter((row:any)=>row.type==='expense').map((row:any)=>({
    description:row.description||categoryMap.get(String(row.category_id||''))||'Запланированный расход',
    category:categoryMap.get(String(row.category_id||''))||'Без категории',
    person:personMap.get(String(row.person_id||''))||'Участник семьи',
    amount_kzt:Number(row.amount||0),
    frequency:row.frequency||'monthly',
    day_of_month:row.day_of_month||null,
    next_due_date:row.next_due_date||null,
    reminder_days:Number(row.reminder_days||0),
    active:row.active===true
  }));

  const piggyBank=(piggyResult.data||[]).map((row:any)=>({
    currency:String(row.currency_code||''),
    amount:Number(row.amount||0),
    updated_at:row.updated_at||null
  }));

  const today=localDate(timeZone);
  const instructions=`Ты уточняешь ответ ИИ-Казначея данными из раздела «План» приложения «Семейная казна».

Раздел «План» состоит из трёх частей:
1) семейный календарь: «День рождения», «Встреча», «Событие»;
2) запланированные/регулярные расходы;
3) «Копилка» с отдельными остатками по валютам.
Переданные plan_events, recurring_expenses и piggy_bank являются полным доступным содержимым этих частей Плана. Используй даты, названия, владельца, комментарии, суммы и статусы буквально и ничего не выдумывай.

Правила:
- Вопросы о днях рождения, встречах, событиях, мероприятиях и важных датах отвечай по plan_events.
- Вопросы о запланированных/ежемесячных расходах отвечай по recurring_expenses. Учитывай active и frequency.
- Вопросы о Копилке отвечай по piggy_bank. Не складывай разные валюты в одну сумму без курса.
- Если назван месяц без года, используй год из today и явно укажи его в ответе.
- Для относительных дат («сегодня», «завтра», «в пятницу», «на следующей неделе») считай относительно today.
- Если подходящих записей нет, прямо скажи, что в соответствующей части Плана таких записей нет.
- Если вопрос одновременно касается финансов/салона и Плана, сохрани полезную часть base_answer и дополни её точными сведениями Плана.
- Отвечай по-русски, кратко и предметно.`;

  const input=JSON.stringify({today,timezone:timeZone,question:transcript,base_answer:baseAnswer,plan:{plan_events:planEvents,recurring_expenses:recurringExpenses,piggy_bank:piggyBank}});
  const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',
    headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({model:TREASURER_MODEL,instructions,input,reasoning:{effort:'low'},max_output_tokens:700,store:false})
  });
  const text=await response.text();
  let payload:any={};
  try{payload=text?JSON.parse(text):{}}catch{payload={}}
  if(!response.ok){console.error('Plan Treasurer OpenAI failed',response.status,payload?.error?.message||text.slice(0,400));return baseAnswer}
  return responseText(payload)||baseAnswer;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);

  const auth=req.headers.get('Authorization')||'';
  let form:FormData;
  try{form=await req.formData()}catch{return json({ok:false,error:'INVALID_FORM'},400)}

  // The dedicated client-side voice layer synthesizes the final corrected answer.
  // Force the base assistant to return text so stale audio can never accompany a
  // Plan-enriched answer.
  form.set('answer_mode','text');
  const timeZone=String(form.get('timezone')||'Asia/Almaty');

  const baseResponse=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-assistant`,{
    method:'POST',
    headers:{Authorization:auth,apikey:ANON_KEY},
    body:form
  });
  const basePayload:any=await baseResponse.json().catch(()=>({}));
  if(!baseResponse.ok||!basePayload?.ok)return json(basePayload,baseResponse.status);

  const transcript=String(basePayload.transcript||'').trim();
  if(!transcript||!isPlanQuestion(transcript))return json({...basePayload,mode:'text'});

  try{
    const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
    const {data:{user},error:userError}=await userClient.auth.getUser();
    if(userError||!user)return json({ok:false,error:'UNAUTHORIZED'},401);
    const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:membership,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id).limit(1).maybeSingle();
    if(membershipError||!membership?.family_id)return json({...basePayload,mode:'text'});

    const answer=await enrichPlanAnswer(transcript,String(basePayload.answer||''),String(membership.family_id),timeZone);
    return json({...basePayload,answer,mode:'text',plan_context_used:true});
  }catch(error){
    console.error('Plan Treasurer enrichment failed',error);
    return json({...basePayload,mode:'text',plan_context_used:false});
  }
});