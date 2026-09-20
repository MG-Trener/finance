import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_ENV=Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON')||'';
const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type, x-planned-expense-cron',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json'}});

function localDate(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function dateParts(value:string){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match?{year:Number(match[1]),month:Number(match[2]),day:Number(match[3])}:null;
}
function daysBetween(from:string,to:string){
  const a=dateParts(from),b=dateParts(to);
  if(!a||!b)return Number.NaN;
  return Math.round((Date.UTC(b.year,b.month-1,b.day)-Date.UTC(a.year,a.month-1,a.day))/86400000);
}
function fallbackDueDate(row:any,today:string){
  const current=dateParts(today);if(!current)return today;
  const preferred=Math.max(1,Math.min(31,Number(row?.day_of_month)||1));
  const last=new Date(Date.UTC(current.year,current.month,0)).getUTCDate();
  return `${current.year}-${String(current.month).padStart(2,'0')}-${String(Math.min(preferred,last)).padStart(2,'0')}`;
}
function rublelessMoney(value:unknown){return `${new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(value)||0)} ₸`}
function ruDate(value:string){
  const p=dateParts(value);if(!p)return value;
  return new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(Date.UTC(p.year,p.month-1,p.day,12)));
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
  const supplied=req.headers.get('x-planned-expense-cron')||'';
  const {data:secretRow,error:secretError}=await admin.from('internal_scheduler_secrets').select('secret_value').eq('key','planned_expense_push_cron').maybeSingle();
  if(secretError||!secretRow?.secret_value||supplied!==secretRow.secret_value)return json({ok:false,error:'UNAUTHORIZED'},401);

  const today=localDate();
  const {data:rows,error:recurringError}=await admin.from('recurring_payments')
    .select('id,family_id,person_id,type,amount,description,day_of_month,frequency,next_due_date,reminder_days,active')
    .eq('type','expense')
    .eq('active',true);
  if(recurringError)return json({ok:false,error:recurringError.message},500);

  const dueRows=(rows||[]).map((row:any)=>{
    const dueDate=String(row.next_due_date||fallbackDueDate(row,today)).slice(0,10);
    const days=daysBetween(today,dueDate);
    const reminderDays=Math.max(0,Math.min(60,Number(row.reminder_days??3)));
    return{...row,dueDate,days,reminderDays};
  }).filter((row:any)=>Number.isFinite(row.days)&&row.days<=row.reminderDays);
  if(!dueRows.length)return json({ok:true,date:today,eligible:0,sent:0,skipped:0,failed:0});

  let service:any;try{service=await firebaseService(admin)}catch(error){return json({ok:false,error:String(error)},500)}
  if(!service)return json({ok:false,error:'FIREBASE_NOT_CONFIGURED'},503);
  let accessToken='';try{accessToken=await googleAccessToken(service)}catch(error){return json({ok:false,error:String(error)},502)}

  const personIds=[...new Set(dueRows.map((row:any)=>String(row.person_id)).filter(Boolean))];
  const personUser=new Map<string,string>();
  if(personIds.length){
    const {data:people}=await admin.from('people').select('id,linked_user_id').in('id',personIds);
    for(const person of people||[]){if(person.linked_user_id)personUser.set(String(person.id),String(person.linked_user_id))}
  }

  const familyIds=[...new Set(dueRows.map((row:any)=>String(row.family_id)).filter(Boolean))];
  const {data:devices,error:deviceError}=await admin.from('push_devices').select('id,family_id,user_id,token').in('family_id',familyIds).eq('enabled',true);
  if(deviceError)return json({ok:false,error:deviceError.message},500);
  const devicesByFamily=new Map<string,any[]>();
  for(const device of devices||[]){const key=String(device.family_id),list=devicesByFamily.get(key)||[];list.push(device);devicesByFamily.set(key,list)}

  let sent=0,skipped=0,failed=0;
  for(const row of dueRows){
    const {data:already}=await admin.from('planned_expense_push_deliveries')
      .select('recurring_payment_id')
      .eq('recurring_payment_id',row.id)
      .eq('due_date',row.dueDate)
      .eq('occurrence_date',today)
      .maybeSingle();
    if(already){skipped++;continue}

    const assignedUser=personUser.get(String(row.person_id))||'';
    const familyDevices=devicesByFamily.get(String(row.family_id))||[];
    const recipients=assignedUser?familyDevices.filter((device:any)=>String(device.user_id)===assignedUser):familyDevices;
    if(!recipients.length){skipped++;continue}

    const label=String(row.description||'Плановый расход').trim()||'Плановый расход';
    const title=row.days<0?'⚠️ Плановый расход просрочен':row.days===0?'💳 Сегодня плановый расход':'⏰ Скоро плановый расход';
    const timing=row.days<0?`Просрочено на ${Math.abs(row.days)} дн.`:row.days===0?'Срок сегодня':row.days===1?'Срок завтра':`Срок через ${row.days} дн.`;
    const body=`${label} · ${rublelessMoney(row.amount)} · ${timing} (${ruDate(row.dueDate)})`;
    let rowSent=0;
    for(const device of recipients){
      const response=await sendToToken(service,accessToken,device.token,title,body,{kind:'planned_expense',recurring_id:String(row.id),due_date:row.dueDate,date:today,family_id:String(row.family_id)});
      if(response.ok){rowSent++;sent++;continue}
      failed++;const text=await response.text();if(response.status===404||/UNREGISTERED|registration-token-not-registered/i.test(text))await admin.from('push_devices').update({enabled:false,updated_at:new Date().toISOString()}).eq('id',device.id);
    }
    if(rowSent>0){
      await admin.from('planned_expense_push_deliveries').insert({recurring_payment_id:row.id,family_id:row.family_id,due_date:row.dueDate,occurrence_date:today,sent_devices:rowSent});
    }
  }

  return json({ok:true,date:today,eligible:dueRows.length,sent,skipped,failed});
});
