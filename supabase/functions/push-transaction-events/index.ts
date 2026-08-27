import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_JSON=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||'';
const MAX_EVENT_AGE_MS=15*60*1000;

const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Connection':'keep-alive'}});
const money=(value:unknown)=>`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(value||0))} ₸`;
const typeLabel=(type:unknown)=>String(type)==='income'?'Доход':'Расход';

function b64url(input:Uint8Array|string){const bytes=typeof input==='string'?new TextEncoder().encode(input):input;let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}
function pemBytes(pem:string){const normalized=pem.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');const raw=atob(normalized);const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
async function googleAccessToken(service:any){
  const now=Math.floor(Date.now()/1000),header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'})),claims=b64url(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:service.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600})),unsigned=`${header}.${claims}`;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(service.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))),assertion=`${unsigned}.${b64url(signature)}`;
  const response=await fetch(service.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const payload=await response.json();if(!response.ok||!payload.access_token)throw new Error(`FCM OAuth: ${payload.error_description||payload.error||response.status}`);return payload.access_token as string;
}

async function messageMeta(admin:any,event:any){
  const current=event.after_data||event.before_data||{},before=event.before_data||{};
  const [{data:actor},{data:person},{data:category}]=await Promise.all([
    event.actor_user_id?admin.from('people').select('display_name,label').eq('family_id',event.family_id).eq('linked_user_id',event.actor_user_id).maybeSingle():Promise.resolve({data:null}),
    current.person_id?admin.from('people').select('display_name,label').eq('id',current.person_id).maybeSingle():Promise.resolve({data:null}),
    current.category_id?admin.from('categories').select('name').eq('id',current.category_id).maybeSingle():Promise.resolve({data:null})
  ]);
  const actorName=actor?.display_name||'Участник семьи',personName=person?.display_name||(person?.label==='husband'?'Муж':person?.label==='wife'?'Жена':''),categoryName=category?.name||'Без категории',operation=typeLabel(current.type);
  let title='Изменение в семейной казне';
  if(event.event_type==='insert')title=`${operation} ${money(current.amount)}`;
  else if(event.event_type==='delete')title=`Удалён ${operation.toLowerCase()} ${money(current.amount)}`;
  else if(event.event_type==='restore')title=`Восстановлен ${operation.toLowerCase()} ${money(current.amount)}`;
  else if(Number(before.amount||0)!==Number(current.amount||0))title=`${operation}: ${money(before.amount)} → ${money(current.amount)}`;
  else title=`Изменён ${operation.toLowerCase()} ${money(current.amount)}`;
  return{title,body:[actorName,categoryName,personName].filter(Boolean).join(' · ')};
}

Deno.serve(async(req:Request)=>{
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  const auth=req.headers.get('Authorization')||'',userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();if(userError||!user)return json({error:'UNAUTHORIZED'},401);
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:memberships,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id);if(membershipError)return json({error:membershipError.message},500);
  const familyIds=[...new Set((memberships||[]).map((x:any)=>x.family_id))];if(!familyIds.length)return json({ok:true,sent:0,pending:0});

  const nowIso=new Date().toISOString(),cutoffIso=new Date(Date.now()-MAX_EVENT_AGE_MS).toISOString();
  await admin.from('push_outbox').update({delivered_at:nowIso,delivery_status:'expired',delivery_error:null}).in('family_id',familyIds).is('delivered_at',null).lt('created_at',cutoffIso);

  const {data:events,error:eventError}=await admin.from('push_outbox').select('*').in('family_id',familyIds).is('delivered_at',null).order('created_at',{ascending:true}).limit(30);if(eventError)return json({error:eventError.message},500);
  if(!events?.length)return json({ok:true,sent:0,pending:0,configured:Boolean(FCM_JSON)});if(!FCM_JSON)return json({ok:false,configured:false,pending:events.length,error:'FIREBASE_NOT_CONFIGURED'},503);
  let service:any;try{service=JSON.parse(FCM_JSON)}catch{return json({error:'INVALID_FIREBASE_SERVICE_ACCOUNT'},500)}
  if(!service.project_id||!service.client_email||!service.private_key)return json({error:'INCOMPLETE_FIREBASE_SERVICE_ACCOUNT'},500);
  let accessToken='';try{accessToken=await googleAccessToken(service)}catch(error){return json({error:String(error)},502)}
  let sent=0,failed=0;
  for(const event of events){
    const {data:devices,error:deviceError}=await admin.from('push_devices').select('id,token,user_id').eq('family_id',event.family_id).eq('enabled',true);if(deviceError){failed++;continue}
    const recipients=(devices||[]).filter((d:any)=>!event.actor_user_id||d.user_id!==event.actor_user_id);
    if(!recipients.length){await admin.from('push_outbox').update({delivered_at:new Date().toISOString(),delivery_status:'no_recipient',attempts:Number(event.attempts||0)+1,delivery_error:null}).eq('id',event.id);continue}
    const meta=await messageMeta(admin,event);let eventSuccess=0;const errors:string[]=[];
    for(const device of recipients){
      const payload={message:{token:device.token,notification:{title:meta.title,body:meta.body},data:{kind:'transaction',event_type:String(event.event_type),transaction_id:String(event.transaction_id),family_id:String(event.family_id)},android:{priority:'high',notification:{channel_id:'finance_operations',sound:'default'}}}};
      const response=await fetch(`https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(response.ok){eventSuccess++;sent++;continue}failed++;const text=await response.text();errors.push(text.slice(0,500));if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(text))await admin.from('push_devices').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',device.id);
    }
    if(eventSuccess>0)await admin.from('push_outbox').update({delivered_at:new Date().toISOString(),delivery_status:eventSuccess===recipients.length?'sent':'partial',attempts:Number(event.attempts||0)+1,delivery_error:errors.join('\n').slice(0,1500)||null}).eq('id',event.id);
    else{const attempts=Number(event.attempts||0)+1;await admin.from('push_outbox').update({attempts,delivery_status:'failed',delivery_error:errors.join('\n').slice(0,1500)||'FCM_SEND_FAILED',...(attempts>=5?{delivered_at:new Date().toISOString()}: {})}).eq('id',event.id)}
  }
  return json({ok:true,configured:true,sent,failed,processed:events.length});
});
