import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY=Deno.env.get('OPENAI_API_KEY')||'';
const TTS_MODEL=Deno.env.get('OPENAI_TREASURER_TTS_MODEL')||'gpt-4o-mini-tts';

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

const VOICES:Record<string,{label:string,group:'male'|'female',style:string}>={
  cedar:{label:'Кедр',group:'male',style:'спокойным взрослым мужским голосом, уверенно и доброжелательно'},
  onyx:{label:'Оникс',group:'male',style:'глубоким взрослым мужским голосом, сдержанно и уверенно'},
  echo:{label:'Эхо',group:'male',style:'ровным взрослым мужским голосом, нейтрально и спокойно'},
  marin:{label:'Марин',group:'female',style:'естественным взрослым женским голосом, мягко и уверенно'},
  nova:{label:'Нова',group:'female',style:'светлым взрослым женским голосом, живо, но без спешки'},
  shimmer:{label:'Шиммер',group:'female',style:'мягким взрослым женским голосом, спокойно и доброжелательно'}
};

const PREVIEW_TEXT='Здравствуйте. Я Казначей вашей семьи. Готов помочь разобраться в доходах, расходах и накоплениях.';

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{
  status,
  headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}
});

function safeVoice(value:string){
  return VOICES[value]?value:'cedar';
}

function bytesToBase64(bytes:Uint8Array){
  let binary='';const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  }
  return btoa(binary);
}

async function synthesize(text:string,voice:string){
  const config=VOICES[voice]||VOICES.cedar;
  const response=await fetch('https://api.openai.com/v1/audio/speech',{
    method:'POST',
    headers:{Authorization:`Bearer ${OPENAI_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      model:TTS_MODEL,
      voice,
      input:text.slice(0,3500),
      instructions:`Говори по-русски ${config.style}. Денежные суммы произноси естественно. Тенге произноси как «тенге», символ ₸ не проговаривай как буквы.`,
      response_format:'mp3',
      speed:0.96
    })
  });
  if(!response.ok){
    console.error('OpenAI speech failed',response.status,(await response.text()).slice(0,500));
    throw new Error(`TTS_${response.status}`);
  }
  const bytes=new Uint8Array(await response.arrayBuffer());
  return{audio_base64:bytesToBase64(bytes),audio_mime:'audio/mpeg'};
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  if(!OPENAI_API_KEY)return json({ok:false,error:'OPENAI_NOT_CONFIGURED',message:'OpenAI API key is not configured.'},503);

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

  const purpose=body?.purpose==='preview'?'preview':'answer';
  const voice=safeVoice(String(body?.voice||'cedar'));
  const text=purpose==='preview'?PREVIEW_TEXT:String(body?.text||'').trim();
  if(!text)return json({ok:false,error:'TEXT_REQUIRED'},400);
  if(text.length>3500)return json({ok:false,error:'TEXT_TOO_LONG'},413);

  try{
    const speech=await synthesize(text,voice);
    return json({ok:true,voice,voice_label:VOICES[voice].label,purpose,...speech});
  }catch(error){
    console.error('Treasurer speech failed',error);
    return json({ok:false,error:'TTS_FAILED',message:'Озвучивание Казначея временно недоступно.'},502);
  }
});
