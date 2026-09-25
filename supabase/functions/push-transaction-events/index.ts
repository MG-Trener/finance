import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_ENV=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||'';
const MAX_EVENT_AGE_MS=15*60*1000;
const FAMILY_MESSAGE_LIMIT=200;
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});
const money=(value:unknown)=>`${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(Number(value||0))} ₸`;
const typeLabel=(type:unknown)=>String(type)==='income'?'Доход':String(type)==='transfer'?'Перевод':'Расход';
const BALANCE_MILESTONES=[
  {amount:100000,title:'Ничего себе! Почти +100500!!!'},
  {amount:200000,title:'А может в копилку отложим?'},
  {amount:300000,title:'Оу, оу, а что происходит?'},
  {amount:400000,title:'Шубу купишь?'},
  {amount:500000,title:'Пора открывать банк развития'},
  {amount:600000,title:'Казначей просит ещё один сундук'},
  {amount:700000,title:'Так… а где мы будем всё это хранить?'},
  {amount:800000,title:'Кажется, деньги начали размножаться'},
  {amount:900000,title:'Миллион уже стучится в ворота'},
  {amount:1000000,title:'Прикинь... МУЛЛЬООООН!!!'}
] as const;
const balanceNumber=(value:unknown)=>{
  const n=Number(value);
  return Number.isFinite(n)?n:null;
};
function crossedMilestone(before:number,after:number){
  let hit:(typeof BALANCE_MILESTONES)[number]|null=null;
  for(const item of BALANCE_MILESTONES)if(before<item.amount&&after>=item.amount)hit=item;
  return hit;
}

function b64url(input:Uint8Array|string){
  const bytes=typeof input==='string'?new TextEncoder().encode(input):input;
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return btoa(binary).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}
function pemBytes(pem:string){
  const normalized=pem.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const raw=atob(normalized),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
async function googleAccessToken(service:any){
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64url(JSON.stringify({iss:service.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:service.token_uri||'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const unsigned=`${header}.${claims}`;
  const key=await crypto.subtle.importKey('pkcs8',pemBytes(service.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
  const assertion=`${unsigned}.${b64url(signature)}`;
  const response=await fetch(service.token_uri||'https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
  const payload=await response.json();
  if(!response.ok||!payload.access_token)throw new Error(`FCM OAuth: ${payload.error_description||payload.error||response.status}`);
  return payload.access_token as string;
}
async function firebaseService(admin:any){
  let raw=FCM_ENV;
  if(!raw){
    const {data,error}=await admin.rpc('get_firebase_service_account_json');
    if(!error&&data)raw=String(data);
  }
  if(!raw)return null;
  let service:any;
  try{service=JSON.parse(raw)}catch{throw new Error('INVALID_FIREBASE_SERVICE_ACCOUNT')}
  if(!service.project_id||!service.client_email||!service.private_key)throw new Error('INCOMPLETE_FIREBASE_SERVICE_ACCOUNT');
  return service;
}
async function sendToToken(service:any,accessToken:string,token:string,notification:{title:string,body:string},data:Record<string,string>){
  const payload={message:{token,notification,data,android:{priority:'high',notification:{channel_id:'finance_operations',sound:'default'}}}};
  return await fetch(`https://fcm.googleapis.com/v1/projects/${service.project_id}/messages:send`,{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
}
async function messageMeta(admin:any,event:any){
  const current=event.after_data||event.before_data||{},before=event.before_data||{};
  const [{data:actor},{data:person},{data:category},{data:subcategory}]=await Promise.all([
    event.actor_user_id?admin.from('people').select('display_name,label').eq('family_id',event.family_id).eq('linked_user_id',event.actor_user_id).maybeSingle():Promise.resolve({data:null}),
    current.person_id?admin.from('people').select('display_name,label').eq('id',current.person_id).maybeSingle():Promise.resolve({data:null}),
    current.category_id?admin.from('categories').select('name').eq('id',current.category_id).maybeSingle():Promise.resolve({data:null}),
    current.subcategory_id?admin.from('subcategories').select('name').eq('id',current.subcategory_id).maybeSingle():Promise.resolve({data:null})
  ]);
  const actorName=actor?.display_name||'Участник семьи';
  const personName=person?.display_name||(person?.label==='husband'?'Муж':person?.label==='wife'?'Жена':'');
  const categoryName=category?.name||'Без категории';
  const subcategoryName=subcategory?.name||'';
  const operation=typeLabel(current.type);
  const balanceBefore=balanceNumber(current._family_balance_before);
  const balanceAfter=balanceNumber(current._family_balance_after);
  const insertBody=current.type==='transfer'
    ?[personName||actorName,money(current.amount)].filter(Boolean).join(' · ')
    :[personName||actorName,money(current.amount),categoryName,subcategoryName].filter(Boolean).join(' · ');

  let title='Изменение в семейной казне';
  let body=[actorName,categoryName,personName].filter(Boolean).join(' · ');
  if(event.event_type==='insert'){
    body=insertBody;
    if(current.type==='expense'){
      title=balanceBefore!==null&&balanceBefore<0?'Казна опустела, но подданные продолжают тратить':'Расход казны...';
    }else if(current.type==='income'){
      title=balanceBefore!==null&&balanceAfter!==null&&balanceBefore<=0&&balanceAfter>0?'Вау, казна снова в плюсе':'Пополнение казны';
    }else{
      title=`Перевод ${money(current.amount)}`;
    }
  }else if(event.event_type==='delete')title=`Удалён ${operation.toLowerCase()} ${money(current.amount)}`;
  else if(event.event_type==='restore')title=`Восстановлен ${operation.toLowerCase()} ${money(current.amount)}`;
  else if(Number(before.amount||0)!==Number(current.amount||0))title=`${operation}: ${money(before.amount)} → ${money(current.amount)}`;
  else title=`Изменён ${operation.toLowerCase()} ${money(current.amount)}`;

  const messages:Array<{title:string,body:string,kind:string,milestone?:string}>=[{title,body,kind:'transaction'}];
  if(event.event_type==='insert'&&current.type==='income'&&balanceBefore!==null&&balanceAfter!==null){
    const milestone=crossedMilestone(balanceBefore,balanceAfter);
    if(milestone)messages.push({
      title:milestone.title,
      body:`Баланс казны: ${money(balanceAfter)} · ${insertBody}`,
      kind:'balance_milestone',
      milestone:String(milestone.amount)
    });
  }
  return{messages};
}

async function sendFamilyMessage(admin:any,user:any,familyIds:string[],message:string){
  const normalized=message.trim();
  if(!normalized)return json({ok:false,error:'MESSAGE_REQUIRED'},400);
  if(Array.from(normalized).length>FAMILY_MESSAGE_LIMIT)return json({ok:false,error:'MESSAGE_TOO_LONG',limit:FAMILY_MESSAGE_LIMIT},400);
  const familyId=familyIds[0];
  if(!familyId)return json({ok:false,error:'NO_FAMILY_ACCESS'},403);

  const [{data:actor},{data:devices,error:deviceError}]=await Promise.all([
    admin.from('people').select('display_name').eq('family_id',familyId).eq('linked_user_id',user.id).maybeSingle(),
    admin.from('push_devices').select('id,token,user_id').eq('family_id',familyId).eq('enabled',true)
  ]);
  if(deviceError)return json({ok:false,error:deviceError.message},500);
  const recipients=(devices||[]).filter((device:any)=>device.user_id!==user.id);
  if(!recipients.length)return json({ok:false,error:'NO_RECIPIENT_DEVICE',sent:0});

  let service:any;
  try{service=await firebaseService(admin)}catch(error){return json({ok:false,error:String(error)});}
  if(!service)return json({ok:false,error:'FIREBASE_NOT_CONFIGURED',sent:0});
  let accessToken='';
  try{accessToken=await googleAccessToken(service)}catch(error){return json({ok:false,error:String(error)});}

  const title=`Сообщение от ${actor?.display_name||'супруга'}`;
  let sent=0,failed=0;
  const errors:string[]=[];
  for(const device of recipients){
    const response=await sendToToken(service,accessToken,device.token,{title,body:normalized},{kind:'family_message',family_id:String(familyId),sender_user_id:String(user.id)});
    if(response.ok){sent++;continue}
    failed++;
    const text=await response.text();errors.push(text.slice(0,500));
    if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(text))await admin.from('push_devices').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',device.id);
  }
  if(!sent)return json({ok:false,error:'FCM_SEND_FAILED',sent,failed,detail:errors.join('\n').slice(0,1000)});
  return json({ok:true,kind:'family_message',sent,failed});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);

  let body:any={};
  try{body=await req.json()}catch{body={}}
  const auth=req.headers.get('Authorization')||'';
  const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({error:'UNAUTHORIZED'},401);

  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:memberships,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id);
  if(membershipError)return json({error:membershipError.message},500);
  const familyIds=[...new Set((memberships||[]).map((x:any)=>String(x.family_id)))];
  if(!familyIds.length)return json({ok:true,sent:0,pending:0});

  if(String(body?.action||'')==='family_message')return await sendFamilyMessage(admin,user,familyIds,String(body?.message||''));

  const nowIso=new Date().toISOString(),cutoffIso=new Date(Date.now()-MAX_EVENT_AGE_MS).toISOString();
  await admin.from('push_outbox').update({delivered_at:nowIso,delivery_status:'expired',delivery_error:null}).in('family_id',familyIds).is('delivered_at',null).lt('created_at',cutoffIso);
  const {data:events,error:eventError}=await admin.from('push_outbox').select('*').in('family_id',familyIds).is('delivered_at',null).order('created_at',{ascending:true}).limit(30);
  if(eventError)return json({error:eventError.message},500);
  if(!events?.length){
    let configured=false;try{configured=Boolean(await firebaseService(admin))}catch(_){configured=false}
    return json({ok:true,sent:0,pending:0,configured});
  }

  let service:any;
  try{service=await firebaseService(admin)}catch(error){return json({error:String(error)},500)}
  if(!service)return json({ok:false,configured:false,pending:events.length,error:'FIREBASE_NOT_CONFIGURED'},503);
  let accessToken='';
  try{accessToken=await googleAccessToken(service)}catch(error){return json({error:String(error)},502)}

  let sent=0,failed=0;
  for(const event of events){
    const {data:devices,error:deviceError}=await admin.from('push_devices').select('id,token,user_id').eq('family_id',event.family_id).eq('enabled',true);
    if(deviceError){failed++;continue}
    const recipients=(devices||[]).filter((d:any)=>!event.actor_user_id||d.user_id!==event.actor_user_id);
    if(!recipients.length){
      await admin.from('push_outbox').update({delivered_at:new Date().toISOString(),delivery_status:'no_recipient',attempts:Number(event.attempts||0)+1,delivery_error:null}).eq('id',event.id);
      continue;
    }
    const meta=await messageMeta(admin,event);
    let successfulDeliveries=0;
    const expectedDeliveries=recipients.length*meta.messages.length;
    const errors:string[]=[];
    for(const device of recipients){
      for(const message of meta.messages){
        const data:Record<string,string>={
          kind:message.kind,
          event_type:String(event.event_type),
          transaction_id:String(event.transaction_id),
          family_id:String(event.family_id)
        };
        if(message.milestone)data.milestone=message.milestone;
        const response=await sendToToken(service,accessToken,device.token,{title:message.title,body:message.body},data);
        if(response.ok){successfulDeliveries++;sent++;continue}
        failed++;
        const responseText=await response.text();errors.push(responseText.slice(0,500));
        if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(responseText)){
          await admin.from('push_devices').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',device.id);
          break;
        }
      }
    }
    if(successfulDeliveries>0){
      await admin.from('push_outbox').update({
        delivered_at:new Date().toISOString(),
        delivery_status:successfulDeliveries===expectedDeliveries?'sent':'partial',
        attempts:Number(event.attempts||0)+1,
        delivery_error:errors.join('\n').slice(0,1500)||null
      }).eq('id',event.id);
    }else{
      const attempts=Number(event.attempts||0)+1;
      await admin.from('push_outbox').update({
        attempts,
        delivery_status:'failed',
        delivery_error:errors.join('\n').slice(0,1500)||'FCM_SEND_FAILED',
        ...(attempts>=5?{delivered_at:new Date().toISOString()}: {})
      }).eq('id',event.id);
    }
  }
  return json({ok:true,configured:true,sent,failed,processed:events.length});
});
