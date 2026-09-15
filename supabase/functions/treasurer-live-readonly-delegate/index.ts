import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});
const WRITE_RE=/(?:\b(?:напомни|напоминан|запиши|записать|добавь|добавить|создай|создать|поставь|поставить|удали|удалить|измени|изменить|перенеси|перенести|отметь|отметить|сохрани|сохранить|внеси|внести|назначь|назначить)\b)/iu;
const refusal='Я работаю только в режиме чтения. Могу посмотреть ваши финансы, План и календари и ответить по ним, но не могу ничего создавать, изменять, удалять или ставить напоминания.';

async function annualBirthdayContext(auth:string){
  const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return '';
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:membership,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id).limit(1).maybeSingle();
  if(membershipError||!membership?.family_id)return '';
  const [eventsResult,peopleResult]=await Promise.all([
    admin.from('calendar_entries').select('entry_date,title,comment,person_id').eq('family_id',membership.family_id).eq('calendar_context','plan').eq('kind','event').eq('event_type','birthday').order('entry_date'),
    admin.from('people').select('id,display_name,label').eq('family_id',membership.family_id)
  ]);
  if(eventsResult.error||peopleResult.error)return '';
  const people=new Map((peopleResult.data||[]).map((p:any)=>[String(p.id),String(p.display_name||p.label||'Участник семьи')]));
  const birthdays=(eventsResult.data||[]).map((row:any)=>({month_day:String(row.entry_date||'').slice(5,10),title:row.title||'День рождения',person:people.get(String(row.person_id||''))||'Участник семьи',comment:row.comment||null,recurrence:'annual'}));
  return birthdays.length?`СИСТЕМНЫЙ СПРАВОЧНИК ДНЕЙ РОЖДЕНИЯ: ${JSON.stringify(birthdays)}. Все записи в этом списке повторяются ежегодно по month_day независимо от года исходной записи.`:'';
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const auth=req.headers.get('Authorization')||'';
  let body:any={};try{body=await req.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const question=String(body?.question||'').trim();
  if(WRITE_RE.test(question))return json({ok:true,answer:refusal,readonly_blocked:true});
  try{
    const birthdayContext=await annualBirthdayContext(auth);
    if(birthdayContext){
      const history=Array.isArray(body?.history)?body.history.slice(-10):[];
      body.history=[...history,{role:'assistant',text:birthdayContext}];
    }
  }catch(error){console.warn('Annual birthday context unavailable',error)}
  const upstream=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-live-delegate`,{
    method:'POST',headers:{Authorization:auth,apikey:ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const payload:any=await upstream.json().catch(()=>({}));
  return json(payload,upstream.status);
});