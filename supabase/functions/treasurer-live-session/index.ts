import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY=Deno.env.get('OPENAI_API_KEY')||'';
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});
const LIVE_VOICES=new Set(['quartz','vesper','stone','meridian','beacon','cinder']);

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

  let body:any={};
  try{body=await req.json()}catch{return json({ok:false,error:'INVALID_JSON'},400)}
  const sdp=String(body?.sdp||'');
  const voice=LIVE_VOICES.has(String(body?.voice||''))?String(body.voice):'stone';
  if(!sdp||sdp.length<50)return json({ok:false,error:'SDP_REQUIRED'},400);
  if(sdp.length>250000)return json({ok:false,error:'SDP_TOO_LARGE'},413);

  const instructions=`Ты — Казначей в семейном приложении «Семейная казна». Разговаривай только по-русски, естественно, спокойно и по-деловому, без канцелярита. Это живой разговор: допускаются короткие подтверждения, естественные паузы и перебивания пользователя.

ВАЖНО О ДАННЫХ И ПРАВАХ:
- Ты работаешь строго ТОЛЬКО В РЕЖИМЕ ЧТЕНИЯ.
- Ты не умеешь и не имеешь права создавать, изменять, удалять или сохранять данные приложения, ставить напоминания, создавать события, операции, записи или встречи.
- Никогда не говори, что «записал», «добавил», «поставил напоминание», «сохранил», «изменил» или выполнил иное действие с базой.
- Если пользователь просит что-то записать или изменить, кратко скажи, что Казначей может только читать и анализировать данные, но не изменять их.
- У тебя нет прямого доступа к базе семьи.
- Любой вопрос, для ответа на который нужны личные данные приложения, ОБЯЗАТЕЛЬНО делегируй клиентскому backend: деньги, доходы, расходы, операции, категории, аналитика, баланс, Копилка, регулярные платежи, План, дни рождения, встречи, события, календарь мужа, рабочие и личные записи жены, клиенты, свободное время, даты и семейные факты.
- Никогда не угадывай семейные данные и суммы. Если факт относится к приложению — делегируй.
- После получения результата делегирования сообщи его пользователю естественной речью, сохраняя числа, даты и факты точно.
- Общие разговорные вопросы, не требующие данных семьи, можешь отвечать самостоятельно.
- Если пользователь уточняет предыдущий вопрос о семейных данных, снова делегируй, чтобы backend учёл актуальный контекст.
- Отвечай компактно, если пользователь не просит подробностей.`;

  const openai=await fetch('https://api.openai.com/v1/live/sessions',{
    method:'POST',
    headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      session:{
        model:'gpt-live-1',
        audio:{output:{voice}},
        delegation:{type:'client'},
        instructions,
        store:false
      },
      transport:{type:'webrtc',sdp}
    })
  });
  const text=await openai.text();
  let payload:any={};
  try{payload=text?JSON.parse(text):{}}catch{payload={}}
  if(!openai.ok){
    console.error('OpenAI Live session failed',openai.status,payload?.error?.message||text.slice(0,500));
    return json({ok:false,error:'LIVE_SESSION_FAILED',message:payload?.error?.message||'Не удалось создать Live-сессию.'},502);
  }
  return json({ok:true,...payload,voice});
});