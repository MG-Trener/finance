import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});
const WRITE_RE=/(?:\b(?:напомни|напоминан|запиши|записать|добавь|добавить|создай|создать|поставь|поставить|удали|удалить|измени|изменить|перенеси|перенести|отметь|отметить|сохрани|сохранить|внеси|внести|назначь|назначить)\b)/iu;
const refusal='Я работаю только в режиме чтения. Могу посмотреть ваши финансы, План и календари и ответить по ним, но не могу ничего создавать, изменять, удалять или ставить напоминания.';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const auth=req.headers.get('Authorization')||'';
  let body:any={};try{body=await req.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const question=String(body?.question||'').trim();
  if(WRITE_RE.test(question))return json({ok:true,answer:refusal,readonly_blocked:true});
  const upstream=await fetch(`${SUPABASE_URL}/functions/v1/treasurer-live-delegate`,{
    method:'POST',headers:{Authorization:auth,apikey:ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)
  });
  const payload:any=await upstream.json().catch(()=>({}));
  return json(payload,upstream.status);
});