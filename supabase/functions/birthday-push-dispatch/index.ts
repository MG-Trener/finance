import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_ENV=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||'';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, x-birthday-cron','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});

function localDate(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function b64url(input:Uint8Array|string){const bytes=typeof input==='string'?new TextEncoder().encode(input):input;let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function pemBytes(pem:string){const normalized=pem.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');const raw=atob(normalized),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
async function googleAccessToken(service:any){
  const now=Math.floor(Date.now()/1000),header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})),claims=b64url(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:service.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})),unsigned=`${header}.${claims}`;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(service.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const response=await fetch(service.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${b64url(signature)}`})});
  const payload=await response.json();if(!response.ok||!payload.access_token)throw new Error(`FCM OAuth: ${payload.error_description||payload.error||response.status}`);return payload.access_token as string;
}
async function firebaseService(admin:any){
  let raw=FCM_ENV;if(!raw){const {data,error}=await admin.rpc('get_firebase_service_account_json');if(!error&&data)raw=String(data)}
  if(!raw)return null;const service=JSON.parse(raw);if(!service.project_id||!service.client_email||!service.private_key)throw new Error('INCOMPLETE_FIREBASE_SERVICE_ACCOUNT');return service;
}
async function sendToToken(service:any,accessToken:string,token:string,title:string,body:string,data:Record<string,string>){
  return fetch(`https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token,notification:{title,body},data,android:{priority:'high',notification:{channel_id:'finance_operations',sound:'default'}}}})});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const supplied=req.headers.get('x-birthday-cron')||'';
  const {data:secretRow,error:secretError}=await admin.from('internal_scheduler_secrets').select('secret_value').eq('key','birthday_push_cron').maybeSingle();
  if(secretError||!secretRow?.secret_value||supplied!==secretRow.secret_value)return json({ok:false,error:'UNAUTHORIZED'},401);

  const today=localDate();
  const {data:events,error:eventError}=await admin.from('calendar_entries').select('id,family_id,title').eq('calendar_context','plan').eq('kind','event').eq('event_type','birthday').eq('entry_date',today).order('created_at',{ascending:true});
  if(eventError)return json({ok:false,error:eventError.message},500);
  if(!events?.length)return json({ok:true,date:today,families:0,sent:0});

  let service:any;try{service=await firebaseService(admin)}catch(error){return json({ok:false,error:String(error)},500)}
  if(!service)return json({ok:false,error:'FIREBASE_NOT_CONFIGURED'},503);
  let accessToken='';try{accessToken=await googleAccessToken(service)}catch(error){return json({ok:false,error:String(error)},502)}

  const grouped=new Map<string,any[]>();
  for(const event of events){const key=String(event.family_id);const list=grouped.get(key)||[];list.push(event);grouped.set(key,list)}
  let sent=0,skipped=0,failed=0;
  for(const [familyId,items] of grouped){
    const {data:already}=await admin.from('birthday_push_deliveries').select('family_id').eq('family_id',familyId).eq('occurrence_date',today).maybeSingle();
    if(already){skipped++;continue}
    const {data:devices,error:deviceError}=await admin.from('push_devices').select('id,token').eq('family_id',familyId).eq('enabled',true);
    if(deviceError||!devices?.length){skipped++;continue}
    const titles=items.map(item=>String(item.title||'День рождения')).filter(Boolean);
    const body=titles.length===1?titles[0]:`Сегодня: ${titles.join(' · ')}`;
    let familySent=0;
    for(const device of devices){
      const response=await sendToToken(service,accessToken,device.token,'🎂 День рождения сегодня',body,{kind:'birthday',date:today,family_id:familyId});
      if(response.ok){familySent++;sent++;continue}
      failed++;const text=await response.text();if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(text))await admin.from('push_devices').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',device.id);
    }
    if(familySent>0){await admin.from('birthday_push_deliveries').insert({family_id:familyId,occurrence_date:today,event_ids:items.map(item=>item.id),sent_devices:familySent});}
  }
  return json({ok:true,date:today,families:grouped.size,sent,failed,skipped});
});