import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});
const WRITE_RE=/(?:\b(?:напомни|напоминан|запиши|записать|добавь|добавить|создай|создать|поставь|поставить|удали|удалить|измени|изменить|перенеси|перенести|отметь|отметить|сохрани|сохранить|внеси|внести|назначь|назначить)\b)/iu;
const refusal='Я работаю только в режиме чтения: могу посмотреть и объяснить данные семейной казны, Плана и календарей, но не могу создавать, изменять, удалять записи или ставить напоминания.';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const auth=req.headers.get('Authorization')||'';
  let form:FormData;try{form=await req.formData()}catch{return json({ok:false,error:'INVALID_FORM'},400)}
  const upstream=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-assistant-plan`,{method:'POST',headers:{Authorization:auth,apikey:ANON_KEY},body:form});
  const payload:any=await upstream.json().catch(()=>({}));
  if(!upstream.ok||!payload?.ok)return json(payload,upstream.status);
  const transcript=String(payload.transcript||'').trim();
  if(WRITE_RE.test(transcript))return json({...payload,answer:refusal,mode:'text',readonly_blocked:true});
  return json({...payload,readonly:true});
});